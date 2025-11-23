# AWS Cognito Authentication Setup

This document provides setup instructions and documentation for the AWS Cognito authentication system in SiteLogix backend.

## Overview

The SiteLogix backend now uses AWS Cognito for user authentication instead of custom JWT tokens. This provides:

- Secure, industry-standard authentication
- Built-in password policies and security features
- Multi-factor authentication (MFA) support
- User groups for role-based access control
- Token refresh and session management
- Email verification and password reset flows

## Configuration

### Cognito User Pool Details

- **User Pool ID**: `us-east-1_tPkj4vb3A`
- **Client ID**: `7rsb6cnpp86cdgtv3h9j6c8t75`
- **Client Secret**: `vofaujel798h2iu5decko25cqa0ndubp3hnvdbvdtcjinge2v8i`
- **Region**: `us-east-1`

### Required Custom Attributes

The following custom attributes should be configured in your Cognito User Pool:

1. **custom:personId** (String) - Links to DynamoDB personnel table (e.g., "PER#PKW01")
2. **custom:employeeNumber** (String) - Employee identification number
3. **custom:firstName** (String) - User's first name
4. **custom:lastName** (String) - User's last name
5. **custom:nickName** (String) - Preferred name
6. **custom:role** (String) - User role (employee, manager, admin, superadmin)

### User Groups (Roles)

Create the following groups in Cognito for role-based access control:

- **employee** - Standard employees
- **manager** - Project managers
- **admin** - System administrators
- **superadmin** - Super administrators

## Files

### 1. cognito-auth.js (511 lines)

Main authentication handler with core functions:

#### Functions:

- **handleCognitoLogin(email, password)** - Sign in user
  - Returns: `{ success, user, accessToken, idToken, refreshToken, expiresIn }`
  - Errors: AUTH_FAILED, USER_NOT_CONFIRMED, PASSWORD_RESET_REQUIRED, etc.

- **handleCognitoRefresh(refreshToken)** - Refresh access token
  - Returns: `{ success, user, accessToken, idToken, expiresIn }`
  - Errors: TOKEN_EXPIRED, REFRESH_FAILED

- **handleCognitoLogout(accessToken)** - Sign out user globally
  - Returns: `{ success, message }`
  - Errors: UNAUTHORIZED, LOGOUT_FAILED

- **verifyCognitoToken(token, tokenType)** - Verify JWT token
  - Parameters: token (string), tokenType ('access' or 'id')
  - Returns: `{ success, user, payload }`
  - Errors: TOKEN_EXPIRED, INVALID_TOKEN, VERIFICATION_FAILED

- **getCurrentUser(accessToken)** - Get user info from access token
  - Returns: `{ success, user }`
  - Errors: UNAUTHORIZED

### 2. cognito-user-management.js (832 lines)

User CRUD operations (admin functions):

#### Functions:

- **createCognitoUser(userData)** - Create new user
  - Parameters: `{ email, password, firstName, lastName, personId, employeeNumber, nickName, role, ... }`
  - Returns: `{ success, user, temporaryPassword? }`
  - Errors: USER_EXISTS, INVALID_PASSWORD, INVALID_PARAMETERS

- **updateCognitoUser(userId, updates)** - Update user attributes
  - Returns: `{ success, message, userId }`
  - Errors: USER_NOT_FOUND

- **addUserToGroup(userId, groupName)** - Add user to role group
  - Returns: `{ success, message, userId, groupName }`
  - Errors: USER_NOT_FOUND, GROUP_NOT_FOUND

- **removeUserFromGroup(userId, groupName)** - Remove from group
  - Returns: `{ success, message }`

- **resetPassword(email)** - Trigger password reset email
  - Returns: `{ success, message, email }`
  - Errors: USER_NOT_FOUND, RATE_LIMIT_EXCEEDED

- **changePassword(accessToken, oldPassword, newPassword)** - Change password
  - Returns: `{ success, message }`
  - Errors: INVALID_PASSWORD, RATE_LIMIT_EXCEEDED

- **getCognitoUser(userId)** - Get user details
  - Returns: `{ success, user }`
  - Errors: USER_NOT_FOUND

- **enableUser(userId)** - Enable disabled user account
- **disableUser(userId)** - Disable user account (prevents login)
- **deleteCognitoUser(userId)** - Permanently delete user
- **listCognitoUsers(options)** - List all users with pagination

### 3. api-handler.js (Updated)

Updated API endpoints to use Cognito authentication:

#### Auth Endpoints:

- `POST /api/auth/login` - User login
  - Body: `{ email, password }` or `{ username, passcode }` (backwards compatible)
  - Returns: `{ success, user, accessToken, idToken, refreshToken, expiresIn }`

- `POST /api/auth/logout` - User logout
  - Headers: `Authorization: Bearer {accessToken}`
  - Returns: `{ success, message }`

- `POST /api/auth/refresh` - Refresh access token
  - Body: `{ refreshToken }`
  - Returns: `{ success, user, accessToken, idToken, expiresIn }`

- `GET /api/auth/me` - Get current user info
  - Headers: `Authorization: Bearer {accessToken}`
  - Returns: `{ success, user }`

- `POST /api/auth/change-password` - Change password
  - Headers: `Authorization: Bearer {accessToken}`
  - Body: `{ currentPassword, newPassword }`
  - Returns: `{ success, message }`

- `POST /api/auth/reset-password` - Request password reset
  - Body: `{ email }`
  - Returns: `{ success, message, email }`

- `POST /api/auth/register` - Create new user (admin only)
  - Headers: `Authorization: Bearer {accessToken}`
  - Body: User data with custom attributes
  - Returns: `{ success, user }`

## User Object Structure

When a user successfully authenticates, the returned user object contains:

```javascript
{
  userId: 'cognito-sub-uuid',           // Cognito user ID
  email: 'user@example.com',
  emailVerified: true,
  username: 'user@example.com',

  // Custom attributes
  personId: 'PER#PKW01',                // Links to DynamoDB
  employeeNumber: 'E12345',
  firstName: 'John',
  lastName: 'Doe',
  nickName: 'Johnny',
  role: 'employee',

  // Groups (for RBAC)
  groups: ['employee', 'manager'],

  // Token metadata
  tokenIssued: '2025-01-15T10:30:00Z',
  tokenExpires: '2025-01-15T11:30:00Z'
}
```

## Authentication Flow

### 1. Login Flow

```
Client → POST /api/auth/login { email, password }
  ↓
cognito-auth.handleCognitoLogin()
  ↓
AWS Cognito User Pool
  ↓
Response: { accessToken, idToken, refreshToken, user }
```

### 2. Protected Route Flow

```
Client → GET /api/protected-route
  Headers: Authorization: Bearer {accessToken}
  ↓
verifyCognitoTokenMiddleware(event)
  ↓
cognito-auth.verifyCognitoToken(token)
  ↓
AWS JWT Verifier
  ↓
If valid: Continue with user object
If invalid: Return 401 Unauthorized
```

### 3. Token Refresh Flow

```
Client → POST /api/auth/refresh { refreshToken }
  ↓
cognito-auth.handleCognitoRefresh(refreshToken)
  ↓
AWS Cognito
  ↓
Response: { accessToken, idToken, user }
```

## Migration from Legacy Auth

If you're migrating from the old JWT-based authentication:

### 1. User Migration

You'll need to migrate existing users from DynamoDB to Cognito:

```javascript
const { createCognitoUser } = require('./cognito-user-management');

// For each user in sitelogix-personnel table:
await createCognitoUser({
  email: personnel.email,
  password: 'TemporaryPassword123!', // Users must reset
  firstName: personnel.firstName,
  lastName: personnel.lastName,
  personId: personnel.personId,
  employeeNumber: personnel.employeeNumber,
  nickName: personnel.nickName,
  role: personnel.role,
  emailVerified: true,
  sendEmail: true // Send welcome email with temp password
});
```

### 2. Frontend Changes

Update frontend to use new response format:

**Old format:**
```javascript
{ success: true, token, user }
```

**New format:**
```javascript
{ success: true, accessToken, idToken, refreshToken, expiresIn, user }
```

### 3. Token Storage

Store tokens in frontend:
- `accessToken` - Use for API authentication (1 hour expiry)
- `refreshToken` - Use to get new access token (7 day expiry)
- `idToken` - Contains user claims (optional to store)

## Testing

### Running Tests

```bash
cd /Users/jhrstudio/Documents/GitHub/sitelogix-1.5/backend/src/functions

# Update test configuration in cognito-auth.test.js
# Set TEST_CONFIG with actual test credentials

# Run tests
node cognito-auth.test.js
```

### Manual Testing with cURL

**Login:**
```bash
curl -X POST https://your-api-gateway/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!"
  }'
```

**Get Current User:**
```bash
curl -X GET https://your-api-gateway/api/auth/me \
  -H "Authorization: Bearer {accessToken}"
```

**Refresh Token:**
```bash
curl -X POST https://your-api-gateway/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "{refreshToken}"
  }'
```

## Security Considerations

1. **Client Secret**: The client secret is included in the code. In production, consider:
   - Using a public app client (no secret) for frontend apps
   - Or storing the secret in AWS Secrets Manager

2. **Token Storage**:
   - Store tokens securely in frontend (HttpOnly cookies recommended)
   - Don't expose tokens in URLs or logs
   - Clear tokens on logout

3. **Password Policy**: Configure in Cognito User Pool:
   - Minimum length: 8 characters
   - Require uppercase, lowercase, numbers, symbols
   - Password history and expiration policies

4. **MFA**: Consider enabling Multi-Factor Authentication for admin users

5. **Rate Limiting**: Cognito has built-in rate limiting for authentication attempts

## Troubleshooting

### Common Errors

**NotAuthorizedException**
- Invalid credentials
- User not confirmed
- Solution: Check credentials, verify email confirmation

**UserNotFoundException**
- User doesn't exist
- Solution: Check email spelling, verify user was created

**PasswordResetRequiredException**
- Admin force-reset password
- Solution: User must reset password via forgot password flow

**InvalidPasswordException**
- Password doesn't meet requirements
- Solution: Check password policy in Cognito

**TokenExpiredError**
- Access token expired (1 hour)
- Solution: Use refresh token to get new access token

## Monitoring

Monitor authentication in AWS CloudWatch:

1. Cognito User Pool Metrics
2. Lambda function logs (api-handler)
3. CloudWatch Insights queries for auth failures

## Support

For issues or questions, contact the development team.
