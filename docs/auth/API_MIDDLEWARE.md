# API Authentication Middleware

## Overview
This document provides implementation details for authentication and authorization middleware for SiteLogix Lambda functions and API Gateway.

---

## Architecture

```
API Gateway
    ↓
Lambda Authorizer (JWT validation)
    ↓
Lambda Function
    ↓
Permission Middleware (role/permission check)
    ↓
Resource Ownership Check (if needed)
    ↓
Business Logic
```

---

## Lambda Authorizer

### Purpose
AWS Lambda Authorizer validates JWT tokens and generates IAM policies for API Gateway.

### Implementation

```typescript
// backend/src/middleware/authorizer.ts

import jwt from 'jsonwebtoken';
import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';
import { getPublicKey } from '../utils/keyManager';
import { checkTokenBlacklist } from '../services/tokenService';
import { getUserById } from '../services/userService';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  name: string;
  assignedProjects: string[];
  exp: number;
  iat: number;
  iss: string;
  aud: string;
  jti: string;
}

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log('Authorizer invoked:', {
    methodArn: event.methodArn,
    type: event.type
  });

  try {
    // Extract token from Authorization header
    const token = extractToken(event.authorizationToken);
    if (!token) {
      throw new Error('No token provided');
    }

    // Decode header to get key ID
    const decodedHeader = jwt.decode(token, { complete: true });
    if (!decodedHeader) {
      throw new Error('Invalid token format');
    }

    // Get public key
    const publicKey = await getPublicKey(decodedHeader.header.kid);

    // Verify JWT signature and claims
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: 'sitelogix-api',
      audience: 'sitelogix-client',
      complete: false
    }) as TokenPayload;

    // Check if token is blacklisted
    const isBlacklisted = await checkTokenBlacklist(decoded.jti);
    if (isBlacklisted) {
      console.warn('Blacklisted token used:', decoded.jti);
      throw new Error('Token has been revoked');
    }

    // Verify user is still active
    const user = await getUserById(decoded.sub);
    if (!user || !user.isActive || user.isLocked) {
      console.warn('Inactive user attempted access:', decoded.sub);
      throw new Error('User account is inactive');
    }

    // Generate allow policy with user context
    return generatePolicy(decoded.sub, 'Allow', event.methodArn, {
      userId: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      permissions: JSON.stringify(decoded.permissions),
      assignedProjects: JSON.stringify(decoded.assignedProjects),
      name: decoded.name
    });

  } catch (error) {
    console.error('Authorization failed:', error);

    // Generate deny policy
    // Note: Don't include user context on deny
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

/**
 * Extract token from Authorization header
 * Supports: "Bearer <token>" or just "<token>"
 */
function extractToken(authHeader: string): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');

  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }

  // Also support token without "Bearer" prefix
  return authHeader;
}

/**
 * Generate IAM policy for API Gateway
 */
function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, any>
): APIGatewayAuthorizerResult {
  // Generate policy for all methods in the API
  // This allows caching the authorization result
  const apiGatewayArn = resource.split('/').slice(0, 2).join('/') + '/*';

  const policy: APIGatewayAuthorizerResult = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: apiGatewayArn
        }
      ]
    }
  };

  // Add context if provided (only on Allow)
  if (effect === 'Allow' && context) {
    // Note: Context values must be strings
    policy.context = context;
  }

  return policy;
}
```

### API Gateway Configuration

```yaml
# serverless.yml or SAM template
functions:
  authorizer:
    handler: src/middleware/authorizer.handler
    environment:
      PUBLIC_KEY_SECRET_NAME: sitelogix/jwt/public-key

  api:
    handler: src/functions/api-handler.handler
    events:
      - http:
          path: /api/{proxy+}
          method: ANY
          authorizer:
            name: authorizer
            type: token
            identitySource: method.request.header.Authorization
            resultTtlInSeconds: 300 # Cache authorization for 5 minutes
```

---

## Permission Middleware

### Purpose
Check if authenticated user has required permissions for the operation.

### Implementation

```typescript
// backend/src/middleware/permissions.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export enum Permission {
  // User permissions
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

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

interface AuthContext {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  assignedProjects: string[];
  name: string;
}

/**
 * Extract auth context from API Gateway event
 */
export function getAuthContext(event: APIGatewayProxyEvent): AuthContext {
  const context = event.requestContext.authorizer;

  if (!context) {
    throw new Error('No authorization context found');
  }

  return {
    userId: context.userId,
    email: context.email,
    role: context.role,
    permissions: JSON.parse(context.permissions || '[]'),
    assignedProjects: JSON.parse(context.assignedProjects || '[]'),
    name: context.name
  };
}

/**
 * Check if user has required permission(s)
 */
export function requirePermission(
  ...requiredPermissions: Permission[]
): (event: APIGatewayProxyEvent) => APIGatewayProxyResult | null {
  return (event: APIGatewayProxyEvent): APIGatewayProxyResult | null => {
    try {
      const context = getAuthContext(event);

      const hasPermission = requiredPermissions.every(perm =>
        context.permissions.includes(perm)
      );

      if (!hasPermission) {
        console.warn('Permission denied:', {
          userId: context.userId,
          required: requiredPermissions,
          actual: context.permissions
        });

        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'Forbidden',
            message: 'Insufficient permissions for this operation'
          })
        };
      }

      // Permission check passed
      return null;
    } catch (error) {
      console.error('Permission check failed:', error);

      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required'
        })
      };
    }
  };
}

/**
 * Check if user has ANY of the required permissions
 */
export function requireAnyPermission(
  ...requiredPermissions: Permission[]
): (event: APIGatewayProxyEvent) => APIGatewayProxyResult | null {
  return (event: APIGatewayProxyEvent): APIGatewayProxyResult | null => {
    try {
      const context = getAuthContext(event);

      const hasAnyPermission = requiredPermissions.some(perm =>
        context.permissions.includes(perm)
      );

      if (!hasAnyPermission) {
        console.warn('Permission denied (any):', {
          userId: context.userId,
          required: requiredPermissions,
          actual: context.permissions
        });

        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'Forbidden',
            message: 'Insufficient permissions for this operation'
          })
        };
      }

      return null;
    } catch (error) {
      console.error('Permission check failed:', error);

      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required'
        })
      };
    }
  };
}

/**
 * Check if user has specific role
 */
export function requireRole(
  ...allowedRoles: string[]
): (event: APIGatewayProxyEvent) => APIGatewayProxyResult | null {
  return (event: APIGatewayProxyEvent): APIGatewayProxyResult | null => {
    try {
      const context = getAuthContext(event);

      if (!allowedRoles.includes(context.role)) {
        console.warn('Role check failed:', {
          userId: context.userId,
          required: allowedRoles,
          actual: context.role
        });

        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'Forbidden',
            message: 'Insufficient role for this operation'
          })
        };
      }

      return null;
    } catch (error) {
      console.error('Role check failed:', error);

      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required'
        })
      };
    }
  };
}
```

---

## Resource Ownership Middleware

### Purpose
Verify that user owns or has access to specific resources.

### Implementation

```typescript
// backend/src/middleware/ownership.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext } from './permissions';
import { getReport } from '../services/reportService';
import { getProject } from '../services/projectService';

export enum ResourceType {
  REPORT = 'report',
  PROJECT = 'project',
  USER = 'user'
}

/**
 * Check if user owns or has access to a resource
 */
export async function requireOwnership(
  resourceType: ResourceType,
  getResourceId: (event: APIGatewayProxyEvent) => string
): Promise<(event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult | null>> {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult | null> => {
    try {
      const context = getAuthContext(event);
      const resourceId = getResourceId(event);

      // Super admins bypass ownership checks
      if (context.role === 'SUPER_ADMIN') {
        return null;
      }

      let hasAccess = false;

      switch (resourceType) {
        case ResourceType.REPORT:
          hasAccess = await checkReportAccess(context, resourceId);
          break;

        case ResourceType.PROJECT:
          hasAccess = await checkProjectAccess(context, resourceId);
          break;

        case ResourceType.USER:
          hasAccess = checkUserAccess(context, resourceId);
          break;

        default:
          throw new Error(`Unknown resource type: ${resourceType}`);
      }

      if (!hasAccess) {
        console.warn('Ownership check failed:', {
          userId: context.userId,
          resourceType,
          resourceId
        });

        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'Forbidden',
            message: 'You do not have access to this resource'
          })
        };
      }

      return null;
    } catch (error) {
      console.error('Ownership check failed:', error);

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Internal Server Error',
          message: 'Failed to verify resource access'
        })
      };
    }
  };
}

/**
 * Check if user can access a report
 */
async function checkReportAccess(
  context: AuthContext,
  reportId: string
): Promise<boolean> {
  const report = await getReport(reportId);

  if (!report) {
    return false;
  }

  // User is the creator
  if (report.createdBy === context.userId) {
    return true;
  }

  // Manager can access reports in their projects
  if (context.role === 'MANAGER' && context.assignedProjects.includes(report.projectId)) {
    return true;
  }

  // User can access reports in assigned projects
  if (context.assignedProjects.includes(report.projectId)) {
    return true;
  }

  return false;
}

/**
 * Check if user can access a project
 */
async function checkProjectAccess(
  context: AuthContext,
  projectId: string
): Promise<boolean> {
  const project = await getProject(projectId);

  if (!project) {
    return false;
  }

  // Manager who created the project
  if (context.role === 'MANAGER' && project.createdBy === context.userId) {
    return true;
  }

  // Assigned to project
  if (context.assignedProjects.includes(projectId)) {
    return true;
  }

  return false;
}

/**
 * Check if user can access another user's data
 */
function checkUserAccess(context: AuthContext, targetUserId: string): boolean {
  // User can access own data
  if (context.userId === targetUserId) {
    return true;
  }

  // Managers can access team members (implemented in caller)
  return false;
}
```

---

## Time-Based Restrictions

### Purpose
Enforce time-based access rules (e.g., edit within 24 hours).

### Implementation

```typescript
// backend/src/middleware/timeRestrictions.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext } from './permissions';

interface TimeRestrictedResource {
  createdAt: number;
  createdBy: string;
}

/**
 * Check if resource can be modified based on time restrictions
 */
export function requireTimeWindow(
  windowHours: number,
  getResource: (event: APIGatewayProxyEvent) => Promise<TimeRestrictedResource>
): (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult | null> {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult | null> => {
    try {
      const context = getAuthContext(event);

      // Super admins bypass time restrictions
      if (context.role === 'SUPER_ADMIN') {
        return null;
      }

      const resource = await getResource(event);

      // Check ownership
      if (resource.createdBy !== context.userId) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'Forbidden',
            message: 'You can only modify your own resources'
          })
        };
      }

      // Check time window
      const now = Date.now();
      const createdAt = resource.createdAt;
      const windowMs = windowHours * 60 * 60 * 1000;

      if (now - createdAt > windowMs) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'Forbidden',
            message: `This resource can only be modified within ${windowHours} hours of creation`
          })
        };
      }

      return null;
    } catch (error) {
      console.error('Time restriction check failed:', error);

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Internal Server Error',
          message: 'Failed to verify time restrictions'
        })
      };
    }
  };
}
```

---

## Usage Examples

### Example 1: Simple Permission Check

```typescript
// backend/src/functions/createProject.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { requirePermission, Permission } from '../middleware/permissions';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Check permission
  const permissionCheck = requirePermission(Permission.PROJECT_CREATE)(event);
  if (permissionCheck) return permissionCheck;

  // User has permission, proceed with business logic
  const body = JSON.parse(event.body || '{}');

  // Create project...
  const project = await createProject(body);

  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(project)
  };
};
```

### Example 2: Multiple Permission Checks

```typescript
// backend/src/functions/deleteUser.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { requirePermission, Permission, requireRole } from '../middleware/permissions';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Check both permission and role
  const permissionCheck = requirePermission(Permission.USER_DELETE)(event);
  if (permissionCheck) return permissionCheck;

  const roleCheck = requireRole('SUPER_ADMIN', 'MANAGER')(event);
  if (roleCheck) return roleCheck;

  // Proceed with deletion...
  const userId = event.pathParameters?.id;
  await deleteUser(userId);

  return {
    statusCode: 204,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: ''
  };
};
```

### Example 3: Ownership Check

```typescript
// backend/src/functions/updateReport.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { requirePermission, Permission } from '../middleware/permissions';
import { requireOwnership, ResourceType } from '../middleware/ownership';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Check permission
  const permissionCheck = requirePermission(Permission.REPORT_UPDATE_OWN)(event);
  if (permissionCheck) return permissionCheck;

  // Check ownership
  const ownershipCheck = await requireOwnership(
    ResourceType.REPORT,
    (e) => e.pathParameters?.id || ''
  )(event);
  if (ownershipCheck) return ownershipCheck;

  // Update report...
  const reportId = event.pathParameters?.id;
  const body = JSON.parse(event.body || '{}');

  const report = await updateReport(reportId, body);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(report)
  };
};
```

### Example 4: Time Restriction

```typescript
// backend/src/functions/editReport.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { requirePermission, Permission } from '../middleware/permissions';
import { requireTimeWindow } from '../middleware/timeRestrictions';
import { getReport } from '../services/reportService';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Check permission
  const permissionCheck = requirePermission(Permission.REPORT_UPDATE_OWN)(event);
  if (permissionCheck) return permissionCheck;

  // Check 24-hour time window
  const timeCheck = await requireTimeWindow(
    24,
    async (e) => {
      const reportId = e.pathParameters?.id || '';
      return await getReport(reportId);
    }
  )(event);
  if (timeCheck) return timeCheck;

  // Edit report...
  const reportId = event.pathParameters?.id;
  const body = JSON.parse(event.body || '{}');

  const report = await updateReport(reportId, body);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(report)
  };
};
```

### Example 5: Complex Multi-Check

```typescript
// backend/src/functions/approveReport.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  requirePermission,
  requireAnyPermission,
  Permission,
  getAuthContext
} from '../middleware/permissions';
import { requireOwnership, ResourceType } from '../middleware/ownership';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Managers and admins can approve
  const permissionCheck = requireAnyPermission(
    Permission.REPORT_READ_ALL,
    Permission.ANALYTICS_VIEW_PROJECT
  )(event);
  if (permissionCheck) return permissionCheck;

  // Check project ownership for managers
  const context = getAuthContext(event);
  if (context.role === 'MANAGER') {
    const ownershipCheck = await requireOwnership(
      ResourceType.PROJECT,
      async (e) => {
        const report = await getReport(e.pathParameters?.id || '');
        return report.projectId;
      }
    )(event);
    if (ownershipCheck) return ownershipCheck;
  }

  // Approve report...
  const reportId = event.pathParameters?.id;
  await approveReport(reportId, context.userId);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ status: 'approved' })
  };
};
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions for this operation"
}
```

### 403 Forbidden (Ownership)
```json
{
  "error": "Forbidden",
  "message": "You do not have access to this resource"
}
```

### 403 Forbidden (Time Restriction)
```json
{
  "error": "Forbidden",
  "message": "This resource can only be modified within 24 hours of creation"
}
```

---

## Testing

### Unit Tests

```typescript
// __tests__/middleware/permissions.test.ts

import { requirePermission, Permission } from '../permissions';
import { APIGatewayProxyEvent } from 'aws-lambda';

describe('Permission Middleware', () => {
  it('should allow access with valid permission', () => {
    const event = {
      requestContext: {
        authorizer: {
          userId: 'user-123',
          permissions: JSON.stringify([Permission.PROJECT_CREATE])
        }
      }
    } as any;

    const result = requirePermission(Permission.PROJECT_CREATE)(event);
    expect(result).toBeNull();
  });

  it('should deny access without permission', () => {
    const event = {
      requestContext: {
        authorizer: {
          userId: 'user-123',
          permissions: JSON.stringify([Permission.REPORT_CREATE])
        }
      }
    } as any;

    const result = requirePermission(Permission.PROJECT_CREATE)(event);
    expect(result).not.toBeNull();
    expect(result?.statusCode).toBe(403);
  });
});
```

---

## Performance Considerations

### Caching Authorization Results
- API Gateway caches authorizer results for 5 minutes
- Reduces Lambda invocations
- Uses Authorization header as cache key

### Minimizing Database Queries
- Include user data in JWT to avoid user lookup
- Cache blacklist checks (with short TTL)
- Use DynamoDB indexes for fast queries

### Parallel Checks
```typescript
// Run multiple checks in parallel when independent
const [permCheck, ownerCheck] = await Promise.all([
  checkPermission(user, Permission.REPORT_UPDATE),
  checkOwnership(user, reportId)
]);
```

---

## Security Best Practices

1. **Always validate on backend** - Never trust client-side checks
2. **Fail closed** - Deny access by default
3. **Log permission denials** - For security monitoring
4. **Use least privilege** - Grant minimum required permissions
5. **Validate resource IDs** - Prevent injection attacks
6. **Rate limit** - Prevent brute force attacks
7. **Monitor anomalies** - Alert on suspicious patterns

---

## Deployment

### Environment Variables
```bash
PUBLIC_KEY_SECRET_NAME=sitelogix/jwt/public-key
TOKEN_BLACKLIST_TABLE=SiteLogix-TokenBlacklist
USER_TABLE=SiteLogix-Users
```

### IAM Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:sitelogix/jwt/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/SiteLogix-*"
      ]
    }
  ]
}
```
