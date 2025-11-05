# DynamoDB Access Patterns Documentation

## Overview
This document outlines all query patterns needed for the SiteLogix admin/project management features, organized by table and use case.

---

## Enhanced Personnel Table (sitelogix-personnel-v2)

### Primary Key Structure
- **PK**: `EMPLOYEE#<employee_id>`
- **SK**: `METADATA`

### Access Patterns

#### 1. Get Employee by ID (Primary Key Query)
**Use Case**: View employee details, authenticate user
**Query Type**: GetItem
```javascript
{
  TableName: "sitelogix-personnel-v2",
  Key: {
    PK: "EMPLOYEE#emp-001-uuid",
    SK: "METADATA"
  }
}
```
**Performance**: O(1) - Direct key lookup

---

#### 2. Search Employee by Name (GSI1-NameIndex)
**Use Case**: Search/autocomplete functionality
**Query Type**: Query on GSI1
```javascript
{
  TableName: "sitelogix-personnel-v2",
  IndexName: "GSI1-NameIndex",
  KeyConditionExpression: "full_name = :name",
  ExpressionAttributeValues: {
    ":name": "John Smith"
  }
}
```
**Performance**: O(1) for exact match

---

#### 3. Get Employee by Employee Number (GSI2-EmployeeNumberIndex)
**Use Case**: Badge scanning, payroll integration
**Query Type**: Query on GSI2
```javascript
{
  TableName: "sitelogix-personnel-v2",
  IndexName: "GSI2-EmployeeNumberIndex",
  KeyConditionExpression: "employee_number = :empNum",
  ExpressionAttributeValues: {
    ":empNum": "EMP001"
  }
}
```
**Performance**: O(1) - Unique identifier lookup

---

#### 4. Get All Employees in a Team (GSI3-TeamIndex)
**Use Case**: Team management, assigning tasks to team
**Query Type**: Query on GSI3
```javascript
{
  TableName: "sitelogix-personnel-v2",
  IndexName: "GSI3-TeamIndex",
  KeyConditionExpression: "team_id = :teamId",
  ExpressionAttributeValues: {
    ":teamId": "TEAM#team-001-uuid"
  }
}
```
**Performance**: O(n) where n = team members

---

#### 5. Get All Active Managers (GSI4-RoleStatusIndex)
**Use Case**: Project assignment, manager selection dropdown
**Query Type**: Query on GSI4
```javascript
{
  TableName: "sitelogix-personnel-v2",
  IndexName: "GSI4-RoleStatusIndex",
  KeyConditionExpression: "role = :role AND status = :status",
  ExpressionAttributeValues: {
    ":role": "manager",
    ":status": "active"
  }
}
```
**Performance**: O(n) where n = active managers

---

#### 6. Get All Active Employees (GSI4-RoleStatusIndex)
**Use Case**: Dashboard displays, reporting
**Query Type**: Query on GSI4
```javascript
{
  TableName: "sitelogix-personnel-v2",
  IndexName: "GSI4-RoleStatusIndex",
  KeyConditionExpression: "role = :role AND status = :status",
  ExpressionAttributeValues: {
    ":role": "user",
    ":status": "active"
  }
}
```
**Performance**: O(n) where n = active employees

---

#### 7. Update Employee Health Status
**Use Case**: Record injury, medical restrictions
**Query Type**: UpdateItem
```javascript
{
  TableName: "sitelogix-personnel-v2",
  Key: {
    PK: "EMPLOYEE#emp-001-uuid",
    SK: "METADATA"
  },
  UpdateExpression: "SET health_status = :status, health_notes = :notes, updated_at = :timestamp",
  ExpressionAttributeValues: {
    ":status": "medical_restriction",
    ":notes": "Light duty only",
    ":timestamp": "2025-11-05T10:30:00Z"
  }
}
```

---

## Projects Table (sitelogix-projects)

### Primary Key Structure
- **PK**: `PROJECT#<project_id>`
- **SK**: `METADATA` (for project details) or `TEAM#<employee_id>` (for team members)

### Access Patterns

#### 1. Get Project by ID (Primary Key Query)
**Use Case**: View project details
**Query Type**: GetItem
```javascript
{
  TableName: "sitelogix-projects",
  Key: {
    PK: "PROJECT#proj-001-uuid",
    SK: "METADATA"
  }
}
```
**Performance**: O(1)

---

#### 2. Search Project by Name (GSI1-ProjectNameIndex)
**Use Case**: Project search functionality
**Query Type**: Query on GSI1
```javascript
{
  TableName: "sitelogix-projects",
  IndexName: "GSI1-ProjectNameIndex",
  KeyConditionExpression: "project_name = :name",
  ExpressionAttributeValues: {
    ":name": "Downtown Office Complex"
  }
}
```
**Performance**: O(1) for exact match

---

#### 3. Get All Active Projects (GSI2-StatusIndex)
**Use Case**: Dashboard, active projects list
**Query Type**: Query on GSI2
```javascript
{
  TableName: "sitelogix-projects",
  IndexName: "GSI2-StatusIndex",
  KeyConditionExpression: "status = :status",
  ExpressionAttributeValues: {
    ":status": "active"
  },
  ScanIndexForward: false // Most recent first
}
```
**Performance**: O(n) where n = active projects

---

#### 4. Get All Projects by Status with Date Range (GSI2-StatusIndex)
**Use Case**: Filter projects by status and timeframe
**Query Type**: Query on GSI2 with range condition
```javascript
{
  TableName: "sitelogix-projects",
  IndexName: "GSI2-StatusIndex",
  KeyConditionExpression: "status = :status AND start_date BETWEEN :startDate AND :endDate",
  ExpressionAttributeValues: {
    ":status": "active",
    ":startDate": "2024-01-01",
    ":endDate": "2024-12-31"
  }
}
```
**Performance**: O(n) where n = matching projects

---

#### 5. Get All Projects Managed by User (GSI3-ManagerIndex)
**Use Case**: Manager's project dashboard
**Query Type**: Query on GSI3
```javascript
{
  TableName: "sitelogix-projects",
  IndexName: "GSI3-ManagerIndex",
  KeyConditionExpression: "manager_id = :managerId",
  ExpressionAttributeValues: {
    ":managerId": "EMPLOYEE#emp-002-uuid"
  },
  ScanIndexForward: false // Most recent first
}
```
**Performance**: O(n) where n = manager's projects

---

#### 6. Get Project Team Members (Primary Key Query with SK prefix)
**Use Case**: View all team members assigned to project
**Query Type**: Query
```javascript
{
  TableName: "sitelogix-projects",
  KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
  ExpressionAttributeValues: {
    ":pk": "PROJECT#proj-001-uuid",
    ":skPrefix": "TEAM#"
  }
}
```
**Performance**: O(n) where n = team members

---

#### 7. Assign Team Member to Project
**Use Case**: Add employee to project team
**Query Type**: PutItem
```javascript
{
  TableName: "sitelogix-projects",
  Item: {
    PK: "PROJECT#proj-001-uuid",
    SK: "TEAM#emp-001-uuid",
    employee_id: "emp-001-uuid",
    employee_name: "John Smith",
    role_on_project: "foreman",
    assigned_at: "2025-11-05T10:30:00Z",
    assigned_by: "MANAGER#emp-002-uuid"
  }
}
```

---

#### 8. Update Project Status and Milestones
**Use Case**: Progress tracking, milestone completion
**Query Type**: UpdateItem
```javascript
{
  TableName: "sitelogix-projects",
  Key: {
    PK: "PROJECT#proj-001-uuid",
    SK: "METADATA"
  },
  UpdateExpression: "SET status = :status, milestones = :milestones, updated_at = :timestamp",
  ExpressionAttributeValues: {
    ":status": "active",
    ":milestones": [...updatedMilestones],
    ":timestamp": "2025-11-05T10:30:00Z"
  }
}
```

---

## Users/Auth Table (sitelogix-users)

### Primary Key Structure
- **PK**: `USER#<user_id>`
- **SK**: `METADATA`

### Access Patterns

#### 1. Authenticate User by Username (GSI1-UsernameIndex) **CRITICAL PATH**
**Use Case**: Login authentication
**Query Type**: Query on GSI1
```javascript
{
  TableName: "sitelogix-users",
  IndexName: "GSI1-UsernameIndex",
  KeyConditionExpression: "username = :username",
  ExpressionAttributeValues: {
    ":username": "jsmith"
  }
}
```
**Performance**: O(1) - Most frequent query, higher RCU allocation
**Note**: Compare password hash after retrieval

---

#### 2. Get User by ID (Primary Key Query)
**Use Case**: Session validation, profile view
**Query Type**: GetItem
```javascript
{
  TableName: "sitelogix-users",
  Key: {
    PK: "USER#user-001-uuid",
    SK: "METADATA"
  }
}
```
**Performance**: O(1)

---

#### 3. Get User by Employee ID (GSI2-EmployeeIndex)
**Use Case**: Link user account to employee record
**Query Type**: Query on GSI2
```javascript
{
  TableName: "sitelogix-users",
  IndexName: "GSI2-EmployeeIndex",
  KeyConditionExpression: "employee_id = :empId",
  ExpressionAttributeValues: {
    ":empId": "EMPLOYEE#emp-001-uuid"
  }
}
```
**Performance**: O(1) - Should be 1:1 relationship

---

#### 4. Get All Active Admins (GSI3-RoleStatusIndex)
**Use Case**: Admin management, notifications
**Query Type**: Query on GSI3
```javascript
{
  TableName: "sitelogix-users",
  IndexName: "GSI3-RoleStatusIndex",
  KeyConditionExpression: "role = :role AND account_status = :status",
  ExpressionAttributeValues: {
    ":role": "admin",
    ":status": "active"
  }
}
```
**Performance**: O(n) where n = active admins

---

#### 5. Update Last Login Timestamp
**Use Case**: Track user activity
**Query Type**: UpdateItem
```javascript
{
  TableName: "sitelogix-users",
  Key: {
    PK: "USER#user-001-uuid",
    SK: "METADATA"
  },
  UpdateExpression: "SET last_login = :timestamp, login_count = login_count + :inc",
  ExpressionAttributeValues: {
    ":timestamp": "2025-11-05T10:30:00Z",
    ":inc": 1
  }
}
```

---

#### 6. Disable User Account
**Use Case**: Terminate employee, security incident
**Query Type**: UpdateItem
```javascript
{
  TableName: "sitelogix-users",
  Key: {
    PK: "USER#user-001-uuid",
    SK: "METADATA"
  },
  UpdateExpression: "SET account_status = :status, updated_at = :timestamp",
  ExpressionAttributeValues: {
    ":status": "disabled",
    ":timestamp": "2025-11-05T10:30:00Z"
  }
}
```

---

#### 7. Reset Password
**Use Case**: Forgot password, forced reset
**Query Type**: UpdateItem
```javascript
{
  TableName: "sitelogix-users",
  Key: {
    PK: "USER#user-001-uuid",
    SK: "METADATA"
  },
  UpdateExpression: "SET password_hash = :hash, password_reset_required = :required, updated_at = :timestamp",
  ExpressionAttributeValues: {
    ":hash": "$2b$12$...",
    ":required": false,
    ":timestamp": "2025-11-05T10:30:00Z"
  }
}
```

---

## Time Tracking Table (sitelogix-time-tracking)

### Primary Key Structure
- **PK**: `EMPLOYEE#<employee_id>`
- **SK**: `DATE#<YYYY-MM-DD>#PROJECT#<project_id>`

### Access Patterns

#### 1. Get Employee Hours for Specific Date and Project
**Use Case**: Time entry verification
**Query Type**: GetItem
```javascript
{
  TableName: "sitelogix-time-tracking",
  Key: {
    PK: "EMPLOYEE#emp-001-uuid",
    SK: "DATE#2025-11-04#PROJECT#proj-001-uuid"
  }
}
```
**Performance**: O(1)

---

#### 2. Get All Hours for Employee in Date Range
**Use Case**: Payroll calculation, timesheet review
**Query Type**: Query with range condition
```javascript
{
  TableName: "sitelogix-time-tracking",
  KeyConditionExpression: "PK = :empId AND SK BETWEEN :startDate AND :endDate",
  ExpressionAttributeValues: {
    ":empId": "EMPLOYEE#emp-001-uuid",
    ":startDate": "DATE#2025-11-01",
    ":endDate": "DATE#2025-11-30"
  }
}
```
**Performance**: O(n) where n = days worked

---

#### 3. Get All Hours for Employee in Week
**Use Case**: Weekly timesheet, weekly payroll
**Query Type**: Query on GSI2-WeekIndex
```javascript
{
  TableName: "sitelogix-time-tracking",
  IndexName: "GSI2-WeekIndex",
  KeyConditionExpression: "week_number = :week AND begins_with(PK, :empPrefix)",
  ExpressionAttributeValues: {
    ":week": "2025-W45",
    ":empPrefix": "EMPLOYEE#emp-001-uuid"
  }
}
```
**Performance**: O(n) where n = entries for employee in week

---

#### 4. Get All Hours for Employee in Month
**Use Case**: Monthly payroll, expense tracking
**Query Type**: Query on GSI3-MonthIndex
```javascript
{
  TableName: "sitelogix-time-tracking",
  IndexName: "GSI3-MonthIndex",
  KeyConditionExpression: "month = :month AND begins_with(PK, :empPrefix)",
  ExpressionAttributeValues: {
    ":month": "2025-11",
    ":empPrefix": "EMPLOYEE#emp-001-uuid"
  }
}
```
**Performance**: O(n) where n = entries for employee in month

---

#### 5. Get All Hours for Project in Date Range (GSI1-ProjectDateIndex)
**Use Case**: Project cost tracking, budget analysis
**Query Type**: Query on GSI1
```javascript
{
  TableName: "sitelogix-time-tracking",
  IndexName: "GSI1-ProjectDateIndex",
  KeyConditionExpression: "project_id = :projId AND date BETWEEN :startDate AND :endDate",
  ExpressionAttributeValues: {
    ":projId": "proj-001-uuid",
    ":startDate": "2025-11-01",
    ":endDate": "2025-11-30"
  }
}
```
**Performance**: O(n) where n = all employee entries for project in range

---

#### 6. Get All Hours for Project in Week (GSI1-ProjectDateIndex)
**Use Case**: Weekly project cost reports
**Query Type**: Query on GSI1 with date range for week
```javascript
{
  TableName: "sitelogix-time-tracking",
  IndexName: "GSI1-ProjectDateIndex",
  KeyConditionExpression: "project_id = :projId AND date BETWEEN :weekStart AND :weekEnd",
  ExpressionAttributeValues: {
    ":projId": "proj-001-uuid",
    ":weekStart": "2025-11-04",
    ":weekEnd": "2025-11-10"
  }
}
```
**Performance**: O(n) where n = all entries for project in week

---

#### 7. Get All Unapproved Time Entries for Week (GSI2-WeekIndex)
**Use Case**: Manager approval workflow
**Query Type**: Query on GSI2 with filter
```javascript
{
  TableName: "sitelogix-time-tracking",
  IndexName: "GSI2-WeekIndex",
  KeyConditionExpression: "week_number = :week",
  FilterExpression: "approved = :approved",
  ExpressionAttributeValues: {
    ":week": "2025-W45",
    ":approved": false
  }
}
```
**Performance**: O(n) where n = all entries in week (filtered client-side)

---

#### 8. Record Time Entry
**Use Case**: Daily time tracking, voice report processing
**Query Type**: PutItem
```javascript
{
  TableName: "sitelogix-time-tracking",
  Item: {
    PK: "EMPLOYEE#emp-001-uuid",
    SK: "DATE#2025-11-04#PROJECT#proj-001-uuid",
    employee_id: "emp-001-uuid",
    employee_name: "John Smith",
    project_id: "proj-001-uuid",
    project_name: "Downtown Office Complex",
    date: "2025-11-04",
    week_number: "2025-W45",
    month: "2025-11",
    regular_hours: 8.0,
    overtime_hours: 0,
    doubletime_hours: 0,
    total_hours: 8.0,
    hourly_rate: 35.50,
    total_pay: 284.00,
    approved: false,
    created_at: "2025-11-04T17:00:00Z",
    updated_at: "2025-11-04T17:00:00Z"
  }
}
```

---

#### 9. Approve Time Entry
**Use Case**: Manager approval
**Query Type**: UpdateItem
```javascript
{
  TableName: "sitelogix-time-tracking",
  Key: {
    PK: "EMPLOYEE#emp-001-uuid",
    SK: "DATE#2025-11-04#PROJECT#proj-001-uuid"
  },
  UpdateExpression: "SET approved = :approved, approved_by = :approver, approved_at = :timestamp, updated_at = :timestamp",
  ExpressionAttributeValues: {
    ":approved": true,
    ":approver": "MANAGER#emp-002-uuid",
    ":timestamp": "2025-11-05T08:00:00Z"
  }
}
```

---

## Cross-Table Access Patterns

### 1. Get Complete User Profile (Users + Personnel)
**Use Case**: User dashboard, profile page
**Steps**:
1. Query Users table by username (GSI1)
2. Get Personnel record using employee_id from User record
```javascript
// Step 1
const user = await query(UsersTable, GSI1, { username: "jsmith" });
// Step 2
const employee = await getItem(PersonnelTable, {
  PK: user.employee_id,
  SK: "METADATA"
});
```

---

### 2. Get Project with Team Details (Projects + Personnel)
**Use Case**: Project detail page with team roster
**Steps**:
1. Get Project metadata
2. Query Project team members (SK begins_with "TEAM#")
3. BatchGet Personnel records for each team member
```javascript
// Step 1
const project = await getItem(ProjectsTable, {
  PK: "PROJECT#proj-001-uuid",
  SK: "METADATA"
});
// Step 2
const teamAssignments = await query(ProjectsTable, {
  PK: "PROJECT#proj-001-uuid",
  SK: { beginsWith: "TEAM#" }
});
// Step 3
const teamDetails = await batchGet(PersonnelTable, teamAssignments.map(t => ({
  PK: t.employee_id,
  SK: "METADATA"
})));
```

---

### 3. Calculate Project Labor Costs (Projects + Time Tracking)
**Use Case**: Project financial reports
**Steps**:
1. Get Project details
2. Query Time Tracking by project_id and date range (GSI1)
3. Sum total_pay for all entries
```javascript
// Step 1
const project = await getItem(ProjectsTable, {
  PK: "PROJECT#proj-001-uuid",
  SK: "METADATA"
});
// Step 2
const timeEntries = await query(TimeTrackingTable, GSI1, {
  project_id: "proj-001-uuid",
  date: { between: ["2025-11-01", "2025-11-30"] }
});
// Step 3
const totalLaborCost = timeEntries.reduce((sum, entry) => sum + entry.total_pay, 0);
```

---

### 4. Employee Utilization Report (Personnel + Time Tracking)
**Use Case**: Resource allocation analysis
**Steps**:
1. Get all active employees (Personnel GSI4)
2. For each employee, query Time Tracking for date range
3. Calculate utilization percentage
```javascript
// Step 1
const employees = await query(PersonnelTable, GSI4, {
  role: "user",
  status: "active"
});
// Step 2 & 3
const utilization = await Promise.all(employees.map(async emp => {
  const hours = await query(TimeTrackingTable, {
    PK: emp.PK,
    SK: { between: ["DATE#2025-11-01", "DATE#2025-11-30"] }
  });
  const totalHours = hours.reduce((sum, h) => sum + h.total_hours, 0);
  return {
    employee: emp.full_name,
    hours: totalHours,
    utilization: (totalHours / 160) * 100 // Assuming 160 hrs/month
  };
}));
```

---

## Performance Considerations

### Read Capacity Units (RCU) Allocation
- **Users Table**: 15 RCU (high read frequency for auth)
- **Time Tracking Table**: 20 RCU (frequent queries for payroll/reports)
- **Projects Table**: 10 RCU (moderate read frequency)
- **Personnel Table**: 10 RCU (moderate read frequency)

### Write Capacity Units (WCU) Allocation
- **Time Tracking Table**: 20 WCU (daily entries for all employees)
- **Projects Table**: 10 WCU (moderate updates)
- **Personnel Table**: 10 WCU (infrequent updates)
- **Users Table**: 10 WCU (login updates, infrequent account changes)

### Caching Strategy
1. **User sessions**: Cache user data for 15 minutes
2. **Project metadata**: Cache for 5 minutes
3. **Personnel records**: Cache for 10 minutes
4. **Time entries**: Do not cache (needs real-time accuracy)

### Batch Operations
- Use BatchGetItem for retrieving multiple personnel/project records
- Use BatchWriteItem for bulk time entry imports
- Limit batch sizes to 25 items per request

### Index Selection Guidelines
1. Always use GetItem when you have the full primary key
2. Use GSI1 (username) for all login operations
3. Use GSI2 (week/month indexes) for payroll operations
4. Use GSI3 (team/manager indexes) for team management
5. Avoid scans at all costs - all queries should use keys or GSIs

---

## Monitoring Queries

### Track Throttled Requests
Monitor CloudWatch metrics:
- `UserErrors` (throttling)
- `SystemErrors`
- `ConsumedReadCapacityUnits`
- `ConsumedWriteCapacityUnits`

### Set Alarms For
1. RCU utilization > 80%
2. WCU utilization > 80%
3. Throttled requests > 0
4. Read/Write latency > 50ms (p99)
