# DynamoDB Schema Deployment Checklist
## SiteLogix 1.5 - Step-by-Step Implementation Guide

**Version:** 1.0
**Date:** November 4, 2025
**Estimated Duration:** 1-2 weeks

---

## Overview

This checklist provides a comprehensive, step-by-step guide for deploying the complete DynamoDB schema. Each task includes verification steps and rollback procedures.

**Deployment Strategy:** Phased approach with testing at each stage
**Downtime:** Zero (all operations are non-blocking)
**Risk Mitigation:** Backups before every change, PITR enabled

---

## Pre-Deployment Phase

### Environment Preparation

- [ ] **AWS CLI Configuration**
  - [ ] AWS CLI installed (version 2.x)
  - [ ] Credentials configured (`aws configure`)
  - [ ] Correct region set (us-east-1)
  - [ ] Test connection: `aws dynamodb list-tables`

- [ ] **IAM Permissions Verified**
  - [ ] dynamodb:CreateTable
  - [ ] dynamodb:UpdateTable
  - [ ] dynamodb:DescribeTable
  - [ ] dynamodb:UpdateContinuousBackups
  - [ ] dynamodb:CreateBackup
  - [ ] dynamodb:Scan
  - [ ] dynamodb:Query
  - [ ] dynamodb:PutItem
  - [ ] dynamodb:UpdateItem

- [ ] **Backup All Existing Tables**
  ```bash
  aws dynamodb create-backup --table-name sitelogix-reports --backup-name reports-pre-migration-$(date +%Y%m%d)
  aws dynamodb create-backup --table-name sitelogix-personnel --backup-name personnel-pre-migration-$(date +%Y%m%d)
  aws dynamodb create-backup --table-name sitelogix-vendors --backup-name vendors-pre-migration-$(date +%Y%m%d)
  aws dynamodb create-backup --table-name sitelogix-constraints --backup-name constraints-pre-migration-$(date +%Y%m%d)
  ```
  - [ ] Verify all backups completed successfully
  - [ ] Document backup ARNs in runbook

- [ ] **Export Sample Data**
  ```bash
  aws dynamodb scan --table-name sitelogix-reports --max-items 10 > reports-sample.json
  aws dynamodb scan --table-name sitelogix-personnel --max-items 10 > personnel-sample.json
  aws dynamodb scan --table-name sitelogix-vendors --max-items 10 > vendors-sample.json
  aws dynamodb scan --table-name sitelogix-constraints --max-items 10 > constraints-sample.json
  ```
  - [ ] Verify JSON files created
  - [ ] Review data for PII/sensitive info before sharing

- [ ] **CloudWatch Dashboard Setup**
  - [ ] Create dashboard: `SiteLogix-DynamoDB-Migration`
  - [ ] Add metrics: ThrottledRequests, ConsumedCapacity, SystemErrors
  - [ ] Set up SNS topic for alerts
  - [ ] Configure alarms (throttling > 10, errors > 0)

- [ ] **Team Notification**
  - [ ] Notify dev team of migration schedule
  - [ ] Schedule maintenance window (if needed)
  - [ ] Prepare rollback communication plan

---

## Phase 1: Enable Streams and PITR (30 minutes)

### Enable Streams on All Tables

**sitelogix-reports:**
- [ ] Enable stream:
  ```bash
  aws dynamodb update-table \
    --table-name sitelogix-reports \
    --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
    --region us-east-1
  ```
- [ ] Wait for table status ACTIVE:
  ```bash
  aws dynamodb describe-table --table-name sitelogix-reports --query 'Table.TableStatus'
  ```
- [ ] Verify stream ARN:
  ```bash
  aws dynamodb describe-table --table-name sitelogix-reports --query 'Table.LatestStreamArn'
  ```
- [ ] Document stream ARN: ___________________________

**sitelogix-personnel:**
- [ ] Enable stream (same command, change table name)
- [ ] Verify stream ARN
- [ ] Document stream ARN: ___________________________

**sitelogix-vendors:**
- [ ] Enable stream (same command, change table name)
- [ ] Verify stream ARN
- [ ] Document stream ARN: ___________________________

**sitelogix-constraints:**
- [ ] Enable stream (same command, change table name)
- [ ] Verify stream ARN
- [ ] Document stream ARN: ___________________________

### Enable PITR on All Tables

**sitelogix-reports:**
- [ ] Enable PITR:
  ```bash
  aws dynamodb update-continuous-backups \
    --table-name sitelogix-reports \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
    --region us-east-1
  ```
- [ ] Verify PITR status:
  ```bash
  aws dynamodb describe-continuous-backups \
    --table-name sitelogix-reports \
    --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus'
  ```
- [ ] Expected: "ENABLED"

**Repeat for remaining 3 tables:**
- [ ] sitelogix-personnel PITR enabled
- [ ] sitelogix-vendors PITR enabled
- [ ] sitelogix-constraints PITR enabled

### Phase 1 Verification
- [ ] All 4 tables have StreamEnabled = true
- [ ] All 4 tables have PITR = ENABLED
- [ ] No errors in CloudWatch logs
- [ ] Table status = ACTIVE for all

**Phase 1 Complete:** ☐ (Check when done)

---

## Phase 2: sitelogix-reports - Add GSI3-StatusIndex (20 minutes)

### Verify Attributes

- [ ] Check if status and timestamp exist on records:
  ```bash
  aws dynamodb scan --table-name sitelogix-reports --max-items 5 --query 'Items[*].[status.S, timestamp.S]'
  ```
- [ ] If missing attributes found, proceed to backfill script

### Backfill Attributes (if needed)

- [ ] Create backfill script: `backfill-reports-status.py`
- [ ] Test on 1 record first
- [ ] Run full backfill:
  ```bash
  python3 backfill-reports-status.py
  ```
- [ ] Verify backfill completed:
  ```bash
  aws dynamodb scan --table-name sitelogix-reports --filter-expression "attribute_not_exists(status)" --select COUNT
  ```
- [ ] Expected: Count = 0

### Create GSI3-StatusIndex

- [ ] Create GSI:
  ```bash
  aws dynamodb update-table \
    --table-name sitelogix-reports \
    --attribute-definitions \
      AttributeName=status,AttributeType=S \
      AttributeName=timestamp,AttributeType=S \
    --global-secondary-index-updates \
      "[{\"Create\":{\"IndexName\":\"GSI3-StatusIndex\",\"KeySchema\":[{\"AttributeName\":\"status\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"timestamp\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"},\"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}}}]" \
    --region us-east-1
  ```
- [ ] Start time: __________
- [ ] Monitor creation progress (check every 2 minutes):
  ```bash
  aws dynamodb describe-table --table-name sitelogix-reports --query "Table.GlobalSecondaryIndexes[?IndexName=='GSI3-StatusIndex'].IndexStatus"
  ```
- [ ] Expected progression: null → CREATING → ACTIVE
- [ ] End time: __________
- [ ] Duration: __________ minutes

### Verify GSI3

- [ ] Check GSI status:
  ```bash
  aws dynamodb describe-table --table-name sitelogix-reports --query 'Table.GlobalSecondaryIndexes[*].{Name:IndexName,Status:IndexStatus}'
  ```
- [ ] Expected: 3 GSIs, all ACTIVE
- [ ] Test query:
  ```bash
  aws dynamodb query \
    --table-name sitelogix-reports \
    --index-name GSI3-StatusIndex \
    --key-condition-expression "status = :status" \
    --expression-attribute-values '{":status":{"S":"published"}}' \
    --max-items 3
  ```
- [ ] Query returned results: Yes / No
- [ ] No errors in CloudWatch logs

**Phase 2 Complete:** ☐

---

## Phase 3: sitelogix-personnel - Update GSI2 (40 minutes)

### Backfill Attributes

- [ ] Create backfill script: `backfill-personnel-status.py`
- [ ] Test on 1 PROFILE record first
- [ ] Run full backfill:
  ```bash
  python3 backfill-personnel-status.py
  ```
- [ ] Verify backfill:
  ```bash
  aws dynamodb scan --table-name sitelogix-personnel --filter-expression "SK = :sk AND attribute_not_exists(status)" --expression-attribute-values '{":sk":{"S":"PROFILE"}}' --select COUNT
  ```
- [ ] Expected: Count = 0

### Create New GSI2-StatusIndex

- [ ] Create GSI:
  ```bash
  aws dynamodb update-table \
    --table-name sitelogix-personnel \
    --attribute-definitions \
      AttributeName=status,AttributeType=S \
      AttributeName=dateLastSeen,AttributeType=S \
    --global-secondary-index-updates \
      "[{\"Create\":{\"IndexName\":\"GSI2-StatusIndex\",\"KeySchema\":[{\"AttributeName\":\"status\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"dateLastSeen\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"},\"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}}}]" \
    --region us-east-1
  ```
- [ ] Start time: __________
- [ ] Monitor creation (check every 2 minutes)
- [ ] Status = ACTIVE
- [ ] End time: __________
- [ ] Duration: __________ minutes

### Verify New GSI2

- [ ] Check GSI count:
  ```bash
  aws dynamodb describe-table --table-name sitelogix-personnel --query 'length(Table.GlobalSecondaryIndexes)'
  ```
- [ ] Expected: 3 (GSI1-NameIndex, GSI2-ProjectIndex, GSI2-StatusIndex)
- [ ] Test new GSI2-StatusIndex:
  ```bash
  aws dynamodb query \
    --table-name sitelogix-personnel \
    --index-name GSI2-StatusIndex \
    --key-condition-expression "status = :status" \
    --expression-attribute-values '{":status":{"S":"active"}}' \
    --max-items 3
  ```
- [ ] Query successful: Yes / No

### Update Application Code

- [ ] Review code using old GSI2-ProjectIndex
- [ ] Update queries to use base table or alternative
- [ ] Deploy application changes
- [ ] Run integration tests
- [ ] Monitor CloudWatch logs for 30 minutes
- [ ] No errors observed

### Delete Old GSI2-ProjectIndex

⚠️ **WARNING:** Only proceed after application code is updated and tested!

- [ ] Application code updated: Yes / No
- [ ] Integration tests passed: Yes / No
- [ ] Production monitoring shows no errors: Yes / No

If all above are Yes:
- [ ] Delete old GSI:
  ```bash
  aws dynamodb update-table \
    --table-name sitelogix-personnel \
    --global-secondary-index-updates \
      "[{\"Delete\":{\"IndexName\":\"GSI2-ProjectIndex\"}}]" \
    --region us-east-1
  ```
- [ ] Monitor deletion completion
- [ ] Verify only 2 GSIs remain:
  ```bash
  aws dynamodb describe-table --table-name sitelogix-personnel --query 'Table.GlobalSecondaryIndexes[*].IndexName'
  ```
- [ ] Expected: ["GSI1-NameIndex", "GSI2-StatusIndex"]

**Phase 3 Complete:** ☐

---

## Phase 4: sitelogix-vendors - Add GSI2-TypeIndex (30 minutes)

### Backfill Attributes

- [ ] Create backfill script: `backfill-vendors-type.py`
- [ ] Test on 1 record first
- [ ] Run full backfill:
  ```bash
  python3 backfill-vendors-type.py
  ```
- [ ] Verify backfill:
  ```bash
  aws dynamodb scan --table-name sitelogix-vendors --filter-expression "SK = :sk AND attribute_not_exists(vendor_type)" --expression-attribute-values '{":sk":{"S":"PROFILE"}}' --select COUNT
  ```
- [ ] Expected: Count = 0

### Create GSI2-TypeIndex

- [ ] Create GSI:
  ```bash
  aws dynamodb update-table \
    --table-name sitelogix-vendors \
    --attribute-definitions \
      AttributeName=vendor_type,AttributeType=S \
      AttributeName=dateLastSeen,AttributeType=S \
    --global-secondary-index-updates \
      "[{\"Create\":{\"IndexName\":\"GSI2-TypeIndex\",\"KeySchema\":[{\"AttributeName\":\"vendor_type\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"dateLastSeen\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"},\"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}}}]" \
    --region us-east-1
  ```
- [ ] Start time: __________
- [ ] Monitor creation progress
- [ ] End time: __________
- [ ] Duration: __________ minutes

### Verify GSI2

- [ ] Check GSI status = ACTIVE
- [ ] Test query:
  ```bash
  aws dynamodb query \
    --table-name sitelogix-vendors \
    --index-name GSI2-TypeIndex \
    --key-condition-expression "vendor_type = :vtype" \
    --expression-attribute-values '{":vtype":{"S":"supplier"}}' \
    --max-items 3
  ```
- [ ] Query successful: Yes / No
- [ ] Expected: 2 GSIs total

**Phase 4 Complete:** ☐

---

## Phase 5: sitelogix-constraints - Add GSI3-ProjectDateIndex (30 minutes)

### Backfill Attributes

- [ ] Create backfill script: `backfill-constraints-project.py`
- [ ] Test on 1 record first
- [ ] Run full backfill:
  ```bash
  python3 backfill-constraints-project.py
  ```
- [ ] Verify backfill:
  ```bash
  aws dynamodb scan --table-name sitelogix-constraints --filter-expression "attribute_not_exists(project_id) OR attribute_not_exists(report_date)" --select COUNT
  ```
- [ ] Expected: Count = 0

### Create GSI3-ProjectDateIndex

- [ ] Create GSI:
  ```bash
  aws dynamodb update-table \
    --table-name sitelogix-constraints \
    --attribute-definitions \
      AttributeName=project_id,AttributeType=S \
      AttributeName=report_date,AttributeType=S \
    --global-secondary-index-updates \
      "[{\"Create\":{\"IndexName\":\"GSI3-ProjectDateIndex\",\"KeySchema\":[{\"AttributeName\":\"project_id\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"report_date\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"},\"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}}}]" \
    --region us-east-1
  ```
- [ ] Start time: __________
- [ ] Monitor creation progress
- [ ] End time: __________
- [ ] Duration: __________ minutes

### Verify GSI3

- [ ] Check GSI status = ACTIVE
- [ ] Test query:
  ```bash
  aws dynamodb query \
    --table-name sitelogix-constraints \
    --index-name GSI3-ProjectDateIndex \
    --key-condition-expression "project_id = :pid" \
    --expression-attribute-values '{":pid":{"S":"proj_001"}}' \
    --max-items 3
  ```
- [ ] Query successful: Yes / No
- [ ] Expected: 3 GSIs total

**Phase 5 Complete:** ☐

---

## Phase 6: Create sitelogix-work-logs Table (15 minutes)

### Deploy Table

- [ ] Verify table definition exists: `/infrastructure/table-work-logs.json`
- [ ] Create table:
  ```bash
  aws dynamodb create-table --cli-input-json file://infrastructure/table-work-logs.json --region us-east-1
  ```
- [ ] Start time: __________
- [ ] Monitor table creation:
  ```bash
  watch -n 30 'aws dynamodb describe-table --table-name sitelogix-work-logs --query "Table.TableStatus"'
  ```
- [ ] Status = ACTIVE
- [ ] End time: __________
- [ ] Duration: __________ minutes

### Enable PITR

- [ ] Enable PITR:
  ```bash
  aws dynamodb update-continuous-backups \
    --table-name sitelogix-work-logs \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
    --region us-east-1
  ```
- [ ] Verify PITR enabled

### Verify Table

- [ ] Check GSIs:
  ```bash
  aws dynamodb describe-table --table-name sitelogix-work-logs --query 'Table.GlobalSecondaryIndexes[*].{Name:IndexName,Status:IndexStatus}'
  ```
- [ ] Expected: 2 GSIs (GSI1-ProjectDateIndex, GSI2-TeamIndex), both ACTIVE
- [ ] Stream enabled: Yes / No
- [ ] PITR enabled: Yes / No

**Phase 6 Complete:** ☐

---

## Phase 7: Create sitelogix-ai-analysis-cache Table (15 minutes)

### Deploy Table

- [ ] Verify table definition exists: `/infrastructure/table-ai-analysis-cache.json`
- [ ] Create table:
  ```bash
  aws dynamodb create-table --cli-input-json file://infrastructure/table-ai-analysis-cache.json --region us-east-1
  ```
- [ ] Start time: __________
- [ ] Monitor table creation
- [ ] Status = ACTIVE
- [ ] End time: __________
- [ ] Duration: __________ minutes

### Enable PITR and TTL

- [ ] Enable PITR:
  ```bash
  aws dynamodb update-continuous-backups \
    --table-name sitelogix-ai-analysis-cache \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
    --region us-east-1
  ```
- [ ] Enable TTL:
  ```bash
  aws dynamodb update-time-to-live \
    --table-name sitelogix-ai-analysis-cache \
    --time-to-live-specification "Enabled=true,AttributeName=ttl" \
    --region us-east-1
  ```
- [ ] Verify TTL status:
  ```bash
  aws dynamodb describe-time-to-live --table-name sitelogix-ai-analysis-cache
  ```
- [ ] Expected: TimeToLiveStatus = "ENABLED"

### Verify Table

- [ ] Check GSIs (expected: 2)
- [ ] Stream enabled: Yes / No
- [ ] PITR enabled: Yes / No
- [ ] TTL enabled: Yes / No

**Phase 7 Complete:** ☐

---

## Phase 8: Post-Deployment Verification (1 hour)

### Table Inventory

- [ ] List all SiteLogix tables:
  ```bash
  aws dynamodb list-tables --query "TableNames[?contains(@, 'sitelogix')]"
  ```
- [ ] Expected: 6 tables
  - [ ] sitelogix-reports
  - [ ] sitelogix-personnel
  - [ ] sitelogix-vendors
  - [ ] sitelogix-constraints
  - [ ] sitelogix-work-logs
  - [ ] sitelogix-ai-analysis-cache

### Stream Verification

- [ ] Run stream verification script:
  ```bash
  for table in sitelogix-reports sitelogix-personnel sitelogix-vendors sitelogix-constraints sitelogix-work-logs sitelogix-ai-analysis-cache; do
    echo "=== $table ==="
    aws dynamodb describe-table --table-name $table --query 'Table.{TableName:TableName,StreamEnabled:StreamSpecification.StreamEnabled,StreamARN:LatestStreamArn}'
  done
  ```
- [ ] All 6 tables have StreamEnabled = true
- [ ] All stream ARNs documented

### PITR Verification

- [ ] Run PITR verification script:
  ```bash
  for table in sitelogix-reports sitelogix-personnel sitelogix-vendors sitelogix-constraints sitelogix-work-logs sitelogix-ai-analysis-cache; do
    echo "=== $table ==="
    aws dynamodb describe-continuous-backups --table-name $table --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus'
  done
  ```
- [ ] All 6 tables have PITR = ENABLED

### GSI Verification

- [ ] sitelogix-reports: 3 GSIs (GSI1-ProjectIndex, GSI2-ManagerIndex, GSI3-StatusIndex)
- [ ] sitelogix-personnel: 2 GSIs (GSI1-NameIndex, GSI2-StatusIndex)
- [ ] sitelogix-vendors: 2 GSIs (GSI1-CompanyIndex, GSI2-TypeIndex)
- [ ] sitelogix-constraints: 3 GSIs (GSI1-CategoryIndex, GSI2-StatusIndex, GSI3-ProjectDateIndex)
- [ ] sitelogix-work-logs: 2 GSIs (GSI1-ProjectDateIndex, GSI2-TeamIndex)
- [ ] sitelogix-ai-analysis-cache: 2 GSIs (GSI1-TypeIndex, GSI2-ModelIndex)
- [ ] Total GSIs: 15

### Data Integrity Checks

- [ ] Count records in each existing table:
  ```bash
  for table in sitelogix-reports sitelogix-personnel sitelogix-vendors sitelogix-constraints; do
    echo "=== $table ==="
    aws dynamodb scan --table-name $table --select COUNT
  done
  ```
- [ ] Compare counts with pre-migration counts
- [ ] Reports: ______ (before) vs ______ (after)
- [ ] Personnel: ______ (before) vs ______ (after)
- [ ] Vendors: ______ (before) vs ______ (after)
- [ ] Constraints: ______ (before) vs ______ (after)
- [ ] Zero data loss confirmed: Yes / No

### Sample Query Testing

- [ ] Test access pattern 1 (direct report lookup):
  ```bash
  aws dynamodb get-item --table-name sitelogix-reports --key '{"PK":{"S":"REPORT#<reportId>"},"SK":{"S":"METADATA"}}'
  ```
- [ ] Test access pattern 2 (project timeline via GSI1):
  ```bash
  aws dynamodb query --table-name sitelogix-reports --index-name GSI1-ProjectIndex --key-condition-expression "project_id = :pid" --expression-attribute-values '{":pid":{"S":"proj_001"}}' --max-items 1
  ```
- [ ] Test access pattern 3 (fuzzy name search via GSI1):
  ```bash
  aws dynamodb query --table-name sitelogix-personnel --index-name GSI1-NameIndex --key-condition-expression "full_name = :name" --expression-attribute-values '{":name":{"S":"Test Person"}}' --max-items 1
  ```
- [ ] Test access pattern 4 (constraints by status via GSI2):
  ```bash
  aws dynamodb query --table-name sitelogix-constraints --index-name GSI2-StatusIndex --key-condition-expression "status = :status" --expression-attribute-values '{":status":{"S":"open"}}' --max-items 1
  ```
- [ ] All queries successful: Yes / No

### CloudWatch Monitoring

- [ ] Check CloudWatch metrics for last hour:
  - [ ] No throttled requests
  - [ ] No system errors
  - [ ] No user errors spike
  - [ ] Consumed capacity < 80% of provisioned
- [ ] Review CloudWatch Logs for errors
- [ ] No critical errors found: Yes / No

**Phase 8 Complete:** ☐

---

## Phase 9: Application Integration (Week 2)

### Update Application Code

- [ ] Update report service to use GSI3-StatusIndex
- [ ] Update personnel service to use GSI2-StatusIndex
- [ ] Update vendor service to use GSI2-TypeIndex
- [ ] Update constraints service to use GSI3-ProjectDateIndex
- [ ] Add work-logs table writes to report processing
- [ ] Add AI cache reads/writes to AI processing Lambda

### Deploy to Staging

- [ ] Deploy updated application to staging
- [ ] Run full integration test suite
- [ ] Load test with production-like traffic
- [ ] Monitor for 24 hours
- [ ] No errors or performance degradation: Yes / No

### Deploy to Production

- [ ] Create production deployment plan
- [ ] Schedule deployment window (if needed)
- [ ] Deploy application code
- [ ] Monitor CloudWatch metrics in real-time
- [ ] Run smoke tests
- [ ] Monitor for 4 hours
- [ ] Rollback triggered: Yes / No (if Yes, document reason)

**Phase 9 Complete:** ☐

---

## Phase 10: Stream Processors Deployment (Week 3)

### Audit Trail Lambda

- [ ] Deploy audit logger Lambda (streams → S3)
- [ ] Configure Lambda to consume all 6 table streams
- [ ] Test with 1 insert/update per table
- [ ] Verify audit logs written to S3:
  ```bash
  aws s3 ls s3://sitelogix-audit-trail/$(date +%Y/%m/%d)/
  ```
- [ ] Monitor Lambda errors for 24 hours
- [ ] No errors: Yes / No

### Archival Lambda (Optional for now)

- [ ] Design archival logic (age > 90 days)
- [ ] Deploy archival Lambda
- [ ] Test on 1 aged record
- [ ] Monitor for 1 week
- [ ] Schedule: TBD

**Phase 10 Complete:** ☐

---

## Final Verification & Sign-Off

### Success Criteria Checklist

- [ ] All 6 tables deployed and ACTIVE
- [ ] All 15 GSIs deployed and ACTIVE
- [ ] Zero data loss (record counts match)
- [ ] All 7 core access patterns tested and working
- [ ] No performance degradation (< 100ms query latency)
- [ ] Streams enabled on all tables
- [ ] PITR enabled on all tables
- [ ] Audit trail capturing all changes
- [ ] CloudWatch alarms configured
- [ ] No critical errors in logs
- [ ] Costs within projected budget ($150/month)

### Documentation

- [ ] Schema design document reviewed and approved
- [ ] Migration plan executed successfully
- [ ] Deployment checklist completed
- [ ] Runbook updated with new tables/GSIs
- [ ] Team trained on new schema

### Post-Deployment Monitoring (Week 1)

- [ ] Monitor CloudWatch metrics daily
- [ ] Review costs daily (should trend toward $150/month)
- [ ] Check for throttling events
- [ ] Verify PITR recovery works (test on staging)
- [ ] Run data integrity checks
- [ ] No issues found: Yes / No

### Sign-Off

- [ ] Lead Developer approval: _______________________ (Name, Date)
- [ ] DevOps Engineer approval: _______________________ (Name, Date)
- [ ] Database Architect approval: _______________________ (Name, Date)
- [ ] CEO approval (if required): _______________________ (Name, Date)

---

## Rollback Procedures

### If Phase 1-5 Fails (GSI Updates)

**Option 1: Delete Failed GSI**
```bash
aws dynamodb update-table \
  --table-name <table-name> \
  --global-secondary-index-updates "[{\"Delete\":{\"IndexName\":\"<failed-gsi-name>\"}}]"
```

**Option 2: Restore from Backup**
```bash
aws dynamodb restore-table-from-backup \
  --target-table-name <table-name>-restored \
  --backup-arn <backup-arn>
```

### If Phase 6-7 Fails (New Tables)

**Option 1: Delete New Table**
```bash
aws dynamodb delete-table --table-name sitelogix-work-logs
aws dynamodb delete-table --table-name sitelogix-ai-analysis-cache
```
(No data loss risk - tables were empty)

### If Application Fails After Migration

**Option 1: Hotfix Application Code**
- Revert application code to previous version
- Deploy hotfix

**Option 2: Use PITR to Restore**
```bash
aws dynamodb restore-table-to-point-in-time \
  --source-table-name <table-name> \
  --target-table-name <table-name>-restored \
  --restore-date-time <iso-timestamp>
```

---

## Emergency Contacts

**Lead Developer:** ___________________________
**DevOps Engineer:** ___________________________
**Database Architect:** ___________________________
**AWS Support:** ___________________________

---

## Deployment Log

| Phase | Start Time | End Time | Duration | Status | Notes |
|-------|-----------|----------|----------|--------|-------|
| Pre-Deployment | | | | | |
| Phase 1 | | | | | |
| Phase 2 | | | | | |
| Phase 3 | | | | | |
| Phase 4 | | | | | |
| Phase 5 | | | | | |
| Phase 6 | | | | | |
| Phase 7 | | | | | |
| Phase 8 | | | | | |
| Phase 9 | | | | | |
| Phase 10 | | | | | |

**Total Deployment Time:** __________ hours/days

---

## Lessons Learned

### What Went Well:

-
-
-

### What Could Be Improved:

-
-
-

### Recommendations for Future Migrations:

-
-
-

---

**Document Status:** Ready for Execution
**Last Updated:** November 4, 2025
**Version:** 1.0
