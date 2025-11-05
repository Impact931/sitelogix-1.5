# SiteLogix Authentication Implementation Roadmap

## Overview
This document provides a step-by-step implementation plan for adding authentication and authorization to SiteLogix.

---

## Phase 1: Backend Foundation (Days 1-3)

### Day 1: Database & User Management

#### 1.1 DynamoDB Tables Setup
```bash
# Create Users table
aws dynamodb create-table \
  --table-name SiteLogix-Users \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=email,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    IndexName=email-index,KeySchema=[{AttributeName=email,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5

# Create TokenBlacklist table with TTL
aws dynamodb create-table \
  --table-name SiteLogix-TokenBlacklist \
  --attribute-definitions \
    AttributeName=tokenId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=tokenId,KeyType=HASH \
  --global-secondary-indexes \
    IndexName=userId-index,KeySchema=[{AttributeName=userId,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5

# Enable TTL on TokenBlacklist
aws dynamodb update-time-to-live \
  --table-name SiteLogix-TokenBlacklist \
  --time-to-live-specification \
    Enabled=true,AttributeName=expiresAt

# Create AuditLogs table
aws dynamodb create-table \
  --table-name SiteLogix-AuditLogs \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=userId,AttributeType=S \
    AttributeName=timestamp,AttributeType=N \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    IndexName=userId-timestamp-index,KeySchema=[{AttributeName=userId,KeyType=HASH},{AttributeName=timestamp,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5
```

#### 1.2 Generate JWT Keys
```bash
# Generate RSA key pair
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Store in AWS Secrets Manager
aws secretsmanager create-secret \
  --name sitelogix/jwt/private-key \
  --secret-string file://private.pem

aws secretsmanager create-secret \
  --name sitelogix/jwt/public-key \
  --secret-string file://public.pem

# Clean up local keys
rm private.pem public.pem
```

#### 1.3 Create Initial Super Admin Users
```typescript
// scripts/create-super-admins.ts
import bcrypt from 'bcryptjs';
import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const dynamodb = new DynamoDB.DocumentClient();

const superAdmins = [
  {
    email: 'robert@sitelogix.com',
    name: 'Robert Trask',
    password: 'CHANGE_ME_123!' // Change this!
  },
  {
    email: 'jayson@sitelogix.com',
    name: 'Jayson Rivas',
    password: 'CHANGE_ME_123!' // Change this!
  }
];

async function createSuperAdmins() {
  for (const admin of superAdmins) {
    const hashedPassword = await bcrypt.hash(admin.password, 12);

    await dynamodb.put({
      TableName: 'SiteLogix-Users',
      Item: {
        id: uuidv4(),
        email: admin.email,
        name: admin.name,
        passwordHash: hashedPassword,
        role: 'SUPER_ADMIN',
        assignedProjects: [],
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        passwordChangedAt: Date.now(),
        passwordHistory: []
      }
    }).promise();

    console.log(`Created super admin: ${admin.name}`);
  }
}

createSuperAdmins();
```

### Day 2: Authentication Services

#### 2.1 Install Dependencies
```bash
cd backend
npm install jsonwebtoken bcryptjs uuid
npm install -D @types/jsonwebtoken @types/bcryptjs @types/uuid
```

#### 2.2 Implement Auth Service
- Create `backend/src/services/authService.ts` (see AUTH_ARCHITECTURE.md)
- Create `backend/src/services/userService.ts`
- Create `backend/src/services/tokenService.ts`
- Create `backend/src/utils/keyManager.ts`

#### 2.3 Create Auth Lambda Functions
```
backend/src/functions/auth/
  ├── login.ts
  ├── logout.ts
  ├── refresh.ts
  ├── forgot-password.ts
  └── reset-password.ts
```

### Day 3: Authorization Middleware

#### 3.1 Lambda Authorizer
- Create `backend/src/middleware/authorizer.ts` (see API_MIDDLEWARE.md)
- Deploy as Lambda function
- Configure API Gateway to use authorizer

#### 3.2 Permission Middleware
- Create `backend/src/middleware/permissions.ts`
- Create `backend/src/middleware/ownership.ts`
- Create `backend/src/middleware/timeRestrictions.ts`

#### 3.3 Update Existing Lambda Functions
Add authentication checks to existing functions:
```typescript
// Example: Update upload-report.ts
import { requirePermission, Permission } from '../middleware/permissions';

export const handler = async (event: APIGatewayProxyEvent) => {
  // Add permission check
  const permissionCheck = requirePermission(Permission.REPORT_CREATE)(event);
  if (permissionCheck) return permissionCheck;

  // Existing logic...
};
```

---

## Phase 2: Frontend Implementation (Days 4-6)

### Day 4: Auth Context & Routes

#### 4.1 Install Dependencies
```bash
cd frontend
npm install react-router-dom
npm install -D @types/react-router-dom
```

#### 4.2 Create Auth Context
- Create `frontend/src/contexts/AuthContext.tsx`
- Create `frontend/src/types/permissions.ts`
- Wrap App with AuthProvider

#### 4.3 Create Login Page
- Create `frontend/src/pages/Login.tsx`
- Create `frontend/src/pages/Unauthorized.tsx`
- Add styling for login form

### Day 5: Route Protection

#### 5.1 Protected Routes
- Create `frontend/src/components/ProtectedRoute.tsx`
- Update `frontend/src/App.tsx` with route guards
- Add loading states

#### 5.2 API Client
- Create `frontend/src/services/apiClient.ts`
- Implement auto-refresh logic
- Update existing API calls to use new client

### Day 6: Permission Gates & UI

#### 6.1 Permission Components
- Create `frontend/src/components/PermissionGate.tsx`
- Create `frontend/src/components/RoleGate.tsx`
- Create `frontend/src/components/ProjectGate.tsx`

#### 6.2 Update Existing Components
Add permission checks to UI elements:
```typescript
// Example: Update VoiceReportingScreen.tsx
<PermissionGate requiredPermissions={[Permission.REPORT_CREATE]}>
  <button onClick={handleStartRecording}>
    Start Recording
  </button>
</PermissionGate>
```

#### 6.3 Session Management
- Create `frontend/src/hooks/useTokenRefresh.ts`
- Create `frontend/src/hooks/useActivityTracking.ts`
- Integrate into App.tsx

---

## Phase 3: User Management UI (Days 7-8)

### Day 7: Admin Panel Foundation

#### 7.1 Create Admin Routes
```typescript
frontend/src/pages/admin/
  ├── AdminLayout.tsx
  ├── Dashboard.tsx
  ├── UserManagement.tsx
  ├── UserForm.tsx
  └── UserList.tsx
```

#### 7.2 User CRUD Operations
- List users with pagination
- Create new user form
- Edit user form
- Delete user confirmation
- Role assignment UI

### Day 8: User Management Features

#### 8.1 Advanced Features
- Search/filter users
- Bulk actions
- Account locking/unlocking
- Password reset
- Audit log viewer

#### 8.2 Profile Management
- User profile page
- Change password form
- Notification preferences
- Activity history

---

## Phase 4: Testing & Security (Days 9-10)

### Day 9: Backend Testing

#### 9.1 Unit Tests
```bash
cd backend
npm install -D jest @types/jest ts-jest
```

Create tests:
```
backend/__tests__/
  ├── services/
  │   ├── authService.test.ts
  │   └── tokenService.test.ts
  └── middleware/
      ├── authorizer.test.ts
      └── permissions.test.ts
```

#### 9.2 Integration Tests
- Test complete login flow
- Test token refresh
- Test permission checks
- Test resource ownership

### Day 10: Frontend Testing & Security Audit

#### 10.1 Frontend Tests
```bash
cd frontend
npm install -D @testing-library/react @testing-library/react-hooks
```

Create tests:
```
frontend/__tests__/
  ├── contexts/
  │   └── AuthContext.test.tsx
  ├── components/
  │   ├── ProtectedRoute.test.tsx
  │   └── PermissionGate.test.tsx
  └── services/
      └── apiClient.test.ts
```

#### 10.2 Security Audit
- [ ] Passwords hashed with bcrypt
- [ ] JWT signed with RS256
- [ ] httpOnly cookies configured
- [ ] HTTPS enforced
- [ ] CORS configured properly
- [ ] Rate limiting implemented
- [ ] Input validation
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Security headers

---

## Phase 5: Migration & Deployment (Days 11-12)

### Day 11: Data Migration

#### 11.1 Existing Users
If you have existing users in other systems:
```typescript
// scripts/migrate-users.ts
// Import users from existing system
// Hash passwords
// Create user records in DynamoDB
```

#### 11.2 Project Assignments
```typescript
// scripts/assign-projects.ts
// Map users to projects
// Update assignedProjects field
```

### Day 12: Deployment

#### 12.1 Infrastructure
```bash
# Deploy backend
cd backend
npm run build
# Deploy Lambda functions
# Update API Gateway configuration
# Deploy authorizer

# Deploy frontend
cd frontend
npm run build
# Upload to S3
# Invalidate CloudFront cache
```

#### 12.2 Environment Configuration
```bash
# Production environment variables
AWS_REGION=us-east-1
USER_TABLE=SiteLogix-Users
TOKEN_BLACKLIST_TABLE=SiteLogix-TokenBlacklist
AUDIT_LOG_TABLE=SiteLogix-AuditLogs
JWT_PRIVATE_KEY_SECRET=sitelogix/jwt/private-key
JWT_PUBLIC_KEY_SECRET=sitelogix/jwt/public-key
```

#### 12.3 Smoke Tests
- [ ] Can login as super admin
- [ ] Can create new user
- [ ] Can submit report
- [ ] Can view analytics (role-based)
- [ ] Can logout
- [ ] Token refresh works
- [ ] Permission checks work
- [ ] Session timeout works

---

## Phase 6: Post-Deployment (Ongoing)

### Week 1: Monitoring

#### Setup Monitoring
```bash
# CloudWatch alarms
- Failed login attempts > 10 in 5 minutes
- Token blacklist size > 100,000
- Token validation failures > 100 in 1 minute
- User table read/write capacity

# CloudWatch dashboards
- Authentication metrics
- API Gateway requests
- Lambda execution times
- Error rates
```

#### Audit & Review
- Review audit logs daily
- Check for failed login patterns
- Monitor permission denials
- Track user activity

### Week 2-4: Iteration

#### Gather Feedback
- User experience issues
- Permission problems
- Performance issues
- Feature requests

#### Refinements
- Adjust permission matrix if needed
- Improve error messages
- Optimize performance
- Add convenience features

---

## Rollback Plan

If issues occur after deployment:

### Backend Rollback
```bash
# Revert Lambda functions
aws lambda update-function-code \
  --function-name sitelogix-api \
  --s3-bucket your-bucket \
  --s3-key previous-version.zip

# Remove authorizer from API Gateway
# (API will be open - only for emergency)
```

### Frontend Rollback
```bash
# Revert S3 frontend
aws s3 sync s3://backup-bucket/previous-version s3://sitelogix-frontend

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id XXXXX \
  --paths "/*"
```

### Database Rollback
```bash
# DynamoDB has point-in-time recovery
# Restore to previous state if needed
aws dynamodb restore-table-to-point-in-time \
  --source-table-name SiteLogix-Users \
  --target-table-name SiteLogix-Users-Restored \
  --restore-date-time 2024-01-01T12:00:00Z
```

---

## Success Criteria

### Functional Requirements
- [ ] Users can login with email/password
- [ ] JWT tokens generated and validated correctly
- [ ] Role-based permissions enforced
- [ ] Super admins can manage users
- [ ] Managers can manage projects and teams
- [ ] Users can submit reports
- [ ] Session management works (refresh, timeout)
- [ ] Token revocation works
- [ ] Password requirements enforced
- [ ] Audit logging captures all auth events

### Non-Functional Requirements
- [ ] Login completes in < 2 seconds
- [ ] Token validation adds < 100ms latency
- [ ] System handles 100 concurrent users
- [ ] No security vulnerabilities in audit
- [ ] 99.9% uptime
- [ ] All tests passing
- [ ] Documentation complete

### User Acceptance
- [ ] Robert and Jayson can access all features
- [ ] Managers can create and manage projects
- [ ] Users can submit reports without issues
- [ ] UI/UX is intuitive
- [ ] Error messages are clear
- [ ] Mobile responsive

---

## Maintenance Checklist

### Daily
- [ ] Review failed login attempts
- [ ] Check system health metrics
- [ ] Monitor error rates

### Weekly
- [ ] Review audit logs
- [ ] Check for security alerts
- [ ] Review permission denials
- [ ] Verify backups

### Monthly
- [ ] Rotate JWT keys (optional)
- [ ] Review user accounts
- [ ] Archive old audit logs
- [ ] Security audit
- [ ] Performance review

### Quarterly
- [ ] Force password changes (if policy requires)
- [ ] Review and update permissions
- [ ] Conduct security training
- [ ] Update documentation

---

## Resources & Documentation

### Internal Docs
- `/docs/AUTH_ARCHITECTURE.md` - Complete auth architecture
- `/docs/auth/PERMISSIONS_MATRIX.md` - Role permissions reference
- `/docs/auth/JWT_SPECIFICATION.md` - JWT token details
- `/docs/auth/API_MIDDLEWARE.md` - Backend middleware guide
- `/docs/auth/FRONTEND_AUTH.md` - Frontend implementation guide

### External Resources
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [AWS Lambda Authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html)
- [React Authentication Tutorial](https://reactjs.org/docs/context.html)

---

## Support & Troubleshooting

### Common Issues

**Issue:** Users can't login
**Solution:** Check DynamoDB Users table, verify password hash, check CloudWatch logs

**Issue:** Token validation fails
**Solution:** Verify JWT keys in Secrets Manager, check token expiry, check blacklist

**Issue:** Permission denied unexpectedly
**Solution:** Check user permissions in JWT, verify role assignment, check audit logs

**Issue:** Session expires too quickly
**Solution:** Verify token expiry times, check auto-refresh implementation

**Issue:** High Lambda costs
**Solution:** Increase authorizer cache TTL, optimize database queries

### Getting Help
- Check CloudWatch logs for errors
- Review audit logs for auth events
- Contact: robert@sitelogix.com, jayson@sitelogix.com
- Emergency: Rollback to previous version

---

## Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Backend Foundation | 3 days | Database tables, JWT keys, auth services, middleware |
| Phase 2: Frontend Implementation | 3 days | Auth context, routes, API client, permission gates |
| Phase 3: User Management UI | 2 days | Admin panel, user CRUD, profile management |
| Phase 4: Testing & Security | 2 days | Unit tests, integration tests, security audit |
| Phase 5: Migration & Deployment | 2 days | Data migration, deployment, smoke tests |
| Phase 6: Post-Deployment | Ongoing | Monitoring, feedback, iteration |

**Total Implementation Time:** 12 days + ongoing maintenance

---

## Next Steps

1. Review this implementation plan with team
2. Set up development environment
3. Begin Phase 1: Backend Foundation
4. Follow roadmap sequentially
5. Test thoroughly at each phase
6. Deploy to production
7. Monitor and iterate

Good luck with the implementation!
