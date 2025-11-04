# SiteLogix Infrastructure - Quick Start Guide

**TL;DR:** Run 3 scripts to achieve RFC-008 compliance in 4 hours.

---

## Prerequisites

```bash
# Verify AWS CLI is configured
aws sts get-caller-identity
# Should show account: 500313280221, region: us-east-1

# Navigate to scripts directory
cd /Users/jhrstudio/Documents/GitHub/sitelogix-1.5/infrastructure/scripts
```

---

## Step 1: Check Current Compliance (5 min)

```bash
./check-compliance.sh
```

**Expected Output:** "Status: NON-COMPLIANT" (0-30% compliance)

---

## Step 2: Enable Critical Protection (1.5 hours)

```bash
./phase1-enable-protection.sh
```

**What it does:**
- Enables PITR on 4 DynamoDB tables
- Enables Deletion Protection on 4 tables
- Enables DynamoDB Streams on 4 tables
- Enables S3 Access Logging on 3 buckets
- Creates CloudTrail for data events
- Deploys 5 CloudWatch alarms
- Creates SNS topic for alerts

**Cost Impact:** +$50-80/month

**Action Required:** Check email and confirm SNS subscription

---

## Step 3: Configure Lifecycle Policies (2 hours)

```bash
./phase2-lifecycle-policies.sh
```

**What it does:**
- Hot tier: 0-90 days (STANDARD)
- Warm tier: 90-365 days (STANDARD_IA)
- Cold tier: 1-3 years (GLACIER)
- Deep Archive: 3-7 years (DEEP_ARCHIVE)

**Cost Impact:** -40% storage costs (SAVINGS)

---

## Step 4: Create Missing Tables (1 hour)

```bash
cd ../cloudformation

aws cloudformation create-stack \
  --stack-name sitelogix-missing-tables \
  --template-body file://missing-dynamodb-tables.yaml \
  --capabilities CAPABILITY_IAM \
  --region us-east-1

# Wait for completion (5-10 minutes)
aws cloudformation wait stack-create-complete \
  --stack-name sitelogix-missing-tables \
  --region us-east-1
```

**What it creates:**
- sitelogix-work-logs
- sitelogix-ai-analysis
- sitelogix-audit-log

**Cost Impact:** +$20-30/month

---

## Step 5: Verify Compliance (5 min)

```bash
cd ../scripts
./check-compliance.sh
```

**Expected Output:** "Status: PARTIALLY COMPLIANT" (70-90% compliance)

**Remaining Gap:** Object Lock (requires Phase 4 - see Implementation Guide)

---

## Quick Commands

### Check DynamoDB Status

```bash
# PITR status
aws dynamodb describe-continuous-backups \
  --table-name sitelogix-reports \
  --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription'

# Deletion Protection
aws dynamodb describe-table --table-name sitelogix-reports \
  --query 'Table.DeletionProtectionEnabled'

# Streams
aws dynamodb describe-table --table-name sitelogix-reports \
  --query 'Table.StreamSpecification'
```

### Check S3 Status

```bash
# Versioning
aws s3api get-bucket-versioning --bucket sitelogix-audio-files-prod

# Logging
aws s3api get-bucket-logging --bucket sitelogix-audio-files-prod

# Lifecycle
aws s3api get-bucket-lifecycle-configuration --bucket sitelogix-audio-files-prod
```

### Check CloudWatch Alarms

```bash
# List all SiteLogix alarms
aws cloudwatch describe-alarms --alarm-name-prefix SiteLogix

# Check alarm state
aws cloudwatch describe-alarms --alarm-names "SiteLogix-DynamoDB-Throttling-Reports" \
  --query 'MetricAlarms[0].StateValue'
```

### Check CloudTrail

```bash
# Trail status
aws cloudtrail get-trail-status --name SiteLogix-Audit-Trail

# Recent events
aws cloudtrail lookup-events --max-results 10
```

---

## Troubleshooting

### "Access Denied" Error

```bash
# Check your AWS credentials
aws sts get-caller-identity

# Should show:
# Account: 500313280221
# Arn: arn:aws:iam::500313280221:user/YOUR_USERNAME
```

**Fix:** Ensure you have admin permissions or PowerUserAccess role.

### "Table is being updated" Error

```bash
# Wait until table is ACTIVE
aws dynamodb describe-table --table-name sitelogix-reports \
  --query 'Table.TableStatus'

# When it shows "ACTIVE", retry the command
```

### "Object Lock not enabled" Warning

This is expected. Object Lock can only be enabled on NEW buckets.

**Fix:** Execute Phase 4 (Object Lock Migration) - see Implementation Guide.

---

## Cost Summary

| Phase | Cost Impact | Duration |
|-------|-------------|----------|
| Phase 1 | +$50-80/month | 1.5 hours |
| Phase 2 | -$20-30/month (savings) | 2 hours |
| Phase 3 | +$20-30/month | 1 hour |
| **TOTAL** | **+$50-80/month** | **4.5 hours** |

**Annual Cost:** ~$600-960/year

**Risk Mitigated:** $185,000+ (data loss, legal issues, compliance fines)

**ROI:** 150-300x

---

## Next Steps

After completing Steps 1-5:

1. **Confirm email subscriptions** for SNS alerts
2. **Test CloudWatch alarms** (trigger test events)
3. **Review compliance report** (should be 70-90%)
4. **Plan Phase 4** (Object Lock migration)
5. **Schedule monthly integrity checks**

---

## Full Documentation

- **Executive Summary:** `/infrastructure/EXECUTIVE_SUMMARY.md`
- **Production Plan:** `/infrastructure/production-infrastructure-plan.md`
- **Implementation Guide:** `/infrastructure/IMPLEMENTATION_GUIDE.md`
- **RFC-008 Requirements:** `/# RFC-008 - Database Planning Guidance.md`

---

## Support

**Questions?** Email: jayson@impactconsulting931.com

**Issues?** Check troubleshooting section in Implementation Guide

---

**Last Updated:** November 4, 2025
