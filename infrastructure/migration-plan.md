# Migration Plan: Personnel Table v1 to v2

## Overview
This document outlines the step-by-step migration process from the current `sitelogix-personnel` table to the enhanced `sitelogix-personnel-v2` table with expanded features for admin/project management.

---

## Pre-Migration Checklist

### 1. Backup Current Data
- [ ] Export all data from `sitelogix-personnel` table
- [ ] Store backup in S3 bucket: `sitelogix-backups/personnel/YYYY-MM-DD/`
- [ ] Verify backup integrity
- [ ] Document record count for validation

### 2. Create New Table
- [ ] Deploy `sitelogix-personnel-v2` table using schema in `admin-tables-schemas.json`
- [ ] Verify all GSIs are created successfully
- [ ] Wait for table status to be ACTIVE
- [ ] Wait for all GSI statuses to be ACTIVE

### 3. Test Environment Setup
- [ ] Deploy v2 table in test/staging environment first
- [ ] Run migration script in test environment
- [ ] Validate data integrity in test environment
- [ ] Perform query tests on all access patterns
- [ ] Load test with expected production volume

---

## Migration Strategy

### Approach: Dual-Write Pattern (Zero Downtime)

We'll use a phased approach to ensure zero downtime:

**Phase 1**: Create new table, dual-write mode
**Phase 2**: Backfill historical data
**Phase 3**: Validate data consistency
**Phase 4**: Switch reads to new table
**Phase 5**: Deprecate old table

---

## Phase 1: Deploy New Table and Enable Dual-Write

### Step 1.1: Deploy New Table
```bash
# Create the new table
aws dynamodb create-table --cli-input-json file://infrastructure/admin-tables-schemas.json --output json

# Wait for table to be active
aws dynamodb wait table-exists --table-name sitelogix-personnel-v2

# Verify table status
aws dynamodb describe-table --table-name sitelogix-personnel-v2
```

### Step 1.2: Update Application Code for Dual-Write

Create a wrapper service that writes to both tables:

```javascript
// services/personnelService.js

class PersonnelService {
  async createEmployee(employeeData) {
    const v1Record = this.transformToV1Format(employeeData);
    const v2Record = this.transformToV2Format(employeeData);

    try {
      // Write to both tables
      await Promise.all([
        this.writeToV1(v1Record),
        this.writeToV2(v2Record)
      ]);

      return v2Record;
    } catch (error) {
      // If v2 fails, at least v1 is written
      console.error('Dual write failed:', error);
      throw error;
    }
  }

  async updateEmployee(employeeId, updates) {
    const v1Updates = this.transformToV1Format(updates);
    const v2Updates = this.transformToV2Format(updates);

    await Promise.all([
      this.updateV1(employeeId, v1Updates),
      this.updateV2(employeeId, v2Updates)
    ]);
  }

  // Read from v1 table during migration
  async getEmployee(employeeId) {
    return this.getFromV1(employeeId);
  }
}
```

### Step 1.3: Deploy Dual-Write Code
```bash
# Deploy updated Lambda functions
./deploy-api-lambda.sh

# Verify deployment
aws lambda get-function --function-name sitelogix-api-handler
```

---

## Phase 2: Backfill Historical Data

### Step 2.1: Create Migration Script

```javascript
// scripts/migrate-personnel-v1-to-v2.js

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const SOURCE_TABLE = 'sitelogix-personnel';
const TARGET_TABLE = 'sitelogix-personnel-v2';

async function scanAndMigrate() {
  let migratedCount = 0;
  let errorCount = 0;
  const errors = [];

  let lastEvaluatedKey = null;

  do {
    // Scan source table
    const scanParams = {
      TableName: SOURCE_TABLE,
      Limit: 25,
      ExclusiveStartKey: lastEvaluatedKey
    };

    const result = await dynamodb.scan(scanParams).promise();

    // Transform and write to target table
    for (const item of result.Items) {
      try {
        const transformedItem = transformPersonnelRecord(item);
        await dynamodb.put({
          TableName: TARGET_TABLE,
          Item: transformedItem
        }).promise();

        migratedCount++;

        if (migratedCount % 100 === 0) {
          console.log(`Migrated ${migratedCount} records...`);
        }
      } catch (error) {
        errorCount++;
        errors.push({
          record: item,
          error: error.message
        });
        console.error(`Error migrating record ${item.PK}:`, error);
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;

  } while (lastEvaluatedKey);

  console.log(`\nMigration Complete!`);
  console.log(`Successfully migrated: ${migratedCount} records`);
  console.log(`Errors: ${errorCount} records`);

  if (errors.length > 0) {
    // Write errors to file for review
    const fs = require('fs');
    fs.writeFileSync(
      './migration-errors.json',
      JSON.stringify(errors, null, 2)
    );
    console.log(`Error details written to migration-errors.json`);
  }

  return { migratedCount, errorCount };
}

function transformPersonnelRecord(v1Record) {
  // Extract employee_id from PK (format: EMPLOYEE#<id>)
  const employeeId = v1Record.PK.replace('EMPLOYEE#', '');

  // Generate employee number if not exists
  const employeeNumber = v1Record.employee_number || generateEmployeeNumber(v1Record);

  return {
    PK: v1Record.PK, // Keep same PK format
    SK: v1Record.SK, // Keep same SK format
    employee_id: employeeId,
    employee_number: employeeNumber,
    full_name: v1Record.full_name,

    // New fields with defaults
    role: v1Record.role || 'user',
    email: v1Record.email || '',
    phone: v1Record.phone || '',
    team_id: v1Record.project_id || '', // Map old project_id to team_id

    // Health tracking (new)
    health_status: 'fit_for_duty',
    health_notes: '',

    // Status (new)
    status: v1Record.active === false ? 'inactive' : 'active',

    // Hours tracking (new with defaults)
    hourly_rate: v1Record.hourly_rate || 0,
    hours_week: 0,
    hours_month: 0,

    // Certifications (new)
    certifications: v1Record.certifications || [],

    // Timestamps
    created_at: v1Record.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: v1Record.created_by || 'MIGRATION_SCRIPT',

    // Preserve any other fields
    ...getAdditionalFields(v1Record)
  };
}

function generateEmployeeNumber(record) {
  // Generate employee number from name + random suffix
  const namePrefix = record.full_name
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase();
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `EMP${namePrefix}${randomSuffix}`;
}

function getAdditionalFields(record) {
  // Preserve any custom fields that don't conflict
  const reserved = [
    'PK', 'SK', 'employee_id', 'employee_number', 'full_name',
    'role', 'email', 'phone', 'team_id', 'health_status',
    'health_notes', 'status', 'hourly_rate', 'hours_week',
    'hours_month', 'certifications', 'created_at', 'updated_at',
    'created_by', 'project_id', 'active'
  ];

  const additional = {};
  for (const [key, value] of Object.entries(record)) {
    if (!reserved.includes(key)) {
      additional[key] = value;
    }
  }
  return additional;
}

// Run migration
scanAndMigrate()
  .then(result => {
    console.log('Migration completed:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
```

### Step 2.2: Run Migration Script
```bash
# Run in test environment first
NODE_ENV=test node scripts/migrate-personnel-v1-to-v2.js

# Review results and error log
cat migration-errors.json

# If successful, run in production
NODE_ENV=production node scripts/migrate-personnel-v1-to-v2.js
```

---

## Phase 3: Validate Data Consistency

### Step 3.1: Create Validation Script

```javascript
// scripts/validate-personnel-migration.js

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

async function validateMigration() {
  console.log('Starting validation...\n');

  // 1. Count records in both tables
  const v1Count = await getTableCount('sitelogix-personnel');
  const v2Count = await getTableCount('sitelogix-personnel-v2');

  console.log(`V1 Table: ${v1Count} records`);
  console.log(`V2 Table: ${v2Count} records`);

  if (v1Count !== v2Count) {
    console.error('❌ Record counts do not match!');
    return false;
  }
  console.log('✅ Record counts match\n');

  // 2. Sample validation - compare 100 random records
  console.log('Validating sample records...');
  const v1Records = await getSampleRecords('sitelogix-personnel', 100);
  let matchCount = 0;
  let mismatchCount = 0;

  for (const v1Record of v1Records) {
    const v2Record = await dynamodb.get({
      TableName: 'sitelogix-personnel-v2',
      Key: {
        PK: v1Record.PK,
        SK: v1Record.SK
      }
    }).promise();

    if (!v2Record.Item) {
      console.error(`❌ Record missing in V2: ${v1Record.PK}`);
      mismatchCount++;
      continue;
    }

    // Validate core fields
    if (
      v1Record.full_name === v2Record.Item.full_name &&
      v1Record.email === v2Record.Item.email
    ) {
      matchCount++;
    } else {
      console.error(`❌ Data mismatch for ${v1Record.PK}`);
      mismatchCount++;
    }
  }

  console.log(`\nSample validation: ${matchCount} matches, ${mismatchCount} mismatches`);

  // 3. Test all GSIs
  console.log('\nTesting GSIs...');
  await testGSI('GSI1-NameIndex', 'full_name', 'John Smith');
  await testGSI('GSI2-EmployeeNumberIndex', 'employee_number', 'EMP001');
  await testGSI('GSI4-RoleStatusIndex', 'role', 'user');

  console.log('\n✅ Validation complete!');
  return mismatchCount === 0;
}

async function getTableCount(tableName) {
  const result = await dynamodb.scan({
    TableName: tableName,
    Select: 'COUNT'
  }).promise();
  return result.Count;
}

async function getSampleRecords(tableName, count) {
  const result = await dynamodb.scan({
    TableName: tableName,
    Limit: count
  }).promise();
  return result.Items;
}

async function testGSI(indexName, keyName, keyValue) {
  try {
    const result = await dynamodb.query({
      TableName: 'sitelogix-personnel-v2',
      IndexName: indexName,
      KeyConditionExpression: `${keyName} = :value`,
      ExpressionAttributeValues: {
        ':value': keyValue
      }
    }).promise();

    console.log(`✅ ${indexName}: ${result.Items.length} records found`);
  } catch (error) {
    console.error(`❌ ${indexName} failed:`, error.message);
  }
}

validateMigration()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
```

### Step 3.2: Run Validation
```bash
node scripts/validate-personnel-migration.js
```

---

## Phase 4: Switch Reads to New Table

### Step 4.1: Update Application Code

```javascript
// Update PersonnelService to read from v2
class PersonnelService {
  async getEmployee(employeeId) {
    // Switch to v2 for reads
    return this.getFromV2(employeeId);
  }

  async searchEmployeeByName(name) {
    // Use new GSI1-NameIndex on v2
    return this.queryV2GSI1(name);
  }

  async getEmployeesByTeam(teamId) {
    // Use new GSI3-TeamIndex on v2
    return this.queryV2GSI3(teamId);
  }

  // Continue dual-write for safety
  async createEmployee(employeeData) {
    const v2Record = this.transformToV2Format(employeeData);
    const v1Record = this.transformToV1Format(employeeData);

    await Promise.all([
      this.writeToV2(v2Record),
      this.writeToV1(v1Record)
    ]);

    return v2Record;
  }
}
```

### Step 4.2: Deploy Read-Switch Code
```bash
# Deploy updated code
./deploy-api-lambda.sh

# Monitor for errors
aws logs tail /aws/lambda/sitelogix-api-handler --follow
```

### Step 4.3: Monitor for 48 Hours
- Monitor CloudWatch logs for errors
- Check error rates
- Validate query performance
- Compare response times v1 vs v2

---

## Phase 5: Deprecate Old Table

### Step 5.1: Disable Dual-Write (after 1 week of monitoring)

```javascript
// Remove v1 writes
class PersonnelService {
  async createEmployee(employeeData) {
    const v2Record = this.transformToV2Format(employeeData);
    return this.writeToV2(v2Record); // Only v2 now
  }

  async updateEmployee(employeeId, updates) {
    const v2Updates = this.transformToV2Format(updates);
    return this.updateV2(employeeId, v2Updates); // Only v2 now
  }
}
```

### Step 5.2: Deploy Single-Write Code
```bash
./deploy-api-lambda.sh
```

### Step 5.3: Archive Old Table (after 2 weeks of single-write)

```bash
# Export v1 table to S3 for archival
aws dynamodb export-table-to-point-in-time \
  --table-arn arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-personnel \
  --s3-bucket sitelogix-backups \
  --s3-prefix personnel-v1-archive/$(date +%Y-%m-%d) \
  --export-format DYNAMODB_JSON

# Wait for export to complete
aws dynamodb describe-export --export-arn <EXPORT_ARN>

# Verify export in S3
aws s3 ls s3://sitelogix-backups/personnel-v1-archive/
```

### Step 5.4: Delete Old Table (after export verified)

```bash
# Only do this after confirming export is complete and valid
# And after at least 1 month of successful v2 operation

aws dynamodb delete-table --table-name sitelogix-personnel
```

---

## Rollback Plan

If issues are discovered during migration:

### Immediate Rollback (During Dual-Write Phase)
1. Switch reads back to v1 table
2. Deploy rollback code
3. Investigate issues
4. Fix and retry migration

### Emergency Rollback (After Read-Switch)
1. Immediately deploy code to read from v1
2. Continue dual-write to maintain v2 data
3. Investigate discrepancies
4. Re-run validation scripts
5. Re-attempt read switch after fixes

### Code for Emergency Rollback
```javascript
// Emergency rollback - read from v1
class PersonnelService {
  async getEmployee(employeeId) {
    return this.getFromV1(employeeId); // Rollback to v1
  }

  // Keep dual-write active
  async createEmployee(employeeData) {
    await Promise.all([
      this.writeToV1(employeeData),
      this.writeToV2(employeeData)
    ]);
  }
}
```

---

## Post-Migration Tasks

### 1. Update Documentation
- [ ] Update API documentation with new fields
- [ ] Update access patterns documentation
- [ ] Update developer onboarding guides
- [ ] Update schema diagrams

### 2. Update Monitoring
- [ ] Create CloudWatch dashboards for v2 table
- [ ] Set up alarms for v2 table metrics
- [ ] Update capacity planning based on v2 usage

### 3. Train Team
- [ ] Train developers on new fields and GSIs
- [ ] Train operations team on new monitoring
- [ ] Train support team on new features

### 4. Cleanup
- [ ] Remove v1 table references from code
- [ ] Archive v1 table documentation
- [ ] Update CI/CD pipelines

---

## Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| **Preparation** | 2-3 days | Create new table, test in staging |
| **Phase 1** | 1 day | Enable dual-write |
| **Phase 2** | 1 day | Backfill data |
| **Phase 3** | 1 day | Validate migration |
| **Phase 4** | 1-2 days | Switch reads to v2 |
| **Monitoring** | 1 week | Monitor for issues |
| **Phase 5** | 1 day | Disable dual-write |
| **Archive** | 2 weeks later | Archive v1 table |
| **Total** | ~3-4 weeks | Full migration cycle |

---

## Risk Assessment

### High Risk Items
1. **Data Loss**: Mitigated by dual-write and backups
2. **Query Performance**: Mitigated by testing in staging
3. **Application Errors**: Mitigated by phased rollout

### Medium Risk Items
1. **Cost Increase**: New table + dual-write temporarily doubles write costs
2. **Schema Mismatch**: Validation scripts catch discrepancies
3. **GSI Throttling**: Monitor and adjust capacity as needed

### Low Risk Items
1. **User Experience**: Transparent to users during migration
2. **Data Consistency**: Dual-write ensures consistency

---

## Success Criteria

Migration is considered successful when:
- [ ] All records migrated (counts match)
- [ ] All GSIs functioning correctly
- [ ] Sample validation shows 100% data accuracy
- [ ] Read performance meets or exceeds v1 performance
- [ ] Zero data loss incidents
- [ ] Application error rate unchanged
- [ ] 1 week of stable operation on v2 reads
- [ ] Team trained on new schema
- [ ] Documentation updated

---

## Support Contacts

| Role | Name | Contact |
|------|------|---------|
| **Database Architect** | TBD | email@sitelogix.com |
| **Backend Lead** | TBD | email@sitelogix.com |
| **DevOps Engineer** | TBD | email@sitelogix.com |
| **Product Manager** | TBD | email@sitelogix.com |

---

## Appendix: Useful Commands

### Check Table Status
```bash
aws dynamodb describe-table --table-name sitelogix-personnel-v2 \
  --query 'Table.TableStatus'
```

### Check GSI Status
```bash
aws dynamodb describe-table --table-name sitelogix-personnel-v2 \
  --query 'Table.GlobalSecondaryIndexes[*].[IndexName,IndexStatus]'
```

### Get Record Count
```bash
aws dynamodb scan --table-name sitelogix-personnel-v2 \
  --select COUNT \
  --query 'Count'
```

### Monitor Consumed Capacity
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=sitelogix-personnel-v2 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```
