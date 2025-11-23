# SiteLogix User Migration Guide

## Overview
This guide covers the migration of users from DynamoDB (sitelogix-personnel) to AWS Cognito User Pool.

## Migration Script

**File:** `migrate-users-to-cognito.js`
**Lines:** 487
**Location:** Project root directory

## Prerequisites

1. **AWS Credentials** configured in `.env`:
   ```
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_REGION=us-east-1
   AWS_COGNITO_USER_POOL_ID=us-east-1_tPkj4vb3A
   AWS_COGNITO_CLIENT_ID=7rsb6cnpp86cdgtv3h9j6c8t75
   AWS_COGNITO_CLIENT_SECRET=vofaujel798h2iu5decko25cqa0ndubp3hnvdbvdtcjinge2v8i
   ```

2. **Required NPM packages** (already installed):
   - `@aws-sdk/client-cognito-identity-provider`
   - `@aws-sdk/client-dynamodb`
   - `@aws-sdk/util-dynamodb`
   - `dotenv`

3. **Cognito User Groups** must exist:
   - Admin
   - Manager
   - Foreman
   - Employee
   - SuperAdmin

## What the Script Does

### 1. Scans DynamoDB Personnel Table
- Reads all records from `sitelogix-personnel` table
- Filters for records with `SK = 'PROFILE'` and valid email addresses
- Excludes already migrated users (those with `cognitoUserId` field)
- Excludes inactive users

### 2. Creates Cognito Users
For each personnel record, the script:
- Creates a Cognito user with email as username
- Sets user attributes:
  - `email` - User's email address
  - `email_verified` - Set to `true`
  - `given_name` - First name
  - `family_name` - Last name
  - `phone_number` - Formatted phone (E.164 format: +1XXXXXXXXXX)
  - `phone_number_verified` - Set to `true` if phone exists
  - `custom:personId` - DynamoDB person ID (e.g., PER#N01)
  - `custom:employeeNumber` - Employee number (e.g., N01)
  - `custom:nickName` - Preferred name or nickname
  - `custom:role` - Normalized role (Admin, Manager, Foreman, Employee, SuperAdmin)
  - `custom:jobTitle` - Job title (if available)
  - `custom:employmentStatus` - Employment status (active, terminated, etc.)

### 3. Sets Temporary Password
- Password: `ChangeMe2025!`
- User must change password on first login
- No invitation email is sent (MessageAction: SUPPRESS)

### 4. Assigns to Cognito Groups
Adds user to appropriate role-based group:
- Role mapping:
  - `admin`, `administrator` → `Admin` group
  - `manager` → `Manager` group
  - `foreman` → `Foreman` group
  - `employee`, `worker` → `Employee` group
  - `superadmin`, `super admin` → `SuperAdmin` group

### 5. Updates DynamoDB Records
- Adds `cognitoUserId` field with Cognito sub value
- Updates `updatedAt` timestamp
- Preserves all existing fields

### 6. Error Handling
- Skips users with invalid email formats
- Handles `UsernameExistsException` (duplicate emails)
- Continues on individual failures
- Logs all errors with details
- Generates comprehensive migration report

## How to Run

### Dry-Run Mode (Recommended First)
Test the migration without making any changes:

```bash
node migrate-users-to-cognito.js --dry-run
```

This will:
- Show all users that would be migrated
- Display what operations would be performed
- Generate a test report
- Make NO changes to Cognito or DynamoDB

### Production Migration
After verifying dry-run results, run the actual migration:

```bash
node migrate-users-to-cognito.js
```

**Note:** The script includes a 5-second countdown before starting to allow cancellation (Ctrl+C).

## Example Output

### Successful Migration
```
======================================================================
🚀 SiteLogix User Migration to Cognito
======================================================================

Configuration:
  User Pool ID:      us-east-1_tPkj4vb3A
  Region:            us-east-1
  DynamoDB Table:    sitelogix-personnel
  Temp Password:     ChangeMe2025!

📋 Scanning sitelogix-personnel table...
✓ Found 5 personnel records with email addresses

📊 Found 5 users to migrate (active, with email, not already migrated)

🔄 Starting migration...

[1/5]
→ Migrating: Robert Trask (rtrask@parkwaycs.com)
  ✓ Cognito user created: c1a2b3c4-d5e6-7f8g-9h0i-j1k2l3m4n5o6
    ✓ Added to group: Admin
  ✓ Updated DynamoDB with cognitoUserId

[2/5]
→ Migrating: Jayson Rivas (jayson@impactconsulting931.com)
  ✓ Cognito user created: a9b8c7d6-e5f4-3g2h-1i0j-k9l8m7n6o5p4
    ✓ Added to group: Admin
  ✓ Updated DynamoDB with cognitoUserId

...

📄 Report saved: migration-report-1763930146352.json

======================================================================
📊 MIGRATION SUMMARY
======================================================================

Total Users:       5
✓ Successful:      5
✗ Failed:          0

======================================================================
```

### Failed Migration Example
```
[3/5]
→ Migrating: John Doe (invalid-email)
  ✗ Failed: Invalid email format

======================================================================
📊 MIGRATION SUMMARY
======================================================================

Total Users:       5
✓ Successful:      4
✗ Failed:          1

❌ Failed Migrations:
  • John Doe (invalid-email)
    Reason: Invalid email format
```

## Migration Report

The script generates a detailed JSON report saved as `migration-report-[timestamp].json`:

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
      "email": "rtrask@parkwaycs.com",
      "displayName": "Robert Trask",
      "personId": "PER#PKW01",
      "employeeNumber": "PKW01",
      "cognitoUserId": "c1a2b3c4-d5e6-7f8g-9h0i-j1k2l3m4n5o6"
    },
    ...
  ]
}
```

## Preset Admin Users

The following admin users from `seed-admins.js` will be migrated:

1. **Aaron Trask**
   - Email: atrask@parkwaycs.com
   - Employee Number: N01
   - Role: Admin

2. **Corey Birchfield**
   - Email: corey.birchfield@parkwaycs.com
   - Employee Number: N02
   - Role: Admin

3. **Robert Trask**
   - Email: rtrask@parkwaycs.com
   - Employee Number: PKW01
   - Role: Admin

4. **Jayson Rivas**
   - Email: jayson@impactconsulting931.com
   - Employee Number: IC101
   - Role: Admin

## Post-Migration Steps

### 1. Verify User Creation
Check Cognito User Pool:
```bash
aws cognito-idp list-users \
  --user-pool-id us-east-1_tPkj4vb3A \
  --region us-east-1
```

### 2. Verify DynamoDB Updates
Check that personnel records have `cognitoUserId`:
```bash
aws dynamodb scan \
  --table-name sitelogix-personnel \
  --filter-expression "attribute_exists(cognitoUserId)" \
  --region us-east-1
```

### 3. Test User Login
- Users can log in with their email and temporary password: `ChangeMe2025!`
- They will be forced to change password on first login
- Verify that custom attributes are accessible

### 4. Review Migration Report
- Check `migration-report-[timestamp].json` for any failures
- Manually handle any failed migrations
- Keep report for audit trail

## Troubleshooting

### Issue: "UsernameExistsException"
**Cause:** User already exists in Cognito
**Solution:** User has already been migrated. Script will skip automatically.

### Issue: "Invalid email format"
**Cause:** Personnel record has malformed email
**Solution:** Correct email in DynamoDB and re-run migration

### Issue: "InvalidParameterException: Invalid phone number"
**Cause:** Phone number not in E.164 format
**Solution:** Script auto-formats US numbers. For international numbers, update personnel record.

### Issue: "Group does not exist"
**Cause:** Cognito user group not created
**Solution:** Create missing groups in Cognito User Pool:
```bash
aws cognito-idp create-group \
  --user-pool-id us-east-1_tPkj4vb3A \
  --group-name Admin \
  --description "Administrator users" \
  --region us-east-1
```

### Issue: Rate limiting / throttling
**Cause:** Too many API calls to Cognito
**Solution:** Script includes 100ms delay between users. Increase if needed.

## Security Notes

1. **Temporary Passwords**
   - Default: `ChangeMe2025!`
   - Users must change on first login
   - Consider sending password reset emails separately

2. **Email Suppression**
   - Script sets `MessageAction: SUPPRESS` to prevent automatic invitation emails
   - You may want to send custom onboarding emails separately

3. **Credentials**
   - Never commit `.env` file
   - Use IAM roles with least privilege
   - Rotate AWS credentials regularly

## Rollback Procedure

If you need to rollback the migration:

1. **Remove Cognito Users:**
   ```bash
   aws cognito-idp list-users \
     --user-pool-id us-east-1_tPkj4vb3A \
     --region us-east-1 | \
   jq -r '.Users[].Username' | \
   while read username; do
     aws cognito-idp admin-delete-user \
       --user-pool-id us-east-1_tPkj4vb3A \
       --username "$username" \
       --region us-east-1
   done
   ```

2. **Remove cognitoUserId from DynamoDB:**
   - Update personnel records to remove `cognitoUserId` field
   - This can be done via AWS Console or custom script

## Support

For issues or questions:
- Review migration report for detailed error messages
- Check CloudWatch logs for Cognito API errors
- Verify IAM permissions for Cognito and DynamoDB access

## Script Configuration

The script configuration is at the top of `migrate-users-to-cognito.js`:

```javascript
const CONFIG = {
  cognito: {
    userPoolId: 'us-east-1_tPkj4vb3A',
    clientId: '7rsb6cnpp86cdgtv3h9j6c8t75',
    region: 'us-east-1',
  },
  dynamodb: {
    tableName: 'sitelogix-personnel',
    region: 'us-east-1',
  },
  tempPassword: 'ChangeMe2025!',
  validRoles: ['Admin', 'Manager', 'Foreman', 'Employee', 'SuperAdmin'],
};
```

These values can be overridden via environment variables.
