# User Migration - Quick Start Guide

## TL;DR

```bash
# 1. Test first (no changes made)
node migrate-users-to-cognito.js --dry-run

# 2. Review output and verify users to migrate

# 3. Run actual migration
node migrate-users-to-cognito.js
```

## What You Need to Know

### Temporary Password
All migrated users will have the password: **`ChangeMe2025!`**

They MUST change this on first login.

### User Attributes Migrated
- Email (username)
- First Name & Last Name
- Phone Number (if valid)
- Employee Number
- Role → Cognito Group
- Person ID (custom attribute)
- Employment Status

### Users That Will Be Migrated
- Active employees only
- Must have valid email address
- Not already migrated (no existing `cognitoUserId`)

### Current Users in System
Based on dry-run test, these users will be migrated:
1. Robert Trask (rtrask@parkwaycs.com) - Admin
2. Jayson Rivas (jayson@impactconsulting931.com) - Admin
3. Corey Birchfield (corey.birchfield@parkwaycs.com) - Admin
4. Aaron Trask (atrask@parkwaycs.com) - Admin
5. Don Guthrie (dguthrie@parkwaycs.com) - Employee

## Files Created

### Main Script
- **File:** `migrate-users-to-cognito.js` (487 lines)
- **Location:** Project root

### Documentation
- **File:** `MIGRATION-GUIDE.md` (comprehensive guide)
- **File:** `MIGRATION-QUICK-START.md` (this file)

### Output Files
- **File:** `migration-report-[timestamp].json` (auto-generated)
- Contains detailed results for each user

## Common Issues & Solutions

### "UsernameExistsException"
User already exists in Cognito - skip, already migrated.

### "Invalid email format"
Fix email in DynamoDB personnel table and re-run.

### "Group does not exist"
Create Cognito user groups first:
- Admin
- Manager
- Foreman
- Employee
- SuperAdmin

## Pre-Flight Checklist

- [ ] AWS credentials configured in `.env`
- [ ] Cognito User Pool groups exist
- [ ] Run dry-run first
- [ ] Review dry-run output
- [ ] Backup important data (optional but recommended)
- [ ] Ready to proceed with migration

## Post-Migration

1. Check migration report JSON file
2. Verify successful count matches expected
3. Test login with one user (email + `ChangeMe2025!`)
4. User should be prompted to change password
5. Verify custom attributes are accessible

## Need Help?

See `MIGRATION-GUIDE.md` for detailed documentation including:
- Troubleshooting
- Rollback procedures
- Verification commands
- Security notes
