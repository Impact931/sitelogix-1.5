# SiteLogix Database Table Relationships

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SiteLogix Database Schema                         │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│   sitelogix-users    │
│  (Authentication)    │
├──────────────────────┤
│ PK: USER#<uuid>      │
│ SK: METADATA         │
│                      │
│ - username (GSI1)    │◄──────────┐
│ - password_hash      │           │
│ - role               │           │ 1:1 Link
│ - employee_id (GSI2) │───────────┼──────────┐
│ - account_status     │           │          │
│ - last_login         │           │          │
│ - mfa_enabled        │           │          │
└──────────────────────┘           │          │
         │                         │          │
         │ Role-based             │          │
         │ Access                 │          │
         ▼                         │          ▼
                         ┌──────────────────────────┐
    ┌────────────────────┤ sitelogix-personnel-v2   │
    │                    │   (Employees)            │
    │                    ├──────────────────────────┤
    │                    │ PK: EMPLOYEE#<uuid>      │
    │                    │ SK: METADATA             │
    │                    │                          │
    │                    │ - employee_number (GSI2) │
    │                    │ - full_name (GSI1)       │
    │                    │ - role (GSI4)            │
    │                    │ - email                  │
    │                    │ - phone                  │
    │                    │ - team_id (GSI3) ────────┼──┐
    │                    │ - health_status          │  │
    │                    │ - status (GSI4)          │  │ Team
    │                    │ - hourly_rate            │  │ Membership
    │                    │ - certifications         │  │
    │                    └──────────────────────────┘  │
    │                             │                    │
    │ Manager                     │ Employee           │
    │ (created_by)                │ Assigned           │
    │                             │ to Project         │
    ▼                             ▼                    │
┌──────────────────────────┐                          │
│   sitelogix-projects     │◄─────────────────────────┘
│     (Projects)           │
├──────────────────────────┤
│ PK: PROJECT#<uuid>       │
│ SK: METADATA             │
│                          │
│ - project_name (GSI1)    │
│ - status (GSI2)          │
│ - start_date (GSI2 SK)   │
│ - location               │
│ - budget                 │
│ - milestones[]           │
│ - manager_id (GSI3) ─────┼──┐
│ - team_members[]         │  │ Manager
│                          │  │ Responsible
│ SK: TEAM#<employee_id>   │  │ For Project
│ (Team Assignments)       │  │
└──────────────────────────┘  │
         │                    │
         │ Project            │
         │ Assignment         │
         ▼                    │
┌────────────────────────────┐│
│ sitelogix-time-tracking    ││
│    (Hours Tracking)        ││
├────────────────────────────┤│
│ PK: EMPLOYEE#<uuid>        ││
│ SK: DATE#YYYY-MM-DD#       ││
│     PROJECT#<uuid>         ││
│                            ││
│ - project_id (GSI1)        ││
│ - date (GSI1 SK)           ││
│ - week_number (GSI2)       ││
│ - month (GSI3)             ││
│ - regular_hours            ││
│ - overtime_hours           ││
│ - doubletime_hours         ││
│ - total_hours              ││
│ - hourly_rate              ││
│ - total_pay                ││
│ - approved                 ││
│ - approved_by ─────────────┼┘
└────────────────────────────┘
```

---

## Relationship Details

### 1. Users ↔ Personnel (1:1)
**Relationship**: Each user account is linked to exactly one employee record

**Foreign Key**:
- `Users.employee_id` → `Personnel.PK`

**Use Case**:
- Get employee details from user session
- Get user account from employee record

**Query Examples**:
```javascript
// Get employee from user
const user = await getUser(userId);
const employee = await getEmployee(user.employee_id);

// Get user from employee
const users = await queryUsersByEmployee(employeeId); // Via GSI2
```

---

### 2. Personnel ↔ Projects (Many-to-Many)
**Relationship**: Employees can be assigned to multiple projects, projects have multiple employees

**Implementation**:
- `Projects.team_members[]` array stores employee IDs
- `Projects` table uses `SK: TEAM#<employee_id>` for individual assignments

**Use Cases**:
- View all projects an employee is assigned to
- View all team members on a project
- Assign/remove employees from projects

**Query Examples**:
```javascript
// Get employee's projects
const projects = await scanProjects({
  FilterExpression: 'contains(team_members, :empId)',
  ExpressionAttributeValues: { ':empId': employeeId }
});

// Get project's team
const team = await queryProject({
  PK: projectId,
  SK: { beginsWith: 'TEAM#' }
});
```

---

### 3. Personnel ↔ Projects (Manager) (1:Many)
**Relationship**: Each project has one manager, managers can manage multiple projects

**Foreign Key**:
- `Projects.manager_id` → `Personnel.PK`

**Use Cases**:
- View all projects managed by a user
- Identify project manager for approval workflows

**Query Examples**:
```javascript
// Get manager's projects
const projects = await queryProjectsByManager(managerId); // Via GSI3

// Get project manager
const project = await getProject(projectId);
const manager = await getEmployee(project.manager_id);
```

---

### 4. Personnel + Projects → Time Tracking (Composite)
**Relationship**: Time entries link employees to projects for specific dates

**Foreign Keys**:
- `TimeTracking.PK` contains `employee_id`
- `TimeTracking.SK` contains `project_id`

**Use Cases**:
- Record hours worked by employee on project
- Calculate labor costs for project
- Generate payroll reports for employee

**Query Examples**:
```javascript
// Get employee's hours for date range
const hours = await queryTimeTracking({
  PK: `EMPLOYEE#${employeeId}`,
  SK: { between: ['DATE#2025-11-01', 'DATE#2025-11-30'] }
});

// Get project labor costs
const hours = await queryTimeTrackingByProject(projectId); // Via GSI1
const totalCost = hours.reduce((sum, h) => sum + h.total_pay, 0);
```

---

### 5. Time Tracking ↔ Personnel (Approval) (Many-to-1)
**Relationship**: Time entries can be approved by managers

**Foreign Key**:
- `TimeTracking.approved_by` → `Personnel.PK`

**Use Cases**:
- Track who approved time entries
- Manager approval workflow
- Audit trail

**Query Examples**:
```javascript
// Get unapproved entries for week
const entries = await queryTimeTrackingByWeek('2025-W45', {
  FilterExpression: 'approved = :false',
  ExpressionAttributeValues: { ':false': false }
});

// Approve entries
await updateTimeEntry(entry, {
  approved: true,
  approved_by: managerId,
  approved_at: new Date().toISOString()
});
```

---

## Data Flow Diagrams

### User Login Flow
```
┌──────┐     ┌───────────┐     ┌──────────────┐     ┌─────────────┐
│Client│────▶│  API      │────▶│ sitelogix-   │────▶│  sitelogix- │
│      │     │  Handler  │     │ users        │     │  personnel  │
│      │     │           │     │ (GSI1)       │     │             │
└──────┘     └───────────┘     └──────────────┘     └─────────────┘
   │              │                    │                     │
   │ POST /login  │                    │                     │
   │ {username,   │  Query by          │  Get employee      │
   │  password}   │  username          │  details           │
   │              │                    │                     │
   │              │  ◄─────────────────┘                     │
   │              │  User record                             │
   │              │  (with employee_id)                      │
   │              │                                          │
   │              │  ─────────────────────────────────────▶  │
   │              │  Get employee by PK                      │
   │              │                                          │
   │              │  ◄───────────────────────────────────────┘
   │              │  Employee record                         │
   │              │                                          │
   │  ◄───────────┘                                          │
   │  JWT token + user profile                              │
   │                                                         │
```

### Project Assignment Flow
```
┌────────┐     ┌──────────┐     ┌────────────┐     ┌──────────────┐
│Manager │────▶│   API    │────▶│ sitelogix- │────▶│  sitelogix-  │
│        │     │          │     │ projects   │     │  personnel   │
└────────┘     └──────────┘     └────────────┘     └──────────────┘
    │               │                  │                   │
    │ POST /projects/:id/team          │                   │
    │ {employee_ids: [...]}            │                   │
    │               │                  │                   │
    │               │  Verify manager  │                   │
    │               │  owns project    │                   │
    │               │  (GSI3)          │                   │
    │               │                  │                   │
    │               │  Get employees   │                   │
    │               │  ────────────────────────────────▶   │
    │               │                  │                   │
    │               │  ◄────────────────────────────────   │
    │               │  Employee records                    │
    │               │                  │                   │
    │               │  Update project  │                   │
    │               │  team_members[]  │                   │
    │               │  ────────────▶   │                   │
    │               │                  │                   │
    │               │  Add TEAM# items │                   │
    │               │  for each member │                   │
    │               │  ────────────▶   │                   │
    │               │                  │                   │
    │  ◄────────────┘                  │                   │
    │  Success                         │                   │
    │                                  │                   │
```

### Time Entry Submission Flow
```
┌──────────┐   ┌─────────┐   ┌────────────┐   ┌──────────┐   ┌──────────┐
│Voice     │──▶│  API    │──▶│ sitelogix- │──▶│sitelogix-│──▶│sitelogix-│
│Report    │   │         │   │ personnel  │   │projects  │   │time-     │
│          │   │         │   │            │   │          │   │tracking  │
└──────────┘   └─────────┘   └────────────┘   └──────────┘   └──────────┘
     │              │               │               │              │
     │ Transcript   │               │               │              │
     │ with hours   │               │               │              │
     │              │  Get employee │               │              │
     │              │  by name      │               │              │
     │              │  (GSI1)       │               │              │
     │              │  ───────────▶ │               │              │
     │              │               │               │              │
     │              │  ◄────────────┘               │              │
     │              │  Employee ID                  │              │
     │              │                               │              │
     │              │  Get project by name          │              │
     │              │  (GSI1)                       │              │
     │              │  ─────────────────────────▶   │              │
     │              │                               │              │
     │              │  ◄─────────────────────────   │              │
     │              │  Project ID                   │              │
     │              │                               │              │
     │              │  Create time entry            │              │
     │              │  ──────────────────────────────────────────▶ │
     │              │  PK: EMPLOYEE#<id>            │              │
     │              │  SK: DATE#2025-11-05#PROJECT#<id>           │
     │              │                               │              │
     │  ◄───────────┘                               │              │
     │  Confirmation                                │              │
     │                                              │              │
```

### Payroll Report Generation Flow
```
┌──────────┐   ┌─────────┐   ┌──────────────┐   ┌──────────────┐
│CFO       │──▶│  API    │──▶│  sitelogix-  │──▶│  sitelogix-  │
│Dashboard │   │         │   │  personnel   │   │  time-       │
│          │   │         │   │              │   │  tracking    │
└──────────┘   └─────────┘   └──────────────┘   └──────────────┘
     │              │               │                   │
     │ GET /reports/payroll         │                   │
     │ ?month=2025-11               │                   │
     │              │               │                   │
     │              │  Get all active employees         │
     │              │  (GSI4: role+status)              │
     │              │  ───────────▶ │                   │
     │              │               │                   │
     │              │  ◄────────────┘                   │
     │              │  Employee list                    │
     │              │                                   │
     │              │  For each employee:               │
     │              │  Query time entries by month      │
     │              │  (GSI3: month index)              │
     │              │  ─────────────────────────────▶   │
     │              │                                   │
     │              │  ◄─────────────────────────────   │
     │              │  Time entries                     │
     │              │                                   │
     │              │  Aggregate:                       │
     │              │  - Total hours                    │
     │              │  - Regular/OT/DT breakdown        │
     │              │  - Total pay                      │
     │              │  - Projects worked                │
     │              │                                   │
     │  ◄───────────┘                                   │
     │  Payroll report with:                            │
     │  - Employee details                              │
     │  - Hours breakdown                               │
     │  - Total compensation                            │
     │                                                  │
```

---

## Key Patterns Used

### 1. Denormalization
To avoid expensive cross-table joins, we denormalize frequently accessed data:

**Time Tracking Table**:
- Stores `employee_name` (from Personnel)
- Stores `project_name` (from Projects)
- Stores `hourly_rate` (from Personnel, frozen at entry time)

**Benefit**: Single query gets all needed data for display
**Trade-off**: Must update denormalized data when source changes

---

### 2. Composite Keys
Allow multiple related items under same partition:

**Projects Table**:
```
PK: PROJECT#001, SK: METADATA       → Project details
PK: PROJECT#001, SK: TEAM#emp-001   → Team member 1
PK: PROJECT#001, SK: TEAM#emp-002   → Team member 2
```

**Benefit**: Get project + all team members in single query

---

### 3. Global Secondary Indexes (GSI)
Enable flexible query patterns:

**Personnel GSI4-RoleStatusIndex**:
- Query by role: Get all managers
- Query by role+status: Get all active managers

**Time Tracking GSI2-WeekIndex**:
- Query by week: Get all entries for week 45
- Filter by employee: Get specific employee's week

---

### 4. Adjacency List Pattern
Model many-to-many relationships:

**Employee-Project Assignment**:
```
Projects table stores team_members[] array
Each assignment also stored as SK: TEAM#<employee_id>
```

**Benefit**:
- Quick lookup of project team
- Quick addition/removal of members
- Maintains referential integrity

---

## Query Complexity Guide

| Query Type | Complexity | RCU Cost | Example |
|------------|------------|----------|---------|
| **GetItem** (by PK+SK) | O(1) | 0.5-1 | Get employee by ID |
| **Query** (by PK) | O(n) | 0.5n | Get all team members for project |
| **Query** (by GSI) | O(n) | 0.5n | Get employee by name |
| **Query with Filter** | O(n) | 0.5n | Get unapproved time entries (scans all, filters client-side) |
| **Scan** | O(N) | 0.5N | Get all employees (avoid!) |
| **BatchGetItem** | O(k) | 0.5k | Get 25 employees at once |

**Legend**:
- n = items returned
- N = total items in table
- k = items requested

**Best Practices**:
- Always use GetItem when you have full key
- Use Query over Scan whenever possible
- Use GSIs for alternate access patterns
- Use BatchGetItem for multiple items
- Avoid FilterExpression on large result sets

---

## Consistency Model

### Strong Consistency
DynamoDB uses **eventual consistency** by default, but you can request **strong consistency**:

```javascript
// Strongly consistent read
const result = await dynamodb.get({
  TableName: 'sitelogix-users',
  Key: { PK: userId, SK: 'METADATA' },
  ConsistentRead: true  // Forces strong consistency
}).promise();
```

**When to use strong consistency**:
- Authentication queries (must have latest password)
- Financial calculations (must have accurate amounts)
- After write, immediate read of same item

**When eventual consistency is OK**:
- Dashboard displays (slightly stale data acceptable)
- Search results (not critical if seconds old)
- Reporting queries (aggregate data)

**Cost**: Strong consistency reads cost **2x RCU**

---

## Scaling Considerations

### Partition Key Distribution
Good distribution prevents hot partitions:

**Good** (unique per item):
- `EMPLOYEE#<uuid>` ✅
- `PROJECT#<uuid>` ✅
- `USER#<uuid>` ✅

**Risky** (potential hot partition):
- `WEEK#2025-W45` ⚠️ (all employees write to same partition)
- `DATE#2025-11-05` ⚠️ (all time entries for one day)

**Solution for risky keys**: Use composite PK or shard:
- `EMPLOYEE#<uuid>` as PK, `DATE#2025-11-05` as SK ✅

### Burst Capacity
DynamoDB provides burst capacity:
- Can handle 2x provisioned capacity for 5 minutes
- Good for handling spikes (e.g., all employees clock out at 5pm)

### Write Sharding
For very high write volume, consider write sharding:
```javascript
// Instead of: PK: WEEK#2025-W45
// Use: PK: WEEK#2025-W45#SHARD#{hash % 10}
```

---

## Backup and Recovery

### Point-in-Time Recovery (PITR)
All tables have PITR enabled:
- Continuous backups for 35 days
- Restore to any second in the past 35 days
- No performance impact

**Recovery Process**:
```bash
# Restore table to specific timestamp
aws dynamodb restore-table-to-point-in-time \
  --source-table-name sitelogix-users \
  --target-table-name sitelogix-users-restored \
  --restore-date-time 2025-11-04T10:00:00Z
```

### On-Demand Backups
Create snapshots for long-term retention:
```bash
# Create backup
aws dynamodb create-backup \
  --table-name sitelogix-users \
  --backup-name users-backup-2025-11-05

# Restore from backup
aws dynamodb restore-table-from-backup \
  --target-table-name sitelogix-users-restored \
  --backup-arn arn:aws:dynamodb:us-east-1:123456789:table/sitelogix-users/backup/12345
```

### DynamoDB Streams
Audit trail for all changes:
- Captures before/after image of every item
- 24-hour retention
- Can trigger Lambda functions
- Can replicate to other systems

**Use Cases**:
- Audit logging
- Data replication
- Real-time notifications
- Materialized views

---

## Performance Optimization Checklist

- [ ] Use GetItem instead of Query when you have full key
- [ ] Use BatchGetItem for multiple items (up to 100)
- [ ] Cache frequently accessed data (user sessions, config)
- [ ] Use GSIs for alternate access patterns (don't scan)
- [ ] Denormalize data to avoid joins
- [ ] Use projection expressions to retrieve only needed attributes
- [ ] Consider eventual consistency for non-critical reads
- [ ] Monitor consumed capacity and adjust provisioning
- [ ] Use sparse indexes to reduce GSI costs
- [ ] Implement pagination for large result sets

---

## Related Documentation

- [admin-tables-schemas.json](./admin-tables-schemas.json) - Complete table definitions
- [sample-data.json](./sample-data.json) - Test data examples
- [access-patterns.md](./access-patterns.md) - Detailed query patterns
- [migration-plan.md](./migration-plan.md) - Migration guide
- [ADMIN_TABLES_README.md](./ADMIN_TABLES_README.md) - Comprehensive overview
