# SiteLogix Security Checklist

## Pre-Deployment Security Checklist

### Authentication

- [ ] **Password Hashing**
  - [ ] Using bcrypt with cost factor 12 or higher
  - [ ] No plaintext passwords stored anywhere
  - [ ] Password history stored as hashes only

- [ ] **Password Policy**
  - [ ] Minimum 12 characters
  - [ ] Requires uppercase, lowercase, numbers, special chars
  - [ ] Prevents common passwords
  - [ ] Prevents user info in password (name, email)
  - [ ] Force change every 90 days (optional)
  - [ ] Prevents reuse of last 5 passwords

- [ ] **JWT Tokens**
  - [ ] Signed with RS256 (not HS256)
  - [ ] Private key stored in AWS Secrets Manager
  - [ ] Access token expiry: 15 minutes
  - [ ] Refresh token expiry: 30 days
  - [ ] Token includes all required claims (sub, exp, iat, iss, aud, jti)

- [ ] **Token Storage**
  - [ ] Tokens stored in httpOnly cookies
  - [ ] Secure flag enabled (HTTPS only)
  - [ ] SameSite=strict for CSRF protection
  - [ ] No tokens in localStorage
  - [ ] No tokens in session storage

- [ ] **Session Management**
  - [ ] Token refresh implemented
  - [ ] Token blacklist for logout/revocation
  - [ ] Auto-logout after 30 minutes inactivity
  - [ ] Session tracking in audit logs

### Authorization

- [ ] **Permission Checks**
  - [ ] All API endpoints check permissions
  - [ ] Lambda authorizer validates JWT
  - [ ] Permission middleware in place
  - [ ] Resource ownership verified
  - [ ] Time-based restrictions enforced

- [ ] **Role-Based Access Control**
  - [ ] Roles defined: SUPER_ADMIN, MANAGER, USER
  - [ ] Permissions mapped to roles
  - [ ] Super admins cannot be downgraded
  - [ ] Minimum 1 super admin required
  - [ ] Role changes audited

- [ ] **Frontend Protection**
  - [ ] Protected routes implemented
  - [ ] Permission gates in UI
  - [ ] Role gates in UI
  - [ ] Loading states for auth checks
  - [ ] Redirect to login on 401

### API Security

- [ ] **HTTPS**
  - [ ] HTTPS enforced in production
  - [ ] HTTP redirects to HTTPS
  - [ ] HSTS header configured
  - [ ] Valid SSL certificate

- [ ] **CORS**
  - [ ] CORS properly configured
  - [ ] Only allowed origins
  - [ ] Credentials allowed for allowed origins only
  - [ ] No wildcard (*) in production

- [ ] **Rate Limiting**
  - [ ] Login endpoint: 5 attempts per 15 minutes
  - [ ] API endpoints: 100 requests per minute
  - [ ] Block after threshold exceeded
  - [ ] Rate limit by IP and user ID

- [ ] **Security Headers**
  - [ ] Strict-Transport-Security
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] X-XSS-Protection: 1; mode=block
  - [ ] Content-Security-Policy
  - [ ] Referrer-Policy: strict-origin-when-cross-origin

### Input Validation

- [ ] **API Input**
  - [ ] All inputs validated
  - [ ] Type checking enforced
  - [ ] Length limits on strings
  - [ ] SQL injection prevention
  - [ ] NoSQL injection prevention
  - [ ] XSS prevention (sanitize outputs)

- [ ] **File Uploads**
  - [ ] File type validation
  - [ ] File size limits
  - [ ] Virus scanning (if applicable)
  - [ ] Secure storage (S3)
  - [ ] Signed URLs for downloads

### Database Security

- [ ] **DynamoDB**
  - [ ] Least privilege IAM roles
  - [ ] Encryption at rest enabled
  - [ ] Encryption in transit (TLS)
  - [ ] Point-in-time recovery enabled
  - [ ] Backup strategy in place

- [ ] **Data Protection**
  - [ ] Sensitive data encrypted
  - [ ] PII handled according to policy
  - [ ] Data retention policy defined
  - [ ] Secure deletion implemented

### Audit & Logging

- [ ] **Audit Logs**
  - [ ] All auth events logged
  - [ ] Login attempts (success/failure)
  - [ ] Logout events
  - [ ] Token refresh
  - [ ] Password changes
  - [ ] Role changes
  - [ ] Permission denials
  - [ ] Account lockouts

- [ ] **CloudWatch Logs**
  - [ ] Lambda function logs
  - [ ] API Gateway access logs
  - [ ] Error logs
  - [ ] Performance metrics

- [ ] **Monitoring & Alerts**
  - [ ] Failed login alert (>10 in 5 min)
  - [ ] Account lockout alert
  - [ ] Token blacklist size alert
  - [ ] Permission denial rate alert
  - [ ] Unusual activity patterns

### Account Security

- [ ] **Account Lockout**
  - [ ] Lock after 5 failed attempts
  - [ ] Lock duration: 30 minutes
  - [ ] Email notification on lockout
  - [ ] Admin can manually unlock
  - [ ] Automatic unlock after timeout

- [ ] **Password Reset**
  - [ ] Secure reset token generation
  - [ ] Token expires after 1 hour
  - [ ] Token single-use only
  - [ ] Email notification on reset
  - [ ] Cannot reuse old password

- [ ] **Account Management**
  - [ ] Email verification (if applicable)
  - [ ] Account deactivation (not just delete)
  - [ ] Data export capability (GDPR)
  - [ ] Account deletion process

### Code Security

- [ ] **Dependencies**
  - [ ] No known vulnerabilities (npm audit)
  - [ ] Dependencies up to date
  - [ ] Lock files committed
  - [ ] Regular security updates

- [ ] **Secrets Management**
  - [ ] No hardcoded secrets
  - [ ] Environment variables for config
  - [ ] AWS Secrets Manager for keys
  - [ ] .env files in .gitignore
  - [ ] No secrets in git history

- [ ] **Error Handling**
  - [ ] No sensitive info in error messages
  - [ ] Generic error messages to users
  - [ ] Detailed errors logged securely
  - [ ] Stack traces hidden in production

### Infrastructure

- [ ] **AWS IAM**
  - [ ] Least privilege policies
  - [ ] Separate roles per service
  - [ ] MFA on root account
  - [ ] Regular access review

- [ ] **Lambda Functions**
  - [ ] Minimal permissions
  - [ ] VPC configuration (if needed)
  - [ ] Resource limits configured
  - [ ] Timeout configured

- [ ] **API Gateway**
  - [ ] Lambda authorizer configured
  - [ ] Request validation enabled
  - [ ] Throttling configured
  - [ ] Access logging enabled

### Testing

- [ ] **Security Tests**
  - [ ] Unit tests for auth logic
  - [ ] Integration tests for auth flow
  - [ ] Permission check tests
  - [ ] Token validation tests
  - [ ] SQL/NoSQL injection tests
  - [ ] XSS tests
  - [ ] CSRF tests

- [ ] **Penetration Testing**
  - [ ] Brute force attack prevention
  - [ ] Token tampering detection
  - [ ] Session hijacking prevention
  - [ ] Privilege escalation prevention

### Compliance

- [ ] **GDPR (if applicable)**
  - [ ] User consent management
  - [ ] Data export capability
  - [ ] Right to be forgotten
  - [ ] Data minimization
  - [ ] Privacy policy

- [ ] **Data Retention**
  - [ ] Audit logs retained for required period
  - [ ] Old data archived/deleted
  - [ ] Backup retention policy
  - [ ] Secure deletion process

### Documentation

- [ ] **Security Documentation**
  - [ ] Authentication architecture documented
  - [ ] Permission matrix documented
  - [ ] Security policies documented
  - [ ] Incident response plan
  - [ ] Disaster recovery plan

- [ ] **User Documentation**
  - [ ] Password requirements explained
  - [ ] Security best practices
  - [ ] How to report issues
  - [ ] Privacy policy available

---

## Post-Deployment Checklist

### Immediate (Day 1)

- [ ] Verify super admin access
- [ ] Test login flow
- [ ] Test permission checks
- [ ] Test token refresh
- [ ] Monitor CloudWatch logs
- [ ] Check for errors
- [ ] Verify rate limiting works
- [ ] Test account lockout

### Week 1

- [ ] Review all audit logs
- [ ] Check for failed login patterns
- [ ] Monitor performance metrics
- [ ] Review security alerts
- [ ] Gather user feedback
- [ ] Check for permission issues
- [ ] Verify backup working

### Month 1

- [ ] Security audit
- [ ] Review user accounts
- [ ] Update documentation
- [ ] Review and adjust permissions
- [ ] Performance optimization
- [ ] Dependency updates
- [ ] Penetration test results

---

## Ongoing Maintenance

### Daily
- [ ] Review failed login attempts
- [ ] Check system health
- [ ] Monitor error rates
- [ ] Review security alerts

### Weekly
- [ ] Review audit logs
- [ ] Check permission denials
- [ ] Verify backups
- [ ] Update dependencies (if needed)

### Monthly
- [ ] Security audit
- [ ] Review user accounts
- [ ] Archive old logs
- [ ] Performance review
- [ ] Dependency updates

### Quarterly
- [ ] Rotate JWT keys
- [ ] Force password changes (if policy)
- [ ] Review permissions
- [ ] Security training
- [ ] Penetration testing

---

## Emergency Procedures

### Security Breach

1. **Immediate Actions**
   - [ ] Revoke all active tokens
   - [ ] Lock affected accounts
   - [ ] Enable enhanced monitoring
   - [ ] Notify security team

2. **Investigation**
   - [ ] Review audit logs
   - [ ] Identify breach vector
   - [ ] Assess damage
   - [ ] Document findings

3. **Remediation**
   - [ ] Fix vulnerability
   - [ ] Rotate all keys
   - [ ] Force password reset
   - [ ] Deploy fixes

4. **Post-Incident**
   - [ ] Notify affected users
   - [ ] Update security measures
   - [ ] Document lessons learned
   - [ ] Implement preventive measures

### Account Compromise

1. [ ] Lock account immediately
2. [ ] Revoke all user tokens
3. [ ] Review user activity logs
4. [ ] Contact user
5. [ ] Force password reset
6. [ ] Enable MFA (when available)
7. [ ] Monitor for further activity

### System Unavailability

1. [ ] Check AWS status
2. [ ] Review CloudWatch logs
3. [ ] Verify database connectivity
4. [ ] Check Lambda function status
5. [ ] Rollback if needed
6. [ ] Notify users
7. [ ] Document incident

---

## Security Contact Information

**Security Team:**
- Robert Trask: robert@sitelogix.com
- Jayson Rivas: jayson@sitelogix.com

**Emergency:**
- On-Call: [Phone Number]
- Slack: #security-incidents

**Reporting:**
- Security Issues: security@sitelogix.com
- Bug Bounty: [If applicable]

---

## Compliance Certifications

Track required certifications and audits:

- [ ] SOC 2 (if required)
- [ ] ISO 27001 (if required)
- [ ] GDPR compliance (if applicable)
- [ ] HIPAA (if applicable)
- [ ] PCI DSS (if processing payments)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation | Status |
|------|-----------|--------|------------|--------|
| Password compromise | Medium | High | Strong policy, MFA | ✓ |
| Token theft | Low | High | httpOnly cookies, short expiry | ✓ |
| SQL injection | Low | High | Parameterized queries | ✓ |
| XSS attack | Low | Medium | Input sanitization, CSP | ✓ |
| CSRF attack | Low | Medium | SameSite cookies, tokens | ✓ |
| DDoS attack | Medium | High | Rate limiting, WAF | ⚠ |
| Insider threat | Low | High | Audit logging, least privilege | ✓ |
| Data breach | Low | Critical | Encryption, access control | ✓ |

Legend:
- ✓ = Mitigated
- ⚠ = Partially mitigated
- ✗ = Not mitigated

---

## Security Metrics

Track these metrics monthly:

1. **Authentication**
   - Failed login attempts
   - Account lockouts
   - Password resets
   - Average session duration

2. **Authorization**
   - Permission denials
   - Role changes
   - Privilege escalations (should be 0)

3. **Performance**
   - Login success rate
   - Token validation latency
   - API response times

4. **Security Events**
   - Security incidents
   - Vulnerability reports
   - Patches applied
   - Compliance status

---

## Sign-Off

This security checklist should be reviewed and signed off by:

- [ ] Security Engineer: _________________ Date: _______
- [ ] Backend Developer: _________________ Date: _______
- [ ] DevOps Engineer: __________________ Date: _______
- [ ] Project Manager: ___________________ Date: _______

**Deployment Approval:**
- [ ] All critical items complete
- [ ] Security audit passed
- [ ] Penetration test passed
- [ ] Management approval

Approved by: _________________ Date: _______
