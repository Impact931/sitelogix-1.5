# Migration Guide: Custom JWT to AWS Cognito Authentication

This guide helps you migrate from the legacy custom JWT authentication (admin-endpoints.js) to AWS Cognito authentication.

## Quick Reference

### What Changed

| Aspect | Old (Custom JWT) | New (AWS Cognito) |
|--------|------------------|-------------------|
| Authentication | Custom JWT with bcrypt | AWS Cognito User Pool |
| Token Storage | DynamoDB (sitelogix-users) | Cognito User Pool |
| Token Type | Single JWT token | AccessToken + IDToken + RefreshToken |
| Password Management | Manual bcrypt hashing | Cognito managed |
| User Attributes | DynamoDB columns | Cognito attributes + custom attributes |
| Groups/Roles | Permission arrays | Cognito Groups |
| Token Verification | jsonwebtoken library | aws-jwt-verify |
| Token Expiry | 1 hour (configurable) | 1 hour access, 7 day refresh |

### API Changes

#### Login Endpoint

**Old Request:**
```json
POST /api/auth/login
{
  "username": "user123",
  "passcode": "mypassword"
}
```

**Old Response:**
```json
{
  "success": true,
  "accessToken": "jwt.token.here",
  "refreshToken": "refresh.token.here",
  "expiresIn": 3600,
  "user": {
    "userId": "PER#PKW01",
    "username": "user123",
    "email": "user@example.com",
    "role": "employee",
    "permissions": ["read:projects"]
  }
}
```

**New Request (supports both formats):**
```json
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "mypassword"
}
// OR (backwards compatible)
{
  "username": "user@example.com",
  "passcode": "mypassword"
}
```

**New Response:**
```json
{
  "success": true,
  "accessToken": "cognito.access.token",
  "idToken": "cognito.id.token",
  "refreshToken": "cognito.refresh.token",
  "expiresIn": 3600,
  "user": {
    "userId": "cognito-uuid",
    "email": "user@example.com",
    "emailVerified": true,
    "personId": "PER#PKW01",
    "employeeNumber": "E12345",
    "firstName": "John",
    "lastName": "Doe",
    "nickName": "Johnny",
    "role": "employee",
    "groups": ["employee"],
    "username": "user@example.com",
    "tokenIssued": "2025-01-15T10:00:00Z",
    "tokenExpires": "2025-01-15T11:00:00Z"
  }
}
```

## Migration Steps

### Step 1: Prepare Cognito User Pool

1. **Create custom attributes** in your Cognito User Pool:
   ```
   custom:personId (String, mutable)
   custom:employeeNumber (String, mutable)
   custom:firstName (String, mutable)
   custom:lastName (String, mutable)
   custom:nickName (String, mutable)
   custom:role (String, mutable)
   ```

2. **Create user groups**:
   ```
   employee
   manager
   admin
   superadmin
   ```

3. **Configure app client**:
   - Enable USER_PASSWORD_AUTH flow
   - Set token expiration (1 hour for access, 7 days for refresh)
   - Configure attribute read/write permissions

### Step 2: Migrate Users from DynamoDB to Cognito

Create a migration script to transfer users:

```javascript
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { createCognitoUser } = require('./cognito-user-management');

async function migrateUsers() {
  const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });

  // Scan sitelogix-personnel table
  const scanCommand = new ScanCommand({
    TableName: 'sitelogix-personnel',
    FilterExpression: 'SK = :profile',
    ExpressionAttributeValues: {
      ':profile': { S: 'PROFILE' }
    }
  });

  const result = await dynamoClient.send(scanCommand);
  const users = result.Items.map(item => unmarshall(item));

  for (const user of users) {
    console.log(`Migrating user: ${user.email}`);

    try {
      const result = await createCognitoUser({
        email: user.email,
        password: 'TempPassword123!', // Temporary password
        firstName: user.firstName,
        lastName: user.lastName,
        personId: user.personId,
        employeeNumber: user.employeeNumber,
        nickName: user.nickName,
        role: user.role,
        emailVerified: true,
        sendEmail: true // Send welcome email
      });

      if (result.success) {
        console.log(`✓ Migrated: ${user.email}`);
      } else {
        console.error(`✗ Failed: ${user.email} - ${result.error}`);
      }
    } catch (error) {
      console.error(`✗ Error migrating ${user.email}:`, error.message);
    }

    // Rate limiting - wait 100ms between users
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('Migration complete!');
}

// Run migration
migrateUsers().catch(console.error);
```

### Step 3: Update Frontend Authentication Code

#### Old Frontend Code:
```javascript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'user123',
    passcode: 'mypassword'
  })
});

const data = await response.json();
localStorage.setItem('token', data.accessToken);
localStorage.setItem('refreshToken', data.refreshToken);

// Make authenticated request
const response = await fetch('/api/projects', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});
```

#### New Frontend Code:
```javascript
// Login (backwards compatible)
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com', // Changed from username
    password: 'mypassword'     // Changed from passcode
  })
});

const data = await response.json();
localStorage.setItem('accessToken', data.accessToken);   // More specific name
localStorage.setItem('idToken', data.idToken);           // Store ID token
localStorage.setItem('refreshToken', data.refreshToken);
localStorage.setItem('user', JSON.stringify(data.user)); // Store user info

// Make authenticated request (same as before)
const response = await fetch('/api/projects', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});

// Handle token expiry
if (response.status === 401) {
  // Token expired, refresh it
  const refreshResponse = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refreshToken: localStorage.getItem('refreshToken')
    })
  });

  const refreshData = await refreshResponse.json();
  if (refreshData.success) {
    localStorage.setItem('accessToken', refreshData.accessToken);
    localStorage.setItem('idToken', refreshData.idToken);
    // Retry original request
  } else {
    // Refresh failed, redirect to login
    window.location.href = '/login';
  }
}
```

### Step 4: Update User Object References

Update code that accesses user properties:

**Old:**
```javascript
const userId = user.userId;           // Was personId from DynamoDB
const role = user.role;
const permissions = user.permissions; // Array of permission strings
```

**New:**
```javascript
const cognitoUserId = user.userId;    // Cognito UUID
const personId = user.personId;       // Link to DynamoDB personnel record
const role = user.role;               // Still available in custom attributes
const groups = user.groups;           // Cognito groups (replaces permissions)

// To link to DynamoDB personnel data, use personId:
const personnel = await getPersonnelByPersonId(user.personId);
```

### Step 5: Update Permission Checks

**Old permission checking:**
```javascript
function hasPermission(user, requiredPermission) {
  if (user.role === 'admin') return true;
  return user.permissions.includes(requiredPermission);
}

// Usage
if (hasPermission(user, 'delete:employees')) {
  // Allow action
}
```

**New permission checking (using Cognito groups):**
```javascript
function hasPermission(user, requiredGroup) {
  // Check if user is in required group
  return user.groups?.includes(requiredGroup) ||
         user.groups?.includes('admin') ||
         user.groups?.includes('superadmin');
}

// Usage
if (hasPermission(user, 'manager')) {
  // Allow action
}

// Or check role directly
if (user.role === 'admin' || user.role === 'manager') {
  // Allow action
}
```

### Step 6: Update Password Operations

**Old password change:**
```javascript
POST /api/auth/change-password
{
  "currentPassword": "oldpass",
  "newPassword": "newpass"
}
```

**New password change (same, but different implementation):**
```javascript
POST /api/auth/change-password
Headers: { "Authorization": "Bearer {accessToken}" }
{
  "currentPassword": "oldpass",
  "newPassword": "newpass"
}
```

**Old password reset (admin):**
```javascript
POST /api/auth/reset-password
Headers: { "Authorization": "Bearer {adminToken}" }
{
  "userId": "user-id",
  "newPassword": "newpass"
}
```

**New password reset:**
```javascript
POST /api/auth/reset-password
{
  "email": "user@example.com"
}
// Sends password reset email to user
```

### Step 7: Testing

1. **Test login with migrated users**
   - Users should receive temporary password via email
   - First login may require password change

2. **Test token refresh**
   - Verify refresh token works before access token expires
   - Test expired token handling

3. **Test permission checks**
   - Verify role-based access control works
   - Test group membership

4. **Test password operations**
   - Change password
   - Reset password
   - Temporary password flow

## Rollback Plan

If you need to rollback to the old authentication:

1. **Keep admin-endpoints.js**: Don't delete the old authentication code
2. **Comment out Cognito imports**: In api-handler.js, comment out Cognito imports
3. **Restore old endpoint handlers**: Uncomment old auth endpoint handlers
4. **Redeploy**: Deploy the rollback version

## Dual-Mode Operation (Optional)

You can run both authentication systems simultaneously during migration:

```javascript
// In api-handler.js
if (path.endsWith('/auth/login') && method === 'POST') {
  const { email, username } = body;

  // Try Cognito first
  if (email) {
    const cognitoResult = await handleCognitoLogin(email, body.password);
    if (cognitoResult.success) {
      return { statusCode: 200, headers, body: JSON.stringify(cognitoResult) };
    }
  }

  // Fall back to legacy JWT
  if (username) {
    const legacyResult = await handleLogin(body);
    return { statusCode: legacyResult.statusCode, headers, body: JSON.stringify(legacyResult.body) };
  }
}
```

## Common Issues

### Issue: User can't login after migration

**Cause**: Temporary password not set or expired

**Solution**:
```javascript
const { resetPassword } = require('./cognito-user-management');
await resetPassword('user@example.com');
// User will receive new temporary password via email
```

### Issue: Missing custom attributes

**Cause**: Custom attributes not configured in User Pool

**Solution**: Add custom attributes in AWS Console → Cognito → User Pool → Attributes

### Issue: Token verification fails

**Cause**: Using wrong token type

**Solution**: Verify you're using `accessToken`, not `idToken` for API calls

### Issue: Groups not appearing in token

**Cause**: User not added to groups

**Solution**:
```javascript
const { addUserToGroup } = require('./cognito-user-management');
await addUserToGroup('user@example.com', 'employee');
```

## Support

For migration assistance, contact the development team or refer to:
- COGNITO_SETUP.md - Full documentation
- cognito-auth.test.js - Testing examples
- AWS Cognito documentation

## Cleanup (After Successful Migration)

Once migration is complete and tested:

1. Archive old authentication code
2. Remove legacy JWT dependencies (jsonwebtoken, bcryptjs)
3. Clean up sitelogix-users table (optional, keep for backup)
4. Update documentation
5. Train team on new authentication flow
