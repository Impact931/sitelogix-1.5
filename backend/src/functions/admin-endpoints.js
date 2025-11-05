/**
 * Admin Endpoints Handler
 * Provides authentication, employee management, project management, and time tracking endpoints
 *
 * Architecture:
 * - JWT-based authentication with refresh tokens
 * - Role-based access control (RBAC)
 * - DynamoDB for data persistence
 * - Rate limiting per user
 *
 * @module admin-endpoints
 */

const jwt = require('jsonwebtoken');
const { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, QueryCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Cache for secrets and JWT keys
const secretsCache = {};

// In-memory rate limiting (for production, use Redis or DynamoDB)
const rateLimitStore = new Map();

/**
 * Get secret from AWS Secrets Manager with caching
 */
async function getSecret(secretName) {
  if (secretsCache[secretName]) {
    return secretsCache[secretName];
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsClient.send(command);
    const secret = JSON.parse(response.SecretString);
    secretsCache[secretName] = secret;
    return secret;
  } catch (error) {
    console.error(`Error retrieving secret ${secretName}:`, error);
    throw error;
  }
}

/**
 * Get JWT secret from Secrets Manager
 */
async function getJWTSecret() {
  const secret = await getSecret('sitelogix/jwt');
  return secret.secret_key || 'default-dev-secret-change-in-production';
}

/**
 * Rate limiting middleware
 * Limits requests to 100 per minute per user
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 100;

  if (!rateLimitStore.has(userId)) {
    rateLimitStore.set(userId, []);
  }

  const userRequests = rateLimitStore.get(userId);

  // Remove requests outside current window
  const validRequests = userRequests.filter(timestamp => now - timestamp < windowMs);

  if (validRequests.length >= maxRequests) {
    const oldestRequest = Math.min(...validRequests);
    const resetTime = Math.ceil((oldestRequest + windowMs - now) / 1000);

    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetTime
    };
  }

  validRequests.push(now);
  rateLimitStore.set(userId, validRequests);

  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - validRequests.length,
    resetTime: Math.ceil(windowMs / 1000)
  };
}

/**
 * Verify JWT token and extract user information
 */
async function verifyToken(token) {
  try {
    const jwtSecret = await getJWTSecret();
    const decoded = jwt.verify(token, jwtSecret);

    // Check if token is expired
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Generate JWT token
 */
async function generateToken(user, expiresIn = '1h') {
  const jwtSecret = await getJWTSecret();

  const payload = {
    userId: user.userId,
    username: user.username,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, jwtSecret, { expiresIn });
}

/**
 * Generate refresh token
 */
async function generateRefreshToken(userId) {
  const jwtSecret = await getJWTSecret();

  const payload = {
    userId,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, jwtSecret, { expiresIn: '7d' });
}

/**
 * Hash password using SHA256
 */
function hashPassword(password, salt) {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

/**
 * Check if user has required permission
 */
function hasPermission(user, requiredPermission) {
  if (!user || !user.permissions) return false;

  // Admin has all permissions
  if (user.role === 'admin') return true;

  // Check for wildcard permissions
  if (user.permissions.includes('*') || user.permissions.includes('manage:*')) {
    return true;
  }

  // Check for specific permission
  return user.permissions.includes(requiredPermission);
}

/**
 * Check if user can access resource (for own records)
 */
function canAccessResource(user, resourceUserId) {
  return user.role === 'admin' || user.role === 'manager' || user.userId === resourceUserId;
}

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/login
 * Login with username/passcode and return JWT token
 */
async function handleLogin(body) {
  try {
    const { username, passcode } = body;

    if (!username || !passcode) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Username and passcode are required',
          code: 'VALIDATION_ERROR'
        }
      };
    }

    // Get user from DynamoDB
    const getUserCommand = new GetItemCommand({
      TableName: 'sitelogix-users',
      Key: {
        PK: { S: `USER#${username}` },
        SK: { S: 'METADATA' }
      }
    });

    const userResult = await dynamoClient.send(getUserCommand);

    if (!userResult.Item) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: 'Invalid credentials',
          code: 'AUTH_FAILED'
        }
      };
    }

    const user = unmarshall(userResult.Item);

    // Verify passcode
    const hashedPasscode = hashPassword(passcode, user.salt);

    if (hashedPasscode !== user.passcodeHash) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: 'Invalid credentials',
          code: 'AUTH_FAILED'
        }
      };
    }

    // Check if user is active
    if (user.status !== 'active') {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Account is inactive',
          code: 'ACCOUNT_INACTIVE'
        }
      };
    }

    // Generate tokens
    const token = await generateToken(user);
    const refreshToken = await generateRefreshToken(user.userId);

    // Update last login timestamp
    const updateCommand = new UpdateItemCommand({
      TableName: 'sitelogix-users',
      Key: {
        PK: { S: `USER#${username}` },
        SK: { S: 'METADATA' }
      },
      UpdateExpression: 'SET lastLogin = :lastLogin',
      ExpressionAttributeValues: {
        ':lastLogin': { S: new Date().toISOString() }
      }
    });

    await dynamoClient.send(updateCommand);

    return {
      statusCode: 200,
      body: {
        success: true,
        token,
        refreshToken,
        expiresIn: 3600,
        user: {
          userId: user.userId,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          permissions: user.permissions
        }
      }
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

/**
 * POST /api/auth/logout
 * Invalidate session (token blacklisting would be implemented here)
 */
async function handleLogout(body, user) {
  try {
    // In production, add token to blacklist in DynamoDB or Redis
    // For now, just return success

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Successfully logged out'
      }
    };
  } catch (error) {
    console.error('Logout error:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

/**
 * POST /api/auth/refresh
 * Refresh JWT token using refresh token
 */
async function handleRefreshToken(body) {
  try {
    const { refreshToken } = body;

    if (!refreshToken) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Refresh token is required',
          code: 'VALIDATION_ERROR'
        }
      };
    }

    // Verify refresh token
    const jwtSecret = await getJWTSecret();
    const decoded = jwt.verify(refreshToken, jwtSecret);

    if (decoded.type !== 'refresh') {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: 'Invalid refresh token',
          code: 'TOKEN_INVALID'
        }
      };
    }

    // Get user data
    const getUserCommand = new QueryCommand({
      TableName: 'sitelogix-users',
      IndexName: 'GSI1-UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': { S: decoded.userId }
      },
      Limit: 1
    });

    const userResult = await dynamoClient.send(getUserCommand);

    if (!userResult.Items || userResult.Items.length === 0) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: 'User not found',
          code: 'AUTH_FAILED'
        }
      };
    }

    const user = unmarshall(userResult.Items[0]);

    // Generate new tokens
    const newToken = await generateToken(user);
    const newRefreshToken = await generateRefreshToken(user.userId);

    return {
      statusCode: 200,
      body: {
        success: true,
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600
      }
    };
  } catch (error) {
    console.error('Refresh token error:', error);

    if (error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: 'Refresh token expired',
          code: 'TOKEN_EXPIRED'
        }
      };
    }

    return {
      statusCode: 401,
      body: {
        success: false,
        error: 'Invalid refresh token',
        code: 'TOKEN_INVALID'
      }
    };
  }
}

/**
 * GET /api/auth/me
 * Get current user information
 */
async function handleGetCurrentUser(user) {
  try {
    // Get full user details from database
    const getUserCommand = new GetItemCommand({
      TableName: 'sitelogix-users',
      Key: {
        PK: { S: `USER#${user.username}` },
        SK: { S: 'METADATA' }
      }
    });

    const userResult = await dynamoClient.send(getUserCommand);

    if (!userResult.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'User not found',
          code: 'NOT_FOUND'
        }
      };
    }

    const userData = unmarshall(userResult.Item);

    // Remove sensitive fields
    delete userData.passcodeHash;
    delete userData.salt;

    return {
      statusCode: 200,
      body: {
        success: true,
        user: {
          userId: userData.userId,
          username: userData.username,
          email: userData.email,
          fullName: userData.fullName,
          role: userData.role,
          projectAssignments: userData.projectAssignments || [],
          permissions: userData.permissions || [],
          lastLogin: userData.lastLogin,
          createdAt: userData.createdAt
        }
      }
    };
  } catch (error) {
    console.error('Get current user error:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

// ============================================================================
// EMPLOYEE MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/employees
 * List all employees with filtering
 */
async function handleListEmployees(queryParams, user) {
  try {
    // Check permissions
    if (!hasPermission(user, 'read:employees') && user.role !== 'manager') {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        }
      };
    }

    const { projectId, role, status, search, limit = 50, offset = 0 } = queryParams;

    let command;
    let items = [];

    // Build query based on filters
    if (projectId) {
      // Query by project assignment (using GSI)
      command = new QueryCommand({
        TableName: 'sitelogix-personnel',
        IndexName: 'GSI1-ProjectIndex',
        KeyConditionExpression: 'project_id = :projectId',
        ExpressionAttributeValues: marshall({
          ':projectId': projectId
        })
      });
    } else if (status) {
      // Query by status (using GSI)
      command = new QueryCommand({
        TableName: 'sitelogix-personnel',
        IndexName: 'GSI2-StatusIndex',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: marshall({
          ':status': status
        })
      });
    } else {
      // Scan all personnel
      command = new ScanCommand({
        TableName: 'sitelogix-personnel',
        Limit: parseInt(limit)
      });
    }

    const result = await dynamoClient.send(command);
    items = result.Items.map(item => unmarshall(item));

    // Apply additional filters
    if (role) {
      items = items.filter(emp => emp.role === role);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(emp =>
        emp.full_name?.toLowerCase().includes(searchLower) ||
        emp.email?.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination
    const paginatedItems = items.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    // Transform to API format
    const employees = paginatedItems.map(emp => ({
      employeeId: emp.personnel_id,
      fullName: emp.full_name,
      goByName: emp.go_by_name || emp.full_name,
      email: emp.email,
      phone: emp.phone,
      role: emp.role,
      status: emp.status,
      hourlyRate: emp.hourly_rate,
      projectAssignments: emp.project_assignments || [],
      dateHired: emp.date_hired,
      lastActive: emp.updated_at
    }));

    return {
      statusCode: 200,
      body: {
        success: true,
        employees,
        pagination: {
          total: items.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: items.length > (parseInt(offset) + parseInt(limit))
        }
      }
    };
  } catch (error) {
    console.error('List employees error:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

/**
 * GET /api/employees/:id
 * Get specific employee details
 */
async function handleGetEmployee(employeeId, user) {
  try {
    // Check permissions
    if (!canAccessResource(user, employeeId)) {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        }
      };
    }

    const command = new GetItemCommand({
      TableName: 'sitelogix-personnel',
      Key: {
        PK: { S: `PERSONNEL#${employeeId}` },
        SK: { S: 'METADATA' }
      }
    });

    const result = await dynamoClient.send(command);

    if (!result.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Employee not found',
          employeeId
        }
      };
    }

    const emp = unmarshall(result.Item);

    return {
      statusCode: 200,
      body: {
        success: true,
        employee: {
          employeeId: emp.personnel_id,
          fullName: emp.full_name,
          goByName: emp.go_by_name || emp.full_name,
          email: emp.email,
          phone: emp.phone,
          emergencyContact: emp.emergency_contact,
          role: emp.role,
          status: emp.status,
          hourlyRate: emp.hourly_rate,
          overtimeRate: emp.overtime_rate || emp.hourly_rate * 1.5,
          projectAssignments: emp.project_assignments || [],
          skills: emp.skills || [],
          certifications: emp.certifications || [],
          dateHired: emp.date_hired,
          lastActive: emp.updated_at,
          totalHoursWorked: emp.total_hours_worked || 0,
          averageHoursPerWeek: emp.average_hours_per_week || 0,
          createdAt: emp.created_at,
          updatedAt: emp.updated_at
        }
      }
    };
  } catch (error) {
    console.error('Get employee error:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

/**
 * POST /api/employees
 * Create new employee
 */
async function handleCreateEmployee(body, user) {
  try {
    // Check permissions
    if (!hasPermission(user, 'create:employees')) {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        }
      };
    }

    const { fullName, email, phone, role, hourlyRate } = body;

    // Validation
    if (!fullName || !email || !role || !hourlyRate) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Validation failed',
          details: [
            { field: 'fullName', message: 'Full name is required' },
            { field: 'email', message: 'Email is required' },
            { field: 'role', message: 'Role is required' },
            { field: 'hourlyRate', message: 'Hourly rate is required' }
          ].filter(d => !body[d.field])
        }
      };
    }

    const employeeId = uuidv4();
    const timestamp = new Date().toISOString();

    const employee = {
      PK: `PERSONNEL#${employeeId}`,
      SK: 'METADATA',
      personnel_id: employeeId,
      full_name: fullName,
      go_by_name: body.goByName || fullName,
      email,
      phone,
      emergency_contact: body.emergencyContact,
      role,
      status: 'active',
      hourly_rate: parseFloat(hourlyRate),
      overtime_rate: parseFloat(hourlyRate) * 1.5,
      project_assignments: body.projectAssignments || [],
      skills: body.skills || [],
      certifications: body.certifications || [],
      date_hired: body.dateHired || timestamp.split('T')[0],
      created_at: timestamp,
      updated_at: timestamp
    };

    const command = new PutItemCommand({
      TableName: 'sitelogix-personnel',
      Item: marshall(employee)
    });

    await dynamoClient.send(command);

    return {
      statusCode: 201,
      body: {
        success: true,
        employee: {
          employeeId,
          fullName,
          goByName: employee.go_by_name,
          email,
          phone,
          role,
          status: 'active',
          hourlyRate: employee.hourly_rate,
          createdAt: timestamp
        }
      }
    };
  } catch (error) {
    console.error('Create employee error:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

/**
 * PUT /api/employees/:id
 * Update employee information
 */
async function handleUpdateEmployee(employeeId, body, user) {
  try {
    // Check permissions
    if (!hasPermission(user, 'update:employees')) {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        }
      };
    }

    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    const allowedFields = ['phone', 'email', 'role', 'hourlyRate', 'status', 'projectAssignments', 'skills', 'goByName'];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateExpressions.push(`#${dbField} = :${dbField}`);
        expressionAttributeNames[`#${dbField}`] = dbField;
        expressionAttributeValues[`:${dbField}`] = marshall({ value: body[field] }).value;
      }
    });

    // Always update timestamp
    updateExpressions.push('#updated_at = :updated_at');
    expressionAttributeNames['#updated_at'] = 'updated_at';
    expressionAttributeValues[':updated_at'] = { S: new Date().toISOString() };

    const command = new UpdateItemCommand({
      TableName: 'sitelogix-personnel',
      Key: {
        PK: { S: `PERSONNEL#${employeeId}` },
        SK: { S: 'METADATA' }
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });

    const result = await dynamoClient.send(command);
    const updated = unmarshall(result.Attributes);

    return {
      statusCode: 200,
      body: {
        success: true,
        employee: {
          employeeId,
          fullName: updated.full_name,
          phone: updated.phone,
          hourlyRate: updated.hourly_rate,
          role: updated.role,
          updatedAt: updated.updated_at
        }
      }
    };
  } catch (error) {
    console.error('Update employee error:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

/**
 * DELETE /api/employees/:id
 * Soft delete employee
 */
async function handleDeleteEmployee(employeeId, queryParams, user) {
  try {
    // Check permissions
    if (!hasPermission(user, 'delete:employees')) {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        }
      };
    }

    const hardDelete = queryParams.hardDelete === 'true';
    const timestamp = new Date().toISOString();

    if (hardDelete && user.role === 'admin') {
      // Permanent deletion
      const command = new DeleteItemCommand({
        TableName: 'sitelogix-personnel',
        Key: {
          PK: { S: `PERSONNEL#${employeeId}` },
          SK: { S: 'METADATA' }
        }
      });

      await dynamoClient.send(command);

      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'Employee permanently deleted',
          employeeId
        }
      };
    } else {
      // Soft delete - set status to terminated
      const command = new UpdateItemCommand({
        TableName: 'sitelogix-personnel',
        Key: {
          PK: { S: `PERSONNEL#${employeeId}` },
          SK: { S: 'METADATA' }
        },
        UpdateExpression: 'SET #status = :status, terminated_at = :terminated_at, termination_reason = :reason',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: marshall({
          ':status': 'terminated',
          ':terminated_at': timestamp,
          ':reason': queryParams.reason || 'Not specified'
        })
      });

      await dynamoClient.send(command);

      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'Employee terminated successfully',
          employeeId,
          terminatedAt: timestamp
        }
      };
    }
  } catch (error) {
    console.error('Delete employee error:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Authentication
  handleLogin,
  handleLogout,
  handleRefreshToken,
  handleGetCurrentUser,

  // Employee Management
  handleListEmployees,
  handleGetEmployee,
  handleCreateEmployee,
  handleUpdateEmployee,
  handleDeleteEmployee,

  // Utilities
  verifyToken,
  checkRateLimit,
  hasPermission,
  canAccessResource
};
