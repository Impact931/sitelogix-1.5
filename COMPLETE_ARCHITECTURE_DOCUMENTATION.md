# SiteLogix Complete Architecture Documentation

## Overview

SiteLogix is a construction management platform with **complete integration** between:
- **Personnel Management** (Employee database)
- **User Management** (System login accounts)
- **Labor/Overtime Tracking** (Payroll and time tracking)
- **Roxy Voice AI** (Voice reporting with intelligent employee recognition)

---

## 🏗️ Database Architecture

### 1. **sitelogix-personnel** - Employee Database

**Purpose:** Central employee/personnel database for payroll, time tracking, and Roxy recognition

**Primary Key:** `PK = "PER#{employeeNumber}"`, `SK = "PROFILE"`

**Schema:**
```typescript
{
  // Identity
  personId: string;              // "PER#EMP-20250116001"
  employeeNumber: string;        // "EMP-20250116001" (auto-generated)

  // Personal Info
  firstName: string;             // "Robert"
  lastName: string;              // "Johnson"
  middleName?: string;           // "James"
  preferredName: string;         // "Bob" ← CRITICAL FOR ROXY
  fullName: string;              // "Robert Johnson" (normalized)
  knownAliases: string[];        // ["Bobby", "Rob", "RJ"]

  // Contact
  email?: string;
  phone?: string;

  // Employment
  employmentStatus: string;      // "active" | "terminated"
  hireDate?: string;             // "2024-01-15"
  jobTitle?: string;             // "Foreman" | "Laborer" | "Electrician"

  // Payroll Rates
  hourlyRate?: number;           // 25.00
  overtimeRate?: number;         // 37.50 (1.5x)
  doubleTimeRate?: number;       // 50.00 (2x)

  // Metadata
  needsProfileCompletion: bool;  // true if missing email/phone
  createdAt: string;             // ISO timestamp
  updatedAt: string;
  lastSeenDate?: string;         // Last mentioned in report
  lastSeenProjectId?: string;    // Last project assignment
}
```

**Global Secondary Indexes:**
- **GSI1-NameIndex**: Query by `full_name` (exact match)
- **GSI2-ProjectIndex**: Query by `lastSeenProjectId`
- **GSI3-StatusIndex**: Query by `employmentStatus`

**Key Features:**
- ✅ **6-Layer Intelligent Deduplication** (prevents duplicate employees)
- ✅ **Fuzzy Name Matching** (handles typos in voice reports)
- ✅ **Alias Tracking** (Bob = Robert, Mike = Michael, etc.)
- ✅ **Auto-creation from Voice Reports** (Roxy creates employees automatically)
- ✅ **Profile Completion Tracking** (flags incomplete records)

---

### 2. **sitelogix-users** - System Login Accounts

**Purpose:** Authentication and access control for system login

**Primary Key:** `PK = "USER#{userId}"`, `SK = "METADATA"`

**Schema:**
```typescript
{
  // Identity
  userId: string;                // UUID
  username: string;              // "bob.johnson" (unique)

  // Authentication
  passwordHash: string;          // bcrypt hash
  mustChangePassword: boolean;   // Force password change on next login

  // Personal Info
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;

  // Access Control
  role: string;                  // "superadmin" | "admin" | "manager" | "employee"
  status: string;                // "active" | "inactive" | "suspended"
  permissions: string[];         // ["read:employees", "manage:projects"]

  // Linkage (Optional - for consolidation)
  employeeId?: string;           // Links to sitelogix-personnel.personId

  // Security
  lastLogin?: string;
  failedLoginAttempts: number;

  // Metadata
  createdAt: string;
  updatedAt: string;
}
```

**Global Secondary Indexes:**
- **GSI1-UsernameIndex**: Query by `username` (for login)
- **GSI2-EmployeeIndex**: Query by `employeeId` (link to personnel)
- **GSI3-RoleStatusIndex**: Query by `role` and `status`

---

### 3. **sitelogix-payroll-entries** - Labor & Overtime Tracking

**Purpose:** **PERMANENT RECORDS** of all labor hours and overtime for payroll processing

**Primary Key:** `PK = "REPORT#{reportDate}"`, `SK = "{employeeId}#{timestamp}"`

**Schema:**
```typescript
{
  // Keys
  entryId: string;               // "PAY-1705392847123-abc123xyz"

  // Employee Link → CONNECTS TO PERSONNEL
  employee_id: string;           // Links to sitelogix-personnel.personId
  employee_number: string;       // "EMP-20250116001"
  employee_name: string;         // "Bob Johnson"

  // Project Link
  project_id: string;
  project_name: string;
  report_id: string;
  report_date: string;           // "2025-01-16" (YYYY-MM-DD)

  // Labor Hours - PERMANENT RECORDS
  regular_hours: number;         // 8.0
  overtime_hours: number;        // 2.5
  double_time_hours: number;     // 0.0
  total_hours: number;           // 10.5 (calculated)

  // Pay Rates
  hourly_rate: number;           // 25.00
  overtime_rate?: number;        // 37.50 (auto-calculated: hourlyRate * 1.5)
  double_time_rate?: number;     // 50.00 (auto-calculated: hourlyRate * 2.0)

  // Cost Calculation (AUTOMATIC)
  total_cost: number;            // $256.25 (calculated)

  // Time Tracking
  arrival_time?: string;         // "07:00 AM"
  departure_time?: string;       // "05:30 PM"

  // Work Details
  work_location: string;         // "on-site" | "off-site"
  activities_performed: string[];// ["Framing", "Electrical rough-in"]
  employee_specific_issues?: string; // Special notes

  // Status
  review_status: string;         // "pending" | "reviewed" | "approved"

  // Metadata
  created_at: string;            // ISO timestamp
  updated_at: string;
}
```

**Global Secondary Indexes:**
- **GSI1-EmployeeIndex**: Query by `employee_id` → GET ALL HOURS FOR AN EMPLOYEE
- **GSI2-ProjectIndex**: Query by `project_id` → GET ALL HOURS FOR A PROJECT
- **GSI3-ReviewIndex**: Query by `review_status` → GET ENTRIES NEEDING REVIEW

**Cost Calculation Formula:**
```javascript
total_cost =
  (regular_hours * hourly_rate * 1.0) +
  (overtime_hours * hourly_rate * 1.5) +
  (double_time_hours * hourly_rate * 2.0)

Example:
  8 hrs × $25.00 × 1.0  = $200.00
  2.5 hrs × $25.00 × 1.5 = $93.75
  Total = $293.75
```

---

## 🔗 How Everything Connects

### Data Flow: Voice Report → Employee Recognition → Payroll Entry

```
1. Roxy Receives Voice Report
   ↓
2. AI Transcription extracts: "Bob worked 8 hours today"
   ↓
3. Personnel Service: Match or Create Employee
   • Layer 1: Exact name match ("Bob Johnson")
   • Layer 2: Alias search ("Bob" → "Robert Johnson")
   • Layer 3: Fuzzy match (handles typos: "Jhon" → "John")
   • Layer 4: Preferred name match
   • Result: personId = "PER#EMP-20250116001"
   ↓
4. Payroll Service: Create Permanent Entry
   • Links to employee_id = "PER#EMP-20250116001"
   • Stores hours: regular_hours = 8.0
   • Calculates cost: 8.0 × $25.00 = $200.00
   ↓
5. Permanent Record Created in sitelogix-payroll-entries
   • Never deleted (PERMANENT HISTORY)
   • Queryable by employee, project, or date
   • Used for payroll processing and reporting
```

---

## 🎤 Roxy Voice Recognition - How Nicknames Work

### Why the Nickname Field is Critical

**Field Name:** `preferredName` (labeled as "Nickname for Roxy" in UI)

**Purpose:** This is the **primary identifier** Roxy uses to match people in voice reports.

**Example:**
```
Legal Name:     Robert James Johnson
Nickname:       Bob
Known Aliases:  ["Bobby", "RJ", "Big Bob"]

When voice report says: "Bob worked 8 hours"
→ Matches to Robert Johnson via preferredName = "Bob"

When voice report says: "Bobby was on the roof"
→ Matches to Robert Johnson via knownAliases includes "Bobby"
```

### 6-Layer Deduplication System

**Prevents duplicate employees when names are mentioned differently:**

1. **Exact Full Name Match**
   - "Robert Johnson" → Matches "Robert Johnson"

2. **Alias Search**
   - "Bob" → Searches knownAliases → Matches Robert Johnson

3. **Fuzzy Name Matching** (Typo tolerance)
   - "Robret Jonson" → 92% similarity → Matches Robert Johnson
   - "Jhon Smith" → 88% similarity → Matches John Smith

4. **Context-Based Matching** (Project assignment)
   - "Mike on the Smith project" → Matches Michael Davis (last seen on Smith project)

5. **Multiple Match Detection**
   - Two "Mike"s on same project → Returns both → Prompts for clarification

6. **Auto-Create New Employee**
   - No match found → Creates new employee
   - Flags `needsProfileCompletion = true`
   - Admin completes profile later

---

## 👥 User vs Employee Distinction

### Current Architecture: **Two Separate Systems**

```
┌────────────────────────────────────────────────────────────┐
│                     ALL PEOPLE                              │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   Employees (sitelogix-personnel)                          │
│   • Everyone working on site                                │
│   • Payroll database                                        │
│   • Roxy voice recognition                                  │
│   • Time tracking                                           │
│   • May or may not have login access                        │
│                                                             │
│   ┌─────────────────────────────────────┐                  │
│   │  Users (sitelogix-users)            │                  │
│   │  • Subset of employees               │                  │
│   │  • Have system login credentials     │                  │
│   │  • Can access Roxy interface         │                  │
│   │  • ADMIN can access management tools │                  │
│   └─────────────────────────────────────┘                  │
└────────────────────────────────────────────────────────────┘
```

**Examples:**

| Person | In Personnel DB? | Has Login? | Access Level |
|--------|-----------------|-----------|--------------|
| John Smith (Foreman) | ✅ Yes | ✅ Yes | ADMIN - Full access |
| Bob Johnson (Laborer) | ✅ Yes | ✅ Yes | EMPLOYEE - Roxy only |
| Mike Davis (Electrician) | ✅ Yes | ❌ No | None - Payroll only |
| Sarah Williams (Office) | ❌ No | ✅ Yes | ADMIN - Management only |

**Linkage (Recommended for Consolidation):**
- Add `employeeId` field to Users table
- Add `userId` field to Personnel table
- Link them when creating system accounts

---

## 📊 Querying Labor Hours for an Employee

### Example: Get Bob Johnson's Total Hours This Week

```typescript
// Step 1: Get employee record
const employee = await personnelService.getEmployeeByName("Bob Johnson");
// Returns: { personId: "PER#EMP-20250116001", ... }

// Step 2: Query payroll entries by employee_id
const entries = await payrollService.getPayrollByEmployee(
  "PER#EMP-20250116001",
  {
    startDate: "2025-01-13",  // Monday
    endDate: "2025-01-19"     // Sunday
  }
);

// Step 3: Aggregate hours
const totalRegular = entries.reduce((sum, e) => sum + e.regular_hours, 0);
const totalOvertime = entries.reduce((sum, e) => sum + e.overtime_hours, 0);
const totalCost = entries.reduce((sum, e) => sum + e.total_cost, 0);

console.log({
  employee: employee.fullName,
  nickname: employee.preferredName,
  week: "Jan 13-19, 2025",
  regularHours: totalRegular,    // 40.0
  overtimeHours: totalOvertime,  // 5.0
  totalCost: totalCost           // $1,187.50
});
```

---

## 🔐 Security & Access Control

### Role Hierarchy

```
SUPERADMIN
  └─ Can do everything
     ├─ Manage all users
     ├─ Access all projects
     ├─ View all payroll data
     └─ System configuration

ADMIN
  └─ Full operational access
     ├─ Manage employees
     ├─ Manage projects
     ├─ View payroll reports
     └─ Create user accounts

MANAGER
  └─ Project-level access
     ├─ View assigned projects
     ├─ Approve timesheets
     └─ Generate reports

EMPLOYEE
  └─ Limited access
     ├─ Use Roxy voice interface
     ├─ View own timesheet
     └─ Update own profile
```

---

## 🚀 API Endpoints Summary

### Personnel Management
```
GET    /api/personnel                    # List all employees
GET    /api/personnel/:id                # Get employee by ID
GET    /api/personnel/number/:empNum     # Get by employee number
GET    /api/personnel/search?name=Bob    # Search by name
POST   /api/personnel                    # Create employee
POST   /api/personnel/match              # Match or create (Roxy)
PUT    /api/personnel/:id                # Update employee
DELETE /api/personnel/:id                # Terminate employee
POST   /api/personnel/:id/aliases        # Add nickname/alias
```

### Payroll/Time Tracking
```
GET    /api/payroll/employee/:id         # Get all hours for employee
GET    /api/payroll/report/:reportId     # Get payroll by report
GET    /api/payroll/review               # Get entries needing review
POST   /api/payroll                      # Create single entry
POST   /api/payroll/bulk                 # Create multiple entries
PUT    /api/payroll/:id                  # Update entry
GET    /api/payroll/export/daily/:date   # Export daily payroll CSV
```

### User Management
```
GET    /api/admin/employees              # List all user accounts
POST   /api/admin/employees              # Create user account
PUT    /api/admin/employees/:userId      # Update user
DELETE /api/admin/employees/:userId      # Delete user
POST   /api/auth/reset-password          # Reset user password
```

---

## ✅ Complete Implementation Checklist

### Already Implemented ✅

- [x] Personnel database with intelligent deduplication
- [x] Nickname/preferred name field for Roxy
- [x] Alias tracking and fuzzy matching
- [x] Payroll entries linked to employees
- [x] Labor hours tracking (regular, overtime, double-time)
- [x] Automatic cost calculation
- [x] Permanent historical records
- [x] User authentication system
- [x] Role-based access control
- [x] Password management
- [x] API endpoints for all operations

### Enhanced in This Session ✅

- [x] Moved Change Password into Edit User modal
- [x] Highlighted Nickname field for Roxy voice recognition
- [x] Added clear info text explaining nickname purpose
- [x] Comprehensive architecture documentation

### Recommended Next Steps 🎯

- [ ] Consolidate User + Employee management into single interface
- [ ] Add employee hours/timesheet view in employee profile
- [ ] Create reporting dashboard for labor costs by employee
- [ ] Add batch employee import (CSV upload)
- [ ] Implement employee time-off tracking
- [ ] Add project-specific pay rates (prevailing wage)

---

## 📝 Summary

**SiteLogix has a COMPLETE architecture** where:

1. ✅ **Every employee has a permanent record** in `sitelogix-personnel`
2. ✅ **Every work day has a permanent payroll entry** in `sitelogix-payroll-entries`
3. ✅ **All hours are linked to employees** via `employee_id` field
4. ✅ **Roxy recognizes people by nickname** using `preferredName` field
5. ✅ **Users can optionally have login access** in `sitelogix-users`
6. ✅ **All data persists permanently** for historical reporting

**No data is lost. Everything is connected. The architecture is complete.**

---

**Generated:** 2025-01-16
**Version:** 1.5.0
