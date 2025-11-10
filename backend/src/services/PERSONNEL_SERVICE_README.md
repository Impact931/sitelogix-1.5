# Personnel Service Documentation

Complete personnel management service with intelligent 6-layer employee deduplication for the SiteLogix construction daily reporting system.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [6-Layer Deduplication Algorithm](#6-layer-deduplication-algorithm)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)
- [Performance Considerations](#performance-considerations)

## Overview

The Personnel Service manages all employee-related operations with a focus on intelligent deduplication. It handles the common challenge in construction reporting where employees are mentioned using nicknames, variations of their names, or with typos in voice transcripts.

### Key Capabilities

- **Smart Employee Matching**: 6-layer algorithm to find existing employees
- **Fuzzy Name Matching**: Uses Levenshtein distance to handle typos
- **Alias Management**: Track nicknames and name variations
- **Complete CRUD Operations**: Create, read, update, and soft-delete employees
- **Duplicate Detection**: Identify and merge duplicate employee records
- **Auto-Creation**: Automatically create employee profiles from voice reports

## Features

### 1. CRUD Operations

- Create employee with complete profile information
- Retrieve employee by ID or employee number
- Search employees by name (partial matching)
- List employees with filters (status, profile completion)
- Update employee information
- Soft delete (terminate employee)

### 2. Smart Deduplication

- 6-layer matching algorithm
- Levenshtein distance calculation (max threshold: 2)
- Context-aware matching (project-based)
- Multiple match detection with manual review flag
- Confidence scoring (exact, high, medium, new_employee)

### 3. Alias Management

- Add nicknames and name variations
- Automatic alias lookup
- Alias records for quick searching

### 4. Merge Operations

- Preview merge conflicts before executing
- Merge duplicate employee records
- Preserve history and aliases
- Automatic alias consolidation

## Database Schema

### Table: `sitelogix-personnel`

#### Primary Keys

```
PK: person_id (e.g., "PER#EMP-20250106001")
SK: "PROFILE" or "ALIAS#{normalized_name}"
```

#### Attributes

```typescript
{
  personId: string;              // PER#EMP-20250106001
  employeeNumber: string;        // EMP-20250106001
  firstName: string;             // Robert
  lastName: string;              // Johnson
  middleName?: string;           // James
  preferredName?: string;        // Bob
  fullName: string;              // Robert Johnson (normalized)
  email?: string;
  phone?: string;
  hireDate?: string;            // ISO date
  employmentStatus: string;      // active | inactive | terminated
  hourlyRate?: number;
  overtimeRate?: number;
  jobTitle?: string;
  knownAliases: string[];       // ["Robert Johnson", "Bob", "Bobby"]
  firstMentionedDate?: string;
  firstMentionedReportId?: string;
  lastSeenDate?: string;
  lastSeenProjectId?: string;
  needsProfileCompletion: boolean;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}
```

#### Global Secondary Indexes (GSIs)

**GSI1-NameIndex**
- Hash Key: `full_name`
- Purpose: Fast exact name lookups

**GSI2-ProjectIndex**
- Hash Key: `project_id`
- Purpose: Query employees by project

**GSI3-StatusIndex**
- Hash Key: `employment_status`
- Range Key: `last_seen_date`
- Purpose: Filter by status, sort by recent activity

## API Reference

### Create Operations

#### `createEmployee(data: CreateEmployeeInput): Promise<Employee>`

Create a new employee record.

```typescript
const employee = await personnelService.createEmployee({
  firstName: 'Robert',
  lastName: 'Johnson',
  middleName: 'James',
  preferredName: 'Bob',
  email: 'bob.johnson@example.com',
  phone: '555-0123',
  hireDate: '2024-03-15',
  hourlyRate: 45.5,
  overtimeRate: 68.25,
  jobTitle: 'Lead Electrician',
  createdByUserId: 'admin-001'
});
```

### Read Operations

#### `getEmployeeById(personId: string): Promise<Employee | null>`

Retrieve employee by person ID.

```typescript
const employee = await personnelService.getEmployeeById('PER#EMP-20250106001');
```

#### `getEmployeeByNumber(employeeNumber: string): Promise<Employee | null>`

Retrieve employee by employee number.

```typescript
const employee = await personnelService.getEmployeeByNumber('EMP-20250106001');
```

#### `searchEmployeesByName(name: string): Promise<Employee[]>`

Search employees by partial name match.

```typescript
const results = await personnelService.searchEmployeesByName('Bob');
// Returns all employees with "Bob" in name or aliases
```

#### `listEmployees(filters?: ListEmployeeFilters): Promise<Employee[]>`

List employees with optional filters.

```typescript
// List all active employees
const active = await personnelService.listEmployees({ status: 'active' });

// List employees needing profile completion
const incomplete = await personnelService.listEmployees({
  needsProfileCompletion: true
});
```

### Update Operations

#### `updateEmployee(personId: string, data: Partial<Employee>): Promise<Employee>`

Update employee information.

```typescript
const updated = await personnelService.updateEmployee('PER#EMP-20250106001', {
  email: 'newemail@example.com',
  hourlyRate: 50.0,
  jobTitle: 'Senior Electrician'
});
```

#### `addEmployeeAlias(personId: string, alias: string): Promise<void>`

Add a nickname or alias.

```typescript
await personnelService.addEmployeeAlias('PER#EMP-20250106001', 'Bobby');
```

### Delete Operations

#### `terminateEmployee(personId: string): Promise<void>`

Soft delete - changes status to 'terminated'.

```typescript
await personnelService.terminateEmployee('PER#EMP-20250106001');
```

### Deduplication Operations

#### `matchOrCreateEmployee(name: string, context?: MatchContext): Promise<MatchResult>`

Smart matching with 6-layer algorithm.

```typescript
const result = await personnelService.matchOrCreateEmployee('Bob Smith', {
  projectId: 'PROJECT-001',
  reportDate: '2025-01-06',
  reportId: 'REPORT-001'
});

console.log(result.employeeId);      // PER#EMP-...
console.log(result.confidence);      // exact | high | medium | new_employee
console.log(result.needsReview);     // true if manual review needed
console.log(result.matchMethod);     // exact_name | alias_match | fuzzy_match | etc
```

### Merge Operations

#### `suggestMerge(personId1: string, personId2: string): Promise<MergePreview>`

Preview merge operation.

```typescript
const preview = await personnelService.suggestMerge(
  'PER#EMP-001',
  'PER#EMP-002'
);

console.log(preview.conflicts);      // Field conflicts
console.log(preview.aliasesToMerge); // Aliases to be merged
```

#### `mergeEmployees(primaryId: string, duplicateId: string): Promise<Employee>`

Merge duplicate employee into primary.

```typescript
const merged = await personnelService.mergeEmployees(
  'PER#EMP-001',  // Primary (kept)
  'PER#EMP-002'   // Duplicate (terminated)
);
```

## 6-Layer Deduplication Algorithm

The service uses a sophisticated 6-layer algorithm to intelligently match or create employees:

### Layer 1: Exact Full Name Match

Query GSI1-NameIndex for exact normalized name.

```typescript
// Input: "Robert Smith"
// Lookup: full_name = "Robert Smith"
// Confidence: exact
```

### Layer 2: Alias Search

Search for SK records matching `ALIAS#{normalized_name}`.

```typescript
// Input: "Bob Smith"
// Lookup: SK = "ALIAS#bob_smith"
// Confidence: high
```

### Layer 3: Fuzzy Name Matching

Use Levenshtein distance to find typos (threshold ≤ 2).

```typescript
// Input: "Robrt Smith" (missing 'e')
// Levenshtein distance to "Robert Smith" = 1
// Similarity: 93%
// Confidence: high
```

**Levenshtein Distance Formula:**

```
distance(str1, str2) = min(
  deletion,
  insertion,
  substitution
)
```

**Similarity Percentage:**

```
similarity = ((maxLength - distance) / maxLength) × 100
```

### Layer 4: Context-Based Matching

Filter fuzzy matches by project context.

```typescript
// Multiple fuzzy matches found
// Input context: { projectId: "PROJECT-001" }
// Filter: lastSeenProjectId = "PROJECT-001"
// Select: Employee who recently worked on same project
// Confidence: medium
```

### Layer 5: Multiple Matches Detection

Flag for manual review when 2+ strong matches found.

```typescript
// Input: "Chris Anderson"
// Matches:
//   - Christopher Anderson (95% similarity)
//   - Chris Anderson Jr. (93% similarity)
// Action: Create new + flag for review
// Return: suggestedMatches array
// Confidence: new_employee
// needsReview: true
```

### Layer 6: Auto-Create New Employee

No matches found - create new employee record.

```typescript
// Input: "Unique Person Name"
// No matches in any layer
// Action: Create new employee with needsProfileCompletion = true
// Confidence: new_employee
// needsReview: false
```

## Usage Examples

### Example 1: Processing Voice Report

```typescript
// Voice transcript: "Bob, Jennifer, and Mike worked today"
const employees = ['Bob', 'Jennifer', 'Mike'];
const context = {
  projectId: 'PROJECT-001',
  reportDate: '2025-01-06',
  reportId: 'REPORT-001'
};

for (const name of employees) {
  const result = await personnelService.matchOrCreateEmployee(name, context);

  if (result.needsReview) {
    console.log(`⚠️ Manual review needed for: ${name}`);
    console.log(`Suggested matches:`, result.suggestedMatches);
  }

  // Use result.employeeId for report processing
}
```

### Example 2: Handling Nicknames

```typescript
// Create employee
const emp = await personnelService.createEmployee({
  firstName: 'Christopher',
  lastName: 'Anderson'
});

// Add nicknames
await personnelService.addEmployeeAlias(emp.personId, 'Chris');
await personnelService.addEmployeeAlias(emp.personId, 'Chris A');

// All variations now match
const match1 = await personnelService.matchOrCreateEmployee('Christopher Anderson');
const match2 = await personnelService.matchOrCreateEmployee('Chris Anderson');
const match3 = await personnelService.matchOrCreateEmployee('Chris A');

// All return same employeeId
console.log(match1.employeeId === match2.employeeId); // true
console.log(match2.employeeId === match3.employeeId); // true
```

### Example 3: Fuzzy Matching with Typos

```typescript
// Create employee with correct spelling
await personnelService.createEmployee({
  firstName: 'Michael',
  lastName: 'Rodriguez'
});

// Match with typos
const typos = [
  'Micheal Rodriguez',   // Common misspelling
  'Michael Rodriquez',   // Missing 'g'
  'Michal Rodriguez'     // Missing 'e'
];

for (const typo of typos) {
  const result = await personnelService.matchOrCreateEmployee(typo);
  console.log(`"${typo}" → ${result.confidence} match`);
  // All should match with high/medium confidence
}
```

### Example 4: Detecting and Merging Duplicates

```typescript
// Two similar employees exist
const emp1 = await personnelService.createEmployee({
  firstName: 'William',
  lastName: 'Thompson',
  email: 'bill@example.com'
});

const emp2 = await personnelService.createEmployee({
  firstName: 'Bill',
  lastName: 'Thompson',
  phone: '555-1234'
});

// Preview merge
const preview = await personnelService.suggestMerge(emp1.personId, emp2.personId);
console.log('Conflicts:', preview.conflicts);

// Execute merge
const merged = await personnelService.mergeEmployees(emp1.personId, emp2.personId);
console.log('Merged aliases:', merged.knownAliases); // ["William Thompson", "Bill Thompson"]
```

### Example 5: Searching and Filtering

```typescript
// Search by partial name
const smiths = await personnelService.searchEmployeesByName('Smith');

// List active employees
const active = await personnelService.listEmployees({ status: 'active' });

// List incomplete profiles
const incomplete = await personnelService.listEmployees({
  needsProfileCompletion: true
});

// Update incomplete profile
for (const emp of incomplete) {
  await personnelService.updateEmployee(emp.personId, {
    email: `${emp.firstName.toLowerCase()}@example.com`,
    needsProfileCompletion: false
  });
}
```

## Error Handling

The service uses a consistent error handling approach:

### Validation Errors

```typescript
try {
  await personnelService.updateEmployee('PER#NONEXISTENT', { email: 'test@example.com' });
} catch (error) {
  console.error('Employee not found:', error.message);
}
```

### DynamoDB Errors

All DynamoDB errors are caught and logged. Read operations return `null` instead of throwing:

```typescript
const employee = await personnelService.getEmployeeById('PER#INVALID');
// Returns null instead of throwing
```

### Logging

All operations are logged with emoji prefixes for easy identification:

- ✅ Success operations
- ❌ Errors
- 🔍 Search/match operations
- 📝 Create/update operations
- 🚫 Delete operations
- ⚠️ Warnings (multiple matches, etc.)
- 🔀 Merge operations
- 🏷️ Alias operations

## Performance Considerations

### Indexing Strategy

1. **GSI1-NameIndex**: O(1) lookup for exact names
2. **GSI3-StatusIndex**: Efficient status filtering
3. **Alias Records**: Fast alias lookups via SK pattern

### Optimization Tips

1. **Use Exact Matches First**: Layer 1 is fastest (GSI query)
2. **Limit Fuzzy Matching**: Only scans when necessary
3. **Cache Active Employees**: For repeated matching operations
4. **Batch Operations**: When processing multiple employees

### Scalability

- Supports thousands of employees
- Fuzzy matching scans limited to active employees only
- GSI queries provide consistent low latency
- Consider adding GSI for aliases if alias search becomes bottleneck

## Testing

Run comprehensive tests:

```bash
npm test personnelService.test.ts
```

Run examples:

```bash
ts-node backend/src/services/personnelService.examples.ts
```

## Contributing

When extending this service:

1. Maintain type safety (no `any` types)
2. Add comprehensive tests for new features
3. Update documentation with examples
4. Follow emoji logging convention
5. Preserve backward compatibility

## Support

For questions or issues:
- Check examples in `personnelService.examples.ts`
- Review test cases in `personnelService.test.ts`
- See existing usage in `reportProcessingService.ts`

---

**Version:** 1.0.0
**Last Updated:** 2025-01-06
**Maintained By:** Impact Consulting
