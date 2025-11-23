# AWS Cognito Quick Reference

Quick reference for SiteLogix Cognito authentication.

## Configuration

```javascript
User Pool ID: us-east-1_tPkj4vb3A
Client ID: 7rsb6cnpp86cdgtv3h9j6c8t75
Region: us-east-1
```

## API Endpoints

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| /api/auth/login | POST | No | User login |
| /api/auth/logout | POST | Yes | User logout |
| /api/auth/refresh | POST | No | Refresh token |
| /api/auth/me | GET | Yes | Get current user |
| /api/auth/change-password | POST | Yes | Change password |
| /api/auth/reset-password | POST | No | Reset password |
| /api/auth/register | POST | Admin | Create user |

## Request/Response Examples

### Login
```bash
curl -X POST /api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Pass123!"}'
```

```json
{
  "success": true,
  "accessToken": "eyJ...",
  "idToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 3600,
  "user": {
    "userId": "uuid",
    "email": "user@example.com",
    "personId": "PER#PKW01",
    "role": "employee",
    "groups": ["employee"]
  }
}
```

### Get Current User
```bash
curl -X GET /api/auth/me \
  -H "Authorization: Bearer {accessToken}"
```

### Refresh Token
```bash
curl -X POST /api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"eyJ..."}'
```

### Change Password
```bash
curl -X POST /api/auth/change-password \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"old","newPassword":"new"}'
```

## User Object

```javascript
{
  userId: "cognito-uuid",        // Cognito user ID
  email: "user@example.com",
  emailVerified: true,

  // Custom attributes
  personId: "PER#PKW01",         // DynamoDB link
  employeeNumber: "E12345",
  firstName: "John",
  lastName: "Doe",
  nickName: "Johnny",
  role: "employee",

  // Groups (RBAC)
  groups: ["employee", "manager"],

  // Token info
  username: "user@example.com",
  tokenIssued: "2025-01-15T10:00:00Z",
  tokenExpires: "2025-01-15T11:00:00Z"
}
```

## Function Reference

### cognito-auth.js

```javascript
const {
  handleCognitoLogin,
  handleCognitoRefresh,
  handleCognitoLogout,
  verifyCognitoToken,
  getCurrentUser
} = require('./cognito-auth');

// Login
const result = await handleCognitoLogin('user@example.com', 'password');
// Returns: { success, user, accessToken, idToken, refreshToken, expiresIn }

// Verify token
const verify = await verifyCognitoToken(token, 'access');
// Returns: { success, user, payload }

// Logout
const logout = await handleCognitoLogout(accessToken);
// Returns: { success, message }
```

### cognito-user-management.js

```javascript
const {
  createCognitoUser,
  updateCognitoUser,
  addUserToGroup,
  resetPassword,
  changePassword
} = require('./cognito-user-management');

// Create user
const user = await createCognitoUser({
  email: 'new@example.com',
  password: 'TempPass123!',
  firstName: 'John',
  lastName: 'Doe',
  personId: 'PER#PKW01',
  role: 'employee'
});

// Update user
await updateCognitoUser('user@example.com', {
  firstName: 'Jane',
  role: 'manager'
});

// Add to group
await addUserToGroup('user@example.com', 'manager');

// Reset password
await resetPassword('user@example.com');
```

## Custom Attributes

| Attribute | Type | Purpose |
|-----------|------|---------|
| custom:personId | String | DynamoDB personnel link |
| custom:employeeNumber | String | Employee ID |
| custom:firstName | String | First name |
| custom:lastName | String | Last name |
| custom:nickName | String | Preferred name |
| custom:role | String | User role |

## User Groups

| Group | Description |
|-------|-------------|
| employee | Standard employees |
| manager | Project managers |
| admin | System administrators |
| superadmin | Super administrators |

## Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| AUTH_FAILED | 401 | Invalid credentials |
| UNAUTHORIZED | 401 | No/invalid token |
| TOKEN_EXPIRED | 401 | Token expired |
| VALIDATION_ERROR | 400 | Missing/invalid data |
| USER_EXISTS | 409 | User already exists |
| USER_NOT_FOUND | 404 | User doesn't exist |
| FORBIDDEN | 403 | Insufficient permissions |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |

## Token Expiry

- **Access Token:** 1 hour
- **ID Token:** 1 hour
- **Refresh Token:** 7 days

## Permission Checking

```javascript
// Check role
if (user.role === 'admin' || user.role === 'manager') {
  // Allow action
}

// Check groups
if (user.groups?.includes('admin')) {
  // Allow action
}

// Custom permission function
function hasPermission(user, requiredGroup) {
  return user.groups?.includes(requiredGroup) ||
         user.groups?.includes('admin');
}
```

## Frontend Token Storage

```javascript
// After login
localStorage.setItem('accessToken', result.accessToken);
localStorage.setItem('idToken', result.idToken);
localStorage.setItem('refreshToken', result.refreshToken);
localStorage.setItem('user', JSON.stringify(result.user));

// Make authenticated request
fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});

// Handle token expiry (401)
if (response.status === 401) {
  const refreshResult = await fetch('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({
      refreshToken: localStorage.getItem('refreshToken')
    })
  });
  // Update tokens and retry
}
```

## Common Tasks

### Create test user
```javascript
await createCognitoUser({
  email: 'test@example.com',
  password: 'TestPass123!',
  firstName: 'Test',
  lastName: 'User',
  role: 'employee',
  emailVerified: true
});
```

### Promote user to admin
```javascript
await addUserToGroup('user@example.com', 'admin');
await updateCognitoUser('user@example.com', { role: 'admin' });
```

### Disable user account
```javascript
const { disableUser } = require('./cognito-user-management');
await disableUser('user@example.com');
```

### List all users
```javascript
const { listCognitoUsers } = require('./cognito-user-management');
const result = await listCognitoUsers({ limit: 60 });
console.log(result.users);
```

## Testing

```bash
# Run test suite
cd /Users/jhrstudio/Documents/GitHub/sitelogix-1.5/backend/src/functions
node cognito-auth.test.js
```

## Documentation Files

- **COGNITO_SETUP.md** - Complete setup guide
- **MIGRATION_GUIDE.md** - Migration from custom JWT
- **IMPLEMENTATION_SUMMARY.md** - Implementation details
- **cognito-auth.test.js** - Test examples

## Support

For detailed information:
1. Check COGNITO_SETUP.md for full documentation
2. Check MIGRATION_GUIDE.md for migration help
3. Review cognito-auth.test.js for code examples
4. Contact development team
