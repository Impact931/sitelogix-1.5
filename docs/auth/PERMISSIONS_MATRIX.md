# SiteLogix Permissions Matrix

## Quick Reference

### Permission Notation
- ✓ = Allowed
- ✗ = Not Allowed
- ⚠ = Conditionally Allowed (see notes)

---

## Complete Permissions Matrix

### User Management

| Action | Super Admin | Manager | User | Notes |
|--------|-------------|---------|------|-------|
| View user list | ✓ | ✓ | ✗ | Managers see team members only |
| View user details | ✓ | ✓ | ⚠ | Users can view own profile |
| Create user | ✓ | ✓ | ✗ | Managers cannot create admins |
| Edit user profile | ✓ | ✓ | ⚠ | Users can edit own profile |
| Edit user role | ✓ | ⚠ | ✗ | Managers cannot modify admin roles |
| Delete user | ✓ | ⚠ | ✗ | Managers cannot delete admins |
| Lock/unlock account | ✓ | ⚠ | ✗ | Managers cannot lock admins |
| Reset password (others) | ✓ | ✓ | ✗ | - |
| Change own password | ✓ | ✓ | ✓ | All users can change own password |
| View audit logs | ✓ | ⚠ | ✗ | Managers see team logs only |

### Project Management

| Action | Super Admin | Manager | User | Notes |
|--------|-------------|---------|------|-------|
| Create project | ✓ | ✓ | ✗ | - |
| View all projects | ✓ | ✓ | ✗ | - |
| View assigned projects | ✓ | ✓ | ✓ | - |
| Edit project details | ✓ | ⚠ | ✗ | Managers edit own projects |
| Archive project | ✓ | ⚠ | ✗ | Managers archive own projects |
| Delete project | ✓ | ✗ | ✗ | Only admins can delete |
| Assign team members | ✓ | ⚠ | ✗ | Managers assign to own projects |
| Remove team members | ✓ | ⚠ | ✗ | Managers remove from own projects |
| Set project budget | ✓ | ✓ | ✗ | - |
| View project timeline | ✓ | ✓ | ✓ | Users see assigned projects |

### Report Management

| Action | Super Admin | Manager | User | Notes |
|--------|-------------|---------|------|-------|
| Submit daily report | ✓ | ✓ | ✓ | - |
| View all reports | ✓ | ⚠ | ✗ | Managers see project reports |
| View assigned reports | ✓ | ✓ | ✓ | - |
| View own reports | ✓ | ✓ | ✓ | - |
| Edit own report | ⚠ | ⚠ | ⚠ | Within 24 hours only |
| Delete own report | ✓ | ⚠ | ✗ | Manager within 24 hours |
| Edit any report | ✓ | ✗ | ✗ | Admin only |
| Delete any report | ✓ | ✗ | ✗ | Admin only |
| Export reports | ✓ | ✓ | ✗ | - |
| Generate report PDF | ✓ | ✓ | ⚠ | Users export own reports |

### Data & Content

| Action | Super Admin | Manager | User | Notes |
|--------|-------------|---------|------|-------|
| View personnel list | ✓ | ✓ | ✓ | - |
| Add personnel | ✓ | ✓ | ✓ | - |
| Edit personnel | ✓ | ✓ | ⚠ | Users edit recent entries |
| Delete personnel | ✓ | ✓ | ✗ | - |
| View vendor list | ✓ | ✓ | ✓ | - |
| Add vendor | ✓ | ✓ | ✓ | - |
| Edit vendor | ✓ | ✓ | ⚠ | Users edit recent entries |
| Delete vendor | ✓ | ✓ | ✗ | - |
| View delivery log | ✓ | ✓ | ✓ | - |
| Add delivery | ✓ | ✓ | ✓ | - |
| Edit delivery | ✓ | ✓ | ⚠ | Users edit same-day entries |
| Mark delivery late | ✓ | ✓ | ✓ | - |

### Analytics & Reporting

| Action | Super Admin | Manager | User | Notes |
|--------|-------------|---------|------|-------|
| View CFO dashboard | ✓ | ✓ | ✗ | - |
| View system analytics | ✓ | ✗ | ✗ | Cross-project data |
| View project analytics | ✓ | ✓ | ✗ | - |
| View team performance | ✓ | ✓ | ✗ | - |
| View own performance | ✓ | ✓ | ✓ | - |
| Export analytics data | ✓ | ✓ | ✗ | - |
| Create custom reports | ✓ | ✓ | ✗ | - |
| Schedule reports | ✓ | ✓ | ✗ | - |
| View financial data | ✓ | ⚠ | ✗ | Managers see project financials |
| View cost breakdowns | ✓ | ✓ | ✗ | - |

### Checklist Management

| Action | Super Admin | Manager | User | Notes |
|--------|-------------|---------|------|-------|
| View checklist templates | ✓ | ✓ | ✓ | - |
| Create template | ✓ | ✓ | ✗ | - |
| Edit template | ✓ | ✓ | ✗ | - |
| Delete template | ✓ | ✗ | ✗ | Admin only |
| Assign template to project | ✓ | ✓ | ✗ | - |
| Complete checklist items | ✓ | ✓ | ✓ | - |
| Override checklist | ✓ | ✓ | ✗ | Skip required items |
| View checklist history | ✓ | ✓ | ✗ | - |

### System Configuration

| Action | Super Admin | Manager | User | Notes |
|--------|-------------|---------|------|-------|
| Access system settings | ✓ | ✗ | ✗ | - |
| Configure integrations | ✓ | ✗ | ✗ | ElevenLabs, AWS, etc. |
| Manage API keys | ✓ | ✗ | ✗ | - |
| Configure notifications | ✓ | ⚠ | ⚠ | Users manage own notifications |
| Set system defaults | ✓ | ✗ | ✗ | - |
| View system logs | ✓ | ✗ | ✗ | - |
| Configure backup | ✓ | ✗ | ✗ | - |
| Manage database | ✓ | ✗ | ✗ | - |
| Configure S3 buckets | ✓ | ✗ | ✗ | - |
| Manage Lambda functions | ✓ | ✗ | ✗ | - |

### Notifications

| Action | Super Admin | Manager | User | Notes |
|--------|-------------|---------|------|-------|
| View all notifications | ✓ | ✗ | ✗ | - |
| View own notifications | ✓ | ✓ | ✓ | - |
| Configure notification preferences | ✓ | ✓ | ✓ | - |
| Send system-wide alerts | ✓ | ✗ | ✗ | - |
| Send team notifications | ✓ | ✓ | ✗ | - |
| Dismiss notifications | ✓ | ✓ | ✓ | Own notifications |

---

## Permission Codes Reference

### User Permissions
```typescript
'user:create'           // Create new users
'user:read:all'         // View all users
'user:read:team'        // View team members
'user:read:own'         // View own profile
'user:update:all'       // Update any user
'user:update:team'      // Update team members
'user:update:own'       // Update own profile
'user:delete:all'       // Delete any user
'user:delete:team'      // Delete team members
'user:assign_role'      // Assign/change roles
'user:lock'             // Lock/unlock accounts
'user:reset_password'   // Reset others' passwords
```

### Project Permissions
```typescript
'project:create'                // Create projects
'project:read:all'              // View all projects
'project:read:managed'          // View managed projects
'project:read:assigned'         // View assigned projects
'project:update:all'            // Update any project
'project:update:managed'        // Update managed projects
'project:delete'                // Delete projects
'project:archive'               // Archive projects
'project:assign_users'          // Assign team members
```

### Report Permissions
```typescript
'report:create'                 // Submit reports
'report:read:all'               // View all reports
'report:read:project'           // View project reports
'report:read:assigned'          // View assigned reports
'report:read:own'               // View own reports
'report:update:all'             // Edit any report
'report:update:own'             // Edit own report (time-limited)
'report:delete:all'             // Delete any report
'report:delete:own'             // Delete own report (time-limited)
'report:export'                 // Export reports
```

### Analytics Permissions
```typescript
'analytics:view:system'         // System-wide analytics
'analytics:view:project'        // Project analytics
'analytics:view:team'           // Team performance
'analytics:view:own'            // Own performance
'analytics:export'              // Export analytics data
'analytics:financial'           // View financial data
```

### System Permissions
```typescript
'system:config'                 // System configuration
'system:integrations'           // Manage integrations
'system:api_keys'               // Manage API keys
'system:logs'                   // View system logs
'system:backup'                 // Manage backups
'system:database'               // Database management
```

---

## Role Assignment Rules

### Super Admin
- **Cannot be:** Downgraded by anyone
- **Can assign:** Any role to any user
- **Restrictions:** Minimum 1 Super Admin must exist
- **Default for:** Robert Trask, Jayson Rivas

### Manager
- **Cannot be:** Assigned by Users
- **Can assign:** User role only
- **Restrictions:** Cannot modify Super Admin accounts
- **Scope:** Limited to assigned projects

### User
- **Cannot be:** Assigned roles
- **Can assign:** None
- **Restrictions:** Limited to assigned projects
- **Scope:** Own data only

---

## Time-Based Restrictions

### Report Editing
- **Window:** 24 hours from submission
- **After window:**
  - Users: Cannot edit
  - Managers: Can edit own project reports
  - Super Admin: Can edit any report

### Data Entry Corrections
- **Personnel/Vendor:** 7 days from creation
- **Deliveries:** Same day only
- **After period:** Contact manager for corrections

---

## Special Cases

### Project Assignment
- Users can only access explicitly assigned projects
- Managers automatically access projects they create
- Super Admins access all projects

### Data Visibility
- Personnel/Vendor data: Project-scoped
- Reports: Project-scoped (except Super Admin)
- Analytics: Role-dependent aggregation

### Cross-Project Access
- Only Super Admins can view cross-project data
- Managers limited to assigned projects
- Users see single project context

---

## Permission Inheritance

```
SUPER_ADMIN (all permissions)
    ↓
MANAGER (subset of admin permissions)
    ↓
USER (basic operational permissions)
```

**Note:** There is no permission inheritance between roles. Each role has explicitly defined permissions.

---

## Emergency Access

### Account Recovery
- Super Admin can reset any password
- Managers can reset team member passwords
- Users must use "Forgot Password" flow

### Account Lockout Override
- Super Admin can unlock any account
- Managers can unlock team member accounts
- Automatic unlock after 30 minutes

### Emergency Super Admin Access
- Requires AWS console access
- Direct DynamoDB user role modification
- Must be logged in audit trail

---

## Compliance Notes

### GDPR Considerations
- Users can export own data
- Users can request account deletion
- Super Admin handles data deletion requests

### Audit Requirements
- All permission changes logged
- Role assignments tracked
- Access attempts recorded

### Data Retention
- Audit logs: 7 years
- User data: Until account deletion
- Report data: Indefinite (project lifecycle)
