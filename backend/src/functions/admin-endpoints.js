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
const bcrypt = require('bcryptjs');
const { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, QueryCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { v4: uuidv4 } = require('uuid');
const { personnelService } = require('./personnelService');
const { payrollService } = require('./payrollService');

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

    // Get user from personnel table by username (using Scan since no GSI exists)
    // Note: "username" is a reserved word in DynamoDB, so we need ExpressionAttributeNames
    const scanParams = {
      TableName: 'sitelogix-personnel',
      FilterExpression: '#username = :username',
      ExpressionAttributeNames: {
        '#username': 'username'
      },
      ExpressionAttributeValues: marshall({
        ':username': username
      })
    };

    const getUserCommand = new ScanCommand(scanParams);
    const userResult = await dynamoClient.send(getUserCommand);

    if (!userResult.Items || userResult.Items.length === 0) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: 'Invalid credentials',
          code: 'AUTH_FAILED'
        }
      };
    }

    // Filter for PROFILE records (there may be multiple items with same username)
    const profileRecords = userResult.Items.filter(item => {
      const unmarshalled = unmarshall(item);
      return unmarshalled.SK === 'PROFILE';
    });

    if (profileRecords.length === 0) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: 'Invalid credentials',
          code: 'AUTH_FAILED'
        }
      };
    }

    const personnel = unmarshall(profileRecords[0]);

    // Map personnel fields to expected user format
    const user = {
      userId: personnel.personId,
      username: personnel.username,
      email: personnel.email,
      firstName: personnel.firstName,
      lastName: personnel.lastName,
      role: personnel.role,
      permissions: personnel.permissions || [], // Default empty array if not set
      employmentStatus: personnel.employmentStatus,
      passwordHash: personnel.passwordHash
    };

    // Verify password using bcrypt
    const isValidPassword = await bcrypt.compare(passcode, personnel.passwordHash);

    if (!isValidPassword) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: 'Invalid credentials',
          code: 'AUTH_FAILED'
        }
      };
    }

    // Check if employee is active
    if (user.employmentStatus !== 'active') {
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

    // Update last login timestamp in personnel table
    const updateCommand = new UpdateItemCommand({
      TableName: 'sitelogix-personnel',
      Key: marshall({
        PK: personnel.PK,
        SK: personnel.SK
      }),
      UpdateExpression: 'SET lastLogin = :lastLogin',
      ExpressionAttributeValues: marshall({
        ':lastLogin': new Date().toISOString()
      })
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
          firstName: user.firstName,
          lastName: user.lastName,
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

    // Get user data from personnel table (same table used during login)
    const getUserCommand = new GetItemCommand({
      TableName: 'sitelogix-personnel',
      Key: marshall({
        PK: decoded.userId,  // userId is the personId (e.g., "PER#PKW01")
        SK: 'PROFILE'
      })
    });

    const userResult = await dynamoClient.send(getUserCommand);

    if (!userResult.Item) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: 'User not found',
          code: 'AUTH_FAILED'
        }
      };
    }

    const personnel = unmarshall(userResult.Item);

    // Map personnel fields to expected user format (same as login)
    const user = {
      userId: personnel.personId,
      username: personnel.username,
      email: personnel.email,
      firstName: personnel.firstName,
      lastName: personnel.lastName,
      role: personnel.role,
      permissions: personnel.permissions || [],
      employmentStatus: personnel.employmentStatus
    };

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
 * POST /api/auth/register
 * Register a new superadmin user (only works if no users exist)
 */
async function handleRegister(body) {
  try {
    const { username, passcode, email, firstName, lastName } = body;

    // Validation
    if (!username || !passcode || !email || !firstName || !lastName) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'All fields are required (username, passcode, email, firstName, lastName)',
          code: 'VALIDATION_ERROR'
        }
      };
    }

    // Check if any users already exist
    const scanCommand = new ScanCommand({
      TableName: 'sitelogix-users',
      Limit: 1
    });

    const scanResult = await dynamoClient.send(scanCommand);

    if (scanResult.Items && scanResult.Items.length > 0) {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Registration is disabled. Users already exist in the system.',
          code: 'REGISTRATION_DISABLED'
        }
      };
    }

    // Check if username already exists
    const checkUserCommand = new QueryCommand({
      TableName: 'sitelogix-users',
      IndexName: 'UsernameIndex',
      KeyConditionExpression: 'username = :username',
      ExpressionAttributeValues: {
        ':username': { S: username }
      }
    });

    const existingUser = await dynamoClient.send(checkUserCommand);

    if (existingUser.Items && existingUser.Items.length > 0) {
      return {
        statusCode: 409,
        body: {
          success: false,
          error: 'Username already exists',
          code: 'USERNAME_EXISTS'
        }
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(passcode, 12);

    // Create new superadmin user
    const userId = uuidv4();
    const timestamp = new Date().toISOString();

    const newUser = {
      userId,
      username,
      email,
      passwordHash,
      role: 'superadmin',
      firstName,
      lastName,
      phone: '',
      status: 'active',
      permissions: ['*'],
      createdAt: timestamp,
      updatedAt: timestamp,
      lastLogin: null,
      mustChangePassword: false,
      failedLoginAttempts: 0
    };

    const putCommand = new PutItemCommand({
      TableName: 'sitelogix-users',
      Item: marshall(newUser)
    });

    await dynamoClient.send(putCommand);

    console.log('SuperAdmin user created:', username);

    return {
      statusCode: 201,
      body: {
        success: true,
        message: 'SuperAdmin account created successfully',
        user: {
          userId,
          username,
          email,
          role: 'superadmin',
          firstName,
          lastName
        }
      }
    };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error during registration',
        code: 'INTERNAL_ERROR'
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
        userId: { S: user.userId }
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
    delete userData.passwordHash;

    return {
      statusCode: 200,
      body: {
        success: true,
        user: {
          userId: userData.userId,
          username: userData.username,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
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
async function handleListEmployees(event) {
  try {
    // Extract queryParams and user from event
    const queryParams = event.queryStringParameters || {};
    const user = event.user || {}; // May be undefined if no authentication

    // For now, skip permission check since we're not passing authenticated user
    // TODO: Add proper authentication/authorization
    // if (!hasPermission(user, 'read:employees') && user.role !== 'manager') {
    //   return {
    //     statusCode: 403,
    //     body: {
    //       success: false,
    //       error: 'Insufficient permissions',
    //       code: 'PERMISSION_DENIED'
    //     }
    //   };
    // }

    const { projectId, role, status, search, limit = 50, offset = 0 } = queryParams;

    let command;
    let items = [];

    // Query sitelogix-users table (not sitelogix-personnel)
    // This returns ALL user accounts (admins, managers, employees)
    if (status) {
      // Query by status (using GSI)
      command = new QueryCommand({
        TableName: 'sitelogix-users',
        IndexName: 'StatusIndex',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: marshall({
          ':status': status
        })
      });
    } else {
      // Scan all users
      command = new ScanCommand({
        TableName: 'sitelogix-users',
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
        emp.firstName?.toLowerCase().includes(searchLower) ||
        emp.lastName?.toLowerCase().includes(searchLower) ||
        emp.username?.toLowerCase().includes(searchLower) ||
        emp.email?.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination
    const paginatedItems = items.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    // Transform to API format matching User interface in userService.ts
    const employees = paginatedItems.map(emp => ({
      userId: emp.userId,
      username: emp.username,
      email: emp.email,
      firstName: emp.firstName,
      lastName: emp.lastName,
      role: emp.role,
      status: emp.status,
      permissions: emp.permissions || [],
      mustChangePassword: emp.mustChangePassword || false,
      createdAt: emp.createdAt,
      updatedAt: emp.updatedAt
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
    // Log incoming data for debugging
    console.log('Creating employee with data:', {
      firstName: body.firstName,
      lastName: body.lastName,
      username: body.username,
      email: body.email,
      password: body.password ? '[REDACTED]' : undefined,
      role: body.role
    });

    // This endpoint is for creating USER ACCOUNTS (login credentials)
    // Not to be confused with personnel records in sitelogix-personnel table

    // Validate required fields for user account creation
    if (!body.username?.trim()) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Username is required',
          code: 'VALIDATION_ERROR'
        }
      };
    }

    if (!body.firstName?.trim() || !body.lastName?.trim()) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'First name and last name are required',
          code: 'VALIDATION_ERROR',
          details: {
            firstName: body.firstName,
            lastName: body.lastName,
            hasFirstName: !!body.firstName,
            hasLastName: !!body.lastName
          }
        }
      };
    }

    if (!body.email?.trim()) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Email is required',
          code: 'VALIDATION_ERROR'
        }
      };
    }

    if (!body.password || body.password.length < 8) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Password must be at least 8 characters long',
          code: 'VALIDATION_ERROR'
        }
      };
    }

    // Check if username already exists
    const checkUserCommand = new QueryCommand({
      TableName: 'sitelogix-users',
      IndexName: 'UsernameIndex',
      KeyConditionExpression: 'username = :username',
      ExpressionAttributeValues: marshall({
        ':username': body.username
      })
    });

    const existingUser = await dynamoClient.send(checkUserCommand);

    if (existingUser.Items && existingUser.Items.length > 0) {
      return {
        statusCode: 409,
        body: {
          success: false,
          error: 'Username already exists',
          code: 'USERNAME_EXISTS'
        }
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 12);

    // Create new user account in sitelogix-users table
    const userId = uuidv4();
    const timestamp = new Date().toISOString();

    const newUser = {
      userId,
      username: body.username,
      email: body.email,
      passwordHash,
      role: body.role || 'employee',
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone || '',
      status: 'active',
      permissions: body.permissions || [],
      createdAt: timestamp,
      updatedAt: timestamp,
      lastLogin: null,
      mustChangePassword: false,
      failedLoginAttempts: 0
    };

    const putCommand = new PutItemCommand({
      TableName: 'sitelogix-users',
      Item: marshall(newUser)
    });

    await dynamoClient.send(putCommand);

    console.log('User account created:', userId, body.username);

    // Return the created user (without password hash)
    delete newUser.passwordHash;

    return {
      statusCode: 201,
      body: {
        success: true,
        employee: newUser // Called 'employee' to match frontend expectation
      }
    };
  } catch (error) {
    console.error('Create employee error:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message || 'Internal server error',
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

/**
 * POST /api/auth/change-password
 * Allow users to change their own password
 */
async function handleChangePassword(body, user) {
  try {
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Current password and new password are required',
          code: 'VALIDATION_ERROR'
        }
      };
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'New password must be at least 8 characters long',
          code: 'VALIDATION_ERROR'
        }
      };
    }

    // Get current user from DynamoDB
    const getUserCommand = new GetItemCommand({
      TableName: 'sitelogix-users',
      Key: marshall({ userId: user.userId })
    });

    const userResult = await dynamoClient.send(getUserCommand);
    if (!userResult.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        }
      };
    }

    const currentUser = unmarshall(userResult.Item);

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, currentUser.passwordHash);
    if (!isValidPassword) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: 'Current password is incorrect',
          code: 'INVALID_PASSWORD'
        }
      };
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password in DynamoDB
    const updateCommand = new UpdateItemCommand({
      TableName: 'sitelogix-users',
      Key: marshall({ userId: user.userId }),
      UpdateExpression: 'SET passwordHash = :passwordHash, updatedAt = :updatedAt, mustChangePassword = :mustChangePassword',
      ExpressionAttributeValues: marshall({
        ':passwordHash': newPasswordHash,
        ':updatedAt': new Date().toISOString(),
        ':mustChangePassword': false
      })
    });

    await dynamoClient.send(updateCommand);

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Password changed successfully'
      }
    };

  } catch (error) {
    console.error('Error changing password:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Failed to change password',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

/**
 * POST /api/auth/reset-password
 * Allow admins to reset a user's password
 */
async function handleResetPassword(body, user) {
  try {
    const { userId, newPassword } = body;

    // Check if user has admin permissions
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Insufficient permissions to reset passwords',
          code: 'FORBIDDEN'
        }
      };
    }

    if (!userId || !newPassword) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'User ID and new password are required',
          code: 'VALIDATION_ERROR'
        }
      };
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'New password must be at least 8 characters long',
          code: 'VALIDATION_ERROR'
        }
      };
    }

    // Check if target user exists
    const getUserCommand = new GetItemCommand({
      TableName: 'sitelogix-users',
      Key: marshall({ userId })
    });

    const userResult = await dynamoClient.send(getUserCommand);
    if (!userResult.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        }
      };
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password in DynamoDB and require password change on next login
    const updateCommand = new UpdateItemCommand({
      TableName: 'sitelogix-users',
      Key: marshall({ userId }),
      UpdateExpression: 'SET passwordHash = :passwordHash, updatedAt = :updatedAt, mustChangePassword = :mustChangePassword',
      ExpressionAttributeValues: marshall({
        ':passwordHash': newPasswordHash,
        ':updatedAt': new Date().toISOString(),
        ':mustChangePassword': true // User must change password on next login
      })
    });

    await dynamoClient.send(updateCommand);

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Password reset successfully. User will be required to change password on next login.'
      }
    };

  } catch (error) {
    console.error('Error resetting password:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Failed to reset password',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

module.exports = {
  // Authentication
  handleLogin,
  handleLogout,
  handleRefreshToken,
  handleGetCurrentUser,
  handleRegister,
  handleChangePassword,
  handleResetPassword,

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
