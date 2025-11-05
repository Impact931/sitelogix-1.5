# Admin Endpoints Integration Guide

This guide explains how to integrate the new admin, authentication, project, and time tracking endpoints into the existing SiteLogix API handler.

## Overview

Three new handler modules have been created:

1. **admin-endpoints.js** - Authentication and employee management
2. **project-endpoints.js** - Project CRUD and timeline management
3. **time-tracking-endpoints.js** - Time entry logging and retrieval

## Integration Steps

### 1. Install Required Dependencies

Add JWT support to package.json:

```bash
cd backend/src/functions
npm install jsonwebtoken
```

### 2. Create DynamoDB Tables

Create the following new tables or add to existing schema:

#### sitelogix-users Table

```json
{
  "TableName": "sitelogix-users",
  "KeySchema": [
    { "AttributeName": "PK", "KeyType": "HASH" },
    { "AttributeName": "SK", "KeyType": "RANGE" }
  ],
  "AttributeDefinitions": [
    { "AttributeName": "PK", "AttributeType": "S" },
    { "AttributeName": "SK", "AttributeType": "S" },
    { "AttributeName": "userId", "AttributeType": "S" },
    { "AttributeName": "email", "AttributeType": "S" }
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GSI1-UserIdIndex",
      "KeySchema": [
        { "AttributeName": "userId", "KeyType": "HASH" }
      ]
    },
    {
      "IndexName": "GSI2-EmailIndex",
      "KeySchema": [
        { "AttributeName": "email", "KeyType": "HASH" }
      ]
    }
  ]
}
```

#### sitelogix-projects Table

```json
{
  "TableName": "sitelogix-projects",
  "KeySchema": [
    { "AttributeName": "PK", "KeyType": "HASH" },
    { "AttributeName": "SK", "KeyType": "RANGE" }
  ],
  "AttributeDefinitions": [
    { "AttributeName": "PK", "AttributeType": "S" },
    { "AttributeName": "SK", "AttributeType": "S" },
    { "AttributeName": "manager_id", "AttributeType": "S" },
    { "AttributeName": "status", "AttributeType": "S" }
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GSI1-ManagerIndex",
      "KeySchema": [
        { "AttributeName": "manager_id", "KeyType": "HASH" }
      ]
    },
    {
      "IndexName": "GSI2-StatusIndex",
      "KeySchema": [
        { "AttributeName": "status", "KeyType": "HASH" }
      ]
    }
  ]
}
```

#### sitelogix-time-entries Table

```json
{
  "TableName": "sitelogix-time-entries",
  "KeySchema": [
    { "AttributeName": "PK", "KeyType": "HASH" },
    { "AttributeName": "SK", "KeyType": "RANGE" }
  ],
  "AttributeDefinitions": [
    { "AttributeName": "PK", "AttributeType": "S" },
    { "AttributeName": "SK", "AttributeType": "S" },
    { "AttributeName": "employee_id", "AttributeType": "S" },
    { "AttributeName": "project_id", "AttributeType": "S" }
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GSI1-EmployeeIndex",
      "KeySchema": [
        { "AttributeName": "employee_id", "KeyType": "HASH" }
      ]
    },
    {
      "IndexName": "GSI2-ProjectIndex",
      "KeySchema": [
        { "AttributeName": "project_id", "KeyType": "HASH" }
      ]
    }
  ]
}
```

### 3. Create AWS Secrets Manager Secret

Create a secret for JWT signing:

```bash
aws secretsmanager create-secret \
  --name sitelogix/jwt \
  --secret-string '{"secret_key":"YOUR-RANDOM-SECRET-KEY-HERE"}'
```

Generate a strong secret key:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Update api-handler.js

Add imports at the top of `/Users/jhrstudio/Documents/GitHub/sitelogix-1.5/backend/src/functions/api-handler.js`:

```javascript
// Import new endpoint handlers
const {
  handleLogin,
  handleLogout,
  handleRefreshToken,
  handleGetCurrentUser,
  handleListEmployees,
  handleGetEmployee,
  handleCreateEmployee,
  handleUpdateEmployee,
  handleDeleteEmployee,
  verifyToken,
  checkRateLimit,
  hasPermission
} = require('./admin-endpoints');

const {
  handleListProjects,
  handleGetProject,
  handleCreateProject,
  handleUpdateProject,
  handleDeleteProject,
  handleUpdateProjectStatus,
  handleUpdateProjectTimeline
} = require('./project-endpoints');

const {
  handleCreateTimeEntry,
  handleListTimeEntries,
  handleUpdateTimeEntry,
  handleGetEmployeeHours
} = require('./time-tracking-endpoints');
```

### 5. Add Authentication Middleware

Add before the route handling section in `exports.handler`:

```javascript
/**
 * Authentication middleware
 * Extracts and verifies JWT token from Authorization header
 */
async function authenticateRequest(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const user = await verifyToken(token);

    // Check rate limit
    const rateLimit = checkRateLimit(user.userId);

    if (!rateLimit.allowed) {
      return {
        statusCode: 429,
        body: {
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimit.resetTime,
          limit: rateLimit.limit,
          window: 60
        },
        headers: {
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.resetTime)
        }
      };
    }

    return {
      user,
      headers: {
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'X-RateLimit-Reset': String(rateLimit.resetTime)
      }
    };
  } catch (error) {
    return {
      statusCode: 401,
      body: {
        success: false,
        error: 'Invalid or expired token',
        code: 'TOKEN_INVALID'
      }
    };
  }
}
```

### 6. Add Route Handlers

Add these routes in the main handler after the existing routes:

```javascript
// =====================================================================
// AUTHENTICATION ROUTES
// =====================================================================

// POST /api/auth/login
if (path.endsWith('/auth/login') && method === 'POST') {
  const body = JSON.parse(event.body || '{}');
  const result = await handleLogin(body);
  return {
    statusCode: result.statusCode,
    headers,
    body: JSON.stringify(result.body)
  };
}

// POST /api/auth/logout
if (path.endsWith('/auth/logout') && method === 'POST') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const body = JSON.parse(event.body || '{}');
  const result = await handleLogout(body, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// POST /api/auth/refresh
if (path.endsWith('/auth/refresh') && method === 'POST') {
  const body = JSON.parse(event.body || '{}');
  const result = await handleRefreshToken(body);
  return {
    statusCode: result.statusCode,
    headers,
    body: JSON.stringify(result.body)
  };
}

// GET /api/auth/me
if (path.endsWith('/auth/me') && method === 'GET') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const result = await handleGetCurrentUser(auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// =====================================================================
// EMPLOYEE MANAGEMENT ROUTES
// =====================================================================

// GET /api/employees
if (path.endsWith('/employees') && method === 'GET') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const result = await handleListEmployees(event.queryStringParameters || {}, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// POST /api/employees
if (path.endsWith('/employees') && method === 'POST') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const body = JSON.parse(event.body || '{}');
  const result = await handleCreateEmployee(body, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// GET /api/employees/:id
if (path.match(/\/employees\/[^/]+$/) && method === 'GET') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const employeeId = path.split('/').pop();
  const result = await handleGetEmployee(employeeId, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// PUT /api/employees/:id
if (path.match(/\/employees\/[^/]+$/) && method === 'PUT') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const employeeId = path.split('/').pop();
  const body = JSON.parse(event.body || '{}');
  const result = await handleUpdateEmployee(employeeId, body, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// DELETE /api/employees/:id
if (path.match(/\/employees\/[^/]+$/) && method === 'DELETE') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const employeeId = path.split('/').pop();
  const result = await handleDeleteEmployee(employeeId, event.queryStringParameters || {}, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// GET /api/employees/:id/hours
if (path.match(/\/employees\/[^/]+\/hours$/) && method === 'GET') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const pathParts = path.split('/');
  const employeeId = pathParts[pathParts.length - 2];
  const result = await handleGetEmployeeHours(employeeId, event.queryStringParameters || {}, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// =====================================================================
// PROJECT MANAGEMENT ROUTES
// =====================================================================

// GET /api/projects
if (path.endsWith('/projects') && method === 'GET') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const result = await handleListProjects(event.queryStringParameters || {}, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// POST /api/projects
if (path.endsWith('/projects') && method === 'POST') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const body = JSON.parse(event.body || '{}');
  const result = await handleCreateProject(body, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// GET /api/projects/:id
if (path.match(/\/projects\/[^/]+$/) && method === 'GET') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const projectId = path.split('/').pop();
  const result = await handleGetProject(projectId, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// PUT /api/projects/:id
if (path.match(/\/projects\/[^/]+$/) && method === 'PUT') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const projectId = path.split('/').pop();
  const body = JSON.parse(event.body || '{}');
  const result = await handleUpdateProject(projectId, body, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// DELETE /api/projects/:id
if (path.match(/\/projects\/[^/]+$/) && method === 'DELETE') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const projectId = path.split('/').pop();
  const result = await handleDeleteProject(projectId, event.queryStringParameters || {}, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// PUT /api/projects/:id/status
if (path.match(/\/projects\/[^/]+\/status$/) && method === 'PUT') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const pathParts = path.split('/');
  const projectId = pathParts[pathParts.length - 2];
  const body = JSON.parse(event.body || '{}');
  const result = await handleUpdateProjectStatus(projectId, body, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// POST /api/projects/:id/timeline
if (path.match(/\/projects\/[^/]+\/timeline$/) && method === 'POST') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const pathParts = path.split('/');
  const projectId = pathParts[pathParts.length - 2];
  const body = JSON.parse(event.body || '{}');
  const result = await handleUpdateProjectTimeline(projectId, body, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// =====================================================================
// TIME TRACKING ROUTES
// =====================================================================

// POST /api/time-entries
if (path.endsWith('/time-entries') && method === 'POST') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const body = JSON.parse(event.body || '{}');
  const result = await handleCreateTimeEntry(body, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// GET /api/time-entries
if (path.endsWith('/time-entries') && method === 'GET') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const result = await handleListTimeEntries(event.queryStringParameters || {}, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}

// PUT /api/time-entries/:id
if (path.match(/\/time-entries\/[^/]+$/) && method === 'PUT') {
  const auth = await authenticateRequest(event);
  if (auth.statusCode) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  const timeEntryId = path.split('/').pop();
  const body = JSON.parse(event.body || '{}');
  const result = await handleUpdateTimeEntry(timeEntryId, body, auth.user);
  return {
    statusCode: result.statusCode,
    headers: { ...headers, ...auth.headers },
    body: JSON.stringify(result.body)
  };
}
```

## Testing

### 1. Create Test User

Create a test user in DynamoDB:

```javascript
const crypto = require('crypto');

// Generate salt and hash
const salt = crypto.randomBytes(16).toString('hex');
const passcode = '123456';
const passcodeHash = crypto.createHmac('sha256', salt).update(passcode).digest('hex');

// Insert into sitelogix-users table
{
  PK: 'USER#testuser',
  SK: 'METADATA',
  userId: 'usr_001',
  username: 'testuser',
  email: 'test@example.com',
  fullName: 'Test User',
  role: 'admin',
  permissions: ['*'],
  salt: salt,
  passcodeHash: passcodeHash,
  status: 'active',
  createdAt: new Date().toISOString()
}
```

### 2. Test Authentication

```bash
# Login
curl -X POST https://your-api-url/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "passcode": "123456"}'

# Save the token from response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Test authenticated endpoint
curl -X GET https://your-api-url/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Test Endpoints

```bash
# List employees
curl -X GET "https://your-api-url/api/employees?limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Create project
curl -X POST https://your-api-url/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "Test Project",
    "projectCode": "TP-001",
    "startDate": "2025-11-01",
    "estimatedEndDate": "2025-12-31",
    "budget": {"total": 100000}
  }'

# Log time entry
curl -X POST https://your-api-url/api/time-entries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "emp_001",
    "projectId": "proj_001",
    "date": "2025-11-05",
    "hours": 8.5,
    "overtimeHours": 0.5
  }'
```

## Security Considerations

1. **JWT Secret**: Use a strong, randomly generated secret key
2. **HTTPS Only**: All endpoints must use HTTPS in production
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **Token Expiration**: Tokens expire after 1 hour, refresh tokens after 7 days
5. **Password Hashing**: Use strong hashing (SHA256 with salt)
6. **Permission Checks**: Always verify permissions before operations
7. **Input Validation**: Validate all input data
8. **SQL Injection**: Use parameterized queries (DynamoDB marshall)
9. **CORS**: Configure CORS to allow only trusted domains

## Deployment

1. Update Lambda function with new code
2. Create DynamoDB tables
3. Create Secrets Manager secret for JWT
4. Update IAM role to allow Lambda to access new tables and secrets
5. Test all endpoints
6. Update frontend to use new authentication flow

## Monitoring

Monitor these metrics:
- Authentication success/failure rates
- Token refresh rates
- Rate limit violations
- Permission denied errors
- API response times
- Error rates by endpoint

## Support

For issues or questions:
- Email: jayson@impactconsulting931.com
- Review API documentation: `/docs/api/API_ENDPOINTS.md`
