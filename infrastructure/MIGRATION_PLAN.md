# DynamoDB Schema Migration Plan
## SiteLogix 1.5 - Database Architecture Update

**Version:** 1.0
**Date:** November 4, 2025
**Author:** Database Architect

---

## Executive Summary

This document provides step-by-step migration procedures to update the existing 4 DynamoDB tables and deploy 2 new tables per the complete schema design.

**Migration Scope:**
- Update 4 existing tables (GSI modifications, attribute backfills)
- Create 2 new tables (work-logs, ai-analysis-cache)
- Enable DynamoDB Streams and PITR on all tables
- Zero downtime requirement
- Data integrity verification at each step

**Estimated Timeline:** 1-2 weeks
**Risk Level:** Medium (GSI modifications require careful execution)

---

## Pre-Migration Checklist

### Backups
- [ ] Create on-demand backup of all 4 existing tables
- [ ] Verify backup completion and success
- [ ] Document backup ARNs for rollback
- [ ] Export sample data for validation

### Environment Preparation
- [ ] AWS CLI configured with appropriate credentials
- [ ] IAM permissions verified (dynamodb:*, cloudwatch:*)
- [ ] CloudWatch dashboard created for monitoring
- [ ] Rollback procedures documented
- [ ] Team notification sent (maintenance window)

### Testing Environment
- [ ] Deploy changes to dev/staging first
- [ ] Run integration tests on staging
- [ ] Verify application compatibility
- [ ] Load test new schema

---

## Migration Steps

## Phase 1: Enable Streams and PITR on Existing Tables

**Objective:** Enable audit trail and point-in-time recovery without schema changes.

**Estimated Time:** 30 minutes
**Downtime:** None
**Risk:** Low

### Step 1.1: Enable Streams on sitelogix-reports
```bash
aws dynamodb update-table \
  --table-name sitelogix-reports \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
  --region us-east-1
```

**Wait for table status:** `aws dynamodb describe-table --table-name sitelogix-reports --query 'Table.TableStatus'`

**Expected:** "ACTIVE"

### Step 1.2: Enable PITR on sitelogix-reports
```bash
aws dynamodb update-continuous-backups \
  --table-name sitelogix-reports \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region us-east-1
```

**Verification:**
```bash
aws dynamodb describe-continuous-backups \
  --table-name sitelogix-reports \
  --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus'
```

**Expected:** "ENABLED"

### Step 1.3: Repeat for Other 3 Tables
```bash
# sitelogix-personnel
aws dynamodb update-table --table-name sitelogix-personnel --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES --region us-east-1
aws dynamodb update-continuous-backups --table-name sitelogix-personnel --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true --region us-east-1

# sitelogix-vendors
aws dynamodb update-table --table-name sitelogix-vendors --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES --region us-east-1
aws dynamodb update-continuous-backups --table-name sitelogix-vendors --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true --region us-east-1

# sitelogix-constraints
aws dynamodb update-table --table-name sitelogix-constraints --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES --region us-east-1
aws dynamodb update-continuous-backups --table-name sitelogix-constraints --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true --region us-east-1
```

### Verification:
```bash
# Check all tables have streams and PITR enabled
for table in sitelogix-reports sitelogix-personnel sitelogix-vendors sitelogix-constraints; do
  echo "=== $table ==="
  aws dynamodb describe-table --table-name $table --query 'Table.StreamSpecification.StreamEnabled'
  aws dynamodb describe-continuous-backups --table-name $table --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus'
done
```

---

## Phase 2: sitelogix-reports - Add GSI3-StatusIndex

**Objective:** Enable workflow queue queries (status + timestamp).

**Estimated Time:** 15-20 minutes
**Downtime:** None (GSI creation is non-blocking)
**Risk:** Low

### Step 2.1: Verify Attributes Exist
```bash
# Sample a few records to check if status and timestamp exist
aws dynamodb scan \
  --table-name sitelogix-reports \
  --max-items 5 \
  --query 'Items[*].[status, timestamp]'
```

**Expected:** Both attributes should exist on all records. If not, skip to Step 2.2 for backfill.

### Step 2.2: Backfill Missing Attributes (if needed)
```python
# backfill-reports-status.py
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('sitelogix-reports')

response = table.scan()
items = response['Items']

for item in items:
    needs_update = False
    update_expr = "SET "
    expr_values = {}

    if 'status' not in item:
        update_expr += "status = :status, "
        expr_values[':status'] = 'published'  # Default status
        needs_update = True

    if 'timestamp' not in item:
        update_expr += "timestamp = :timestamp, "
        expr_values[':timestamp'] = item.get('createdAt', datetime.utcnow().isoformat())
        needs_update = True

    if needs_update:
        update_expr = update_expr.rstrip(', ')
        table.update_item(
            Key={'PK': item['PK'], 'SK': item['SK']},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values
        )
        print(f"Updated {item['PK']}")
```

**Run:** `python3 backfill-reports-status.py`

### Step 2.3: Create GSI3-StatusIndex
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

### Step 2.4: Monitor GSI Creation
```bash
# Check status every minute until ACTIVE
watch -n 60 'aws dynamodb describe-table --table-name sitelogix-reports --query "Table.GlobalSecondaryIndexes[?IndexName==\`GSI3-StatusIndex\`].IndexStatus" --output text'
```

**Expected:** "CREATING" → "ACTIVE" (takes ~10-15 minutes)

### Step 2.5: Verify GSI
```bash
# Query the new index
aws dynamodb query \
  --table-name sitelogix-reports \
  --index-name GSI3-StatusIndex \
  --key-condition-expression "status = :status" \
  --expression-attribute-values '{":status":{"S":"published"}}' \
  --max-items 5
```

**Expected:** Returns reports with status = "published"

---

## Phase 3: sitelogix-personnel - Update GSI2

**Objective:** Replace GSI2-ProjectIndex with GSI2-StatusIndex (status + dateLastSeen).

**Estimated Time:** 30-40 minutes
**Downtime:** None
**Risk:** Medium (involves deleting old GSI)

### Step 3.1: Backfill status and dateLastSeen Attributes
```python
# backfill-personnel-status.py
import boto3

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('sitelogix-personnel')

response = table.scan(FilterExpression='SK = :sk', ExpressionAttributeValues={':sk': 'PROFILE'})
items = response['Items']

for item in items:
    needs_update = False
    update_expr = "SET "
    expr_values = {}

    if 'status' not in item:
        update_expr += "status = :status, "
        expr_values[':status'] = 'active'  # Default status
        needs_update = True

    if 'dateLastSeen' not in item:
        update_expr += "dateLastSeen = :dateLastSeen, "
        # Use most recent history record or createdAt
        expr_values[':dateLastSeen'] = item.get('updatedAt', item.get('createdAt', '2025-01-01'))
        needs_update = True

    if needs_update:
        update_expr = update_expr.rstrip(', ')
        table.update_item(
            Key={'PK': item['PK'], 'SK': item['SK']},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values
        )
        print(f"Updated {item['PK']}")
```

**Run:** `python3 backfill-personnel-status.py`

### Step 3.2: Create New GSI2-StatusIndex
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

**Wait for ACTIVE:**
```bash
watch -n 60 'aws dynamodb describe-table --table-name sitelogix-personnel --query "Table.GlobalSecondaryIndexes[?IndexName==\`GSI2-StatusIndex\`].IndexStatus" --output text'
```

### Step 3.3: Verify New GSI2
```bash
aws dynamodb query \
  --table-name sitelogix-personnel \
  --index-name GSI2-StatusIndex \
  --key-condition-expression "status = :status" \
  --expression-attribute-values '{":status":{"S":"active"}}' \
  --max-items 5
```

### Step 3.4: Update Application Code
- [ ] Update all queries using GSI2-ProjectIndex to use base table or alternative query
- [ ] Deploy application changes
- [ ] Verify no errors in CloudWatch logs

### Step 3.5: Delete Old GSI2-ProjectIndex
```bash
# WARNING: Only run after application is updated!
aws dynamodb update-table \
  --table-name sitelogix-personnel \
  --global-secondary-index-updates \
    "[{\"Delete\":{\"IndexName\":\"GSI2-ProjectIndex\"}}]" \
  --region us-east-1
```

**Monitor:** `aws dynamodb describe-table --table-name sitelogix-personnel --query 'Table.GlobalSecondaryIndexes'`

**Expected:** Only GSI1-NameIndex and GSI2-StatusIndex remain.

---

## Phase 4: sitelogix-vendors - Add GSI2-TypeIndex

**Objective:** Enable vendor type filtering and date-based queries.

**Estimated Time:** 20-30 minutes
**Downtime:** None
**Risk:** Low

### Step 4.1: Backfill vendor_type and dateLastSeen
```python
# backfill-vendors-type.py
import boto3

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('sitelogix-vendors')

response = table.scan(FilterExpression='SK = :sk', ExpressionAttributeValues={':sk': 'PROFILE'})
items = response['Items']

for item in items:
    needs_update = False
    update_expr = "SET "
    expr_values = {}

    if 'vendor_type' not in item:
        update_expr += "vendor_type = :vendor_type, "
        expr_values[':vendor_type'] = 'supplier'  # Default type
        needs_update = True

    if 'dateLastSeen' not in item:
        update_expr += "dateLastSeen = :dateLastSeen, "
        expr_values[':dateLastSeen'] = item.get('updatedAt', item.get('createdAt', '2025-01-01'))
        needs_update = True

    if needs_update:
        update_expr = update_expr.rstrip(', ')
        table.update_item(
            Key={'PK': item['PK'], 'SK': item['SK']},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values
        )
        print(f"Updated {item['PK']}")
```

**Run:** `python3 backfill-vendors-type.py`

### Step 4.2: Create GSI2-TypeIndex
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

### Step 4.3: Monitor and Verify
```bash
watch -n 60 'aws dynamodb describe-table --table-name sitelogix-vendors --query "Table.GlobalSecondaryIndexes[?IndexName==\`GSI2-TypeIndex\`].IndexStatus" --output text'
```

**Verify Query:**
```bash
aws dynamodb query \
  --table-name sitelogix-vendors \
  --index-name GSI2-TypeIndex \
  --key-condition-expression "vendor_type = :vtype" \
  --expression-attribute-values '{":vtype":{"S":"supplier"}}' \
  --max-items 5
```

---

## Phase 5: sitelogix-constraints - Add GSI3-ProjectDateIndex

**Objective:** Enable project-specific timeline queries.

**Estimated Time:** 20-30 minutes
**Downtime:** None
**Risk:** Low

### Step 5.1: Backfill project_id and report_date
```python
# backfill-constraints-project.py
import boto3

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('sitelogix-constraints')

response = table.scan()
items = response['Items']

for item in items:
    needs_update = False
    update_expr = "SET "
    expr_values = {}

    # project_id should already exist in PK
    if 'project_id' not in item and 'projectId' in item:
        update_expr += "project_id = :project_id, "
        expr_values[':project_id'] = item['projectId']
        needs_update = True

    # report_date should already exist
    if 'report_date' not in item and 'reportDate' in item:
        update_expr += "report_date = :report_date, "
        expr_values[':report_date'] = item['reportDate']
        needs_update = True

    if needs_update:
        update_expr = update_expr.rstrip(', ')
        table.update_item(
            Key={'PK': item['PK'], 'SK': item['SK']},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values
        )
        print(f"Updated {item['SK']}")
```

**Run:** `python3 backfill-constraints-project.py`

### Step 5.2: Create GSI3-ProjectDateIndex
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

### Step 5.3: Monitor and Verify
```bash
watch -n 60 'aws dynamodb describe-table --table-name sitelogix-constraints --query "Table.GlobalSecondaryIndexes[?IndexName==\`GSI3-ProjectDateIndex\`].IndexStatus" --output text'
```

**Verify Query:**
```bash
aws dynamodb query \
  --table-name sitelogix-constraints \
  --index-name GSI3-ProjectDateIndex \
  --key-condition-expression "project_id = :pid AND report_date > :date" \
  --expression-attribute-values '{":pid":{"S":"proj_001"},":date":{"S":"2025-01-01"}}' \
  --max-items 5
```

---

## Phase 6: Create sitelogix-work-logs Table

**Objective:** Deploy new work logs table for detailed activity tracking.

**Estimated Time:** 10 minutes
**Downtime:** None
**Risk:** Low (new table)

### Step 6.1: Create Table
```bash
aws dynamodb create-table --cli-input-json file://infrastructure/table-work-logs.json --region us-east-1
```

### Step 6.2: Enable PITR
```bash
aws dynamodb update-continuous-backups \
  --table-name sitelogix-work-logs \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region us-east-1
```

### Step 6.3: Monitor Creation
```bash
watch -n 30 'aws dynamodb describe-table --table-name sitelogix-work-logs --query "Table.TableStatus" --output text'
```

**Expected:** "CREATING" → "ACTIVE" (~5 minutes)

### Step 6.4: Verify GSIs
```bash
aws dynamodb describe-table --table-name sitelogix-work-logs --query 'Table.GlobalSecondaryIndexes[*].{Name:IndexName,Status:IndexStatus}'
```

**Expected:** Both GSI1-ProjectDateIndex and GSI2-TeamIndex should be ACTIVE.

---

## Phase 7: Create sitelogix-ai-analysis-cache Table

**Objective:** Deploy AI analysis cache table with TTL enabled.

**Estimated Time:** 10 minutes
**Downtime:** None
**Risk:** Low (new table)

### Step 7.1: Create Table
```bash
aws dynamodb create-table --cli-input-json file://infrastructure/table-ai-analysis-cache.json --region us-east-1
```

### Step 7.2: Enable PITR
```bash
aws dynamodb update-continuous-backups \
  --table-name sitelogix-ai-analysis-cache \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region us-east-1
```

### Step 7.3: Enable TTL
```bash
aws dynamodb update-time-to-live \
  --table-name sitelogix-ai-analysis-cache \
  --time-to-live-specification "Enabled=true,AttributeName=ttl" \
  --region us-east-1
```

### Step 7.4: Monitor Creation
```bash
watch -n 30 'aws dynamodb describe-table --table-name sitelogix-ai-analysis-cache --query "Table.TableStatus" --output text'
```

### Step 7.5: Verify TTL
```bash
aws dynamodb describe-time-to-live --table-name sitelogix-ai-analysis-cache
```

**Expected:** TimeToLiveStatus = "ENABLED"

---

## Phase 8: Post-Migration Verification

### Step 8.1: Verify All Tables
```bash
# List all SiteLogix tables
aws dynamodb list-tables --query "TableNames[?contains(@, 'sitelogix')]" --output table

# Expected: 6 tables
# - sitelogix-reports
# - sitelogix-personnel
# - sitelogix-vendors
# - sitelogix-constraints
# - sitelogix-work-logs
# - sitelogix-ai-analysis-cache
```

### Step 8.2: Verify Streams Enabled
```bash
for table in sitelogix-reports sitelogix-personnel sitelogix-vendors sitelogix-constraints sitelogix-work-logs sitelogix-ai-analysis-cache; do
  echo "=== $table ==="
  aws dynamodb describe-table --table-name $table --query 'Table.{TableName:TableName,StreamEnabled:StreamSpecification.StreamEnabled,StreamARN:LatestStreamArn}' --output table
done
```

### Step 8.3: Verify PITR Enabled
```bash
for table in sitelogix-reports sitelogix-personnel sitelogix-vendors sitelogix-constraints sitelogix-work-logs sitelogix-ai-analysis-cache; do
  echo "=== $table ==="
  aws dynamodb describe-continuous-backups --table-name $table --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription' --output table
done
```

### Step 8.4: Verify GSI Counts
```bash
# Reports: Should have 3 GSIs
aws dynamodb describe-table --table-name sitelogix-reports --query 'length(Table.GlobalSecondaryIndexes)'

# Personnel: Should have 2 GSIs
aws dynamodb describe-table --table-name sitelogix-personnel --query 'length(Table.GlobalSecondaryIndexes)'

# Vendors: Should have 2 GSIs
aws dynamodb describe-table --table-name sitelogix-vendors --query 'length(Table.GlobalSecondaryIndexes)'

# Constraints: Should have 3 GSIs
aws dynamodb describe-table --table-name sitelogix-constraints --query 'length(Table.GlobalSecondaryIndexes)'

# Work Logs: Should have 2 GSIs
aws dynamodb describe-table --table-name sitelogix-work-logs --query 'length(Table.GlobalSecondaryIndexes)'

# AI Cache: Should have 2 GSIs
aws dynamodb describe-table --table-name sitelogix-ai-analysis-cache --query 'length(Table.GlobalSecondaryIndexes)'
```

### Step 8.5: Data Integrity Checks
```bash
# Count records in each table
for table in sitelogix-reports sitelogix-personnel sitelogix-vendors sitelogix-constraints; do
  echo "=== $table ==="
  aws dynamodb scan --table-name $table --select COUNT
done
```

### Step 8.6: Application Testing
- [ ] Deploy updated application code
- [ ] Run integration tests
- [ ] Verify all 7 core access patterns work
- [ ] Check CloudWatch logs for errors
- [ ] Load test with production-like traffic

---

## Rollback Procedures

### If Migration Fails in Phase 2-5 (GSI Updates):

**Option 1: Delete Failed GSI**
```bash
aws dynamodb update-table \
  --table-name <table-name> \
  --global-secondary-index-updates "[{\"Delete\":{\"IndexName\":\"<failed-gsi-name>\"}}]" \
  --region us-east-1
```

**Option 2: Restore from Backup**
```bash
# List available backups
aws dynamodb list-backups --table-name <table-name>

# Restore from backup
aws dynamodb restore-table-from-backup \
  --target-table-name <table-name>-restored \
  --backup-arn <backup-arn>
```

### If Migration Fails in Phase 6-7 (New Tables):

**Option 1: Delete New Table**
```bash
aws dynamodb delete-table --table-name sitelogix-work-logs
aws dynamodb delete-table --table-name sitelogix-ai-analysis-cache
```

**No data loss risk** since these are new tables.

### If Application Fails After Migration:

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

## Monitoring & Alerts

### CloudWatch Metrics to Watch:
- **SystemErrors:** Any > 0 requires investigation
- **UserErrors:** Spike indicates application issues
- **ConsumedReadCapacityUnits:** Near provisioned capacity = throttling risk
- **ConsumedWriteCapacityUnits:** Same as above
- **OnlineIndexPercentageProgress:** Monitor GSI creation progress

### CloudWatch Alarms:
```bash
# Throttling alarm
aws cloudwatch put-metric-alarm \
  --alarm-name DynamoDB-Reports-Throttling \
  --alarm-description "Alert on DynamoDB throttling" \
  --metric-name ThrottledRequests \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=TableName,Value=sitelogix-reports
```

---

## Post-Migration Checklist

### Immediate (Day 0):
- [ ] All 6 tables created and ACTIVE
- [ ] All GSIs ACTIVE
- [ ] Streams enabled on all tables
- [ ] PITR enabled on all tables
- [ ] TTL enabled on ai-analysis-cache
- [ ] Application deployed and tested
- [ ] No errors in CloudWatch logs
- [ ] Backup verification complete

### Week 1:
- [ ] Monitor CloudWatch metrics daily
- [ ] Verify no throttling events
- [ ] Check cost dashboard (should be ~$150/month)
- [ ] Run data integrity checks
- [ ] Test PITR restore on staging

### Week 2:
- [ ] Deploy stream processors (audit logger)
- [ ] Verify audit trail completeness
- [ ] Test archival Lambda (if implemented)
- [ ] Performance benchmarking complete

### Week 4:
- [ ] Security audit (IAM policies)
- [ ] Compliance verification (retention policies)
- [ ] Documentation updated
- [ ] Team training completed
- [ ] Runbook finalized

---

## Success Criteria

Migration is considered successful when:
1. ✅ All 6 tables operational with correct schema
2. ✅ All 15 GSIs ACTIVE and queryable
3. ✅ Zero data loss verified
4. ✅ Application integration tests pass 100%
5. ✅ No performance degradation (< 100ms query latency)
6. ✅ Audit trail capturing all changes
7. ✅ Costs within projected budget ($150/month)
8. ✅ Team trained and confident in new schema

---

## Contact & Support

**Migration Lead:** Database Architect
**Escalation:** DevOps Engineer
**Approval Required:** Lead Developer, CEO

**Emergency Rollback Authority:** Lead Developer

---

**Document Status:** Ready for Execution
**Last Updated:** November 4, 2025
