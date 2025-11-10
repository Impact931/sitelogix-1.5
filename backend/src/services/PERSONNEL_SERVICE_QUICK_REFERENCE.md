# Personnel Service Quick Reference

Fast reference guide for common operations.

## Import

```typescript
import { personnelService } from './services/personnelService';
```

## Common Operations

### 1. Match or Create Employee (Most Common)

```typescript
const result = await personnelService.matchOrCreateEmployee('Bob Smith', {
  projectId: 'PROJECT-001',
  reportDate: '2025-01-06',
  reportId: 'REPORT-001'
});

console.log(result.employeeId);    // Use this ID
console.log(result.confidence);    // exact | high | medium | new_employee
console.log(result.needsReview);   // Flag for manual review
```

### 2. Create Employee

```typescript
const employee = await personnelService.createEmployee({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '555-0123',
  hourlyRate: 45.0
});
```

### 3. Get Employee

```typescript
// By ID
const emp = await personnelService.getEmployeeById('PER#EMP-20250106001');

// By employee number
const emp = await personnelService.getEmployeeByNumber('EMP-20250106001');
```

### 4. Search Employees

```typescript
// Search by name
const results = await personnelService.searchEmployeesByName('Smith');

// List all active
const active = await personnelService.listEmployees({ status: 'active' });

// List incomplete profiles
const incomplete = await personnelService.listEmployees({
  needsProfileCompletion: true
});
```

### 5. Update Employee

```typescript
const updated = await personnelService.updateEmployee('PER#EMP-20250106001', {
  email: 'newemail@example.com',
  hourlyRate: 50.0,
  needsProfileCompletion: false
});
```

### 6. Add Nickname/Alias

```typescript
await personnelService.addEmployeeAlias('PER#EMP-20250106001', 'Bobby');
```

### 7. Merge Duplicates

```typescript
// Preview first
const preview = await personnelService.suggestMerge(
  'PER#EMP-001',
  'PER#EMP-002'
);

// Execute merge
const merged = await personnelService.mergeEmployees(
  'PER#EMP-001',  // Keep this one
  'PER#EMP-002'   // Merge into first
);
```

### 8. Terminate Employee

```typescript
await personnelService.terminateEmployee('PER#EMP-20250106001');
```

## Matching Confidence Levels

| Confidence | Meaning | Action |
|------------|---------|--------|
| `exact` | Exact name match in database | Use immediately |
| `high` | Alias match or very close fuzzy match (>90%) | Use with confidence |
| `medium` | Fuzzy match (85-90%) or context-based | Use but may review |
| `new_employee` | No match found, new record created | Complete profile later |

## When to Review Matches

Check `result.needsReview` flag:

```typescript
if (result.needsReview) {
  console.log('Manual review needed!');
  console.log('Suggested matches:', result.suggestedMatches);
}
```

## Complete Workflow Example

```typescript
// 1. Process voice report
const name = 'Bob Smith';
const match = await personnelService.matchOrCreateEmployee(name, {
  projectId: 'PROJECT-001',
  reportDate: '2025-01-06'
});

// 2. Check if profile is complete
const employee = await personnelService.getEmployeeById(match.employeeId);

if (employee?.needsProfileCompletion) {
  // 3. Complete profile
  await personnelService.updateEmployee(match.employeeId, {
    email: 'bob.smith@example.com',
    phone: '555-1234',
    hireDate: '2025-01-01',
    hourlyRate: 40.0,
    needsProfileCompletion: false
  });
}

// 4. Use employee ID in report
console.log(`Employee ID for report: ${match.employeeId}`);
```

## Testing Fuzzy Matching

```typescript
// Create employee
await personnelService.createEmployee({
  firstName: 'Michael',
  lastName: 'Rodriguez'
});

// These will all match:
await personnelService.matchOrCreateEmployee('Michael Rodriguez');  // exact
await personnelService.matchOrCreateEmployee('Micheal Rodriguez');  // typo
await personnelService.matchOrCreateEmployee('Michael Rodriquez');  // 1 char off
```

## Error Handling

```typescript
try {
  const employee = await personnelService.getEmployeeById('PER#INVALID');
  if (!employee) {
    console.log('Employee not found');
  }
} catch (error) {
  console.error('Error:', error);
}
```

## TypeScript Types

```typescript
import type {
  Employee,
  CreateEmployeeInput,
  MatchContext,
  MatchResult,
  MergePreview,
  ListEmployeeFilters
} from './services/personnelService';
```

## Logging Output

Look for these emoji in logs:

- ✅ Success
- ❌ Error
- 🔍 Search/Match
- 📝 Create/Update
- 🚫 Delete
- ⚠️ Warning
- 🔀 Merge
- 🏷️ Alias
- ✨ Auto-create

## Performance Tips

1. **Use exact matches first** (fastest)
2. **Batch employee lookups** when possible
3. **Cache active employees** for multiple matches
4. **Limit fuzzy searches** to necessary cases
5. **Use filters** when listing employees

## Need More Help?

- **Full Documentation**: `PERSONNEL_SERVICE_README.md`
- **Examples**: `personnelService.examples.ts`
- **Tests**: `personnelService.test.ts`
