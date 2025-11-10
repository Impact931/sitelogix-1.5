# SiteLogix Payroll System - Access Patterns Quick Reference

## Overview
This document provides quick-reference code snippets for common payroll system queries.

---

## Table of Contents
1. [Personnel Queries](#personnel-queries)
2. [Payroll Entry Queries](#payroll-entry-queries)
3. [Report Queries](#report-queries)
4. [Batch Operations](#batch-operations)
5. [TypeScript SDK Examples](#typescript-sdk-examples)

---

## Personnel Queries

### 1. Get Employee by ID
```typescript
const employee = await dynamodb.get({
  TableName: 'sitelogix-personnel',
  Key: {
    PK: `PERSON#${personId}`,
    SK: 'PROFILE'
  }
}).promise();
```

**AWS CLI:**
```bash
aws dynamodb get-item \
  --table-name sitelogix-personnel \
  --key '{"PK":{"S":"PERSON#550e8400-e29b-41d4-a716-446655440000"},"SK":{"S":"PROFILE"}}'
```

---

### 2. Search Employee by Name
```typescript
const results = await dynamodb.query({
  TableName: 'sitelogix-personnel',
  IndexName: 'GSI1-NameIndex',
  KeyConditionExpression: 'full_name = :name',
  ExpressionAttributeValues: {
    ':name': 'Robert Johnson'
  }
}).promise();
```

**AWS CLI:**
```bash
aws dynamodb query \
  --table-name sitelogix-personnel \
  --index-name GSI1-NameIndex \
  --key-condition-expression "full_name = :name" \
  --expression-attribute-values '{":name":{"S":"Robert Johnson"}}'
```

---

### 3. Search Employee by Alias
```typescript
// Query for alias record
const aliasResults = await dynamodb.query({
  TableName: 'sitelogix-personnel',
  IndexName: 'GSI1-NameIndex',
  KeyConditionExpression: 'full_name = :name AND begins_with(SK, :sk)',
  ExpressionAttributeValues: {
    ':name': 'Robert Johnson',
    ':sk': 'ALIAS#'
  }
}).promise();

// Alternative: Scan for alias (less efficient, use for fuzzy search)
const scanResults = await dynamodb.scan({
  TableName: 'sitelogix-personnel',
  FilterExpression: 'SK = :sk AND contains(alias_name, :alias)',
  ExpressionAttributeValues: {
    ':sk': { S: 'ALIAS#bob' },
    ':alias': 'bob'
  }
}).promise();
```

**AWS CLI:**
```bash
# Get all aliases for a person
aws dynamodb query \
  --table-name sitelogix-personnel \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{
    ":pk":{"S":"PERSON#550e8400-e29b-41d4-a716-446655440000"},
    ":sk":{"S":"ALIAS#"}
  }'
```

---

### 4. Lookup by Employee Number
```typescript
const employee = await dynamodb.query({
  TableName: 'sitelogix-personnel',
  IndexName: 'GSI2-EmployeeNumberIndex',
  KeyConditionExpression: 'employee_number = :empNum',
  ExpressionAttributeValues: {
    ':empNum': 'EMP-001'
  }
}).promise();
```

**AWS CLI:**
```bash
aws dynamodb query \
  --table-name sitelogix-personnel \
  --index-name GSI2-EmployeeNumberIndex \
  --key-condition-expression "employee_number = :num" \
  --expression-attribute-values '{":num":{"S":"EMP-001"}}'
```

---

### 5. List All Active Employees
```typescript
const activeEmployees = await dynamodb.query({
  TableName: 'sitelogix-personnel',
  IndexName: 'GSI3-StatusIndex',
  KeyConditionExpression: 'employment_status = :status',
  ExpressionAttributeValues: {
    ':status': 'active'
  }
}).promise();
```

**AWS CLI:**
```bash
aws dynamodb query \
  --table-name sitelogix-personnel \
  --index-name GSI3-StatusIndex \
  --key-condition-expression "employment_status = :status" \
  --expression-attribute-values '{":status":{"S":"active"}}'
```

---

### 6. Find Employees Not Seen Recently
```typescript
const inactiveEmployees = await dynamodb.query({
  TableName: 'sitelogix-personnel',
  IndexName: 'GSI3-StatusIndex',
  KeyConditionExpression: 'employment_status = :status AND last_seen_date < :date',
  ExpressionAttributeValues: {
    ':status': 'active',
    ':date': '2024-12-01'  // ISO date string
  }
}).promise();
```

**AWS CLI:**
```bash
aws dynamodb query \
  --table-name sitelogix-personnel \
  --index-name GSI3-StatusIndex \
  --key-condition-expression "employment_status = :status AND last_seen_date < :date" \
  --expression-attribute-values '{
    ":status":{"S":"active"},
    ":date":{"S":"2024-12-01"}
  }'
```

---

### 7. Create New Employee
```typescript
const newEmployee = {
  PK: `PERSON#${uuid()}`,
  SK: 'PROFILE',
  entity_type: 'PERSON_PROFILE',
  person_id: uuid(),
  employee_number: 'EMP-004',
  first_name: 'David',
  last_name: 'Lee',
  full_name: 'David Lee',
  preferred_name: 'Dave',
  employment_status: 'active',
  default_hourly_rate: 30.00,
  default_overtime_rate: 45.00,
  known_aliases: ['Dave', 'David', 'David Lee'],
  hire_date: '2025-01-07',
  needs_profile_completion: false,
  created_by_user_id: 'mgr_001',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

await dynamodb.put({
  TableName: 'sitelogix-personnel',
  Item: newEmployee
}).promise();

// Also create alias records
for (const alias of newEmployee.known_aliases) {
  await dynamodb.put({
    TableName: 'sitelogix-personnel',
    Item: {
      PK: newEmployee.PK,
      SK: `ALIAS#${alias.toLowerCase()}`,
      entity_type: 'PERSON_ALIAS',
      person_id: newEmployee.person_id,
      alias_name: alias.toLowerCase(),
      full_name: newEmployee.full_name,
      created_at: new Date().toISOString()
    }
  }).promise();
}
```

---

## Payroll Entry Queries

### 1. Get All Payroll Entries for a Report
```typescript
const entries = await dynamodb.query({
  TableName: 'sitelogix-payroll-entries',
  KeyConditionExpression: 'PK = :reportId',
  ExpressionAttributeValues: {
    ':reportId': `REPORT#${reportId}`
  }
}).promise();
```

**AWS CLI:**
```bash
aws dynamodb query \
  --table-name sitelogix-payroll-entries \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"REPORT#rpt_20250106_mgr_001_1736179200"}}'
```

---

### 2. Get Employee Hours for Date Range
```typescript
const entries = await dynamodb.query({
  TableName: 'sitelogix-payroll-entries',
  IndexName: 'GSI1-EmployeeDateIndex',
  KeyConditionExpression: 'employee_id = :empId AND report_date BETWEEN :start AND :end',
  ExpressionAttributeValues: {
    ':empId': personId,
    ':start': '2025-01-01',
    ':end': '2025-01-31'
  }
}).promise();

// Calculate totals
const totalHours = entries.Items.reduce((sum, entry) => sum + entry.total_hours, 0);
const totalPay = entries.Items.reduce((sum, entry) => sum + entry.total_cost, 0);
```

**AWS CLI:**
```bash
aws dynamodb query \
  --table-name sitelogix-payroll-entries \
  --index-name GSI1-EmployeeDateIndex \
  --key-condition-expression "employee_id = :id AND report_date BETWEEN :start AND :end" \
  --expression-attribute-values '{
    ":id":{"S":"550e8400-e29b-41d4-a716-446655440000"},
    ":start":{"S":"2025-01-01"},
    ":end":{"S":"2025-01-31"}
  }'
```

---

### 3. Get Project Labor Costs for Date Range
```typescript
const entries = await dynamodb.query({
  TableName: 'sitelogix-payroll-entries',
  IndexName: 'GSI2-ProjectDateIndex',
  KeyConditionExpression: 'project_id = :projId AND report_date BETWEEN :start AND :end',
  ExpressionAttributeValues: {
    ':projId': 'proj_riverside_tower',
    ':start': '2025-01-01',
    ':end': '2025-01-31'
  }
}).promise();

// Group by employee
const employeeCosts = entries.Items.reduce((acc, entry) => {
  if (!acc[entry.employee_id]) {
    acc[entry.employee_id] = {
      name: entry.employee_name,
      hours: 0,
      cost: 0
    };
  }
  acc[entry.employee_id].hours += entry.total_hours;
  acc[entry.employee_id].cost += entry.total_cost;
  return acc;
}, {});
```

**AWS CLI:**
```bash
aws dynamodb query \
  --table-name sitelogix-payroll-entries \
  --index-name GSI2-ProjectDateIndex \
  --key-condition-expression "project_id = :proj AND report_date BETWEEN :start AND :end" \
  --expression-attribute-values '{
    ":proj":{"S":"proj_riverside_tower"},
    ":start":{"S":"2025-01-01"},
    ":end":{"S":"2025-01-31"}
  }'
```

---

### 4. Generate Daily Payroll CSV (All Employees)
```typescript
const entries = await dynamodb.query({
  TableName: 'sitelogix-payroll-entries',
  IndexName: 'GSI3-DateIndex',
  KeyConditionExpression: 'report_date = :date',
  ExpressionAttributeValues: {
    ':date': '2025-01-06'
  }
}).promise();

// Convert to CSV
const csvRows = entries.Items.map(entry => [
  entry.employee_number,
  entry.employee_name,
  entry.project_name,
  entry.regular_hours,
  entry.overtime_hours,
  entry.double_time_hours || 0,
  entry.total_hours,
  entry.hourly_rate,
  entry.total_cost
].join(','));

const csv = [
  'Employee Number,Name,Project,Regular Hours,Overtime,Double Time,Total Hours,Rate,Total Pay',
  ...csvRows
].join('\n');
```

**AWS CLI:**
```bash
aws dynamodb query \
  --table-name sitelogix-payroll-entries \
  --index-name GSI3-DateIndex \
  --key-condition-expression "report_date = :date" \
  --expression-attribute-values '{":date":{"S":"2025-01-06"}}'
```

---

### 5. Get Entries Needing Review
```typescript
const reviewQueue = await dynamodb.query({
  TableName: 'sitelogix-payroll-entries',
  IndexName: 'GSI4-ReviewIndex',
  KeyConditionExpression: 'needs_review = :needsReview',
  ExpressionAttributeValues: {
    ':needsReview': 'true'
  }
}).promise();
```

**AWS CLI:**
```bash
aws dynamodb query \
  --table-name sitelogix-payroll-entries \
  --index-name GSI4-ReviewIndex \
  --key-condition-expression "needs_review = :review" \
  --expression-attribute-values '{":review":{"S":"true"}}'
```

---

### 6. Create Payroll Entry
```typescript
const entry = {
  PK: `REPORT#${reportId}`,
  SK: `ENTRY#${employeeId}#${Date.now()}`,
  entity_type: 'PAYROLL_ENTRY',
  entry_id: `pay_${reportDate}_${reportId}_${employeeNumber}`,
  report_id: reportId,
  report_date: reportDate,
  employee_id: employeeId,
  employee_number: employeeNumber,
  employee_name: employeeName,
  project_id: projectId,
  project_name: projectName,
  regular_hours: regularHours,
  overtime_hours: overtimeHours,
  total_hours: regularHours + overtimeHours,
  hourly_rate: hourlyRate,
  overtime_rate: overtimeRate,
  total_cost: (regularHours * hourlyRate) + (overtimeHours * overtimeRate),
  extracted_by_ai: true,
  needs_review: 'false',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

await dynamodb.put({
  TableName: 'sitelogix-payroll-entries',
  Item: entry
}).promise();
```

---

## Report Queries

### 1. Get Reports Without Payroll Data
```typescript
const reports = await dynamodb.query({
  TableName: 'sitelogix-reports',
  IndexName: 'GSI3-PayrollStatusIndex',
  KeyConditionExpression: 'payroll_extracted = :status',
  ExpressionAttributeValues: {
    ':status': 'false'
  }
}).promise();
```

**AWS CLI:**
```bash
aws dynamodb query \
  --table-name sitelogix-reports \
  --index-name GSI3-PayrollStatusIndex \
  --key-condition-expression "payroll_extracted = :status" \
  --expression-attribute-values '{":status":{"S":"false"}}'
```

---

### 2. Update Report with Payroll Metadata
```typescript
await dynamodb.update({
  TableName: 'sitelogix-reports',
  Key: {
    PK: `REPORT#${reportId}`,
    SK: 'METADATA'
  },
  UpdateExpression: 'SET payroll_extracted = :extracted, payroll_entry_ids = :ids, employee_ids_mentioned = :empIds, payroll_entry_count = :count, payroll_extraction_timestamp = :timestamp',
  ExpressionAttributeValues: {
    ':extracted': 'true',
    ':ids': payrollEntryIds,
    ':empIds': employeeIds,
    ':count': payrollEntryIds.length,
    ':timestamp': new Date().toISOString()
  }
}).promise();
```

---

## Batch Operations

### 1. Batch Get Multiple Employees
```typescript
const keys = personIds.map(id => ({
  PK: `PERSON#${id}`,
  SK: 'PROFILE'
}));

const result = await dynamodb.batchGet({
  RequestItems: {
    'sitelogix-personnel': {
      Keys: keys
    }
  }
}).promise();

const employees = result.Responses['sitelogix-personnel'];
```

---

### 2. Batch Write Payroll Entries
```typescript
const entries = employees.map(emp => ({
  PutRequest: {
    Item: {
      PK: `REPORT#${reportId}`,
      SK: `ENTRY#${emp.person_id}#${Date.now()}`,
      // ... rest of entry fields
    }
  }
}));

// DynamoDB batch write limit is 25 items
const chunks = [];
for (let i = 0; i < entries.length; i += 25) {
  chunks.push(entries.slice(i, i + 25));
}

for (const chunk of chunks) {
  await dynamodb.batchWrite({
    RequestItems: {
      'sitelogix-payroll-entries': chunk
    }
  }).promise();
}
```

---

## TypeScript SDK Examples

### Complete Employee Search with Deduplication
```typescript
import { DynamoDB } from 'aws-sdk';
import Fuse from 'fuse.js';

const dynamodb = new DynamoDB.DocumentClient();

interface Employee {
  person_id: string;
  full_name: string;
  known_aliases: string[];
  employee_number: string;
  default_hourly_rate: number;
}

async function findOrCreateEmployee(
  nameFromVoice: string,
  projectId: string,
  reportId: string
): Promise<Employee> {
  // Step 1: Exact name match
  const exactMatch = await dynamodb.query({
    TableName: 'sitelogix-personnel',
    IndexName: 'GSI1-NameIndex',
    KeyConditionExpression: 'full_name = :name',
    ExpressionAttributeValues: { ':name': nameFromVoice }
  }).promise();

  if (exactMatch.Items?.length > 0) {
    return exactMatch.Items[0] as Employee;
  }

  // Step 2: Alias search
  const allAliases = await dynamodb.scan({
    TableName: 'sitelogix-personnel',
    FilterExpression: 'begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':sk': 'ALIAS#' }
  }).promise();

  const aliasMatch = allAliases.Items?.find(
    item => item.alias_name.toLowerCase() === nameFromVoice.toLowerCase()
  );

  if (aliasMatch) {
    // Get full profile
    const profile = await dynamodb.get({
      TableName: 'sitelogix-personnel',
      Key: { PK: aliasMatch.PK, SK: 'PROFILE' }
    }).promise();
    return profile.Item as Employee;
  }

  // Step 3: Fuzzy match
  const allEmployees = await dynamodb.scan({
    TableName: 'sitelogix-personnel',
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: { ':sk': 'PROFILE' }
  }).promise();

  const fuse = new Fuse(allEmployees.Items || [], {
    keys: ['full_name', 'known_aliases'],
    threshold: 0.3
  });

  const fuzzyResults = fuse.search(nameFromVoice);

  if (fuzzyResults.length === 1) {
    return fuzzyResults[0].item as Employee;
  }

  if (fuzzyResults.length > 1) {
    // Multiple matches - flag for review
    console.warn(`Ambiguous match for "${nameFromVoice}":`, fuzzyResults.map(r => r.item.full_name));
    // Return best match but mark for review
    return fuzzyResults[0].item as Employee;
  }

  // Step 4: Create new employee
  const newEmployee: Employee = {
    person_id: generateUUID(),
    full_name: nameFromVoice,
    known_aliases: [nameFromVoice, nameFromVoice.split(' ')[0]],
    employee_number: null,
    default_hourly_rate: null,
  };

  await dynamodb.put({
    TableName: 'sitelogix-personnel',
    Item: {
      PK: `PERSON#${newEmployee.person_id}`,
      SK: 'PROFILE',
      ...newEmployee,
      employment_status: 'active',
      needs_profile_completion: true,
      first_mentioned_report_id: reportId,
      first_mentioned_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    }
  }).promise();

  return newEmployee;
}
```

---

### Generate Weekly Payroll Report
```typescript
async function generateWeeklyPayrollReport(
  startDate: string,
  endDate: string
): Promise<any[]> {
  const employees = await dynamodb.query({
    TableName: 'sitelogix-personnel',
    IndexName: 'GSI3-StatusIndex',
    KeyConditionExpression: 'employment_status = :status',
    ExpressionAttributeValues: { ':status': 'active' }
  }).promise();

  const payrollData = [];

  for (const employee of employees.Items || []) {
    const entries = await dynamodb.query({
      TableName: 'sitelogix-payroll-entries',
      IndexName: 'GSI1-EmployeeDateIndex',
      KeyConditionExpression: 'employee_id = :id AND report_date BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':id': employee.person_id,
        ':start': startDate,
        ':end': endDate
      }
    }).promise();

    const regularHours = entries.Items?.reduce((sum, e) => sum + e.regular_hours, 0) || 0;
    const overtimeHours = entries.Items?.reduce((sum, e) => sum + e.overtime_hours, 0) || 0;
    const totalPay = entries.Items?.reduce((sum, e) => sum + e.total_cost, 0) || 0;

    payrollData.push({
      employee_number: employee.employee_number,
      employee_name: employee.full_name,
      regular_hours: regularHours,
      overtime_hours: overtimeHours,
      total_hours: regularHours + overtimeHours,
      total_pay: totalPay
    });
  }

  return payrollData;
}
```

---

### Export to CSV
```typescript
function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => headers.map(h => row[h]).join(','))
  ];

  return csvRows.join('\n');
}

// Usage
const payrollData = await generateWeeklyPayrollReport('2025-01-01', '2025-01-07');
const csv = convertToCSV(payrollData);

// Save to S3
await s3.putObject({
  Bucket: 'sitelogix-reports',
  Key: `payroll/weekly/2025-W01.csv`,
  Body: csv,
  ContentType: 'text/csv'
}).promise();
```

---

## Performance Tips

### 1. Use Parallel Queries for Multiple Projects
```typescript
const projectIds = ['proj_a', 'proj_b', 'proj_c'];

const results = await Promise.all(
  projectIds.map(projId =>
    dynamodb.query({
      TableName: 'sitelogix-payroll-entries',
      IndexName: 'GSI2-ProjectDateIndex',
      KeyConditionExpression: 'project_id = :proj AND report_date BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':proj': projId,
        ':start': startDate,
        ':end': endDate
      }
    }).promise()
  )
);
```

### 2. Cache Frequently Accessed Employees
```typescript
import NodeCache from 'node-cache';

const employeeCache = new NodeCache({ stdTTL: 3600 }); // 1 hour

async function getEmployeeWithCache(personId: string): Promise<Employee> {
  const cached = employeeCache.get<Employee>(personId);
  if (cached) return cached;

  const result = await dynamodb.get({
    TableName: 'sitelogix-personnel',
    Key: { PK: `PERSON#${personId}`, SK: 'PROFILE' }
  }).promise();

  employeeCache.set(personId, result.Item);
  return result.Item as Employee;
}
```

### 3. Use Pagination for Large Result Sets
```typescript
async function getAllPayrollEntriesForDate(date: string): Promise<any[]> {
  let lastEvaluatedKey = undefined;
  const allItems = [];

  do {
    const result = await dynamodb.query({
      TableName: 'sitelogix-payroll-entries',
      IndexName: 'GSI3-DateIndex',
      KeyConditionExpression: 'report_date = :date',
      ExpressionAttributeValues: { ':date': date },
      ExclusiveStartKey: lastEvaluatedKey
    }).promise();

    allItems.push(...(result.Items || []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return allItems;
}
```

---

## Error Handling

```typescript
async function safeQuery(params: any): Promise<any> {
  try {
    return await dynamodb.query(params).promise();
  } catch (error) {
    if (error.code === 'ProvisionedThroughputExceededException') {
      // Retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000));
      return safeQuery(params);
    }

    if (error.code === 'ResourceNotFoundException') {
      console.error('Table or index does not exist');
      throw error;
    }

    console.error('DynamoDB query error:', error);
    throw error;
  }
}
```

---

## Next Steps

1. Implement these patterns in your backend services
2. Add error handling and logging
3. Set up CloudWatch metrics for query performance
4. Create Lambda functions for scheduled payroll exports
5. Build admin UI for employee management

For full documentation, see: `infrastructure/PAYROLL_SCHEMA_DESIGN.md`
