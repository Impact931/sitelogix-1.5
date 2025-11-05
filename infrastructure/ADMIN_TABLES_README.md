# SiteLogix Admin/Project Management Database Schema

## Overview
This document provides a comprehensive overview of the DynamoDB table schemas designed for SiteLogix's admin and project management features. These tables support multi-tenant operations with role-based access control (RBAC) for users, managers, admins, and superadmins.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Table Schemas](#table-schemas)
3. [Key Design Patterns](#key-design-patterns)
4. [Access Patterns](#access-patterns)
5. [Security Considerations](#security-considerations)
6. [Cost Optimization](#cost-optimization)
7. [Getting Started](#getting-started)

---

## Architecture Overview

### Technology Stack
- **Database**: AWS DynamoDB (NoSQL)
- **Pattern**: Single-table design with GSIs for flexible querying
- **Security**: Server-side encryption (AES-256), point-in-time recovery
- **Monitoring**: DynamoDB Streams enabled for audit trails

### Role Hierarchy
```
Superadmin (all permissions)
    ↓
Admin (manage projects, users, personnel)
    ↓
Manager (manage assigned projects, view team members)
    ↓
User (view assigned projects, submit time)
```

---

## Table Schemas

### 1. Enhanced Personnel Table (sitelogix-personnel-v2)

**Purpose**: Store detailed employee information with health tracking, team assignments, and hourly rates.

#### Primary Key Structure
- **PK**: `EMPLOYEE#<employee_id>` (UUID)
- **SK**: `METADATA`

#### Attributes
| Attribute | Type | Description | Required |
|-----------|------|-------------|----------|
| employee_id | String | Unique employee identifier (UUID) | Yes |
| employee_number | String | Human-readable employee number (e.g., "EMP001") | Yes |
| full_name | String | Employee's full name | Yes |
| role | String | user \| manager \| admin \| superadmin | Yes |
| email | String | Work email address | Yes |
| phone | String | Contact phone number | No |
| team_id | String | Reference to team (format: `TEAM#<uuid>`) | No |
| health_status | String | fit_for_duty \| medical_restriction \| on_leave | Yes |
| health_notes | String | Medical restriction details | No |
| status | String | active \| inactive | Yes |
| hourly_rate | Number | Hourly pay rate | Yes |
| hours_week | Number | Hours worked this week | Yes |
| hours_month | Number | Hours worked this month | Yes |
| certifications | String Array | List of certifications (e.g., ["OSHA 30", "CPR"]) | No |
| created_at | String (ISO 8601) | Record creation timestamp | Yes |
| updated_at | String (ISO 8601) | Last update timestamp | Yes |
| created_by | String | User who created record | Yes |

#### Global Secondary Indexes

**GSI1-NameIndex**: Search employees by name
- PK: `full_name`
- Use Case: Autocomplete, search functionality

**GSI2-EmployeeNumberIndex**: Lookup by badge number
- PK: `employee_number`
- Use Case: Badge scanning, payroll integration

**GSI3-TeamIndex**: Get all team members
- PK: `team_id`
- SK: `full_name`
- Use Case: Team management, roster views

**GSI4-RoleStatusIndex**: Filter by role and status
- PK: `role`
- SK: `status`
- Use Case: Get all active managers, all active employees

#### Capacity
- **Read**: 10 RCU
- **Write**: 10 WCU
- **Streams**: Enabled (NEW_AND_OLD_IMAGES)
- **Backup**: Point-in-time recovery enabled

---

### 2. Projects Table (sitelogix-projects)

**Purpose**: Manage construction projects with budgets, timelines, milestones, and team assignments.

#### Primary Key Structure
- **PK**: `PROJECT#<project_id>` (UUID)
- **SK**: `METADATA` (for project details) or `TEAM#<employee_id>` (for team members)

#### Attributes
| Attribute | Type | Description | Required |
|-----------|------|-------------|----------|
| project_id | String | Unique project identifier (UUID) | Yes |
| project_name | String | Project name | Yes |
| location | String | Project site address | Yes |
| budget | Number | Total project budget | Yes |
| budget_spent | Number | Amount spent to date | Yes |
| details | String | Long text description of project | No |
| status | String | planning \| active \| on-hold \| complete | Yes |
| start_date | String (YYYY-MM-DD) | Project start date | Yes |
| end_date | String (YYYY-MM-DD) | Expected completion date | Yes |
| estimated_completion | String (YYYY-MM-DD) | Current estimated completion | Yes |
| milestones | Array | Milestone objects (name, date, status) | No |
| manager_id | String | Reference to manager (format: `EMPLOYEE#<uuid>`) | Yes |
| team_members | String Array | Array of employee IDs | No |
| created_at | String (ISO 8601) | Record creation timestamp | Yes |
| updated_at | String (ISO 8601) | Last update timestamp | Yes |
| created_by | String | User who created record | Yes |

#### Milestone Object Structure
```json
{
  "name": "Foundation Complete",
  "date": "2024-09-15",
  "status": "completed | in_progress | pending"
}
```

#### Global Secondary Indexes

**GSI1-ProjectNameIndex**: Search projects by name
- PK: `project_name`
- Use Case: Project search, autocomplete

**GSI2-StatusIndex**: Filter projects by status
- PK: `status`
- SK: `start_date`
- Use Case: View all active projects, sorted by start date

**GSI3-ManagerIndex**: Get manager's projects
- PK: `manager_id`
- SK: `start_date`
- Use Case: Manager dashboard showing all assigned projects

#### Capacity
- **Read**: 10 RCU
- **Write**: 10 WCU
- **Streams**: Enabled (NEW_AND_OLD_IMAGES)
- **Backup**: Point-in-time recovery enabled

---

### 3. Users/Auth Table (sitelogix-users)

**Purpose**: Authentication and authorization with password hashing and session management.

#### Primary Key Structure
- **PK**: `USER#<user_id>` (UUID)
- **SK**: `METADATA`

#### Attributes
| Attribute | Type | Description | Required |
|-----------|------|-------------|----------|
| user_id | String | Unique user identifier (UUID) | Yes |
| username | String | Unique username for login | Yes |
| password_hash | String | Bcrypt hashed password | Yes |
| role | String | user \| manager \| admin \| superadmin | Yes |
| employee_id | String | Link to personnel record | Yes |
| account_status | String | active \| disabled | Yes |
| last_login | String (ISO 8601) | Last login timestamp | No |
| login_count | Number | Total number of logins | Yes |
| password_reset_required | Boolean | Force password reset on next login | Yes |
| mfa_enabled | Boolean | Multi-factor authentication enabled | Yes |
| created_at | String (ISO 8601) | Record creation timestamp | Yes |
| updated_at | String (ISO 8601) | Last update timestamp | Yes |

#### Global Secondary Indexes

**GSI1-UsernameIndex**: Login authentication (CRITICAL PATH)
- PK: `username`
- Use Case: User authentication (most frequent query)
- Capacity: 10 RCU (higher allocation)

**GSI2-EmployeeIndex**: Link user to employee record
- PK: `employee_id`
- Use Case: Get user account from employee record

**GSI3-RoleStatusIndex**: Filter users by role and status
- PK: `role`
- SK: `account_status`
- Use Case: Get all active admins, disabled accounts

#### Security Features
- **Encryption**: AES-256 server-side encryption
- **Backup**: Point-in-time recovery enabled (critical for auth)
- **Streams**: Enabled for audit trail
- **Password**: Bcrypt hashing with salt rounds = 12

#### Capacity
- **Read**: 15 RCU (highest allocation due to auth frequency)
- **Write**: 10 WCU
- **Streams**: Enabled (NEW_AND_OLD_IMAGES)
- **Backup**: Point-in-time recovery enabled

---

### 4. Time Tracking Table (sitelogix-time-tracking)

**Purpose**: Record employee hours by project with support for regular, overtime, and double-time hours.

#### Primary Key Structure
- **PK**: `EMPLOYEE#<employee_id>`
- **SK**: `DATE#<YYYY-MM-DD>#PROJECT#<project_id>`

#### Attributes
| Attribute | Type | Description | Required |
|-----------|------|-------------|----------|
| employee_id | String | Employee identifier | Yes |
| employee_name | String | Employee full name (denormalized) | Yes |
| project_id | String | Project identifier | Yes |
| project_name | String | Project name (denormalized) | Yes |
| date | String (YYYY-MM-DD) | Work date | Yes |
| week_number | String | ISO week (format: "2025-W45") | Yes |
| month | String | Year-month (format: "2025-11") | Yes |
| regular_hours | Number | Regular hours worked | Yes |
| overtime_hours | Number | Overtime hours (1.5x pay) | Yes |
| doubletime_hours | Number | Double-time hours (2x pay) | Yes |
| total_hours | Number | Sum of all hours | Yes |
| hourly_rate | Number | Employee's hourly rate (denormalized) | Yes |
| total_pay | Number | Calculated total pay | Yes |
| notes | String | Optional notes about the day | No |
| approved | Boolean | Manager approval status | Yes |
| approved_by | String | Manager who approved | No |
| approved_at | String (ISO 8601) | Approval timestamp | No |
| created_at | String (ISO 8601) | Record creation timestamp | Yes |
| updated_at | String (ISO 8601) | Last update timestamp | Yes |

#### Calculation Examples
```javascript
// Regular day: 8 hours @ $35.50/hr
regular_hours: 8.0
overtime_hours: 0
doubletime_hours: 0
total_hours: 8.0
total_pay: 284.00

// Overtime day: 8 regular + 2 overtime @ $35.50/hr
regular_hours: 8.0
overtime_hours: 2.0
doubletime_hours: 0
total_hours: 10.0
total_pay: 284.00 + (2 * 35.50 * 1.5) = 390.50

// Holiday: 8 double-time @ $35.50/hr
regular_hours: 0
overtime_hours: 0
doubletime_hours: 8.0
total_hours: 8.0
total_pay: 568.00
```

#### Global Secondary Indexes

**GSI1-ProjectDateIndex**: Get all hours for a project
- PK: `project_id`
- SK: `date`
- Use Case: Project labor cost reports

**GSI2-WeekIndex**: Get all entries for a week
- PK: `week_number`
- SK: `PK` (employee)
- Use Case: Weekly payroll processing

**GSI3-MonthIndex**: Get all entries for a month
- PK: `month`
- SK: `PK` (employee)
- Use Case: Monthly payroll, financial reports

#### Capacity
- **Read**: 20 RCU (highest - frequent reporting queries)
- **Write**: 20 WCU (highest - daily entries for all employees)
- **Streams**: Enabled (NEW_AND_OLD_IMAGES)
- **Backup**: Point-in-time recovery enabled

---

## Key Design Patterns

### 1. Composite Sort Keys
The Time Tracking table uses a composite SK to allow multiple time entries per employee per day:
```
SK: DATE#2025-11-04#PROJECT#proj-001-uuid
```

This enables:
- One employee working on multiple projects in a day
- Efficient querying by date range
- Natural sorting chronologically

### 2. Denormalization for Performance
Frequently accessed data is denormalized to avoid joins:
- `employee_name` in Time Tracking (avoid lookup to Personnel table)
- `project_name` in Time Tracking (avoid lookup to Projects table)
- `hourly_rate` in Time Tracking (frozen at time of entry)

### 3. Multi-Value Sort Keys
Projects table uses SK for different entity types:
- `METADATA`: Core project information
- `TEAM#<employee_id>`: Team member assignments

This enables:
- Single query to get project + all team members
- Efficient team member add/remove operations

### 4. ISO Week Numbers
Week tracking uses ISO 8601 week format:
```
2025-W45 = Week 45 of 2025
```

Benefits:
- Standard format recognized globally
- Easy range queries
- Consistent week boundaries

---

## Access Patterns

For detailed access patterns, see [access-patterns.md](./access-patterns.md).

### Most Frequent Queries (in order)
1. **User Authentication** (Users table, GSI1)
2. **Get Employee Time Entries** (Time Tracking table, Primary Key)
3. **Get Project Details** (Projects table, Primary Key)
4. **Get Employee Details** (Personnel table, Primary Key)
5. **Get Active Projects** (Projects table, GSI2)

### Batch Operations
- **BatchGetItem**: Retrieve multiple employee/project records
- **BatchWriteItem**: Bulk import time entries
- **Query with FilterExpression**: Filter results client-side when needed

---

## Security Considerations

### Authentication
- Passwords hashed with bcrypt (12 salt rounds)
- Support for MFA (mfa_enabled flag)
- Password reset workflow (password_reset_required flag)
- Account disable capability

### Authorization
Four-tier role system:
```javascript
// Permission levels
const PERMISSIONS = {
  user: ['read_own_data', 'submit_time'],
  manager: ['read_own_data', 'submit_time', 'approve_time', 'view_team', 'manage_project'],
  admin: ['read_all_data', 'write_all_data', 'manage_users', 'manage_projects'],
  superadmin: ['*'] // All permissions
};
```

### Data Protection
- **Encryption at Rest**: AES-256 for all tables
- **Encryption in Transit**: HTTPS for all API calls
- **Point-in-Time Recovery**: Enabled on all tables
- **DynamoDB Streams**: Audit trail for all changes
- **Table Tags**: Sensitive data marked with `Sensitive=true`

### Access Control
```javascript
// Example: Verify user can access employee record
async function canAccessEmployee(userId, employeeId) {
  const user = await getUser(userId);

  if (user.role === 'superadmin' || user.role === 'admin') {
    return true; // Admins can access all
  }

  if (user.employee_id === employeeId) {
    return true; // Users can access their own
  }

  if (user.role === 'manager') {
    const employee = await getEmployee(employeeId);
    const projects = await getManagerProjects(user.employee_id);
    const employeeProjects = await getEmployeeProjects(employeeId);

    // Manager can access employees on their projects
    return projects.some(p => employeeProjects.includes(p.project_id));
  }

  return false;
}
```

---

## Cost Optimization

### Capacity Planning
Based on expected usage patterns:

| Table | RCU | WCU | Estimated Monthly Cost* |
|-------|-----|-----|------------------------|
| Personnel v2 | 10 | 10 | $12.79 |
| Projects | 10 | 10 | $12.79 |
| Users | 15 | 10 | $16.43 |
| Time Tracking | 20 | 20 | $25.58 |
| **Total** | **55** | **50** | **$67.59** |

*Based on US East (Ohio) pricing, 24/7 provisioned capacity

### Cost Reduction Strategies

#### 1. Auto Scaling (Recommended)
Enable auto-scaling to scale down during off-hours:
```bash
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/sitelogix-time-tracking \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --min-capacity 5 \
  --max-capacity 20
```

Potential savings: **30-50%**

#### 2. On-Demand Billing
For unpredictable workloads, consider on-demand pricing:
- Pay per request (no minimum)
- No capacity planning needed
- Best for spiky traffic

Convert to on-demand:
```bash
aws dynamodb update-table \
  --table-name sitelogix-time-tracking \
  --billing-mode PAY_PER_REQUEST
```

#### 3. Caching Strategy
Implement caching to reduce reads:
- **ElastiCache Redis**: Cache hot data (user sessions, frequent queries)
- **DynamoDB DAX**: Microsecond latency for frequently accessed items
- **Application-level cache**: In-memory cache for static data

Potential read reduction: **40-60%**

#### 4. Batch Operations
Use batch operations to reduce request costs:
```javascript
// Instead of 25 GetItem calls (25 RCU)
// Use BatchGetItem (8-10 RCU for same data)
const items = await dynamodb.batchGet({
  RequestItems: {
    'sitelogix-personnel-v2': {
      Keys: employeeIds.map(id => ({ PK: id, SK: 'METADATA' }))
    }
  }
}).promise();
```

---

## Getting Started

### Prerequisites
- AWS CLI configured with appropriate credentials
- Node.js 18+ (for scripts)
- DynamoDB access permissions

### Step 1: Create Tables
```bash
cd infrastructure/scripts
chmod +x create-admin-tables.sh
./create-admin-tables.sh
```

### Step 2: Load Sample Data
```bash
node scripts/load-sample-data.js
```

### Step 3: Test Access Patterns
```bash
node scripts/test-access-patterns.js
```

### Step 4: Migrate from V1 (if applicable)
Follow the detailed migration plan:
```bash
# See infrastructure/migration-plan.md
node scripts/migrate-personnel-v1-to-v2.js
```

---

## Monitoring and Maintenance

### CloudWatch Alarms
Set up alarms for:
- **Throttled Requests**: Alert if any table is throttled
- **Consumed Capacity**: Warn at 80% of provisioned capacity
- **Error Rates**: Alert on elevated error rates
- **Latency**: Alert if p99 latency exceeds 50ms

```bash
# Example: Create alarm for throttled reads
aws cloudwatch put-metric-alarm \
  --alarm-name sitelogix-time-tracking-throttled-reads \
  --alarm-description "Alert when time tracking table is throttled" \
  --metric-name UserErrors \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 60 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=TableName,Value=sitelogix-time-tracking
```

### Regular Maintenance Tasks
- **Weekly**: Review capacity metrics, adjust if needed
- **Monthly**: Analyze query patterns, optimize GSIs
- **Quarterly**: Review cost optimization opportunities
- **Annually**: Evaluate schema changes for new features

---

## Files in This Directory

| File | Description |
|------|-------------|
| `admin-tables-schemas.json` | Complete DynamoDB table schemas in JSON format |
| `sample-data.json` | Sample data for testing and development |
| `access-patterns.md` | Detailed documentation of all query patterns |
| `migration-plan.md` | Step-by-step migration guide from Personnel v1 to v2 |
| `scripts/create-admin-tables.sh` | Automated table creation script |
| `ADMIN_TABLES_README.md` | This file - comprehensive overview |

---

## Support and Troubleshooting

### Common Issues

#### Issue: Table creation fails with "Table already exists"
**Solution**: Delete existing table or run script in interactive mode to choose skip/recreate

#### Issue: GSI not populating
**Solution**: Check GSI status, ensure all required attributes are being written

#### Issue: Query returns no results
**Solution**: Verify key format matches exactly, check case sensitivity

#### Issue: Throttling errors
**Solution**: Increase provisioned capacity or enable auto-scaling

### Getting Help
For questions or issues:
1. Check documentation in `/docs` directory
2. Review CloudWatch logs for error details
3. Contact database team (see migration-plan.md for contacts)

---

## Changelog

### Version 2.0 (2025-11-05)
- Initial release of admin/project management tables
- Enhanced Personnel table with health tracking and hourly rates
- New Projects table with milestone tracking
- New Users/Auth table with RBAC
- New Time Tracking table with week/month aggregations

---

## License
Copyright 2025 SiteLogix. All rights reserved.
