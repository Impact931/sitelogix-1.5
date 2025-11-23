# SiteLogix User Migration - Technical Overview

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Migration Script Flow                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐      ┌──────────────────┐      ┌────────────┐
│   DynamoDB       │      │  Migration       │      │  Cognito   │
│  sitelogix-      │─────▶│     Script       │─────▶│ User Pool  │
│  personnel       │      │                  │      │            │
└──────────────────┘      └──────────────────┘      └────────────┘
        │                          │                       │
        │                          │                       │
        │                          ▼                       │
        │                  ┌──────────────┐               │
        │                  │ Migration    │               │
        │                  │   Report     │               │
        │                  │   (JSON)     │               │
        │                  └──────────────┘               │
        │                                                  │
        └──────────────────────────────────────────────────┘
                    Updates with cognitoUserId
```

## Script Structure

### Main Components

```
migrate-users-to-cognito.js (487 lines)
│
├── Configuration (Lines 31-57)
│   ├── Cognito settings
│   ├── DynamoDB settings
│   └── Temporary password
│
├── Utility Functions (Lines 65-128)
│   ├── isValidEmail()          - Email validation
│   ├── formatPhoneNumber()     - E.164 phone formatting
│   ├── normalizeRole()         - Role name mapping
│   └── colorLog()              - Console output formatting
│
├── Cognito Operations (Lines 137-257)
│   ├── createCognitoUser()     - Create user with attributes
│   └── updatePersonnelWithCognitoId() - Update DynamoDB
│
├── Migration Logic (Lines 263-398)
│   ├── getAllPersonnel()       - Scan DynamoDB table
│   ├── migrateUser()           - Migrate single user
│   ├── generateReport()        - Create JSON report
│   └── displaySummary()        - Show results
│
└── Main Execution (Lines 400-487)
    └── migrate()               - Orchestrate entire process
```

## Data Flow

### 1. Personnel Record (DynamoDB)
```javascript
{
  PK: "PER#N01",
  SK: "PROFILE",
  personId: "PER#N01",
  employeeNumber: "N01",
  firstName: "Aaron",
  lastName: "Trask",
  preferredName: "Aaron",
  email: "atrask@parkwaycs.com",
  phone: "6152223333",
  role: "admin",
  jobTitle: "Project Manager",
  employmentStatus: "active",
  // ... other fields
}
```

### 2. Cognito User Creation
```javascript
{
  Username: "atrask@parkwaycs.com",
  TemporaryPassword: "ChangeMe2025!",
  UserAttributes: [
    { Name: "email", Value: "atrask@parkwaycs.com" },
    { Name: "email_verified", Value: "true" },
    { Name: "given_name", Value: "Aaron" },
    { Name: "family_name", Value: "Trask" },
    { Name: "phone_number", Value: "+16152223333" },
    { Name: "phone_number_verified", Value: "true" },
    { Name: "custom:personId", Value: "PER#N01" },
    { Name: "custom:employeeNumber", Value: "N01" },
    { Name: "custom:nickName", Value: "Aaron" },
    { Name: "custom:role", Value: "Admin" },
    { Name: "custom:jobTitle", Value: "Project Manager" },
    { Name: "custom:employmentStatus", Value: "active" }
  ]
}
```

### 3. DynamoDB Update
```javascript
{
  PK: "PER#N01",
  SK: "PROFILE",
  // ... all existing fields preserved
  cognitoUserId: "c1a2b3c4-d5e6-7f8g-9h0i-j1k2l3m4n5o6", // Added
  updatedAt: "2025-11-23T20:35:46.352Z"                  // Updated
}
```

### 4. Migration Report
```json
{
  "timestamp": "2025-11-23T20:35:46.352Z",
  "dryRun": false,
  "summary": {
    "total": 5,
    "successful": 5,
    "failed": 0
  },
  "results": [
    {
      "success": true,
      "email": "atrask@parkwaycs.com",
      "displayName": "Aaron Trask",
      "personId": "PER#N01",
      "employeeNumber": "N01",
      "cognitoUserId": "c1a2b3c4-d5e6-7f8g-9h0i-j1k2l3m4n5o6"
    }
    // ... more results
  ]
}
```

## Role Mapping

```
DynamoDB Role          →    Cognito Group
─────────────────────────────────────────
"admin"                →    "Admin"
"administrator"        →    "Admin"
"manager"              →    "Manager"
"foreman"              →    "Foreman"
"employee"             →    "Employee"
"worker"               →    "Employee"
"superadmin"           →    "SuperAdmin"
"super admin"          →    "SuperAdmin"
(undefined/null)       →    "Employee" (default)
```

## Custom Attributes Schema

Cognito User Pool must have these custom attributes configured:

| Attribute Name | Type   | Mutable | Required | Description                |
|----------------|--------|---------|----------|----------------------------|
| personId       | String | No      | Yes      | DynamoDB PK reference      |
| employeeNumber | String | No      | Yes      | Employee identifier        |
| nickName       | String | Yes     | No       | Preferred/nickname         |
| role           | String | Yes     | Yes      | User role for permissions  |
| jobTitle       | String | Yes     | No       | Job title/position         |
| employmentStatus| String| Yes     | Yes      | active/terminated/etc      |

## Error Handling

### Scenarios Handled

1. **Invalid Email**
   - Detection: Email format validation
   - Action: Skip user, log error, continue

2. **Duplicate User**
   - Detection: `UsernameExistsException`
   - Action: Skip user (already migrated)

3. **Invalid Phone**
   - Detection: Cannot format to E.164
   - Action: Omit phone attribute, continue

4. **Missing Group**
   - Detection: Group doesn't exist in pool
   - Action: Log warning, continue without group assignment

5. **DynamoDB Update Failure**
   - Detection: UpdateItemCommand error
   - Action: User created in Cognito but not linked, log error

## Performance Characteristics

- **Scan Rate:** DynamoDB scans with pagination (automatic)
- **Migration Rate:** ~100ms delay between users (prevents throttling)
- **Expected Time:** ~0.5-1 second per user
- **Dry-Run:** Instant (no API calls)

## Security Features

### Password Management
- Temporary password: `ChangeMe2025!`
- Password must meet Cognito policy requirements
- User forced to change on first login
- No passwords stored in migration report

### Email Handling
- No invitation emails sent (`MessageAction: SUPPRESS`)
- Email verification set to true (trusted source)
- Prevents spam/confusion during migration

### Credentials
- Loaded from `.env` file (not committed)
- Supports AWS credential chain
- Region-specific configuration

## Testing Strategy

### Dry-Run Mode
```bash
node migrate-users-to-cognito.js --dry-run
```
- Reads from DynamoDB ✓
- Simulates Cognito creation ✓
- No actual Cognito calls ✗
- No DynamoDB updates ✗
- Generates test report ✓

### Production Mode
```bash
node migrate-users-to-cognito.js
```
- 5-second safety countdown
- Real Cognito API calls
- Real DynamoDB updates
- Comprehensive error handling
- Detailed logging

## Idempotency

### Safe to Re-run
The script is idempotent:
- Users with `cognitoUserId` are automatically skipped
- Duplicate email attempts return `UsernameExistsException` (handled)
- No data corruption on re-run
- Can safely retry failed migrations

### Manual Intervention
If partial migration occurs:
1. Script skips already-migrated users
2. Only processes remaining users
3. Maintains separate success/failure tracking

## Monitoring & Logging

### Console Output
- Color-coded status messages
- Progress counter (e.g., [3/5])
- Real-time error reporting
- Summary statistics

### Migration Report
- JSON format for programmatic access
- Timestamp for audit trail
- Individual user results
- Success/failure breakdown

## Files Generated

| File | Purpose | Keep? |
|------|---------|-------|
| `migration-report-[timestamp].json` | Audit trail | Yes |
| Console output | Real-time monitoring | N/A |

## Integration Points

### DynamoDB
- Table: `sitelogix-personnel`
- Operations: Scan, UpdateItem
- Indexes: None required

### Cognito
- User Pool: `us-east-1_tPkj4vb3A`
- Operations: AdminCreateUser, AdminSetUserPassword, AdminAddUserToGroupCommand
- Groups: Admin, Manager, Foreman, Employee, SuperAdmin

### Environment
- Node.js with AWS SDK v3
- dotenv for configuration
- No external databases

## Rollback Strategy

### Option 1: Delete and Re-seed
1. Delete Cognito users (AWS CLI)
2. Remove `cognitoUserId` from DynamoDB
3. Re-run migration if needed

### Option 2: Manual Cleanup
1. Keep migration report
2. Delete specific failed users
3. Retry migration for those users

## Future Enhancements

Potential improvements:
- [ ] Batch processing for large datasets
- [ ] Email notification after migration
- [ ] Custom attribute validation
- [ ] Pre-migration backup
- [ ] Post-migration verification
- [ ] Slack/email alerts for failures
- [ ] Web dashboard for monitoring

## Support & Maintenance

### Key Files
- `migrate-users-to-cognito.js` - Main script
- `MIGRATION-GUIDE.md` - Full documentation
- `MIGRATION-QUICK-START.md` - Quick reference
- `MIGRATION-OVERVIEW.md` - This file

### Contact
- Check migration report for errors
- Review CloudWatch logs for Cognito issues
- Verify IAM permissions if access denied
