# SiteLogix 1.5 Production Infrastructure Implementation Guide

## Quick Start

This guide provides step-by-step instructions for implementing RFC-008 compliant infrastructure for SiteLogix 1.5.

---

## Prerequisites

- AWS CLI configured with admin credentials
- Access to AWS Account: 500313280221
- Region: us-east-1
- Bash shell (macOS/Linux) or Git Bash (Windows)

---

## Implementation Order

### Phase 1: Critical Protection (1.5 hours) - DO FIRST

**Status:** Ready to Execute
**Risk:** Low
**Cost Impact:** +$50-80/month

Run the automated script:

```bash
cd infrastructure/scripts
./phase1-enable-protection.sh
```

This script will:
- Enable Point-in-Time Recovery on all DynamoDB tables
- Enable Deletion Protection on all DynamoDB tables
- Enable DynamoDB Streams for audit trail
- Enable S3 Access Logging
- Configure CloudTrail for data events
- Deploy critical CloudWatch alarms

**Manual Verification:**

```bash
# Check DynamoDB protection status
aws dynamodb describe-table --table-name sitelogix-reports \
  --query 'Table.{DelProtection:DeletionProtectionEnabled}' --output table

aws dynamodb describe-continuous-backups --table-name sitelogix-reports \
  --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription' --output table

# Check S3 logging
aws s3api get-bucket-logging --bucket sitelogix-audio-files-prod

# Check CloudWatch alarms
aws cloudwatch describe-alarms --alarm-name-prefix SiteLogix
```

---

### Phase 2: Lifecycle Policies (2 hours)

**Status:** Ready to Execute
**Risk:** Low
**Cost Impact:** -40% storage costs (savings)

Run the automated script:

```bash
cd infrastructure/scripts
./phase2-lifecycle-policies.sh
```

This script will:
- Configure Hot/Warm/Cold storage tiers
- Set up automatic transitions (90d → IA, 1y → Glacier, 3y → Deep Archive)
- Expire old versions after 90 days
- Optionally enable Intelligent-Tiering

**Manual Verification:**

```bash
# Check lifecycle policies
aws s3api get-bucket-lifecycle-configuration \
  --bucket sitelogix-audio-files-prod --output table
```

---

### Phase 3: Missing DynamoDB Tables (1 hour)

**Status:** Ready to Deploy
**Risk:** Low
**Cost Impact:** +$20-30/month

Deploy via CloudFormation:

```bash
cd infrastructure/cloudformation

aws cloudformation create-stack \
  --stack-name sitelogix-missing-tables \
  --template-body file://missing-dynamodb-tables.yaml \
  --parameters ParameterKey=Environment,ParameterValue=Production \
  --capabilities CAPABILITY_IAM \
  --region us-east-1

# Wait for stack creation
aws cloudformation wait stack-create-complete \
  --stack-name sitelogix-missing-tables \
  --region us-east-1

# Verify tables created
aws dynamodb list-tables --query 'TableNames[?contains(@, `sitelogix`)]'
```

This creates:
- sitelogix-work-logs (with auto-scaling)
- sitelogix-ai-analysis (with auto-scaling)
- sitelogix-audit-log (pay-per-request)

---

### Phase 4: Object Lock Migration (16 hours) - REQUIRES PLANNING

**Status:** Requires Manual Execution
**Risk:** High (data migration)
**Cost Impact:** Neutral (same storage class)

**IMPORTANT:** Object Lock can only be enabled on NEW buckets. This requires data migration.

**Steps:**

1. **Create New Buckets with Object Lock**

```bash
# Audio Files Bucket v2
aws s3api create-bucket \
  --bucket sitelogix-audio-files-prod-v2 \
  --region us-east-1 \
  --object-lock-enabled-for-bucket

# Enable versioning (required for Object Lock)
aws s3api put-bucket-versioning \
  --bucket sitelogix-audio-files-prod-v2 \
  --versioning-configuration Status=Enabled

# Configure Object Lock retention
aws s3api put-object-lock-configuration \
  --bucket sitelogix-audio-files-prod-v2 \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "GOVERNANCE",
        "Years": 7
      }
    }
  }'

# Repeat for transcripts bucket
aws s3api create-bucket \
  --bucket sitelogix-transcripts-prod-v2 \
  --region us-east-1 \
  --object-lock-enabled-for-bucket

aws s3api put-bucket-versioning \
  --bucket sitelogix-transcripts-prod-v2 \
  --versioning-configuration Status=Enabled

aws s3api put-object-lock-configuration \
  --bucket sitelogix-transcripts-prod-v2 \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "GOVERNANCE",
        "Years": 7
      }
    }
  }'
```

2. **Configure New Buckets (Same as Old)**

```bash
# Public access block
aws s3api put-public-access-block \
  --bucket sitelogix-audio-files-prod-v2 \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Encryption
aws s3api put-bucket-encryption \
  --bucket sitelogix-audio-files-prod-v2 \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      },
      "BucketKeyEnabled": true
    }]
  }'

# Access logging
aws s3api put-bucket-logging \
  --bucket sitelogix-audio-files-prod-v2 \
  --bucket-logging-status '{
    "LoggingEnabled": {
      "TargetBucket": "sitelogix-logs-prod",
      "TargetPrefix": "audio-v2-access-logs/"
    }
  }'

# Apply lifecycle policies (from Phase 2)
aws s3api put-bucket-lifecycle-configuration \
  --bucket sitelogix-audio-files-prod-v2 \
  --lifecycle-configuration file://lifecycle-audio.json
```

3. **Migrate Data (TEST FIRST)**

```bash
# Test migration with a small subset
aws s3 sync \
  s3://sitelogix-audio-files-prod/SiteLogix/projects/proj_001/audio/2025/11/ \
  s3://sitelogix-audio-files-prod-v2/SiteLogix/projects/proj_001/audio/2025/11/ \
  --storage-class STANDARD \
  --metadata-directive COPY

# Verify test data
aws s3 ls s3://sitelogix-audio-files-prod-v2/SiteLogix/projects/proj_001/audio/2025/11/ --recursive

# If successful, migrate all data (will take hours)
aws s3 sync \
  s3://sitelogix-audio-files-prod/ \
  s3://sitelogix-audio-files-prod-v2/ \
  --storage-class STANDARD \
  --metadata-directive COPY
```

4. **Update Application Configuration**

```javascript
// Update frontend/backend configuration
const S3_AUDIO_BUCKET = 'sitelogix-audio-files-prod-v2';  // Changed
const S3_TRANSCRIPTS_BUCKET = 'sitelogix-transcripts-prod-v2';  // Changed
```

5. **Deploy Updated Application**

```bash
# Deploy backend changes
cd backend
npm run deploy

# Deploy frontend changes
cd frontend
npm run build
npm run deploy
```

6. **Verify New Buckets in Production**

Test file upload/download through the application to ensure new buckets work correctly.

7. **Decommission Old Buckets (After 30 Days)**

```bash
# After 30 days of successful operation on new buckets
# Mark old buckets for deletion (do NOT delete immediately)
aws s3api put-bucket-tagging \
  --bucket sitelogix-audio-files-prod \
  --tagging 'TagSet=[{Key=Status,Value=Deprecated}]'
```

---

### Phase 5: AWS Backup Plan (30 minutes)

**Status:** Ready to Execute
**Risk:** Low
**Cost Impact:** +$15-25/month

```bash
# Create backup vault
aws backup create-backup-vault \
  --backup-vault-name SiteLogix-Backup-Vault \
  --region us-east-1

# Create backup plan
aws backup create-backup-plan \
  --backup-plan '{
    "BackupPlanName": "SiteLogix-DynamoDB-Daily-Backup",
    "Rules": [
      {
        "RuleName": "DailyBackup",
        "TargetBackupVaultName": "SiteLogix-Backup-Vault",
        "ScheduleExpression": "cron(0 5 * * ? *)",
        "StartWindowMinutes": 60,
        "CompletionWindowMinutes": 120,
        "Lifecycle": {
          "DeleteAfterDays": 35,
          "MoveToColdStorageAfterDays": 7
        }
      }
    ]
  }' \
  --region us-east-1

# Get backup plan ID
BACKUP_PLAN_ID=$(aws backup list-backup-plans \
  --query 'BackupPlansList[?BackupPlanName==`SiteLogix-DynamoDB-Daily-Backup`].BackupPlanId' \
  --output text)

# Assign resources to backup plan
aws backup create-backup-selection \
  --backup-plan-id $BACKUP_PLAN_ID \
  --backup-selection '{
    "SelectionName": "SiteLogix-DynamoDB-Tables",
    "IamRoleArn": "arn:aws:iam::500313280221:role/service-role/AWSBackupDefaultServiceRole",
    "Resources": [
      "arn:aws:dynamodb:us-east-1:500313280221:table/sitelogix-reports",
      "arn:aws:dynamodb:us-east-1:500313280221:table/sitelogix-personnel",
      "arn:aws:dynamodb:us-east-1:500313280221:table/sitelogix-vendors",
      "arn:aws:dynamodb:us-east-1:500313280221:table/sitelogix-constraints",
      "arn:aws:dynamodb:us-east-1:500313280221:table/sitelogix-work-logs",
      "arn:aws:dynamodb:us-east-1:500313280221:table/sitelogix-ai-analysis"
    ]
  }' \
  --region us-east-1
```

---

## Monitoring & Verification

### Check Compliance Status

```bash
# Run comprehensive compliance check
./infrastructure/scripts/check-compliance.sh
```

**Expected Output:**

```
========================================
SiteLogix RFC-008 Compliance Check
========================================

DynamoDB Tables:
  ✓ sitelogix-reports: PITR=ENABLED | DelProt=true | Streams=true
  ✓ sitelogix-personnel: PITR=ENABLED | DelProt=true | Streams=true
  ✓ sitelogix-vendors: PITR=ENABLED | DelProt=true | Streams=true
  ✓ sitelogix-constraints: PITR=ENABLED | DelProt=true | Streams=true
  ✓ sitelogix-work-logs: PITR=ENABLED | DelProt=true | Streams=true
  ✓ sitelogix-ai-analysis: PITR=ENABLED | DelProt=true | Streams=true

S3 Buckets:
  ✓ sitelogix-audio-files-prod-v2: Versioning=Enabled | ObjectLock=Enabled | Logging=Enabled
  ✓ sitelogix-transcripts-prod-v2: Versioning=Enabled | ObjectLock=Enabled | Logging=Enabled
  ✓ sitelogix-logs-prod: Versioning=Enabled | ObjectLock=Enabled

CloudWatch Alarms:
  ✓ 10 alarms configured

Compliance Score: 100% (All requirements met)
```

---

## Cost Estimation

### Current Monthly Costs (Before Implementation)

| Service | Cost |
|---------|------|
| DynamoDB | $40-60 |
| S3 Storage | $50-80 |
| Lambda | $10-20 |
| **TOTAL** | **$100-160** |

### Projected Monthly Costs (After Implementation)

| Service | Cost | Change |
|---------|------|--------|
| DynamoDB (with PITR & Backups) | $80-120 | +$40-60 |
| S3 Storage (optimized lifecycle) | $30-50 | -$20-30 |
| Lambda | $15-25 | +$5 |
| CloudWatch (logs, metrics, alarms) | $20-30 | +$20-30 |
| CloudTrail | $10-15 | +$10-15 |
| AWS Backup | $15-25 | +$15-25 |
| **TOTAL** | **$170-265** | **+$70-105** |

**ROI:**
- Compliance with legal/insurance requirements: Priceless
- Prevent data loss incidents: $10,000+ per incident
- Reduce storage costs over time: -40% after 1 year
- Audit trail for legal discovery: Avoid $50,000+ in manual reconstruction costs

---

## Troubleshooting

### Issue: "Access Denied" when enabling features

**Solution:** Ensure your AWS CLI is configured with admin credentials:

```bash
aws sts get-caller-identity
```

You should see account 500313280221. If not:

```bash
aws configure
# Enter Access Key ID and Secret Access Key
```

### Issue: "Table is being updated" error

**Solution:** DynamoDB only allows one update at a time. Wait 30 seconds and retry:

```bash
aws dynamodb describe-table --table-name sitelogix-reports \
  --query 'Table.TableStatus'
```

Wait until status is "ACTIVE" before running next command.

### Issue: S3 Object Lock fails with "InvalidBucketState"

**Solution:** Object Lock can ONLY be enabled on NEW buckets. You must:
1. Create a new bucket with `--object-lock-enabled-for-bucket`
2. Migrate data to the new bucket
3. Update application to use new bucket

### Issue: CloudFormation stack fails

**Solution:** Check stack events:

```bash
aws cloudformation describe-stack-events \
  --stack-name sitelogix-missing-tables \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]' \
  --output table
```

Most common issue: IAM role for auto-scaling doesn't exist. It's auto-created on first use.

---

## Rollback Procedures

### Rollback Phase 1 (Protection Features)

```bash
# Disable PITR (not recommended)
aws dynamodb update-continuous-backups \
  --table-name sitelogix-reports \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=false

# Disable Streams
aws dynamodb update-table \
  --table-name sitelogix-reports \
  --stream-specification StreamEnabled=false

# Cannot disable Deletion Protection without deleting table
```

### Rollback Phase 2 (Lifecycle Policies)

```bash
# Remove lifecycle policies
aws s3api delete-bucket-lifecycle \
  --bucket sitelogix-audio-files-prod
```

### Rollback Phase 3 (New Tables)

```bash
# Delete CloudFormation stack
aws cloudformation delete-stack \
  --stack-name sitelogix-missing-tables

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name sitelogix-missing-tables
```

### Rollback Phase 4 (Object Lock Migration)

```bash
# Update application to point back to old buckets
# Keep new buckets for 30 days before deletion
```

---

## Success Metrics

Track these metrics to validate implementation:

1. **Compliance Score:** 100% (all RFC-008 requirements met)
2. **RPO (Recovery Point Objective):** 5 minutes (via PITR)
3. **RTO (Recovery Time Objective):** 1 hour (backup restoration)
4. **Storage Cost Reduction:** 40-70% over 7-year lifecycle
5. **Data Durability:** 99.999999999% (11 9's)
6. **Alarm Response Time:** < 5 minutes (SNS delivery)

---

## Post-Implementation Checklist

- [ ] Phase 1 completed and verified
- [ ] Phase 2 lifecycle policies applied
- [ ] Phase 3 missing tables created
- [ ] AWS Backup plan active
- [ ] CloudWatch alarms tested (trigger test events)
- [ ] SNS email subscriptions confirmed
- [ ] CloudTrail logging verified
- [ ] Monthly integrity check scheduled
- [ ] Disaster recovery drill planned
- [ ] Documentation updated with new bucket names
- [ ] Team trained on new audit capabilities

---

## Next Steps

1. **Schedule Phase 4 (Object Lock Migration)**
   - Plan for 2-day maintenance window
   - Test migration script with small dataset
   - Coordinate with development team for application updates

2. **Set Up Monitoring Dashboard**
   - Create CloudWatch dashboard for daily review
   - Configure cost anomaly alerts
   - Set up weekly compliance reports

3. **Document Runbooks**
   - Backup restoration procedure
   - Disaster recovery plan
   - Audit trail query procedures
   - Cost optimization reviews

4. **Schedule Regular Reviews**
   - Weekly: Review CloudWatch alarms
   - Monthly: Verify data integrity (checksums)
   - Quarterly: Compliance audit
   - Annual: Disaster recovery drill

---

## Support

For issues or questions:
- Email: jayson@impactconsulting931.com
- Documentation: /docs/architecture/
- RFC-008 Reference: /# RFC-008 - Database Planning Guidance.md

---

**Last Updated:** November 4, 2025
**Next Review:** After Phase 1 completion
