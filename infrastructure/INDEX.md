# SiteLogix Infrastructure Documentation Index

## Quick Links

### Start Here
- **[SCHEMA_DESIGN_SUMMARY.md](./SCHEMA_DESIGN_SUMMARY.md)** - Executive summary and key decisions
- **[ADMIN_TABLES_README.md](./ADMIN_TABLES_README.md)** - Comprehensive guide to all tables

### Implementation Files
- **[admin-tables-schemas.json](./admin-tables-schemas.json)** - DynamoDB table definitions (ready to deploy)
- **[sample-data.json](./sample-data.json)** - Test data for all tables
- **[scripts/create-admin-tables.sh](./scripts/create-admin-tables.sh)** - Automated table creation script

### Reference Documentation
- **[access-patterns.md](./access-patterns.md)** - All query patterns with examples and performance notes
- **[table-relationships.md](./table-relationships.md)** - Entity relationships, data flow diagrams, and design patterns
- **[migration-plan.md](./migration-plan.md)** - Step-by-step guide to migrate from Personnel v1 to v2

---

## Table Schemas Overview

### 1. Enhanced Personnel Table (sitelogix-personnel-v2)
**Purpose**: Employee management with role-based access, health tracking, and team assignments

**Files**:
- Schema: `admin-tables-schemas.json` → `enhanced_personnel_table`
- Sample Data: `sample-data.json` → `enhanced_personnel_samples`
- Access Patterns: `access-patterns.md` → "Enhanced Personnel Table" section

**Key Features**:
- 4 Global Secondary Indexes (Name, Employee Number, Team, Role+Status)
- Health status tracking
- Hourly rate and hours tracking
- Team assignments

---

### 2. Projects Table (sitelogix-projects)
**Purpose**: Construction project management with budgets, timelines, and milestones

**Files**:
- Schema: `admin-tables-schemas.json` → `projects_table`
- Sample Data: `sample-data.json` → `projects_samples`
- Access Patterns: `access-patterns.md` → "Projects Table" section

**Key Features**:
- 3 Global Secondary Indexes (Project Name, Status, Manager)
- Milestone tracking
- Budget management
- Team member assignments via composite keys

---

### 3. Users/Auth Table (sitelogix-users)
**Purpose**: Authentication and authorization with secure password storage

**Files**:
- Schema: `admin-tables-schemas.json` → `users_auth_table`
- Sample Data: `sample-data.json` → `users_auth_samples`
- Access Patterns: `access-patterns.md` → "Users/Auth Table" section

**Key Features**:
- 3 Global Secondary Indexes (Username, Employee ID, Role+Status)
- Bcrypt password hashing
- MFA support
- Point-in-time recovery enabled

---

### 4. Time Tracking Table (sitelogix-time-tracking)
**Purpose**: Employee hours tracking by project with payroll support

**Files**:
- Schema: `admin-tables-schemas.json` → `time_tracking_table`
- Sample Data: `sample-data.json` → `time_tracking_samples`
- Access Patterns: `access-patterns.md` → "Time Tracking Table" section

**Key Features**:
- 3 Global Secondary Indexes (Project+Date, Week, Month)
- Regular/Overtime/Doubletime hours
- Manager approval workflow
- Automatic pay calculation

---

## Getting Started

### For Developers

1. **Understand the Schema**
   - Read: [ADMIN_TABLES_README.md](./ADMIN_TABLES_README.md)
   - Review: [table-relationships.md](./table-relationships.md)

2. **Set Up Local Environment**
   ```bash
   # Create tables
   cd scripts
   ./create-admin-tables.sh

   # Load sample data
   node load-sample-data.js  # (to be created)
   ```

3. **Implement Access Patterns**
   - Reference: [access-patterns.md](./access-patterns.md)
   - Copy code examples for your use case

### For Database Administrators

1. **Deploy to Production**
   - Review: [SCHEMA_DESIGN_SUMMARY.md](./SCHEMA_DESIGN_SUMMARY.md)
   - Run: `./scripts/create-admin-tables.sh`
   - Verify: Check CloudWatch metrics

2. **Configure Monitoring**
   - Set up CloudWatch alarms (see ADMIN_TABLES_README.md)
   - Enable auto-scaling
   - Configure backup retention

3. **Plan Migration**
   - Read: [migration-plan.md](./migration-plan.md)
   - Test in staging first
   - Execute migration phases

### For Product Managers

1. **Understand Features**
   - Read: [SCHEMA_DESIGN_SUMMARY.md](./SCHEMA_DESIGN_SUMMARY.md)
   - Review: Role-based access section
   - Check: Cost analysis

2. **Plan Rollout**
   - Timeline: See migration-plan.md
   - Testing: Coordinate with QA team
   - Training: Review documentation needs

---

## Common Tasks

### Query Examples

#### Get Employee by ID
```javascript
const employee = await dynamodb.get({
  TableName: 'sitelogix-personnel-v2',
  Key: {
    PK: 'EMPLOYEE#emp-001-uuid',
    SK: 'METADATA'
  }
}).promise();
```
**Reference**: access-patterns.md → "Get Employee by ID"

---

#### Search Employee by Name
```javascript
const employees = await dynamodb.query({
  TableName: 'sitelogix-personnel-v2',
  IndexName: 'GSI1-NameIndex',
  KeyConditionExpression: 'full_name = :name',
  ExpressionAttributeValues: {
    ':name': 'John Smith'
  }
}).promise();
```
**Reference**: access-patterns.md → "Search Employee by Name"

---

#### Get Active Projects
```javascript
const projects = await dynamodb.query({
  TableName: 'sitelogix-projects',
  IndexName: 'GSI2-StatusIndex',
  KeyConditionExpression: 'status = :status',
  ExpressionAttributeValues: {
    ':status': 'active'
  }
}).promise();
```
**Reference**: access-patterns.md → "Get All Active Projects"

---

#### Authenticate User
```javascript
const users = await dynamodb.query({
  TableName: 'sitelogix-users',
  IndexName: 'GSI1-UsernameIndex',
  KeyConditionExpression: 'username = :username',
  ExpressionAttributeValues: {
    ':username': 'jsmith'
  }
}).promise();

// Then verify password with bcrypt
const validPassword = await bcrypt.compare(
  inputPassword,
  users.Items[0].password_hash
);
```
**Reference**: access-patterns.md → "Authenticate User by Username"

---

#### Record Time Entry
```javascript
await dynamodb.put({
  TableName: 'sitelogix-time-tracking',
  Item: {
    PK: 'EMPLOYEE#emp-001-uuid',
    SK: 'DATE#2025-11-05#PROJECT#proj-001-uuid',
    employee_id: 'emp-001-uuid',
    employee_name: 'John Smith',
    project_id: 'proj-001-uuid',
    project_name: 'Downtown Office Complex',
    date: '2025-11-05',
    week_number: '2025-W45',
    month: '2025-11',
    regular_hours: 8.0,
    overtime_hours: 0,
    doubletime_hours: 0,
    total_hours: 8.0,
    hourly_rate: 35.50,
    total_pay: 284.00,
    approved: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}).promise();
```
**Reference**: access-patterns.md → "Record Time Entry"

---

## File Size Reference

| File | Size | Purpose |
|------|------|---------|
| admin-tables-schemas.json | 12 KB | Table definitions |
| sample-data.json | 15 KB | Test data |
| access-patterns.md | 18 KB | Query documentation |
| migration-plan.md | 17 KB | Migration guide |
| table-relationships.md | 25 KB | Relationships & diagrams |
| ADMIN_TABLES_README.md | 18 KB | Comprehensive guide |
| SCHEMA_DESIGN_SUMMARY.md | 15 KB | Executive summary |
| create-admin-tables.sh | 17 KB | Deployment script |
| **Total** | **137 KB** | Complete documentation |

---

## Key Concepts

### Primary Key Structure
All tables use composite keys:
- **PK**: Entity type + UUID (e.g., `EMPLOYEE#<uuid>`)
- **SK**: Metadata or relationship (e.g., `METADATA`, `TEAM#<uuid>`)

### Global Secondary Indexes (GSIs)
Enable alternate query patterns:
- **GSI1**: Typically name or primary search field
- **GSI2**: Typically status or secondary search
- **GSI3**: Typically relationship or aggregation
- **GSI4**: (Personnel only) Role + Status filter

### Denormalization
Frequently accessed data is duplicated for performance:
- Time Tracking stores employee_name and project_name
- Avoids cross-table lookups
- Improves query performance

### Role-Based Access Control (RBAC)
Four-tier permission system:
```
Superadmin → Admin → Manager → User
```

---

## Monitoring

### CloudWatch Metrics to Track
- **ConsumedReadCapacityUnits**: Monitor for throttling
- **ConsumedWriteCapacityUnits**: Monitor for throttling
- **UserErrors**: Track throttled requests
- **SuccessfulRequestLatency**: Track performance

### Recommended Alarms
1. Throttled requests > 0
2. Consumed capacity > 80% of provisioned
3. P99 latency > 50ms
4. Error rate > 1%

**Setup Guide**: See ADMIN_TABLES_README.md → "Monitoring and Alerting"

---

## Cost Estimates

### Monthly Costs (Provisioned Capacity)
- Personnel Table: $12.79/month
- Projects Table: $12.79/month
- Users Table: $16.43/month
- Time Tracking: $25.58/month
- **Total: ~$75/month**

**Optimization Options**: See SCHEMA_DESIGN_SUMMARY.md → "Cost Analysis"

---

## Migration Status

### Current Status: Design Complete ✅

### Next Steps:
1. [ ] Review schemas with stakeholders
2. [ ] Create tables in test environment
3. [ ] Load sample data
4. [ ] Implement backend services
5. [ ] Begin Personnel v1 → v2 migration

**Detailed Plan**: See [migration-plan.md](./migration-plan.md)

---

## Support

### Questions?
- **Schema Questions**: Review ADMIN_TABLES_README.md
- **Query Help**: Check access-patterns.md
- **Migration Help**: See migration-plan.md
- **Technical Issues**: Contact Database Team

### Useful AWS Commands
```bash
# List tables
aws dynamodb list-tables

# Describe table
aws dynamodb describe-table --table-name sitelogix-personnel-v2

# Check capacity
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=sitelogix-personnel-v2 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 --statistics Sum
```

---

## Contributing

When adding new tables or modifying schemas:
1. Update `admin-tables-schemas.json`
2. Add sample data to `sample-data.json`
3. Document access patterns in `access-patterns.md`
4. Update relationships in `table-relationships.md`
5. Update this index

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-05 | Initial admin tables design |

---

## Quick Command Reference

```bash
# Create all tables
cd infrastructure/scripts
./create-admin-tables.sh

# Load sample data
node load-sample-data.js

# Test access patterns
node test-access-patterns.js

# Migrate from v1
node migrate-personnel-v1-to-v2.js

# Validate migration
node validate-personnel-migration.js

# List all SiteLogix tables
aws dynamodb list-tables --query 'TableNames[?contains(@, `sitelogix`)]'

# Export table to S3
aws dynamodb export-table-to-point-in-time \
  --table-arn arn:aws:dynamodb:REGION:ACCOUNT:table/TABLE_NAME \
  --s3-bucket BUCKET_NAME \
  --export-format DYNAMODB_JSON

# Backup table
aws dynamodb create-backup \
  --table-name TABLE_NAME \
  --backup-name BACKUP_NAME
```

---

**Last Updated**: November 5, 2025
**Maintained By**: Database Architecture Team
