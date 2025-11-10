# SiteLogix Payroll Tracking System - DynamoDB Schema Design

## Table of Contents
1. [Overview](#overview)
2. [Table Schemas](#table-schemas)
3. [Access Patterns](#access-patterns)
4. [Sample Data](#sample-data)
5. [Checklist Configuration](#checklist-configuration)
6. [Data Integrity Considerations](#data-integrity-considerations)
7. [Migration Guide](#migration-guide)

---

## Overview

This document describes the enhanced DynamoDB schema design for SiteLogix's payroll tracking feature. The system tracks employee hours extracted from voice-based daily reports and prepares data for payroll processing.

### Design Goals
- **AI-Friendly**: Support automated extraction from voice transcripts
- **Deduplication**: Prevent duplicate employee records via fuzzy matching
- **Flexible Querying**: Support multiple access patterns (by employee, date, project)
- **Audit Trail**: Track who created records and when
- **Scalability**: Handle growing workforce and multiple projects

### Key Tables
1. **sitelogix-personnel** - Master employee registry with alias tracking
2. **sitelogix-payroll-entries** - Daily time entries per employee
3. **sitelogix-reports** (enhanced) - Voice reports with payroll metadata

---

## Table Schemas

### 1. Personnel Table (sitelogix-personnel)

#### Primary Keys
- **PK**: `PERSON#{personId}` (UUID v4)
- **SK**: `PROFILE` (for main record) or `ALIAS#{aliasName}` (for searchable aliases)

#### Item Structure - Profile Record

```json
{
  "PK": "PERSON#550e8400-e29b-41d4-a716-446655440000",
  "SK": "PROFILE",
  "entity_type": "PERSON_PROFILE",

  // Core Identity
  "person_id": "550e8400-e29b-41d4-a716-446655440000",
  "employee_number": "EMP-001",
  "first_name": "Robert",
  "last_name": "Johnson",
  "full_name": "Robert Johnson",
  "preferred_name": "Bob",
  "go_by_name": "Bobby",

  // Contact Information
  "email": "bob.johnson@example.com",
  "phone": "+1-555-123-4567",

  // Employment Details
  "hire_date": "2024-01-15",
  "employment_status": "active",
  "job_title": "Carpenter",
  "default_hourly_rate": 35.00,
  "default_overtime_rate": 52.50,

  // Alias Tracking (for AI matching)
  "known_aliases": ["Bob", "Bobby", "Robert", "Bob Johnson", "Bobby J", "R. Johnson"],

  // Discovery Tracking
  "first_mentioned_date": "2024-09-18",
  "first_mentioned_report_id": "rpt_20240918_mgr_001_1726675200",
  "last_seen_date": "2025-01-06",
  "total_reports_count": 47,
  "total_hours_worked": 376.5,

  // Profile Completion Status
  "needs_profile_completion": false,
  "profile_completion_fields_missing": [],

  // Audit Fields
  "created_by_user_id": "mgr_001",
  "created_by_name": "John Smith",
  "created_at": "2024-09-18T14:30:00Z",
  "updated_at": "2025-01-06T16:45:00Z",

  // GSI Attributes
  "employment_status": "active",
  "last_seen_date": "2025-01-06"
}
```

#### Item Structure - Alias Records (for fuzzy search)

```json
{
  "PK": "PERSON#550e8400-e29b-41d4-a716-446655440000",
  "SK": "ALIAS#bob",
  "entity_type": "PERSON_ALIAS",
  "person_id": "550e8400-e29b-41d4-a716-446655440000",
  "alias_name": "bob",
  "canonical_name": "Robert Johnson",
  "full_name": "Robert Johnson",
  "created_at": "2024-09-18T14:30:00Z"
}
```

#### Global Secondary Indexes

**GSI1-NameIndex**: Query by full name
- **Hash Key**: `full_name` (e.g., "Robert Johnson")
- **Range Key**: `SK` (allows finding both PROFILE and ALIAS records)
- **Use Case**: Search for existing employees before creating duplicates

**GSI2-EmployeeNumberIndex**: Query by employee number
- **Hash Key**: `employee_number` (e.g., "EMP-001")
- **Use Case**: Lookup employees by company-assigned ID

**GSI3-StatusIndex**: Query by employment status and recent activity
- **Hash Key**: `employment_status` (e.g., "active", "inactive", "terminated")
- **Range Key**: `last_seen_date` (ISO date string)
- **Use Case**: List active employees, find inactive employees for cleanup

#### Access Patterns
1. Get employee by ID: `Query(PK = "PERSON#{personId}", SK = "PROFILE")`
2. Search by name: `Query(GSI1, full_name = "Robert Johnson")`
3. Lookup by employee number: `Query(GSI2, employee_number = "EMP-001")`
4. List active employees: `Query(GSI3, employment_status = "active")`
5. Find employees not seen recently: `Query(GSI3, employment_status = "active", last_seen_date < "2024-12-01")`

---

### 2. Payroll Entries Table (sitelogix-payroll-entries)

#### Primary Keys
- **PK**: `REPORT#{reportId}`
- **SK**: `ENTRY#{personId}#{timestamp}`

This design groups all payroll entries for a report together while maintaining unique entries per employee.

#### Item Structure

```json
{
  "PK": "REPORT#rpt_20250106_mgr_001_1736179200",
  "SK": "ENTRY#550e8400-e29b-41d4-a716-446655440000#1736179200000",
  "entity_type": "PAYROLL_ENTRY",

  // Entry Identification
  "entry_id": "pay_20250106_rpt_001_emp_001",
  "report_id": "rpt_20250106_mgr_001_1736179200",
  "report_date": "2025-01-06",

  // Report Context
  "report_submitted_by_id": "mgr_001",
  "report_submitted_by_name": "John Smith",

  // Project Information
  "project_id": "proj_riverside_tower",
  "project_name": "Riverside Tower Apartments",

  // Employee Information (denormalized for quick access)
  "employee_id": "550e8400-e29b-41d4-a716-446655440000",
  "employee_number": "EMP-001",
  "employee_name": "Robert Johnson",

  // Time Tracking
  "arrival_time": "07:00",
  "departure_time": "16:00",
  "regular_hours": 8.0,
  "overtime_hours": 1.0,
  "double_time_hours": 0.0,
  "total_hours": 9.0,

  // Work Details
  "activities_performed": [
    "Framing Level 2 walls",
    "Installing door frames",
    "Material staging"
  ],
  "work_location": "Level 2 - Units 201-204",
  "employee_specific_issues": null,

  // Payroll Calculations (snapshot at time of entry)
  "hourly_rate": 35.00,
  "overtime_rate": 52.50,
  "regular_pay": 280.00,
  "overtime_pay": 52.50,
  "total_cost": 332.50,

  // AI Extraction Metadata
  "extracted_by_ai": true,
  "extraction_confidence": 0.95,
  "needs_review": false,
  "review_reason": null,

  // Audit Trail
  "created_at": "2025-01-06T17:30:00Z",
  "updated_at": "2025-01-06T17:30:00Z",
  "created_by_user_id": "system_ai",

  // GSI Attributes
  "employee_id": "550e8400-e29b-41d4-a716-446655440000",
  "project_id": "proj_riverside_tower",
  "report_date": "2025-01-06",
  "needs_review": "false"
}
```

#### Global Secondary Indexes

**GSI1-EmployeeDateIndex**: Query by employee and date range
- **Hash Key**: `employee_id`
- **Range Key**: `report_date`
- **Use Case**: Generate payroll reports for specific employee

**GSI2-ProjectDateIndex**: Query by project and date range
- **Hash Key**: `project_id`
- **Range Key**: `report_date`
- **Use Case**: Project labor cost analysis

**GSI3-DateIndex**: Query all entries for a date (for daily payroll CSV)
- **Hash Key**: `report_date`
- **Range Key**: `employee_id`
- **Use Case**: Daily payroll export, timesheet generation

**GSI4-ReviewIndex**: Query entries needing human review
- **Hash Key**: `needs_review` (string: "true" or "false")
- **Range Key**: `report_date`
- **Use Case**: Admin review queue for ambiguous AI extractions

#### Access Patterns
1. Get all payroll entries for a report: `Query(PK = "REPORT#{reportId}")`
2. Get employee's hours for date range: `Query(GSI1, employee_id = "...", report_date BETWEEN "2025-01-01" AND "2025-01-31")`
3. Get project labor costs for date range: `Query(GSI2, project_id = "...", report_date BETWEEN "2025-01-01" AND "2025-01-31")`
4. Generate daily payroll CSV: `Query(GSI3, report_date = "2025-01-06")`
5. List entries needing review: `Query(GSI4, needs_review = "true")`

---

### 3. Enhanced Reports Table (sitelogix-reports)

#### New Attributes Added

```json
{
  // ... existing report fields ...

  // Checklist Completion Tracking
  "checklist_completion_status": {
    "arrival_time": true,
    "departure_time": true,
    "personnel_count": true,
    "personnel_names": true,
    "team_assignments": true,
    "deliveries": true,
    "constraints": false,
    "safety": true,
    "additional_notes": false
  },
  "checklist_completion_percentage": 77.8,

  // Audio and Transcript Storage
  "audio_file_s3_url": "s3://sitelogix-reports/audio/2025/01/06/rpt_20250106_mgr_001.mp3",
  "transcript_s3_url": "s3://sitelogix-reports/transcripts/2025/01/06/rpt_20250106_mgr_001.json",

  // Unstructured Notes (fallback for info that doesn't fit checklist)
  "unstructured_notes": "Manager mentioned potential weather delay for concrete pour next week. Waiting on architect approval for window specs.",

  // Payroll Tracking
  "payroll_extracted": "true",
  "payroll_extraction_timestamp": "2025-01-06T17:30:00Z",
  "payroll_entry_ids": [
    "pay_20250106_rpt_001_emp_001",
    "pay_20250106_rpt_001_emp_002",
    "pay_20250106_rpt_001_emp_003"
  ],
  "payroll_entry_count": 3,

  // Employee Tracking
  "employee_ids_mentioned": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001",
    "770e8400-e29b-41d4-a716-446655440002"
  ],
  "new_employees_detected": [],
  "requires_employee_matching": false,
  "ambiguous_employee_names": []
}
```

#### New GSI

**GSI3-PayrollStatusIndex**: Find reports with/without payroll data
- **Hash Key**: `payroll_extracted` (string: "true", "false", "pending")
- **Range Key**: `report_date`
- **Use Case**: Process reports missing payroll data, audit payroll extraction

---

## Access Patterns

### Critical Access Patterns for Payroll System

| Pattern | Table | Index | Query |
|---------|-------|-------|-------|
| 1. Daily payroll export (all employees for date) | payroll-entries | GSI3 | `report_date = "2025-01-06"` |
| 2. Employee timesheet (date range) | payroll-entries | GSI1 | `employee_id = "..." AND report_date BETWEEN` |
| 3. Project labor costs (date range) | payroll-entries | GSI2 | `project_id = "..." AND report_date BETWEEN` |
| 4. Review queue (ambiguous extractions) | payroll-entries | GSI4 | `needs_review = "true"` |
| 5. Search employee by name | personnel | GSI1 | `full_name = "Robert Johnson"` |
| 6. Lookup employee by number | personnel | GSI2 | `employee_number = "EMP-001"` |
| 7. Active employees list | personnel | GSI3 | `employment_status = "active"` |
| 8. Reports missing payroll data | reports | GSI3 | `payroll_extracted = "false"` |
| 9. All payroll entries for a report | payroll-entries | PK | `PK = "REPORT#{reportId}"` |
| 10. Employee profile + aliases | personnel | PK | `PK = "PERSON#{personId}"` |

### Read/Write Patterns and Capacity Planning

**Daily Operations (100 employees, 10 projects, 5 managers)**

| Operation | Frequency/Day | RCU | WCU |
|-----------|---------------|-----|-----|
| Submit daily report | 5 reports | 10 | 50 |
| Extract payroll (100 entries) | 5 batches | 50 | 500 |
| Employee search (deduplication) | 50 queries | 50 | 0 |
| Daily CSV export | 1 query | 100 | 0 |
| Review queue check | 10 queries | 10 | 0 |
| Employee profile updates | 5 updates | 5 | 5 |

**Recommended Provisioned Capacity:**
- **Personnel Table**: 10 RCU / 10 WCU (low volume)
- **Payroll Entries Table**: 20 RCU / 15 WCU (high write, moderate read)
- **Reports Table**: 10 RCU / 10 WCU (moderate both)

---

## Sample Data

### Example 1: Complete Payroll Flow

#### Step 1: Manager Submits Voice Report
```
Voice Input: "Today on Riverside Tower, we had Bob, Mike, and Sarah on site.
Bob arrived at 7am and left at 4pm with an hour overtime.
He worked on framing Level 2 walls and installing door frames..."
```

#### Step 2: AI Extracts Payroll Data
```typescript
// AI Processing Output
{
  employeesDetected: [
    { name: "Bob", confidence: 0.95, needsMatching: false },
    { name: "Mike", confidence: 0.85, needsMatching: true },
    { name: "Sarah", confidence: 0.90, needsMatching: false }
  ],
  timeEntries: [
    {
      employeeName: "Bob",
      arrivalTime: "07:00",
      departureTime: "16:00",
      regularHours: 8.0,
      overtimeHours: 1.0,
      activities: ["Framing Level 2 walls", "Installing door frames"]
    }
  ]
}
```

#### Step 3: System Searches for "Bob"
```typescript
// Query GSI1-NameIndex on personnel table
const searchResults = await dynamoDB.query({
  TableName: 'sitelogix-personnel',
  IndexName: 'GSI1-NameIndex',
  KeyConditionExpression: 'full_name = :name',
  ExpressionAttributeValues: {
    ':name': 'Bob Johnson' // Fuzzy match found "Bob" -> "Bob Johnson"
  }
});

// Result: Found existing employee
{
  person_id: "550e8400-e29b-41d4-a716-446655440000",
  employee_number: "EMP-001",
  full_name: "Robert Johnson",
  known_aliases: ["Bob", "Bobby", "Robert"]
}
```

#### Step 4: Create Payroll Entry
```json
{
  "PK": "REPORT#rpt_20250106_mgr_001_1736179200",
  "SK": "ENTRY#550e8400-e29b-41d4-a716-446655440000#1736179200000",
  "entry_id": "pay_20250106_rpt_001_emp_001",
  "report_id": "rpt_20250106_mgr_001_1736179200",
  "report_date": "2025-01-06",
  "employee_id": "550e8400-e29b-41d4-a716-446655440000",
  "employee_number": "EMP-001",
  "employee_name": "Robert Johnson",
  "regular_hours": 8.0,
  "overtime_hours": 1.0,
  "total_hours": 9.0,
  "hourly_rate": 35.00,
  "overtime_rate": 52.50,
  "total_cost": 332.50,
  "extracted_by_ai": true,
  "needs_review": false
}
```

#### Step 5: Update Report with Payroll Metadata
```json
{
  "PK": "REPORT#rpt_20250106_mgr_001_1736179200",
  "SK": "METADATA",
  "payroll_extracted": "true",
  "payroll_entry_ids": ["pay_20250106_rpt_001_emp_001"],
  "employee_ids_mentioned": ["550e8400-e29b-41d4-a716-446655440000"]
}
```

### Example 2: New Employee Auto-Creation

#### Voice Input with Unknown Employee
```
"Today we had a new guy, Tommy Rodriguez, helping with concrete..."
```

#### AI Detects Unknown Name
```typescript
// Search returns no results
const searchResults = await searchEmployeeByName("Tommy Rodriguez");
// Result: []

// Auto-create employee with incomplete profile
{
  person_id: "880e8400-e29b-41d4-a716-446655440003",
  employee_number: null, // Auto-assign later
  full_name: "Tommy Rodriguez",
  known_aliases: ["Tommy", "Tommy Rodriguez"],
  needs_profile_completion: true,
  profile_completion_fields_missing: [
    "employee_number", "hire_date", "hourly_rate"
  ],
  first_mentioned_report_id: "rpt_20250106_mgr_001_1736179200",
  created_by_user_id: "system_ai"
}
```

#### Payroll Entry Flagged for Review
```json
{
  "entry_id": "pay_20250106_rpt_001_emp_004",
  "employee_id": "880e8400-e29b-41d4-a716-446655440003",
  "employee_name": "Tommy Rodriguez",
  "needs_review": true,
  "review_reason": "New employee auto-created, missing hourly rate"
}
```

### Example 3: Ambiguous Name Matching

#### Voice Input
```
"Today Mike worked on Level 3..."
```

#### System Finds Multiple "Mike" Employees
```typescript
const searchResults = await searchEmployeeByAliases("Mike");
// Results:
[
  { person_id: "aaa...", full_name: "Michael Anderson", last_seen_date: "2025-01-05" },
  { person_id: "bbb...", full_name: "Mike Stevens", last_seen_date: "2024-12-20" }
]

// System uses heuristics:
// 1. Most recently seen on this project
// 2. Project assignment history
// 3. If still ambiguous, flag for review
```

---

## Checklist Configuration

### Checklist Completion JSON Structure

The `checklist_completion_status` field in the reports table stores a JSON object tracking completion of predefined checklist items.

#### Structure
```json
{
  "arrival_time": true,
  "departure_time": true,
  "personnel_count": true,
  "personnel_names": true,
  "team_assignments": true,
  "deliveries": false,
  "constraints": false,
  "safety": true,
  "additional_notes": false
}
```

#### Checklist Item Definitions

Based on `/frontend/src/config/checklistConfig.ts`:

| Item ID | Category | Required | Description |
|---------|----------|----------|-------------|
| `arrival_time` | time | Yes | Manager arrival time |
| `departure_time` | time | Yes | Manager departure time |
| `personnel_count` | personnel | Yes | Total headcount |
| `personnel_names` | personnel | Yes | List of all employees present |
| `team_assignments` | general | Yes | Team activities and assignments |
| `deliveries` | materials | No | Material deliveries |
| `constraints` | general | No | Issues, delays, or constraints |
| `safety` | safety | Yes | Safety incidents or observations |
| `additional_notes` | general | No | Miscellaneous information |

#### Completion Percentage Calculation
```typescript
const calculateCompletionPercentage = (status: Record<string, boolean>): number => {
  const totalItems = Object.keys(status).length;
  const completedItems = Object.values(status).filter(v => v === true).length;
  return Math.round((completedItems / totalItems) * 100 * 10) / 10; // Round to 1 decimal
};

// Example:
// 7 out of 9 items completed = 77.8%
```

#### Dynamic Checklist Support

Admins can customize checklist items via the ChecklistAdmin component. The system should:

1. Load checklist config from admin settings (DynamoDB or S3)
2. Generate dynamic checklist status object based on active items
3. Update completion percentage calculation based on active items only
4. Support adding/removing checklist items without breaking existing reports

```typescript
// Example: Custom checklist
const customChecklist = {
  arrival_time: true,
  departure_time: true,
  personnel_names: true,
  weather_conditions: false,  // Custom item
  equipment_status: true,     // Custom item
  client_walkthrough: false   // Custom item
};
```

---

## Data Integrity Considerations

### 1. Employee Deduplication Strategy

**Problem**: Voice transcripts contain informal names ("Bob", "Bobby", "Robert") that may refer to the same person.

**Solution**: Multi-layered matching system

#### Matching Algorithm
```typescript
async function findOrCreateEmployee(nameFromVoice: string, projectId: string): Promise<Employee> {
  // Step 1: Exact full name match
  let match = await queryByFullName(nameFromVoice);
  if (match) return match;

  // Step 2: Search aliases (Bob -> Robert Johnson)
  match = await queryByAlias(nameFromVoice.toLowerCase());
  if (match) return match;

  // Step 3: Fuzzy match with Levenshtein distance < 3
  const fuzzyMatches = await fuzzySearchEmployees(nameFromVoice);
  if (fuzzyMatches.length === 1 && levenshteinDistance(nameFromVoice, fuzzyMatches[0].name) < 3) {
    return fuzzyMatches[0];
  }

  // Step 4: Context-based matching (project history)
  const projectEmployees = await getRecentEmployeesForProject(projectId, 30); // Last 30 days
  const contextMatch = projectEmployees.find(emp =>
    emp.known_aliases.some(alias =>
      alias.toLowerCase().includes(nameFromVoice.toLowerCase())
    )
  );
  if (contextMatch) return contextMatch;

  // Step 5: Multiple matches or no match -> flag for human review
  if (fuzzyMatches.length > 1) {
    return createTemporaryEmployee(nameFromVoice, {
      needs_review: true,
      review_reason: `Multiple possible matches: ${fuzzyMatches.map(m => m.full_name).join(', ')}`
    });
  }

  // Step 6: Create new employee
  return createEmployee(nameFromVoice, {
    needs_profile_completion: true,
    first_mentioned_report_id: reportId
  });
}
```

#### Alias Management

**Automatic Alias Creation**:
- First name: "Robert" -> "robert"
- Last name: "Johnson" -> "johnson"
- Full name: "Robert Johnson" -> "robert johnson"
- Common nicknames (via lookup table): "Robert" -> ["Bob", "Bobby", "Rob", "Robbie"]

**Manual Alias Addition**:
- Admin can add custom aliases via UI
- Example: "R.J." for "Robert Johnson", "Big Mike" for "Michael Anderson"

**Alias Search Items**:
```json
// For employee "Robert Johnson", create these SK items:
{
  "PK": "PERSON#550e8400-e29b-41d4-a716-446655440000",
  "SK": "ALIAS#robert",
  "full_name": "Robert Johnson"
},
{
  "PK": "PERSON#550e8400-e29b-41d4-a716-446655440000",
  "SK": "ALIAS#bob",
  "full_name": "Robert Johnson"
},
{
  "PK": "PERSON#550e8400-e29b-41d4-a716-446655440000",
  "SK": "ALIAS#bobby",
  "full_name": "Robert Johnson"
}
```

### 2. Employee Name Changes

**Problem**: Employee changes name (marriage, legal name change, preferred name change).

**Solution**: Update profile, maintain alias history

```typescript
async function updateEmployeeName(
  personId: string,
  newFirstName: string,
  newLastName: string,
  updateReason: string
): Promise<void> {
  const employee = await getEmployee(personId);
  const oldFullName = employee.full_name;
  const newFullName = `${newFirstName} ${newLastName}`;

  // 1. Update profile
  await updateItem({
    PK: `PERSON#${personId}`,
    SK: 'PROFILE',
    first_name: newFirstName,
    last_name: newLastName,
    full_name: newFullName,
    updated_at: new Date().toISOString()
  });

  // 2. Add old name as alias (for historical matching)
  await putItem({
    PK: `PERSON#${personId}`,
    SK: `ALIAS#${oldFullName.toLowerCase()}`,
    full_name: newFullName,
    is_historical: true,
    reason: updateReason,
    created_at: new Date().toISOString()
  });

  // 3. Create name change audit record
  await putItem({
    PK: `PERSON#${personId}`,
    SK: `AUDIT#NAME_CHANGE#${Date.now()}`,
    old_name: oldFullName,
    new_name: newFullName,
    reason: updateReason,
    changed_by: userId,
    changed_at: new Date().toISOString()
  });

  // 4. Update GSI1-NameIndex via DynamoDB stream trigger
  // (Automatically handled by DynamoDB when full_name attribute updates)
}
```

### 3. Payroll Entry Corrections

**Problem**: Manager realizes hours were reported incorrectly and needs to correct them.

**Solution**: Create correction entries with audit trail

```typescript
async function correctPayrollEntry(
  entryId: string,
  corrections: Partial<PayrollEntry>,
  correctionReason: string,
  correctedByUserId: string
): Promise<void> {
  const originalEntry = await getPayrollEntry(entryId);

  // 1. Mark original entry as corrected
  await updateItem({
    PK: originalEntry.PK,
    SK: originalEntry.SK,
    is_corrected: true,
    corrected_at: new Date().toISOString(),
    corrected_by_user_id: correctedByUserId,
    correction_reason: correctionReason
  });

  // 2. Create new corrected entry
  const correctedEntry = {
    ...originalEntry,
    SK: `${originalEntry.SK}_CORRECTED_${Date.now()}`,
    entry_id: `${originalEntry.entry_id}_corrected`,
    is_correction: true,
    original_entry_id: originalEntry.entry_id,
    ...corrections,
    created_at: new Date().toISOString(),
    created_by_user_id: correctedByUserId
  };

  await putItem(correctedEntry);

  // 3. Update report metadata
  await updateReportPayrollIds(
    originalEntry.report_id,
    originalEntry.entry_id,
    correctedEntry.entry_id
  );
}
```

### 4. Hourly Rate Changes

**Problem**: Employee receives raise, but we need to maintain historical payroll accuracy.

**Solution**: Store rate snapshot at time of entry

```typescript
// When creating payroll entry, always capture current rates
async function createPayrollEntry(
  reportId: string,
  employeeId: string,
  hours: number
): Promise<PayrollEntry> {
  const employee = await getEmployee(employeeId);

  // Snapshot rates at time of entry creation
  const entry = {
    PK: `REPORT#${reportId}`,
    SK: `ENTRY#${employeeId}#${Date.now()}`,
    employee_id: employeeId,
    hourly_rate: employee.default_hourly_rate,        // Snapshot
    overtime_rate: employee.default_overtime_rate,    // Snapshot
    rate_snapshot_date: new Date().toISOString(),
    regular_hours: hours,
    regular_pay: hours * employee.default_hourly_rate,
    total_cost: hours * employee.default_hourly_rate,
    created_at: new Date().toISOString()
  };

  await putItem(entry);
  return entry;
}

// Update employee rate (future entries use new rate)
async function updateEmployeeRate(
  personId: string,
  newHourlyRate: number,
  effectiveDate: string
): Promise<void> {
  await updateItem({
    PK: `PERSON#${personId}`,
    SK: 'PROFILE',
    default_hourly_rate: newHourlyRate,
    default_overtime_rate: newHourlyRate * 1.5,
    rate_last_updated: new Date().toISOString()
  });

  // Historical entries remain unchanged (they have rate snapshot)
}
```

### 5. Duplicate Entry Prevention

**Problem**: Same employee reported twice in same report (e.g., morning and afternoon activities).

**Solution**: Composite SK with personId prevents duplicates, or aggregate if intentional

```typescript
// Option 1: Prevent duplicates (use personId in SK)
SK: `ENTRY#${personId}#${timestamp}`
// Attempting to create second entry for same person will require different timestamp

// Option 2: Allow multiple entries per person per report (e.g., split shifts)
SK: `ENTRY#${personId}#${timestamp}#${sequence}`

// Query all entries for person on given report
const entries = await query({
  PK: `REPORT#${reportId}`,
  SK: { beginsWith: `ENTRY#${personId}#` }
});

// Aggregate hours across multiple entries
const totalHours = entries.reduce((sum, e) => sum + e.total_hours, 0);
```

---

## Migration Guide

### Step 1: Create New Tables

```bash
# Create personnel table
aws dynamodb create-table \
  --cli-input-json file://infrastructure/table-personnel-enhanced.json

# Create payroll entries table
aws dynamodb create-table \
  --cli-input-json file://infrastructure/table-payroll-entries.json

# Wait for tables to be active
aws dynamodb wait table-exists --table-name sitelogix-personnel
aws dynamodb wait table-exists --table-name sitelogix-payroll-entries
```

### Step 2: Update Existing Reports Table

```bash
# Add new GSI for payroll tracking
aws dynamodb update-table \
  --table-name sitelogix-reports \
  --attribute-definitions AttributeName=payroll_extracted,AttributeType=S \
  --global-secondary-index-updates \
  '[{
    "Create": {
      "IndexName": "GSI3-PayrollStatusIndex",
      "KeySchema": [
        {"AttributeName": "payroll_extracted", "KeyType": "HASH"},
        {"AttributeName": "report_date", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    }
  }]'
```

### Step 3: Migrate Existing Personnel Data

```typescript
// Script: migrate-personnel.ts
import { DynamoDB } from 'aws-sdk';

async function migratePersonnel() {
  const dynamodb = new DynamoDB.DocumentClient();

  // Read from old personnel table (if exists)
  const oldPersonnel = await dynamodb.scan({
    TableName: 'sitelogix-personnel-old'
  }).promise();

  // Transform and write to new schema
  for (const person of oldPersonnel.Items) {
    const newPerson = {
      PK: `PERSON#${person.person_id}`,
      SK: 'PROFILE',
      entity_type: 'PERSON_PROFILE',
      person_id: person.person_id,
      employee_number: person.employee_number || null,
      first_name: person.first_name,
      last_name: person.last_name,
      full_name: person.full_name,
      preferred_name: person.preferred_name || null,
      known_aliases: person.nicknames || [person.first_name.toLowerCase()],
      employment_status: person.status || 'active',
      needs_profile_completion: !person.employee_number || !person.hourly_rate,
      created_at: person.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await dynamodb.put({
      TableName: 'sitelogix-personnel',
      Item: newPerson
    }).promise();

    // Create alias entries for searchability
    for (const alias of newPerson.known_aliases) {
      await dynamodb.put({
        TableName: 'sitelogix-personnel',
        Item: {
          PK: newPerson.PK,
          SK: `ALIAS#${alias.toLowerCase()}`,
          entity_type: 'PERSON_ALIAS',
          person_id: person.person_id,
          alias_name: alias.toLowerCase(),
          full_name: newPerson.full_name,
          created_at: new Date().toISOString()
        }
      }).promise();
    }
  }
}
```

### Step 4: Backfill Payroll Entries from Existing Reports

```typescript
// Script: backfill-payroll.ts
async function backfillPayrollFromReports() {
  const dynamodb = new DynamoDB.DocumentClient();

  // Get all reports
  const reports = await dynamodb.scan({
    TableName: 'sitelogix-reports'
  }).promise();

  for (const report of reports.Items) {
    // Use AI to extract payroll from transcript
    const transcript = await getTranscriptFromS3(report.transcript_s3_url);
    const payrollData = await extractPayrollFromTranscript(transcript);

    // Create payroll entries
    for (const entry of payrollData.entries) {
      const employee = await findOrCreateEmployee(entry.name, report.project_id);

      await dynamodb.put({
        TableName: 'sitelogix-payroll-entries',
        Item: {
          PK: `REPORT#${report.report_id}`,
          SK: `ENTRY#${employee.person_id}#${Date.now()}`,
          entry_id: `pay_${report.report_date}_${report.report_id}_${employee.employee_number}`,
          report_id: report.report_id,
          report_date: report.report_date,
          employee_id: employee.person_id,
          employee_number: employee.employee_number,
          employee_name: employee.full_name,
          regular_hours: entry.hours,
          hourly_rate: employee.default_hourly_rate,
          extracted_by_ai: true,
          needs_review: entry.confidence < 0.8,
          created_at: new Date().toISOString()
        }
      }).promise();
    }

    // Update report with payroll metadata
    await dynamodb.update({
      TableName: 'sitelogix-reports',
      Key: { PK: report.PK, SK: report.SK },
      UpdateExpression: 'SET payroll_extracted = :extracted, employee_ids_mentioned = :ids',
      ExpressionAttributeValues: {
        ':extracted': 'true',
        ':ids': payrollData.entries.map(e => e.employee_id)
      }
    }).promise();
  }
}
```

### Step 5: Enable DynamoDB Streams for Audit Trail

```bash
# Enable streams on personnel table (for tracking changes)
aws dynamodb update-table \
  --table-name sitelogix-personnel \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES

# Enable streams on payroll entries (for analytics)
aws dynamodb update-table \
  --table-name sitelogix-payroll-entries \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES
```

### Step 6: Create Lambda Stream Processors (Optional)

```typescript
// Lambda: personnel-stream-processor
export const handler = async (event: DynamoDBStreamEvent) => {
  for (const record of event.Records) {
    if (record.eventName === 'MODIFY') {
      const oldImage = record.dynamodb.OldImage;
      const newImage = record.dynamodb.NewImage;

      // Detect name changes
      if (oldImage.full_name !== newImage.full_name) {
        await logNameChange(oldImage, newImage);
        await updatePayrollEntriesWithNewName(newImage.person_id, newImage.full_name);
      }

      // Detect rate changes
      if (oldImage.default_hourly_rate !== newImage.default_hourly_rate) {
        await logRateChange(oldImage, newImage);
      }
    }
  }
};
```

---

## Testing and Validation

### Unit Tests for Deduplication

```typescript
describe('Employee Deduplication', () => {
  test('should match "Bob" to "Robert Johnson"', async () => {
    const result = await findOrCreateEmployee('Bob', 'proj_test');
    expect(result.full_name).toBe('Robert Johnson');
  });

  test('should create new employee for unknown name', async () => {
    const result = await findOrCreateEmployee('Zephyr Smith', 'proj_test');
    expect(result.needs_profile_completion).toBe(true);
  });

  test('should flag ambiguous matches for review', async () => {
    const result = await findOrCreateEmployee('Mike', 'proj_test');
    expect(result.needs_review).toBe(true);
  });
});
```

### Integration Tests for Payroll CSV Generation

```typescript
describe('Payroll CSV Export', () => {
  test('should generate daily CSV with all employees', async () => {
    const csv = await generateDailyPayrollCSV('2025-01-06');

    expect(csv).toContain('Employee Number,Name,Regular Hours,Overtime Hours,Total Pay');
    expect(csv).toContain('EMP-001,Robert Johnson,8.0,1.0,332.50');
  });

  test('should aggregate hours across multiple reports', async () => {
    const csv = await generateWeeklyPayrollCSV('2025-01-01', '2025-01-07');

    const bobLine = csv.split('\n').find(line => line.includes('EMP-001'));
    expect(bobLine).toContain('40.0'); // 5 days * 8 hours
  });
});
```

---

## API Design for Payroll System

### REST Endpoints

#### 1. Get Employee by ID
```
GET /api/personnel/{personId}

Response:
{
  "person_id": "550e8400-e29b-41d4-a716-446655440000",
  "employee_number": "EMP-001",
  "full_name": "Robert Johnson",
  "preferred_name": "Bob",
  "employment_status": "active",
  "default_hourly_rate": 35.00,
  "known_aliases": ["Bob", "Bobby", "Robert"]
}
```

#### 2. Search Employees
```
GET /api/personnel/search?q=Bob&status=active

Response:
{
  "results": [
    {
      "person_id": "550e8400-e29b-41d4-a716-446655440000",
      "full_name": "Robert Johnson",
      "preferred_name": "Bob",
      "last_seen_date": "2025-01-06"
    }
  ],
  "count": 1
}
```

#### 3. Create/Update Employee
```
POST /api/personnel
PUT /api/personnel/{personId}

Body:
{
  "first_name": "Robert",
  "last_name": "Johnson",
  "preferred_name": "Bob",
  "employee_number": "EMP-001",
  "email": "bob@example.com",
  "hire_date": "2024-01-15",
  "default_hourly_rate": 35.00,
  "job_title": "Carpenter"
}
```

#### 4. Get Payroll Entries for Date Range
```
GET /api/payroll/entries?start_date=2025-01-01&end_date=2025-01-31&employee_id=550e8400...

Response:
{
  "entries": [
    {
      "entry_id": "pay_20250106_rpt_001_emp_001",
      "report_date": "2025-01-06",
      "project_name": "Riverside Tower",
      "regular_hours": 8.0,
      "overtime_hours": 1.0,
      "total_pay": 332.50
    }
  ],
  "total_hours": 9.0,
  "total_pay": 332.50
}
```

#### 5. Generate Payroll CSV
```
GET /api/payroll/export/csv?date=2025-01-06

Response: (CSV file download)
Employee Number,Name,Project,Regular Hours,Overtime Hours,Double Time,Total Hours,Hourly Rate,Total Pay
EMP-001,Robert Johnson,Riverside Tower,8.0,1.0,0.0,9.0,35.00,332.50
EMP-002,Michael Anderson,Riverside Tower,8.0,0.0,0.0,8.0,32.00,256.00
```

#### 6. Get Review Queue
```
GET /api/payroll/review?status=pending

Response:
{
  "entries": [
    {
      "entry_id": "pay_20250106_rpt_001_emp_004",
      "employee_name": "Tommy Rodriguez",
      "review_reason": "New employee auto-created, missing hourly rate",
      "report_date": "2025-01-06",
      "project_name": "Riverside Tower"
    }
  ],
  "count": 1
}
```

#### 7. Approve/Correct Payroll Entry
```
POST /api/payroll/entries/{entryId}/approve
POST /api/payroll/entries/{entryId}/correct

Body (for correction):
{
  "regular_hours": 7.5,
  "overtime_hours": 0.5,
  "correction_reason": "Employee left early"
}
```

---

## Performance Optimization Tips

### 1. Batch Operations for Daily CSV Export

```typescript
// Instead of querying each employee separately, use GSI3-DateIndex
async function generateDailyCSV(date: string): Promise<string> {
  const params = {
    TableName: 'sitelogix-payroll-entries',
    IndexName: 'GSI3-DateIndex',
    KeyConditionExpression: 'report_date = :date',
    ExpressionAttributeValues: {
      ':date': date
    }
  };

  const result = await dynamodb.query(params).promise();

  // Process all entries in one batch
  return convertToCSV(result.Items);
}
```

### 2. Parallel Queries for Multi-Project Reports

```typescript
// Query multiple projects in parallel
async function getProjectLaborCosts(projectIds: string[], dateRange: [string, string]) {
  const queries = projectIds.map(projectId =>
    dynamodb.query({
      TableName: 'sitelogix-payroll-entries',
      IndexName: 'GSI2-ProjectDateIndex',
      KeyConditionExpression: 'project_id = :pid AND report_date BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':pid': projectId,
        ':start': dateRange[0],
        ':end': dateRange[1]
      }
    }).promise()
  );

  const results = await Promise.all(queries);
  return results.flatMap(r => r.Items);
}
```

### 3. Caching Employee Profiles

```typescript
// Use in-memory cache for frequently accessed employee profiles
import NodeCache from 'node-cache';
const employeeCache = new NodeCache({ stdTTL: 3600 }); // 1 hour

async function getEmployee(personId: string): Promise<Employee> {
  const cached = employeeCache.get(personId);
  if (cached) return cached;

  const result = await dynamodb.get({
    TableName: 'sitelogix-personnel',
    Key: { PK: `PERSON#${personId}`, SK: 'PROFILE' }
  }).promise();

  employeeCache.set(personId, result.Item);
  return result.Item;
}
```

---

## Monitoring and Alerts

### CloudWatch Metrics to Track

1. **Deduplication Accuracy**
   - New employees created per day
   - Employees flagged for review (ambiguous matches)
   - Alias searches per report

2. **Payroll Processing**
   - Reports with payroll extracted (% complete)
   - Payroll entries needing review
   - Average extraction time per report

3. **Table Performance**
   - Read/write capacity utilization
   - Throttled requests
   - GSI query latency

### Sample CloudWatch Alarm

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "payroll-high-review-queue" \
  --alarm-description "Alert when >10 payroll entries need review" \
  --metric-name PayrollEntriesNeedingReview \
  --namespace SiteLogix \
  --statistic Sum \
  --period 3600 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

---

## Conclusion

This schema design provides:
- Robust employee deduplication via alias tracking
- Flexible payroll queries (by employee, project, date)
- Audit trail for all changes
- Support for AI-driven extraction with human review
- Scalable architecture for growing workforce

Next steps:
1. Review and approve schema design
2. Create tables in AWS
3. Implement AI extraction service
4. Build payroll CSV export API
5. Create admin UI for employee management
6. Set up monitoring and alerts
