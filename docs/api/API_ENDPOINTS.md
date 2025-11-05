# SiteLogix API Endpoints - Admin, Auth, and Project Management

**Version:** 2.0
**Last Updated:** November 5, 2025
**Base URL:** `https://api.sitelogix.com` or Lambda Function URL
**Authentication:** JWT Bearer Token

---

## Table of Contents

1. [Authentication](#authentication)
2. [Employee/User Management](#employeeuser-management)
3. [Project Management](#project-management)
4. [Time Tracking](#time-tracking)
5. [Error Handling](#error-handling)
6. [Permissions Matrix](#permissions-matrix)

---

## Authentication

### POST /api/auth/login

Login with username and passcode, returns JWT token.

**Request:**
```json
{
  "username": "jsmith",
  "passcode": "123456"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "userId": "usr_001",
    "username": "jsmith",
    "email": "john.smith@example.com",
    "fullName": "John Smith",
    "role": "manager",
    "permissions": ["read:reports", "write:reports", "manage:personnel"]
  }
}
```

**Error Response:** `401 Unauthorized`
```json
{
  "success": false,
  "error": "Invalid credentials",
  "code": "AUTH_FAILED"
}
```

**Permissions:** None (public endpoint)

---

### POST /api/auth/logout

Invalidate current session and JWT token.

**Headers:**
- `Authorization: Bearer {token}`

**Request:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

**Permissions:** Authenticated user

---

### POST /api/auth/refresh

Refresh JWT token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

**Error Response:** `401 Unauthorized`
```json
{
  "success": false,
  "error": "Invalid or expired refresh token",
  "code": "TOKEN_EXPIRED"
}
```

**Permissions:** None (uses refresh token)

---

### GET /api/auth/me

Get current authenticated user information.

**Headers:**
- `Authorization: Bearer {token}`

**Response:** `200 OK`
```json
{
  "success": true,
  "user": {
    "userId": "usr_001",
    "username": "jsmith",
    "email": "john.smith@example.com",
    "fullName": "John Smith",
    "role": "manager",
    "projectAssignments": ["proj_001", "proj_003"],
    "permissions": ["read:reports", "write:reports", "manage:personnel"],
    "lastLogin": "2025-11-05T10:30:00Z",
    "createdAt": "2025-01-15T08:00:00Z"
  }
}
```

**Permissions:** Authenticated user

---

## Employee/User Management

### GET /api/employees

List all employees with optional filtering.

**Headers:**
- `Authorization: Bearer {token}`

**Query Parameters:**
- `projectId` (optional): Filter by project assignment
- `role` (optional): Filter by role (e.g., "foreman", "laborer", "manager")
- `status` (optional): Filter by status ("active", "inactive", "terminated")
- `search` (optional): Search by name or email
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset

**Response:** `200 OK`
```json
{
  "success": true,
  "employees": [
    {
      "employeeId": "emp_001",
      "fullName": "Michael Johnson",
      "goByName": "Mike",
      "email": "mjohnson@example.com",
      "phone": "+1-555-0123",
      "role": "foreman",
      "status": "active",
      "hourlyRate": 35.00,
      "projectAssignments": ["proj_001", "proj_003"],
      "dateHired": "2023-06-15",
      "lastActive": "2025-11-04T16:00:00Z"
    },
    {
      "employeeId": "emp_002",
      "fullName": "Sarah Williams",
      "goByName": "Sarah",
      "email": "swilliams@example.com",
      "phone": "+1-555-0124",
      "role": "laborer",
      "status": "active",
      "hourlyRate": 28.00,
      "projectAssignments": ["proj_001"],
      "dateHired": "2024-02-10",
      "lastActive": "2025-11-04T16:00:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Permissions:** `read:employees` (admin, manager)

---

### GET /api/employees/:id

Get specific employee details including work history.

**Headers:**
- `Authorization: Bearer {token}`

**Response:** `200 OK`
```json
{
  "success": true,
  "employee": {
    "employeeId": "emp_001",
    "fullName": "Michael Johnson",
    "goByName": "Mike",
    "email": "mjohnson@example.com",
    "phone": "+1-555-0123",
    "emergencyContact": {
      "name": "Jane Johnson",
      "phone": "+1-555-0199",
      "relationship": "spouse"
    },
    "role": "foreman",
    "status": "active",
    "hourlyRate": 35.00,
    "overtimeRate": 52.50,
    "projectAssignments": [
      {
        "projectId": "proj_001",
        "projectName": "Downtown Tower",
        "assignedDate": "2025-01-15",
        "role": "lead_foreman"
      }
    ],
    "skills": ["concrete", "framing", "supervision"],
    "certifications": [
      {
        "name": "OSHA 30",
        "issueDate": "2024-03-15",
        "expiryDate": "2029-03-15"
      }
    ],
    "dateHired": "2023-06-15",
    "lastActive": "2025-11-04T16:00:00Z",
    "totalHoursWorked": 3240,
    "averageHoursPerWeek": 42.5,
    "createdAt": "2023-06-14T12:00:00Z",
    "updatedAt": "2025-11-04T16:00:00Z"
  }
}
```

**Error Response:** `404 Not Found`
```json
{
  "success": false,
  "error": "Employee not found",
  "employeeId": "emp_999"
}
```

**Permissions:** `read:employees` (admin, manager) or own record

---

### POST /api/employees

Create a new employee record.

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request:**
```json
{
  "fullName": "Robert Martinez",
  "goByName": "Bob",
  "email": "rmartinez@example.com",
  "phone": "+1-555-0130",
  "emergencyContact": {
    "name": "Maria Martinez",
    "phone": "+1-555-0131",
    "relationship": "spouse"
  },
  "role": "laborer",
  "hourlyRate": 26.00,
  "dateHired": "2025-11-05",
  "projectAssignments": ["proj_001"],
  "skills": ["framing", "drywall"],
  "certifications": []
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "employee": {
    "employeeId": "emp_046",
    "fullName": "Robert Martinez",
    "goByName": "Bob",
    "email": "rmartinez@example.com",
    "phone": "+1-555-0130",
    "role": "laborer",
    "status": "active",
    "hourlyRate": 26.00,
    "createdAt": "2025-11-05T14:30:00Z"
  }
}
```

**Validation Errors:** `400 Bad Request`
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Email already exists in system"
    },
    {
      "field": "hourlyRate",
      "message": "Hourly rate must be greater than 0"
    }
  ]
}
```

**Permissions:** `create:employees` (admin only)

---

### PUT /api/employees/:id

Update existing employee information.

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request:**
```json
{
  "phone": "+1-555-0999",
  "hourlyRate": 37.00,
  "role": "senior_foreman",
  "projectAssignments": ["proj_001", "proj_003", "proj_005"],
  "skills": ["concrete", "framing", "supervision", "safety"]
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "employee": {
    "employeeId": "emp_001",
    "fullName": "Michael Johnson",
    "phone": "+1-555-0999",
    "hourlyRate": 37.00,
    "role": "senior_foreman",
    "updatedAt": "2025-11-05T14:45:00Z"
  }
}
```

**Permissions:** `update:employees` (admin, manager)

---

### DELETE /api/employees/:id

Soft delete an employee (sets status to 'terminated').

**Headers:**
- `Authorization: Bearer {token}`

**Query Parameters:**
- `reason` (optional): Termination reason
- `hardDelete` (optional): Boolean, permanently delete (admin only)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Employee terminated successfully",
  "employeeId": "emp_046",
  "terminatedAt": "2025-11-05T15:00:00Z"
}
```

**Permissions:** `delete:employees` (admin only)

---

### GET /api/employees/:id/hours

Get employee hours breakdown by week, month, or project.

**Headers:**
- `Authorization: Bearer {token}`

**Query Parameters:**
- `period` (required): "week", "month", "quarter", "year", or "custom"
- `startDate` (optional): ISO date for custom period
- `endDate` (optional): ISO date for custom period
- `projectId` (optional): Filter by specific project

**Response:** `200 OK`
```json
{
  "success": true,
  "employeeId": "emp_001",
  "fullName": "Michael Johnson",
  "period": "month",
  "startDate": "2025-10-01",
  "endDate": "2025-10-31",
  "summary": {
    "totalRegularHours": 168.0,
    "totalOvertimeHours": 12.0,
    "totalHours": 180.0,
    "regularPay": 5880.00,
    "overtimePay": 630.00,
    "totalPay": 6510.00,
    "averageHoursPerDay": 8.18,
    "daysWorked": 22
  },
  "breakdown": [
    {
      "date": "2025-10-01",
      "projectId": "proj_001",
      "projectName": "Downtown Tower",
      "regularHours": 8.0,
      "overtimeHours": 0,
      "totalHours": 8.0,
      "tasks": ["Foundation work", "Concrete pouring"]
    },
    {
      "date": "2025-10-02",
      "projectId": "proj_001",
      "projectName": "Downtown Tower",
      "regularHours": 8.0,
      "overtimeHours": 2.0,
      "totalHours": 10.0,
      "tasks": ["Framing", "Electrical rough-in"]
    }
  ],
  "byProject": [
    {
      "projectId": "proj_001",
      "projectName": "Downtown Tower",
      "totalHours": 140.0,
      "percentage": 77.8
    },
    {
      "projectId": "proj_003",
      "projectName": "Harbor View",
      "totalHours": 40.0,
      "percentage": 22.2
    }
  ]
}
```

**Permissions:** `read:hours` (admin, manager) or own record

---

## Project Management

### GET /api/projects

List all projects with optional filtering.

**Headers:**
- `Authorization: Bearer {token}`

**Query Parameters:**
- `status` (optional): Filter by status ("planning", "active", "on_hold", "completed", "archived")
- `managerId` (optional): Filter by assigned manager
- `search` (optional): Search by project name or location
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset

**Response:** `200 OK`
```json
{
  "success": true,
  "projects": [
    {
      "projectId": "proj_001",
      "projectName": "Downtown Tower Construction",
      "projectCode": "DT-2025-001",
      "location": "123 Main St, Nashville, TN",
      "status": "active",
      "startDate": "2025-01-15",
      "estimatedEndDate": "2025-12-31",
      "actualEndDate": null,
      "budget": 2500000.00,
      "currentSpend": 875000.00,
      "percentComplete": 35.0,
      "assignedManagers": [
        {
          "managerId": "mgr_001",
          "name": "John Smith",
          "role": "project_manager"
        }
      ],
      "personnelCount": 24,
      "activeConstraints": 3,
      "healthScore": 85,
      "lastReportDate": "2025-11-04"
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Permissions:** `read:projects` (all authenticated users, filtered by role)

---

### GET /api/projects/:id

Get detailed project information.

**Headers:**
- `Authorization: Bearer {token}`

**Response:** `200 OK`
```json
{
  "success": true,
  "project": {
    "projectId": "proj_001",
    "projectName": "Downtown Tower Construction",
    "projectCode": "DT-2025-001",
    "description": "45-story mixed-use tower in downtown Nashville",
    "location": {
      "address": "123 Main St",
      "city": "Nashville",
      "state": "TN",
      "zip": "37201",
      "coordinates": {
        "lat": 36.1627,
        "lng": -86.7816
      }
    },
    "status": "active",
    "startDate": "2025-01-15",
    "estimatedEndDate": "2025-12-31",
    "actualEndDate": null,
    "budget": {
      "total": 2500000.00,
      "labor": 1200000.00,
      "materials": 1000000.00,
      "equipment": 300000.00
    },
    "currentSpend": {
      "total": 875000.00,
      "labor": 420000.00,
      "materials": 350000.00,
      "equipment": 105000.00
    },
    "percentComplete": 35.0,
    "assignedManagers": [
      {
        "managerId": "mgr_001",
        "name": "John Smith",
        "role": "project_manager",
        "assignedDate": "2025-01-15"
      }
    ],
    "assignedPersonnel": [
      {
        "employeeId": "emp_001",
        "name": "Michael Johnson",
        "role": "foreman",
        "assignedDate": "2025-01-20"
      }
    ],
    "milestones": [
      {
        "milestoneId": "ms_001",
        "name": "Foundation Complete",
        "targetDate": "2025-03-15",
        "actualDate": "2025-03-12",
        "status": "completed"
      },
      {
        "milestoneId": "ms_002",
        "name": "Structural Steel Complete",
        "targetDate": "2025-06-30",
        "actualDate": null,
        "status": "in_progress"
      }
    ],
    "activeConstraints": 3,
    "safetyIncidents": 0,
    "healthScore": 85,
    "metrics": {
      "totalReports": 180,
      "averageDailyPersonnel": 22,
      "totalLaborHours": 6840,
      "vendorDeliveries": 45,
      "onTimeDeliveryRate": 91.1
    },
    "createdAt": "2025-01-10T10:00:00Z",
    "updatedAt": "2025-11-04T16:00:00Z"
  }
}
```

**Permissions:** `read:projects` (assigned managers/personnel or admin)

---

### POST /api/projects

Create a new project.

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request:**
```json
{
  "projectName": "Sunset Ridge Development",
  "projectCode": "SR-2025-003",
  "description": "Residential development with 120 units",
  "location": {
    "address": "456 Oak Ave",
    "city": "Franklin",
    "state": "TN",
    "zip": "37064"
  },
  "startDate": "2025-12-01",
  "estimatedEndDate": "2026-11-30",
  "budget": {
    "total": 3500000.00,
    "labor": 1500000.00,
    "materials": 1700000.00,
    "equipment": 300000.00
  },
  "assignedManagers": ["mgr_002"],
  "milestones": [
    {
      "name": "Site Preparation",
      "targetDate": "2026-01-15",
      "description": "Clear and grade site"
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "project": {
    "projectId": "proj_013",
    "projectName": "Sunset Ridge Development",
    "projectCode": "SR-2025-003",
    "status": "planning",
    "createdAt": "2025-11-05T15:00:00Z"
  }
}
```

**Permissions:** `create:projects` (manager, admin)

---

### PUT /api/projects/:id

Update project information.

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request:**
```json
{
  "status": "active",
  "estimatedEndDate": "2026-01-15",
  "budget": {
    "total": 2600000.00,
    "labor": 1250000.00,
    "materials": 1050000.00,
    "equipment": 300000.00
  },
  "percentComplete": 40.0
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "project": {
    "projectId": "proj_001",
    "projectName": "Downtown Tower Construction",
    "status": "active",
    "percentComplete": 40.0,
    "updatedAt": "2025-11-05T15:15:00Z"
  }
}
```

**Permissions:** `update:projects` (assigned manager, admin)

---

### DELETE /api/projects/:id

Archive a project (soft delete).

**Headers:**
- `Authorization: Bearer {token}`

**Query Parameters:**
- `reason` (optional): Archival reason
- `hardDelete` (optional): Boolean, permanently delete (admin only)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Project archived successfully",
  "projectId": "proj_013",
  "archivedAt": "2025-11-05T15:30:00Z"
}
```

**Permissions:** `delete:projects` (admin only)

---

### PUT /api/projects/:id/status

Update project status only.

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request:**
```json
{
  "status": "on_hold",
  "reason": "Awaiting permits",
  "notes": "City planning department requires additional documentation"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "project": {
    "projectId": "proj_001",
    "projectName": "Downtown Tower Construction",
    "status": "on_hold",
    "statusReason": "Awaiting permits",
    "updatedAt": "2025-11-05T15:45:00Z"
  }
}
```

**Permissions:** `update:projects` (assigned manager, admin)

---

### POST /api/projects/:id/timeline

Update project timeline and milestones.

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request:**
```json
{
  "milestones": [
    {
      "milestoneId": "ms_002",
      "targetDate": "2025-07-15",
      "status": "in_progress",
      "percentComplete": 65
    },
    {
      "name": "HVAC Installation Complete",
      "targetDate": "2025-09-30",
      "status": "planned",
      "description": "Complete HVAC system installation and testing"
    }
  ],
  "estimatedEndDate": "2026-01-31",
  "notes": "Adjusted timeline due to material delivery delays"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "project": {
    "projectId": "proj_001",
    "milestones": [
      {
        "milestoneId": "ms_002",
        "name": "Structural Steel Complete",
        "targetDate": "2025-07-15",
        "status": "in_progress",
        "percentComplete": 65,
        "updatedAt": "2025-11-05T16:00:00Z"
      },
      {
        "milestoneId": "ms_004",
        "name": "HVAC Installation Complete",
        "targetDate": "2025-09-30",
        "status": "planned",
        "createdAt": "2025-11-05T16:00:00Z"
      }
    ],
    "estimatedEndDate": "2026-01-31",
    "updatedAt": "2025-11-05T16:00:00Z"
  }
}
```

**Permissions:** `update:projects` (assigned manager, admin)

---

## Time Tracking

### POST /api/time-entries

Log a time entry for an employee.

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request:**
```json
{
  "employeeId": "emp_001",
  "projectId": "proj_001",
  "date": "2025-11-05",
  "startTime": "07:30",
  "endTime": "16:30",
  "breakMinutes": 30,
  "hours": 8.5,
  "overtimeHours": 0.5,
  "tasks": [
    "Foundation inspection",
    "Concrete pouring supervision"
  ],
  "notes": "Overtime due to concrete delivery timing"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "timeEntry": {
    "timeEntryId": "te_12345",
    "employeeId": "emp_001",
    "employeeName": "Michael Johnson",
    "projectId": "proj_001",
    "projectName": "Downtown Tower Construction",
    "date": "2025-11-05",
    "hours": 8.5,
    "overtimeHours": 0.5,
    "createdAt": "2025-11-05T16:30:00Z"
  }
}
```

**Permissions:** `create:time-entries` (employee for own record, manager/admin for all)

---

### GET /api/time-entries

Get time entries with filtering.

**Headers:**
- `Authorization: Bearer {token}`

**Query Parameters:**
- `employeeId` (optional): Filter by employee
- `projectId` (optional): Filter by project
- `startDate` (optional): ISO date
- `endDate` (optional): ISO date
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset

**Response:** `200 OK`
```json
{
  "success": true,
  "timeEntries": [
    {
      "timeEntryId": "te_12345",
      "employeeId": "emp_001",
      "employeeName": "Michael Johnson",
      "projectId": "proj_001",
      "projectName": "Downtown Tower Construction",
      "date": "2025-11-05",
      "startTime": "07:30",
      "endTime": "16:30",
      "hours": 8.5,
      "overtimeHours": 0.5,
      "regularPay": 280.00,
      "overtimePay": 26.25,
      "totalPay": 306.25,
      "tasks": ["Foundation inspection", "Concrete pouring supervision"],
      "createdAt": "2025-11-05T16:30:00Z"
    }
  ],
  "summary": {
    "totalEntries": 1,
    "totalHours": 8.5,
    "totalRegularHours": 8.0,
    "totalOvertimeHours": 0.5,
    "totalPay": 306.25
  },
  "pagination": {
    "total": 1,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Permissions:** `read:time-entries` (employee for own records, manager/admin for all)

---

### PUT /api/time-entries/:id

Update an existing time entry.

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request:**
```json
{
  "hours": 9.0,
  "overtimeHours": 1.0,
  "endTime": "17:00",
  "notes": "Extended due to concrete finishing requirements"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "timeEntry": {
    "timeEntryId": "te_12345",
    "employeeId": "emp_001",
    "hours": 9.0,
    "overtimeHours": 1.0,
    "updatedAt": "2025-11-05T17:00:00Z"
  }
}
```

**Permissions:** `update:time-entries` (manager/admin only, within 7 days)

---

## Error Handling

### Standard Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {},
  "timestamp": "2025-11-05T16:00:00Z",
  "requestId": "req_abc123"
}
```

### HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters or validation failed
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate entry)
- `422 Unprocessable Entity` - Request format valid but semantic errors
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service temporarily unavailable

### Common Error Codes

- `AUTH_FAILED` - Authentication failed
- `TOKEN_EXPIRED` - JWT token expired
- `TOKEN_INVALID` - JWT token invalid or malformed
- `PERMISSION_DENIED` - Insufficient permissions
- `VALIDATION_ERROR` - Request validation failed
- `NOT_FOUND` - Resource not found
- `DUPLICATE_ENTRY` - Resource already exists
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Internal server error

---

## Permissions Matrix

### Role-Based Permissions

| Endpoint | Admin | Manager | Employee | Guest |
|----------|-------|---------|----------|-------|
| **Authentication** |
| POST /api/auth/login | ✓ | ✓ | ✓ | ✓ |
| POST /api/auth/logout | ✓ | ✓ | ✓ | - |
| POST /api/auth/refresh | ✓ | ✓ | ✓ | - |
| GET /api/auth/me | ✓ | ✓ | ✓ | - |
| **Employees** |
| GET /api/employees | ✓ | ✓ | Self | - |
| GET /api/employees/:id | ✓ | ✓ | Self | - |
| POST /api/employees | ✓ | - | - | - |
| PUT /api/employees/:id | ✓ | ✓ | - | - |
| DELETE /api/employees/:id | ✓ | - | - | - |
| GET /api/employees/:id/hours | ✓ | ✓ | Self | - |
| **Projects** |
| GET /api/projects | ✓ | ✓ | Assigned | - |
| GET /api/projects/:id | ✓ | Assigned | Assigned | - |
| POST /api/projects | ✓ | ✓ | - | - |
| PUT /api/projects/:id | ✓ | Assigned | - | - |
| DELETE /api/projects/:id | ✓ | - | - | - |
| PUT /api/projects/:id/status | ✓ | Assigned | - | - |
| POST /api/projects/:id/timeline | ✓ | Assigned | - | - |
| **Time Tracking** |
| POST /api/time-entries | ✓ | ✓ | Self | - |
| GET /api/time-entries | ✓ | ✓ | Self | - |
| PUT /api/time-entries/:id | ✓ | ✓ | - | - |

### Permission Strings

Format: `action:resource`

**Actions:**
- `create` - Create new resource
- `read` - View resource
- `update` - Modify resource
- `delete` - Remove resource
- `manage` - Full control over resource

**Resources:**
- `employees`
- `projects`
- `time-entries`
- `reports`
- `vendors`
- `analytics`

**Example Permission Sets:**

**Admin:**
```json
[
  "create:*",
  "read:*",
  "update:*",
  "delete:*",
  "manage:*"
]
```

**Manager:**
```json
[
  "create:projects",
  "read:employees",
  "read:projects",
  "read:time-entries",
  "update:projects",
  "update:employees",
  "manage:time-entries"
]
```

**Employee:**
```json
[
  "read:own",
  "create:time-entries:own",
  "read:projects:assigned"
]
```

---

## Rate Limiting

- **Rate Limit:** 100 requests per minute per user
- **Burst Limit:** 20 requests per second
- **Headers:**
  - `X-RateLimit-Limit`: Total requests allowed
  - `X-RateLimit-Remaining`: Remaining requests in window
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

**Rate Limit Exceeded Response:** `429 Too Many Requests`
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 45,
  "limit": 100,
  "window": 60
}
```

---

## Security Considerations

1. **JWT Tokens:**
   - Access tokens expire after 1 hour
   - Refresh tokens expire after 7 days
   - Tokens are signed with RS256 algorithm

2. **Password Requirements:**
   - Minimum 8 characters
   - Must include uppercase, lowercase, number
   - Cannot be common passwords

3. **API Key Authentication:**
   - Service-to-service authentication uses API keys
   - Keys are prefixed with environment: `prod_`, `dev_`
   - Keys must be included in `X-API-Key` header

4. **HTTPS Only:**
   - All endpoints require HTTPS
   - HTTP requests are redirected to HTTPS

5. **CORS:**
   - Restricted to approved domains
   - Credentials included for same-origin requests

---

**Last Updated:** November 5, 2025
**Version:** 2.0
**Contact:** jayson@impactconsulting931.com
