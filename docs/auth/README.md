# SiteLogix Authentication & Authorization Documentation

## Overview
This directory contains complete documentation for the SiteLogix authentication and authorization system, implementing JWT-based authentication with role-based access control (RBAC).

---

## Documentation Index

### 📘 Core Architecture
**[AUTH_ARCHITECTURE.md](../AUTH_ARCHITECTURE.md)**
- Complete authentication and authorization architecture
- Authentication flow diagrams
- Role hierarchy and definitions
- Session management strategy
- Security requirements and best practices
- Implementation examples for backend and frontend

### 🔐 Permissions & Roles
**[PERMISSIONS_MATRIX.md](./PERMISSIONS_MATRIX.md)**
- Complete permissions matrix by role
- Permission codes reference
- Role assignment rules
- Time-based restrictions
- Special cases and exceptions
- Emergency access procedures

### 🎫 JWT Token Specification
**[JWT_SPECIFICATION.md](./JWT_SPECIFICATION.md)**
- Token structure and payload
- Signing algorithm (RS256)
- Token validation rules
- Token rotation strategy
- Cookie configuration
- Security considerations
- Code examples

### 🛡️ Backend Middleware
**[API_MIDDLEWARE.md](./API_MIDDLEWARE.md)**
- Lambda authorizer implementation
- Permission middleware
- Resource ownership checks
- Time-based restrictions
- Usage examples
- Testing strategies
- Performance optimization

### 🎨 Frontend Authentication
**[FRONTEND_AUTH.md](./FRONTEND_AUTH.md)**
- Auth context implementation
- Protected routes
- API client with auto-refresh
- Permission gates
- Session management
- Activity tracking
- Testing examples

### 🗺️ Implementation Roadmap
**[IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)**
- 12-day implementation plan
- Phase-by-phase tasks
- Setup instructions
- Migration strategies
- Testing procedures
- Deployment checklist
- Rollback plan

### ✅ Security Checklist
**[SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)**
- Pre-deployment security checklist
- Post-deployment monitoring
- Ongoing maintenance tasks
- Emergency procedures
- Compliance requirements
- Risk assessment

---

## Quick Start

### For Developers

1. **Read the Architecture**
   ```bash
   # Start here to understand the overall system
   open docs/AUTH_ARCHITECTURE.md
   ```

2. **Review Permissions**
   ```bash
   # Understand what each role can do
   open docs/auth/PERMISSIONS_MATRIX.md
   ```

3. **Backend Implementation**
   ```bash
   # Follow middleware guide for backend
   open docs/auth/API_MIDDLEWARE.md
   ```

4. **Frontend Implementation**
   ```bash
   # Follow frontend guide for React components
   open docs/auth/FRONTEND_AUTH.md
   ```

5. **Follow Roadmap**
   ```bash
   # Step-by-step implementation guide
   open docs/auth/IMPLEMENTATION_ROADMAP.md
   ```

### For Security Engineers

1. **Review Architecture**
   - Authentication flow
   - Token management
   - Session handling

2. **Check Security Measures**
   - Password hashing (bcrypt, cost factor 12)
   - JWT signing (RS256)
   - Token storage (httpOnly cookies)
   - Rate limiting
   - Account lockout

3. **Run Security Checklist**
   ```bash
   open docs/auth/SECURITY_CHECKLIST.md
   ```

4. **Audit & Monitor**
   - Review audit logs
   - Monitor CloudWatch metrics
   - Set up security alerts

### For Project Managers

1. **Understand Scope**
   - 12-day implementation timeline
   - 3 roles: Super Admin, Manager, User
   - JWT-based authentication

2. **Review Roadmap**
   ```bash
   open docs/auth/IMPLEMENTATION_ROADMAP.md
   ```

3. **Track Progress**
   - Phase 1: Backend (3 days)
   - Phase 2: Frontend (3 days)
   - Phase 3: User Management (2 days)
   - Phase 4: Testing (2 days)
   - Phase 5: Deployment (2 days)

---

## Key Features

### Authentication
- ✅ Email/password login
- ✅ JWT tokens (access + refresh)
- ✅ httpOnly cookie storage
- ✅ Auto-refresh mechanism
- ✅ Session timeout (30 min inactivity)
- ✅ Token revocation/blacklist
- ✅ Account lockout (5 failed attempts)

### Authorization
- ✅ Role-based access control (RBAC)
- ✅ Fine-grained permissions
- ✅ Resource ownership checks
- ✅ Time-based restrictions (24hr edit window)
- ✅ Project-level access control

### Security
- ✅ bcrypt password hashing (cost 12)
- ✅ RS256 JWT signing
- ✅ HTTPS only
- ✅ CORS protection
- ✅ CSRF protection (SameSite cookies)
- ✅ XSS protection
- ✅ Rate limiting
- ✅ Comprehensive audit logging

### User Management
- ✅ Create/edit/delete users
- ✅ Role assignment
- ✅ Account activation/deactivation
- ✅ Password reset
- ✅ Profile management

---

## Role Summary

### Super Admin
**Users:** Robert Trask, Jayson Rivas

**Capabilities:**
- Full system access
- User management (all roles)
- Project management (all projects)
- System configuration
- View all analytics
- Manage integrations

### Manager
**Capabilities:**
- Create and manage projects
- Manage team members (non-admins)
- Assign users to projects
- View project analytics
- Export project data
- Create checklist templates

### User
**Capabilities:**
- Submit daily reports
- View assigned projects
- Edit own reports (24hr window)
- View own analytics
- Complete checklists

---

## Technical Stack

### Backend
- **Runtime:** Node.js (AWS Lambda)
- **Framework:** TypeScript
- **Database:** DynamoDB
- **Authentication:** JWT (jsonwebtoken)
- **Hashing:** bcrypt
- **API Gateway:** AWS API Gateway with Lambda Authorizer

### Frontend
- **Framework:** React with TypeScript
- **Routing:** React Router v6
- **State Management:** React Context
- **HTTP Client:** Fetch API with custom wrapper
- **Build Tool:** Vite

### Infrastructure
- **Hosting:** AWS (Lambda, API Gateway, S3, CloudFront)
- **Database:** DynamoDB
- **Secrets:** AWS Secrets Manager
- **Monitoring:** CloudWatch
- **CDN:** CloudFront

---

## Security Measures

### Authentication Security
| Measure | Implementation |
|---------|---------------|
| Password Hashing | bcrypt (cost factor 12) |
| Token Signing | RS256 (RSA + SHA-256) |
| Token Storage | httpOnly, secure, SameSite cookies |
| Token Lifetime | Access: 15 min, Refresh: 30 days |
| Session Management | Auto-refresh, token rotation |
| Account Lockout | 5 attempts, 30 min lockout |

### API Security
| Measure | Implementation |
|---------|---------------|
| HTTPS | Enforced, HSTS enabled |
| CORS | Configured for specific origins |
| Rate Limiting | 5/15min login, 100/min API |
| Input Validation | All endpoints validated |
| SQL Injection | Parameterized queries |
| XSS Protection | Input sanitization, CSP |

### Monitoring & Audit
| Feature | Details |
|---------|---------|
| Audit Logs | All auth events logged |
| CloudWatch | Metrics, logs, alarms |
| Alerts | Failed logins, lockouts, anomalies |
| Retention | 7 years for audit logs |

---

## API Endpoints

### Authentication
```
POST   /api/auth/login              - Login with email/password
POST   /api/auth/logout             - Logout and invalidate tokens
POST   /api/auth/refresh            - Refresh access token
POST   /api/auth/forgot-password    - Request password reset
POST   /api/auth/reset-password     - Reset password with token
POST   /api/auth/change-password    - Change password (authenticated)
GET    /api/auth/me                 - Get current user info
```

### User Management
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
- Resource ownership checks

### Security Tests
- Brute force protection
- Token tampering
- XSS attempts
- CSRF attempts
- SQL/NoSQL injection attempts

---

## Deployment

### Prerequisites
- AWS account with appropriate permissions
- Node.js 18+ installed
- AWS CLI configured
- DynamoDB tables created
- JWT keys generated and stored in Secrets Manager

### Deployment Steps
1. Create DynamoDB tables
2. Generate and store JWT keys
3. Deploy backend Lambda functions
4. Configure API Gateway with authorizer
5. Build and deploy frontend
6. Create initial super admin users
7. Run smoke tests
8. Enable monitoring and alerts

### Environment Variables
```bash
# Backend
AWS_REGION=us-east-1
USER_TABLE=SiteLogix-Users
TOKEN_BLACKLIST_TABLE=SiteLogix-TokenBlacklist
AUDIT_LOG_TABLE=SiteLogix-AuditLogs
JWT_PRIVATE_KEY_SECRET=sitelogix/jwt/private-key
JWT_PUBLIC_KEY_SECRET=sitelogix/jwt/public-key

# Frontend
VITE_API_BASE_URL=https://api.sitelogix.com
```

---

## Monitoring & Maintenance

### Daily Tasks
- Review failed login attempts
- Check system health metrics
- Monitor error rates

### Weekly Tasks
- Review audit logs
- Check for security alerts
- Verify backups
- Review permission denials

### Monthly Tasks
- Security audit
- Review user accounts
- Archive old audit logs
- Performance review
- Update dependencies

### Quarterly Tasks
- Rotate JWT keys (optional)
- Force password changes (if policy)
- Review and update permissions
- Conduct security training
- Penetration testing

---

## Support & Contact

### Security Issues
- **Email:** security@sitelogix.com
- **Emergency:** [On-call number]
- **Slack:** #security-incidents

### Technical Support
- **Robert Trask:** robert@sitelogix.com
- **Jayson Rivas:** jayson@sitelogix.com

### Documentation Updates
- Submit PR to update documentation
- Review changes with security team
- Update version in changelog

---

## Version History

### v1.0.0 (Current)
- Initial authentication system design
- JWT-based authentication
- Role-based access control
- Complete documentation

### Planned Features (v2.0.0)
- Multi-factor authentication (TOTP)
- Biometric authentication (mobile)
- IP whitelisting for admin accounts
- Geographic restrictions
- Anomaly detection

---

## Resources

### Internal Documentation
- Authentication Architecture
- Permissions Matrix
- JWT Specification
- API Middleware Guide
- Frontend Auth Guide
- Implementation Roadmap
- Security Checklist

### External Resources
- [JWT Best Practices (RFC 8725)](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/)
- [AWS Lambda Authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html)

---

## License

Internal documentation for SiteLogix. Confidential and proprietary.

---

## Contributing

1. Review existing documentation
2. Make changes in feature branch
3. Test thoroughly
4. Update changelog
5. Submit PR for review
6. Get security team approval
7. Merge to main

---

**Last Updated:** November 5, 2024
**Author:** Security Engineering Team
**Reviewers:** Robert Trask, Jayson Rivas
