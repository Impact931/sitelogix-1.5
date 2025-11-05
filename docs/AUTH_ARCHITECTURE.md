# SiteLogix Authentication & Authorization Architecture

## Overview
This document outlines the complete authentication and authorization system for SiteLogix, implementing JWT-based authentication with role-based access control (RBAC).

## Table of Contents
1. [Authentication Flow](#authentication-flow)
2. [Role Hierarchy](#role-hierarchy)
3. [Permissions Matrix](#permissions-matrix)
4. [JWT Token Structure](#jwt-token-structure)
5. [Session Management](#session-management)
6. [Security Requirements](#security-requirements)
7. [Implementation Guide](#implementation-guide)

---

## Authentication Flow

### 1. Login Process
```
User Input (email/password)
    ↓
Frontend validation
    ↓
POST /api/auth/login
    ↓
Lambda: Verify credentials
    ↓
Generate JWT token
    ↓
Return tokens (access + refresh)
    ↓
Store in httpOnly cookies + localStorage (metadata only)
    ↓
Redirect to dashboard
```

### 2. Protected Route Access
```
User navigates to protected route
    ↓
Frontend checks token validity
    ↓
If expired → Attempt refresh
    ↓
API request with Authorization header
    ↓
API Gateway: Validate JWT
    ↓
Lambda Authorizer: Check permissions
    ↓
Grant/Deny access
```

### 3. Token Refresh Flow
```
Access token expires (15 min)
    ↓
Frontend detects 401 response
    ↓
POST /api/auth/refresh with refresh token
    ↓
Validate refresh token
    ↓
Generate new access token
    ↓
Update client tokens
    ↓
Retry original request
```

---

## Role Hierarchy

### Role Levels (in order of access)

#### 1. Super Admin
**Users:** Robert Trask, Jayson Rivas
**Access Level:** Complete system control
**Characteristics:**
- Cannot be deleted or downgraded by others
- Can manage all users and roles
- Access to all data across all projects
- Can modify system settings

#### 2. Manager
**Access Level:** Team and project management
**Characteristics:**
- Can create and manage projects
- Can assign team members to projects
- View all data within managed projects
- Cannot modify Super Admin accounts

#### 3. User
**Access Level:** Basic operational access
**Characteristics:**
- Can submit daily reports
- View only assigned projects
- Edit own reports (within 24 hours)
- Cannot access other users' data

---

## Permissions Matrix

| Resource/Action | Super Admin | Manager | User |
|----------------|-------------|---------|------|
| **User Management** |
| Create users | ✓ | ✓ (non-admin) | ✗ |
| Edit users | ✓ | ✓ (non-admin) | ✗ |
| Delete users | ✓ | ✓ (non-admin) | ✗ |
| View all users | ✓ | ✓ | ✗ |
| Assign roles | ✓ | ✓ (non-admin) | ✗ |
| **Project Management** |
| Create projects | ✓ | ✓ | ✗ |
| Edit projects | ✓ | ✓ (own) | ✗ |
| Delete projects | ✓ | ✓ (own) | ✗ |
| View all projects | ✓ | ✓ | ✗ |
| View assigned projects | ✓ | ✓ | ✓ |
| **Report Management** |
| Submit reports | ✓ | ✓ | ✓ |
| Edit own reports | ✓ | ✓ (24hr) | ✓ (24hr) |
| Delete own reports | ✓ | ✓ (24hr) | ✗ |
| View all reports | ✓ | ✓ (project) | ✗ |
| View assigned reports | ✓ | ✓ | ✓ |
| **Analytics** |
| View system analytics | ✓ | ✓ (project) | ✗ |
| Export data | ✓ | ✓ (project) | ✗ |
| CFO dashboard | ✓ | ✓ | ✗ |
| **Settings** |
| System configuration | ✓ | ✗ | ✗ |
| Checklist templates | ✓ | ✓ | ✗ |
| Notification settings | ✓ | ✓ | ✓ (own) |

### Permission Codes
```typescript
enum Permission {
  // User permissions
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_ASSIGN_ROLE = 'user:assign_role',

  // Project permissions
  PROJECT_CREATE = 'project:create',
  PROJECT_READ_ALL = 'project:read:all',
  PROJECT_READ_ASSIGNED = 'project:read:assigned',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',

  // Report permissions
  REPORT_CREATE = 'report:create',
  REPORT_READ_ALL = 'report:read:all',
  REPORT_READ_ASSIGNED = 'report:read:assigned',
  REPORT_UPDATE_OWN = 'report:update:own',
  REPORT_DELETE_OWN = 'report:delete:own',

  // Analytics permissions
  ANALYTICS_VIEW_SYSTEM = 'analytics:view:system',
  ANALYTICS_VIEW_PROJECT = 'analytics:view:project',
  ANALYTICS_EXPORT = 'analytics:export',

  // System permissions
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_LOGS = 'system:logs',
}

// Role to permissions mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: Object.values(Permission), // All permissions

  MANAGER: [
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ_ALL,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.REPORT_CREATE,
    Permission.REPORT_READ_ALL,
    Permission.REPORT_UPDATE_OWN,
    Permission.ANALYTICS_VIEW_PROJECT,
    Permission.ANALYTICS_EXPORT,
  ],

  USER: [
    Permission.PROJECT_READ_ASSIGNED,
    Permission.REPORT_CREATE,
    Permission.REPORT_READ_ASSIGNED,
    Permission.REPORT_UPDATE_OWN,
  ],
};
```

---

## JWT Token Structure

### Access Token Payload
```json
{
  "sub": "user-uuid-123",
  "email": "robert@sitelogix.com",
  "role": "SUPER_ADMIN",
  "permissions": [
    "user:create",
    "user:read",
    "project:create",
    "..."
  ],
  "name": "Robert Trask",
  "assignedProjects": ["project-1", "project-2"],
  "iat": 1699900000,
  "exp": 1699900900,
  "iss": "sitelogix-api",
  "aud": "sitelogix-client"
}
```

### Refresh Token Payload
```json
{
  "sub": "user-uuid-123",
  "tokenId": "refresh-token-uuid",
  "iat": 1699900000,
  "exp": 1702492000,
  "iss": "sitelogix-api",
  "type": "refresh"
}
```

### Token Configuration
- **Access Token Expiry:** 15 minutes
- **Refresh Token Expiry:** 30 days
- **Algorithm:** RS256 (RSA with SHA-256)
- **Issuer:** sitelogix-api
- **Audience:** sitelogix-client

---

## Session Management

### Storage Strategy

#### Frontend Storage
```typescript
// Access token metadata (NOT the token itself)
localStorage.setItem('auth', JSON.stringify({
  isAuthenticated: true,
  user: {
    id: 'user-uuid',
    email: 'user@example.com',
    role: 'MANAGER',
    name: 'John Doe'
  },
  expiresAt: 1699900900000
}));

// Actual tokens stored in httpOnly cookies (set by backend)
// - accessToken (httpOnly, secure, sameSite: strict)
// - refreshToken (httpOnly, secure, sameSite: strict)
```

#### Cookie Configuration
```javascript
{
  httpOnly: true,        // Prevents XSS attacks
  secure: true,          // HTTPS only
  sameSite: 'strict',    // CSRF protection
  path: '/',
  maxAge: 900000         // 15 minutes for access token
}
```

### Session Lifecycle

1. **Login:** Create session, issue tokens
2. **Active Use:** Validate access token on each request
3. **Token Refresh:** Auto-refresh before expiry
4. **Logout:** Invalidate tokens, clear session
5. **Timeout:** Auto-logout after 30 minutes of inactivity

### Token Blacklist
- Maintain DynamoDB table for invalidated tokens
- Store token ID + expiry time
- Check blacklist on each request
- Auto-cleanup expired entries

```typescript
// DynamoDB Table: TokenBlacklist
{
  tokenId: string;          // Primary key
  userId: string;           // GSI
  revokedAt: number;        // Timestamp
  expiresAt: number;        // TTL for auto-deletion
  reason: string;           // 'logout' | 'security' | 'password_change'
}
```

---

## Security Requirements

### Password Policy
```typescript
const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUserInfo: true, // No email, name in password
  maxAge: 90, // Force change every 90 days
  preventReuse: 5 // Last 5 passwords
};
```

### Password Hashing
```typescript
// Use bcrypt with cost factor 12
import bcrypt from 'bcryptjs';

// Hashing
const SALT_ROUNDS = 12;
const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

// Verification
const isValid = await bcrypt.compare(password, hashedPassword);
```

### Additional Security Measures

#### 1. Rate Limiting
```typescript
// API Gateway or Lambda layer
const RATE_LIMITS = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 30 * 60 * 1000 // 30 minutes
  },
  api: {
    maxRequests: 100,
    windowMs: 60 * 1000 // 1 minute
  }
};
```

#### 2. Account Lockout
- Lock account after 5 failed login attempts
- Lock duration: 30 minutes
- Email notification on lockout
- Admin can manually unlock

#### 3. Multi-Factor Authentication (Phase 2)
- TOTP-based (Google Authenticator, Authy)
- Required for Super Admin accounts
- Optional for other roles
- Backup codes for recovery

#### 4. Security Headers
```typescript
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};
```

#### 5. Audit Logging
Log all authentication events:
- Login attempts (success/failure)
- Logout events
- Token refresh
- Password changes
- Role modifications
- Permission changes

---

## Implementation Guide

### Backend Implementation

#### 1. Lambda Authorizer
```typescript
// functions/authorizer.ts
export const handler = async (event: APIGatewayTokenAuthorizerEvent) => {
  try {
    const token = extractToken(event.authorizationToken);
    const decoded = await verifyJWT(token);

    // Check token blacklist
    const isBlacklisted = await checkBlacklist(decoded.tokenId);
    if (isBlacklisted) {
      throw new Error('Token revoked');
    }

    // Generate IAM policy
    return generatePolicy(decoded.sub, 'Allow', event.methodArn, {
      userId: decoded.sub,
      role: decoded.role,
      permissions: decoded.permissions
    });
  } catch (error) {
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

function generatePolicy(principalId: string, effect: string, resource: string, context?: any) {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource
      }]
    },
    context
  };
}
```

#### 2. Auth Service
```typescript
// services/authService.ts
class AuthService {
  async login(email: string, password: string) {
    // 1. Find user
    const user = await this.findUserByEmail(email);
    if (!user) throw new Error('Invalid credentials');

    // 2. Check account status
    if (user.isLocked) throw new Error('Account locked');

    // 3. Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      await this.recordFailedLogin(user.id);
      throw new Error('Invalid credentials');
    }

    // 4. Reset failed attempts
    await this.resetFailedLogins(user.id);

    // 5. Generate tokens
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    // 6. Log login event
    await this.auditLog('LOGIN_SUCCESS', user.id);

    return { accessToken, refreshToken, user };
  }

  async refreshToken(refreshToken: string) {
    const decoded = await this.verifyRefreshToken(refreshToken);
    const user = await this.findUserById(decoded.sub);

    // Generate new access token
    const accessToken = await this.generateAccessToken(user);

    return { accessToken };
  }

  async logout(userId: string, tokenId: string) {
    // Add token to blacklist
    await this.blacklistToken(tokenId);
    await this.auditLog('LOGOUT', userId);
  }

  private async generateAccessToken(user: User) {
    const permissions = ROLE_PERMISSIONS[user.role];

    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        permissions,
        name: user.name,
        assignedProjects: user.assignedProjects
      },
      PRIVATE_KEY,
      {
        algorithm: 'RS256',
        expiresIn: '15m',
        issuer: 'sitelogix-api',
        audience: 'sitelogix-client'
      }
    );
  }
}
```

#### 3. Permission Middleware
```typescript
// middleware/requirePermission.ts
export function requirePermission(...requiredPermissions: Permission[]) {
  return async (event: APIGatewayProxyEvent) => {
    const userPermissions = event.requestContext.authorizer?.permissions || [];

    const hasPermission = requiredPermissions.every(
      perm => userPermissions.includes(perm)
    );

    if (!hasPermission) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Insufficient permissions' })
      };
    }

    // Continue to handler
    return null;
  };
}

// Usage in Lambda
export const createProject = async (event: APIGatewayProxyEvent) => {
  const permissionCheck = await requirePermission(Permission.PROJECT_CREATE)(event);
  if (permissionCheck) return permissionCheck;

  // Handle project creation
  // ...
};
```

#### 4. Resource Ownership Check
```typescript
// middleware/requireOwnership.ts
export async function requireOwnership(
  resourceType: 'report' | 'project',
  resourceId: string,
  userId: string,
  role: UserRole
): Promise<boolean> {
  // Super admins bypass ownership checks
  if (role === 'SUPER_ADMIN') return true;

  if (resourceType === 'report') {
    const report = await getReport(resourceId);
    return report.createdBy === userId;
  }

  if (resourceType === 'project') {
    const project = await getProject(resourceId);

    // Managers can access projects they manage
    if (role === 'MANAGER') {
      return project.managerId === userId;
    }

    // Users can only access assigned projects
    return project.assignedUsers?.includes(userId);
  }

  return false;
}
```

### Frontend Implementation

#### 1. Auth Context
```typescript
// context/AuthContext.tsx
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
}

export const AuthProvider: React.FC = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for existing session
    const authData = localStorage.getItem('auth');
    if (authData) {
      const { user, expiresAt } = JSON.parse(authData);
      if (Date.now() < expiresAt) {
        setUser(user);
        setIsAuthenticated(true);
      } else {
        // Try to refresh token
        refreshToken();
      }
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) throw new Error('Login failed');

    const { user, expiresAt } = await response.json();

    // Store user info (not tokens)
    localStorage.setItem('auth', JSON.stringify({ user, expiresAt }));

    setUser(user);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });

    localStorage.removeItem('auth');
    setUser(null);
    setIsAuthenticated(false);
  };

  const hasPermission = (permission: Permission) => {
    return user?.permissions?.includes(permission) || false;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      login,
      logout,
      hasPermission,
      hasAnyPermission: (perms) => perms.some(hasPermission),
      hasAllPermissions: (perms) => perms.every(hasPermission)
    }}>
      {children}
    </AuthContext.Provider>
  );
};
```

#### 2. Protected Route Component
```typescript
// components/ProtectedRoute.tsx
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: Permission[];
  requireAll?: boolean; // true = all permissions, false = any permission
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions = [],
  requireAll = true,
  fallback = <Navigate to="/login" />
}) => {
  const { isAuthenticated, hasAllPermissions, hasAnyPermission } = useAuth();

  if (!isAuthenticated) {
    return fallback;
  }

  if (requiredPermissions.length > 0) {
    const hasAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);

    if (!hasAccess) {
      return <Navigate to="/unauthorized" />;
    }
  }

  return <>{children}</>;
};

// Usage in routes
<Routes>
  <Route path="/login" element={<Login />} />

  <Route path="/dashboard" element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  } />

  <Route path="/analytics" element={
    <ProtectedRoute requiredPermissions={[Permission.ANALYTICS_VIEW_SYSTEM]}>
      <Analytics />
    </ProtectedRoute>
  } />

  <Route path="/admin" element={
    <ProtectedRoute requiredPermissions={[Permission.USER_CREATE, Permission.SYSTEM_CONFIG]}>
      <AdminPanel />
    </ProtectedRoute>
  } />
</Routes>
```

#### 3. API Client with Auto-Refresh
```typescript
// utils/apiClient.ts
class ApiClient {
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  async request(url: string, options: RequestInit = {}) {
    // Add credentials to include cookies
    const config = {
      ...options,
      credentials: 'include' as RequestCredentials,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    let response = await fetch(url, config);

    // If 401, try to refresh token
    if (response.status === 401) {
      await this.refreshToken();
      // Retry original request
      response = await fetch(url, config);
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  private async refreshToken() {
    // Prevent multiple simultaneous refresh requests
    if (this.isRefreshing) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        });

        if (!response.ok) {
          // Refresh failed, redirect to login
          window.location.href = '/login';
          throw new Error('Token refresh failed');
        }

        const { expiresAt } = await response.json();

        // Update local storage
        const authData = JSON.parse(localStorage.getItem('auth') || '{}');
        authData.expiresAt = expiresAt;
        localStorage.setItem('auth', JSON.stringify(authData));
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }
}

export const apiClient = new ApiClient();
```

#### 4. Permission-Based UI Components
```typescript
// components/PermissionGate.tsx
interface PermissionGateProps {
  children: React.ReactNode;
  requiredPermissions: Permission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  requiredPermissions,
  requireAll = true,
  fallback = null
}) => {
  const { hasAllPermissions, hasAnyPermission } = useAuth();

  const hasAccess = requireAll
    ? hasAllPermissions(requiredPermissions)
    : hasAnyPermission(requiredPermissions);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

// Usage
<PermissionGate requiredPermissions={[Permission.USER_CREATE]}>
  <Button onClick={handleCreateUser}>Create User</Button>
</PermissionGate>
```

---

## Database Schema

### Users Table
```typescript
// DynamoDB Table: Users
{
  id: string;                    // PK: user-uuid
  email: string;                 // GSI: email-index
  passwordHash: string;
  role: 'SUPER_ADMIN' | 'MANAGER' | 'USER';
  name: string;
  assignedProjects: string[];    // Project IDs
  isLocked: boolean;
  failedLoginAttempts: number;
  lastFailedLogin: number;
  passwordChangedAt: number;
  passwordHistory: string[];     // Last 5 password hashes
  createdAt: number;
  updatedAt: number;
  createdBy: string;             // User ID who created this account
  lastLoginAt: number;
  mfaEnabled: boolean;
  mfaSecret?: string;
  isActive: boolean;
}
```

### Audit Logs Table
```typescript
// DynamoDB Table: AuditLogs
{
  id: string;                    // PK: log-uuid
  userId: string;                // GSI: user-index
  action: string;                // LOGIN_SUCCESS, LOGOUT, PASSWORD_CHANGE, etc.
  resource?: string;             // Resource affected
  resourceId?: string;
  timestamp: number;             // GSI: timestamp-index
  ipAddress: string;
  userAgent: string;
  success: boolean;
  metadata?: Record<string, any>;
}
```

---

## API Endpoints

### Authentication Endpoints
```
POST   /api/auth/login              - Login with email/password
POST   /api/auth/logout             - Logout and invalidate tokens
POST   /api/auth/refresh            - Refresh access token
POST   /api/auth/forgot-password    - Request password reset
POST   /api/auth/reset-password     - Reset password with token
POST   /api/auth/change-password    - Change password (authenticated)
GET    /api/auth/me                 - Get current user info
```

### User Management Endpoints
```
GET    /api/users                   - List users (paginated)
POST   /api/users                   - Create new user
GET    /api/users/:id               - Get user details
PUT    /api/users/:id               - Update user
DELETE /api/users/:id               - Delete user
PUT    /api/users/:id/role          - Update user role
PUT    /api/users/:id/lock          - Lock/unlock user account
```

---

## Security Checklist

- [ ] Passwords hashed with bcrypt (cost factor 12)
- [ ] JWT tokens signed with RS256
- [ ] Tokens stored in httpOnly cookies
- [ ] HTTPS enforced in production
- [ ] CORS properly configured
- [ ] Rate limiting on auth endpoints
- [ ] Account lockout after failed attempts
- [ ] Token blacklist for logout/revocation
- [ ] Audit logging for all auth events
- [ ] Security headers configured
- [ ] XSS protection implemented
- [ ] CSRF protection with SameSite cookies
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] Sensitive data encrypted at rest
- [ ] Regular security audits scheduled

---

## Phase 2 Enhancements

### Multi-Factor Authentication
- TOTP-based (Google Authenticator)
- SMS backup option
- Recovery codes

### Advanced Security
- Biometric authentication (mobile app)
- IP whitelisting for admin accounts
- Geographic restrictions
- Anomaly detection (unusual login patterns)

### Compliance
- GDPR compliance (data export, deletion)
- SOC 2 compliance preparation
- Password rotation policies
- Session recording for admin actions

---

## Monitoring & Alerts

### Metrics to Track
- Failed login attempts
- Account lockouts
- Token refresh rate
- Average session duration
- Permission denial rate

### Alert Triggers
- Multiple failed logins from same IP
- Account lockout
- Admin privilege escalation
- Unusual access patterns
- Token blacklist size exceeds threshold

---

## Testing Strategy

### Unit Tests
- Password hashing/verification
- JWT generation/validation
- Permission checking logic
- Token refresh flow

### Integration Tests
- Complete login flow
- Token refresh flow
- Logout and revocation
- Permission-based access control

### Security Tests
- Brute force protection
- Token tampering
- XSS attempts
- CSRF attempts
- SQL injection attempts

---

## Documentation References
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/)
