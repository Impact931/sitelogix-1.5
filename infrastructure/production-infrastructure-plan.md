# SiteLogix 1.5 Production Infrastructure Plan
## RFC-008 Compliance Implementation

**Version:** 1.0
**Date:** November 4, 2025
**Author:** DevOps Engineer (Claude)
**Status:** Production-Ready Specification

---

## Executive Summary

This document provides production-ready infrastructure specifications to address all RFC-008 compliance gaps and prepare SiteLogix 1.5 for forensic-grade operation.

### Critical Gaps Identified

**S3 Buckets:**
- Versioning: ENABLED (Good)
- Object Lock: NOT ENABLED (Critical Gap)
- Lifecycle Policies: MISSING (Critical Gap)
- Access Logging: NOT ENABLED (Critical Gap)
- Checksums: NOT IMPLEMENTED (Critical Gap)

**DynamoDB Tables:**
- 4 of 6 tables deployed (Personnel, Vendors, Reports, Constraints)
- Missing: Work Logs, AI Analysis Cache
- PITR: DISABLED on all tables (Critical Gap)
- Deletion Protection: DISABLED (Critical Gap)
- Streams: NOT ENABLED (Critical Gap)
- Automated Backups: MISSING (Critical Gap)

**Monitoring:**
- CloudWatch Alarms: NONE (Critical Gap)
- Dashboards: MISSING (Critical Gap)
- Cost Monitoring: MISSING (Critical Gap)

**Audit & Compliance:**
- CloudTrail: Status Unknown (Critical Gap)
- S3 Access Logs: MISSING (Critical Gap)
- File Checksums: NOT IMPLEMENTED (Critical Gap)

---

## Implementation Priority Matrix

### PHASE 1: Immediate Compliance (Day 1-2) - CRITICAL
1. Enable DynamoDB Point-in-Time Recovery (all tables)
2. Enable DynamoDB Deletion Protection (all tables)
3. Enable DynamoDB Streams (all tables)
4. Enable S3 Access Logging
5. Enable CloudTrail (data events)
6. Create critical CloudWatch alarms

### PHASE 2: Data Protection (Day 3-5) - HIGH PRIORITY
1. Implement S3 lifecycle policies (Hot/Warm/Cold)
2. Deploy data archival Lambda functions
3. Implement file checksum validation
4. Create missing DynamoDB tables (Work Logs, AI Analysis Cache)
5. Set up automated backup verification

### PHASE 3: Object Lock Migration (Day 6-10) - REQUIRES PLANNING
1. Create new versioned buckets with Object Lock enabled
2. Migrate existing data to new buckets
3. Update application code to use new buckets
4. Decommission old buckets

### PHASE 4: Monitoring & Optimization (Day 11-14) - OPERATIONAL
1. Deploy comprehensive CloudWatch dashboards
2. Configure cost optimization alarms
3. Implement performance monitoring
4. Set up audit report automation

---

## 1. S3 Bucket Configurations

### 1.1 Audio Files Bucket (sitelogix-audio-files-prod-v2)

**NOTE:** Object Lock requires creating a NEW bucket (cannot be enabled on existing buckets)

```json
{
  "BucketName": "sitelogix-audio-files-prod-v2",
  "Region": "us-east-1",
  "Versioning": {
    "Status": "Enabled"
  },
  "ObjectLockEnabled": true,
  "ObjectLockConfiguration": {
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "GOVERNANCE",
        "Years": 7
      }
    }
  },
  "LoggingConfiguration": {
    "DestinationBucket": "sitelogix-logs-prod",
    "LogFilePrefix": "audio-access-logs/"
  },
  "LifecycleConfiguration": {
    "Rules": [
      {
        "Id": "HotToWarm-90Days",
        "Status": "Enabled",
        "Transitions": [
          {
            "Days": 90,
            "StorageClass": "STANDARD_IA"
          }
        ],
        "Filter": {
          "Prefix": "SiteLogix/projects/"
        }
      },
      {
        "Id": "WarmToCold-1Year",
        "Status": "Enabled",
        "Transitions": [
          {
            "Days": 365,
            "StorageClass": "GLACIER_FLEXIBLE_RETRIEVAL"
          }
        ],
        "Filter": {
          "Prefix": "SiteLogix/projects/"
        }
      },
      {
        "Id": "ColdToDeepArchive-3Years",
        "Status": "Enabled",
        "Transitions": [
          {
            "Days": 1095,
            "StorageClass": "DEEP_ARCHIVE"
          }
        ],
        "Filter": {
          "Prefix": "SiteLogix/projects/"
        }
      },
      {
        "Id": "ExpireNonCurrentVersions-90Days",
        "Status": "Enabled",
        "NoncurrentVersionExpiration": {
          "NoncurrentDays": 90,
          "NewerNoncurrentVersions": 3
        }
      }
    ]
  },
  "PublicAccessBlockConfiguration": {
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  },
  "ServerSideEncryptionConfiguration": {
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        },
        "BucketKeyEnabled": true
      }
    ]
  },
  "IntelligentTieringConfiguration": {
    "Id": "EntireBucket",
    "Status": "Enabled",
    "Filter": {
      "Prefix": ""
    },
    "Tierings": [
      {
        "Days": 90,
        "AccessTier": "ARCHIVE_ACCESS"
      },
      {
        "Days": 180,
        "AccessTier": "DEEP_ARCHIVE_ACCESS"
      }
    ]
  },
  "Tags": [
    {"Key": "Project", "Value": "SiteLogix"},
    {"Key": "Environment", "Value": "Production"},
    {"Key": "Compliance", "Value": "RFC-008"},
    {"Key": "DataClassification", "Value": "Confidential"},
    {"Key": "RetentionPeriod", "Value": "7-Years"}
  ]
}
```

### 1.2 Transcripts Bucket (sitelogix-transcripts-prod-v2)

```json
{
  "BucketName": "sitelogix-transcripts-prod-v2",
  "Region": "us-east-1",
  "Versioning": {
    "Status": "Enabled"
  },
  "ObjectLockEnabled": true,
  "ObjectLockConfiguration": {
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "GOVERNANCE",
        "Years": 7
      }
    }
  },
  "LoggingConfiguration": {
    "DestinationBucket": "sitelogix-logs-prod",
    "LogFilePrefix": "transcripts-access-logs/"
  },
  "LifecycleConfiguration": {
    "Rules": [
      {
        "Id": "HotToWarm-90Days",
        "Status": "Enabled",
        "Transitions": [
          {
            "Days": 90,
            "StorageClass": "STANDARD_IA"
          }
        ]
      },
      {
        "Id": "WarmToGlacier-1Year",
        "Status": "Enabled",
        "Transitions": [
          {
            "Days": 365,
            "StorageClass": "GLACIER_FLEXIBLE_RETRIEVAL"
          }
        ]
      }
    ]
  },
  "PublicAccessBlockConfiguration": {
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  },
  "ServerSideEncryptionConfiguration": {
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        },
        "BucketKeyEnabled": true
      }
    ]
  },
  "Tags": [
    {"Key": "Project", "Value": "SiteLogix"},
    {"Key": "Environment", "Value": "Production"},
    {"Key": "Compliance", "Value": "RFC-008"},
    {"Key": "DataClassification", "Value": "Confidential"}
  ]
}
```

### 1.3 Logging Bucket (NEW - sitelogix-logs-prod)

```json
{
  "BucketName": "sitelogix-logs-prod",
  "Region": "us-east-1",
  "Versioning": {
    "Status": "Enabled"
  },
  "ObjectLockEnabled": true,
  "ObjectLockConfiguration": {
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Years": 7
      }
    }
  },
  "LifecycleConfiguration": {
    "Rules": [
      {
        "Id": "ExpireLogsAfter7Years",
        "Status": "Enabled",
        "Expiration": {
          "Days": 2555
        }
      },
      {
        "Id": "TransitionToGlacier-90Days",
        "Status": "Enabled",
        "Transitions": [
          {
            "Days": 90,
            "StorageClass": "GLACIER_FLEXIBLE_RETRIEVAL"
          }
        ]
      }
    ]
  },
  "PublicAccessBlockConfiguration": {
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  },
  "Tags": [
    {"Key": "Project", "Value": "SiteLogix"},
    {"Key": "Environment", "Value": "Production"},
    {"Key": "Purpose", "Value": "AuditLogs"}
  ]
}
```

---

## 2. DynamoDB Table Protection Configuration

### 2.1 Enable Point-in-Time Recovery (ALL TABLES)

**CLI Commands (Execute Immediately):**

```bash
# Enable PITR for Reports Table
aws dynamodb update-continuous-backups \
  --table-name sitelogix-reports \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# Enable PITR for Personnel Table
aws dynamodb update-continuous-backups \
  --table-name sitelogix-personnel \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# Enable PITR for Vendors Table
aws dynamodb update-continuous-backups \
  --table-name sitelogix-vendors \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# Enable PITR for Constraints Table
aws dynamodb update-continuous-backups \
  --table-name sitelogix-constraints \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

### 2.2 Enable Deletion Protection (ALL TABLES)

```bash
# Reports Table
aws dynamodb update-table \
  --table-name sitelogix-reports \
  --deletion-protection-enabled

# Personnel Table
aws dynamodb update-table \
  --table-name sitelogix-personnel \
  --deletion-protection-enabled

# Vendors Table
aws dynamodb update-table \
  --table-name sitelogix-vendors \
  --deletion-protection-enabled

# Constraints Table
aws dynamodb update-table \
  --table-name sitelogix-constraints \
  --deletion-protection-enabled
```

### 2.3 Enable DynamoDB Streams (ALL TABLES)

```bash
# Reports Table - Enable Streams for audit trail
aws dynamodb update-table \
  --table-name sitelogix-reports \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES

# Personnel Table
aws dynamodb update-table \
  --table-name sitelogix-personnel \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES

# Vendors Table
aws dynamodb update-table \
  --table-name sitelogix-vendors \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES

# Constraints Table
aws dynamodb update-table \
  --table-name sitelogix-constraints \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES
```

### 2.4 Automated Backup Schedule

**AWS Backup Plan Configuration:**

```json
{
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
      },
      "RecoveryPointTags": {
        "Project": "SiteLogix",
        "BackupType": "Automated"
      }
    },
    {
      "RuleName": "WeeklyLongTermBackup",
      "TargetBackupVaultName": "SiteLogix-Backup-Vault",
      "ScheduleExpression": "cron(0 3 ? * SUN *)",
      "StartWindowMinutes": 60,
      "CompletionWindowMinutes": 180,
      "Lifecycle": {
        "DeleteAfterDays": 2555,
        "MoveToColdStorageAfterDays": 90
      },
      "RecoveryPointTags": {
        "Project": "SiteLogix",
        "BackupType": "LongTerm"
      }
    }
  ]
}
```

### 2.5 Missing Tables - Creation Specs

**Table 5: Work Logs Table**

```json
{
  "TableName": "sitelogix-work-logs",
  "KeySchema": [
    {"AttributeName": "PK", "KeyType": "HASH"},
    {"AttributeName": "SK", "KeyType": "RANGE"}
  ],
  "AttributeDefinitions": [
    {"AttributeName": "PK", "AttributeType": "S"},
    {"AttributeName": "SK", "AttributeType": "S"},
    {"AttributeName": "project_id", "AttributeType": "S"},
    {"AttributeName": "report_date", "AttributeType": "S"},
    {"AttributeName": "team_id", "AttributeType": "S"}
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GSI1-ProjectDateIndex",
      "KeySchema": [
        {"AttributeName": "project_id", "KeyType": "HASH"},
        {"AttributeName": "report_date", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    },
    {
      "IndexName": "GSI2-TeamIndex",
      "KeySchema": [
        {"AttributeName": "team_id", "KeyType": "HASH"},
        {"AttributeName": "report_date", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    }
  ],
  "BillingMode": "PROVISIONED",
  "ProvisionedThroughput": {
    "ReadCapacityUnits": 5,
    "WriteCapacityUnits": 5
  },
  "SSESpecification": {
    "Enabled": true,
    "SSEType": "KMS"
  },
  "StreamSpecification": {
    "StreamEnabled": true,
    "StreamViewType": "NEW_AND_OLD_IMAGES"
  },
  "DeletionProtectionEnabled": true,
  "PointInTimeRecoveryEnabled": true,
  "Tags": [
    {"Key": "Project", "Value": "SiteLogix"},
    {"Key": "Environment", "Value": "Production"}
  ]
}
```

**Table 6: AI Analysis Cache Table**

```json
{
  "TableName": "sitelogix-ai-analysis",
  "KeySchema": [
    {"AttributeName": "PK", "KeyType": "HASH"},
    {"AttributeName": "SK", "KeyType": "RANGE"}
  ],
  "AttributeDefinitions": [
    {"AttributeName": "PK", "AttributeType": "S"},
    {"AttributeName": "SK", "AttributeType": "S"},
    {"AttributeName": "analysis_type", "AttributeType": "S"},
    {"AttributeName": "model_used", "AttributeType": "S"},
    {"AttributeName": "created_at", "AttributeType": "S"}
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GSI1-TypeIndex",
      "KeySchema": [
        {"AttributeName": "analysis_type", "KeyType": "HASH"},
        {"AttributeName": "created_at", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    },
    {
      "IndexName": "GSI2-ModelIndex",
      "KeySchema": [
        {"AttributeName": "model_used", "KeyType": "HASH"},
        {"AttributeName": "created_at", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    }
  ],
  "BillingMode": "PROVISIONED",
  "ProvisionedThroughput": {
    "ReadCapacityUnits": 10,
    "WriteCapacityUnits": 10
  },
  "SSESpecification": {
    "Enabled": true,
    "SSEType": "KMS"
  },
  "StreamSpecification": {
    "StreamEnabled": true,
    "StreamViewType": "NEW_AND_OLD_IMAGES"
  },
  "DeletionProtectionEnabled": true,
  "PointInTimeRecoveryEnabled": true,
  "Tags": [
    {"Key": "Project", "Value": "SiteLogix"},
    {"Key": "Environment", "Value": "Production"}
  ]
}
```

---

## 3. Data Lifecycle Automation

### 3.1 DynamoDB to S3 Archive Pipeline

**Lambda Function: DynamoDBToS3Archiver**

**Purpose:** Automatically archive DynamoDB records older than 90 days to S3 for cost-effective long-term storage.

**Configuration:**
```json
{
  "FunctionName": "SiteLogix-DynamoDB-Archiver",
  "Runtime": "nodejs18.x",
  "Handler": "index.handler",
  "MemorySize": 512,
  "Timeout": 300,
  "Environment": {
    "Variables": {
      "ARCHIVE_BUCKET": "sitelogix-archives-prod",
      "ARCHIVE_AGE_DAYS": "90",
      "TABLES_TO_ARCHIVE": "sitelogix-reports,sitelogix-work-logs,sitelogix-ai-analysis"
    }
  },
  "EventSourceMapping": {
    "EventSourceArn": "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-reports/stream/*",
    "BatchSize": 100,
    "StartingPosition": "LATEST"
  },
  "Schedule": "cron(0 2 * * ? *)"
}
```

**Function Logic (Pseudocode):**

```javascript
// Archive reports older than 90 days
async function archiveOldRecords() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  // Query DynamoDB for old records
  const oldRecords = await queryRecordsBefore(cutoffDate);

  // Convert to Parquet format for efficient storage
  const parquetData = convertToParquet(oldRecords);

  // Upload to S3 with partitioning
  const s3Key = `archives/year=${year}/month=${month}/day=${day}/records.parquet`;
  await s3.putObject({
    Bucket: 'sitelogix-archives-prod',
    Key: s3Key,
    Body: parquetData,
    ServerSideEncryption: 'AES256',
    Metadata: {
      'record-count': oldRecords.length.toString(),
      'archive-date': new Date().toISOString(),
      'source-table': tableName
    }
  });

  // Verify upload integrity
  const checksum = await verifyChecksum(s3Key);

  // Update DynamoDB records with archive status
  await updateRecordsWithArchiveInfo(oldRecords, s3Key, checksum);

  // DO NOT DELETE from DynamoDB immediately - mark as archived
  // Optional: Delete after additional retention period (e.g., 180 days)
}
```

### 3.2 File Checksum Validation Lambda

**Lambda Function: S3ChecksumValidator**

**Purpose:** Compute and verify SHA-256 checksums for all uploaded files.

```json
{
  "FunctionName": "SiteLogix-Checksum-Validator",
  "Runtime": "nodejs18.x",
  "Handler": "index.handler",
  "MemorySize": 1024,
  "Timeout": 60,
  "Environment": {
    "Variables": {
      "DYNAMODB_TABLE": "sitelogix-reports",
      "CHECKSUM_ALGORITHM": "SHA256"
    }
  },
  "EventTrigger": {
    "Type": "S3",
    "Events": ["s3:ObjectCreated:*"],
    "Buckets": [
      "sitelogix-audio-files-prod-v2",
      "sitelogix-transcripts-prod-v2"
    ]
  }
}
```

**Function Logic:**

```javascript
async function validateChecksum(event) {
  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;

  // Download file and compute checksum
  const fileData = await s3.getObject({ Bucket: bucket, Key: key });
  const checksum = crypto.createHash('sha256').update(fileData.Body).digest('hex');

  // Store checksum in DynamoDB
  const reportId = extractReportIdFromPath(key);
  await dynamodb.update({
    TableName: 'sitelogix-reports',
    Key: { PK: `REPORT#${reportId}`, SK: 'METADATA' },
    UpdateExpression: 'SET file_checksum = :checksum, checksum_verified_at = :timestamp',
    ExpressionAttributeValues: {
      ':checksum': checksum,
      ':timestamp': new Date().toISOString()
    }
  });

  // Log to audit trail
  await logAuditEvent({
    eventType: 'FILE_CHECKSUM_COMPUTED',
    bucket,
    key,
    checksum,
    timestamp: new Date().toISOString()
  });
}
```

### 3.3 Periodic Integrity Verification

**Lambda Function: MonthlyIntegrityCheck**

```json
{
  "FunctionName": "SiteLogix-Monthly-Integrity-Check",
  "Runtime": "nodejs18.x",
  "Handler": "index.handler",
  "MemorySize": 2048,
  "Timeout": 900,
  "Schedule": "cron(0 3 1 * ? *)",
  "Environment": {
    "Variables": {
      "ALERT_SNS_TOPIC": "arn:aws:sns:us-east-1:ACCOUNT_ID:SiteLogix-Integrity-Alerts"
    }
  }
}
```

---

## 4. CloudWatch Monitoring & Alerting

### 4.1 Critical Alarms (Deploy Immediately)

**Alarm 1: DynamoDB Read/Write Throttling**

```json
{
  "AlarmName": "SiteLogix-DynamoDB-Throttling-Reports",
  "MetricName": "UserErrors",
  "Namespace": "AWS/DynamoDB",
  "Statistic": "Sum",
  "Period": 300,
  "EvaluationPeriods": 2,
  "Threshold": 10,
  "ComparisonOperator": "GreaterThanThreshold",
  "Dimensions": [
    {
      "Name": "TableName",
      "Value": "sitelogix-reports"
    }
  ],
  "AlarmActions": [
    "arn:aws:sns:us-east-1:ACCOUNT_ID:SiteLogix-Critical-Alerts"
  ],
  "TreatMissingData": "notBreaching"
}
```

**Alarm 2: S3 Upload Failures**

```json
{
  "AlarmName": "SiteLogix-S3-Upload-Failures",
  "MetricName": "4xxErrors",
  "Namespace": "AWS/S3",
  "Statistic": "Sum",
  "Period": 300,
  "EvaluationPeriods": 1,
  "Threshold": 5,
  "ComparisonOperator": "GreaterThanThreshold",
  "Dimensions": [
    {
      "Name": "BucketName",
      "Value": "sitelogix-audio-files-prod-v2"
    }
  ],
  "AlarmActions": [
    "arn:aws:sns:us-east-1:ACCOUNT_ID:SiteLogix-Critical-Alerts"
  ]
}
```

**Alarm 3: Lambda Function Errors**

```json
{
  "AlarmName": "SiteLogix-Lambda-Errors-Archiver",
  "MetricName": "Errors",
  "Namespace": "AWS/Lambda",
  "Statistic": "Sum",
  "Period": 300,
  "EvaluationPeriods": 2,
  "Threshold": 3,
  "ComparisonOperator": "GreaterThanThreshold",
  "Dimensions": [
    {
      "Name": "FunctionName",
      "Value": "SiteLogix-DynamoDB-Archiver"
    }
  ],
  "AlarmActions": [
    "arn:aws:sns:us-east-1:ACCOUNT_ID:SiteLogix-Critical-Alerts"
  ]
}
```

**Alarm 4: Daily Cost Anomaly Detection**

```json
{
  "AlarmName": "SiteLogix-Cost-Anomaly",
  "MetricName": "EstimatedCharges",
  "Namespace": "AWS/Billing",
  "Statistic": "Maximum",
  "Period": 86400,
  "EvaluationPeriods": 1,
  "Threshold": 100,
  "ComparisonOperator": "GreaterThanThreshold",
  "Dimensions": [
    {
      "Name": "ServiceName",
      "Value": "AmazonDynamoDB"
    }
  ],
  "AlarmActions": [
    "arn:aws:sns:us-east-1:ACCOUNT_ID:SiteLogix-Cost-Alerts"
  ]
}
```

**Alarm 5: PITR Disabled Detection**

```json
{
  "AlarmName": "SiteLogix-PITR-Disabled-Alert",
  "MetricName": "PointInTimeRecoveryStatus",
  "Namespace": "AWS/DynamoDB",
  "Statistic": "Minimum",
  "Period": 3600,
  "EvaluationPeriods": 1,
  "Threshold": 1,
  "ComparisonOperator": "LessThanThreshold",
  "Dimensions": [
    {
      "Name": "TableName",
      "Value": "sitelogix-reports"
    }
  ],
  "AlarmActions": [
    "arn:aws:sns:us-east-1:ACCOUNT_ID:SiteLogix-Critical-Alerts"
  ]
}
```

### 4.2 CloudWatch Dashboard Specification

**Dashboard Name:** SiteLogix-Production-Overview

```json
{
  "DashboardName": "SiteLogix-Production-Overview",
  "DashboardBody": {
    "widgets": [
      {
        "type": "metric",
        "properties": {
          "title": "DynamoDB Read/Write Capacity",
          "metrics": [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", {"stat": "Sum"}],
            [".", "ConsumedWriteCapacityUnits", {"stat": "Sum"}]
          ],
          "period": 300,
          "region": "us-east-1",
          "yAxis": {"left": {"min": 0}}
        }
      },
      {
        "type": "metric",
        "properties": {
          "title": "S3 Storage by Bucket",
          "metrics": [
            ["AWS/S3", "BucketSizeBytes", {"dimensions": {"BucketName": "sitelogix-audio-files-prod-v2", "StorageType": "StandardStorage"}}],
            ["...", "sitelogix-transcripts-prod-v2", "."],
            ["...", "sitelogix-logs-prod", "."]
          ],
          "period": 86400,
          "stat": "Average"
        }
      },
      {
        "type": "metric",
        "properties": {
          "title": "Lambda Execution Duration",
          "metrics": [
            ["AWS/Lambda", "Duration", {"dimensions": {"FunctionName": "SiteLogix-DynamoDB-Archiver"}}],
            ["...", "SiteLogix-Checksum-Validator"]
          ],
          "period": 300,
          "stat": "Average"
        }
      },
      {
        "type": "metric",
        "properties": {
          "title": "Daily Estimated Costs",
          "metrics": [
            ["AWS/Billing", "EstimatedCharges", {"dimensions": {"ServiceName": "AmazonDynamoDB"}}],
            ["...", "AmazonS3"],
            ["...", "AWSLambda"]
          ],
          "period": 86400,
          "stat": "Maximum"
        }
      },
      {
        "type": "log",
        "properties": {
          "title": "Recent Errors (Last Hour)",
          "query": "SOURCE '/aws/lambda/SiteLogix-DynamoDB-Archiver' | fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20",
          "region": "us-east-1"
        }
      }
    ]
  }
}
```

---

## 5. IAM Policies for User Roles

### 5.1 Foreman/Manager Role (Write-Only Audio Upload)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAudioUpload",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": [
        "arn:aws:s3:::sitelogix-audio-files-prod-v2/SiteLogix/projects/*/audio/*",
        "arn:aws:s3:::sitelogix-transcripts-prod-v2/SiteLogix/projects/*/transcripts/*"
      ],
      "Condition": {
        "StringEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    },
    {
      "Sid": "ReadOwnReports",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-reports",
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:LeadingKeys": ["REPORT#${aws:username}*"]
        }
      }
    },
    {
      "Sid": "DenyDelete",
      "Effect": "Deny",
      "Action": [
        "s3:DeleteObject",
        "s3:DeleteObjectVersion",
        "dynamodb:DeleteItem"
      ],
      "Resource": "*"
    }
  ]
}
```

### 5.2 Project Manager Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadProjectReports",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-reports",
        "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-reports/index/*"
      ]
    },
    {
      "Sid": "ReadS3Files",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion"
      ],
      "Resource": [
        "arn:aws:s3:::sitelogix-audio-files-prod-v2/SiteLogix/projects/${project_id}/*",
        "arn:aws:s3:::sitelogix-transcripts-prod-v2/SiteLogix/projects/${project_id}/*"
      ]
    },
    {
      "Sid": "ApproveEntities",
      "Effect": "Allow",
      "Action": [
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-personnel",
        "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-vendors"
      ]
    },
    {
      "Sid": "DenyDelete",
      "Effect": "Deny",
      "Action": [
        "s3:DeleteObject",
        "s3:DeleteObjectVersion",
        "dynamodb:DeleteItem"
      ],
      "Resource": "*"
    }
  ]
}
```

### 5.3 Administrator Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "FullReadAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:ListBucket",
        "s3:ListBucketVersions"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-*",
        "arn:aws:s3:::sitelogix-*",
        "arn:aws:s3:::sitelogix-*/*"
      ]
    },
    {
      "Sid": "EntityManagement",
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-personnel",
        "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-vendors",
        "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-constraints"
      ]
    },
    {
      "Sid": "RestrictDelete",
      "Effect": "Deny",
      "Action": [
        "s3:DeleteObject",
        "s3:DeleteObjectVersion",
        "dynamodb:DeleteItem"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalArn": "arn:aws:iam::ACCOUNT_ID:role/SiteLogix-SuperAdmin"
        }
      }
    }
  ]
}
```

### 5.4 Executive/Read-Only Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadOnlyDashboard",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "cloudwatch:GetDashboard"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ExportReports",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::sitelogix-reports-exports/*"
      ]
    },
    {
      "Sid": "DenyWrite",
      "Effect": "Deny",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "*"
    }
  ]
}
```

### 5.5 Legal/Compliance Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadAllData",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:ListBucket",
        "s3:ListBucketVersions"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-*",
        "arn:aws:s3:::sitelogix-*",
        "arn:aws:s3:::sitelogix-*/*"
      ]
    },
    {
      "Sid": "AccessDeletedVersions",
      "Effect": "Allow",
      "Action": [
        "s3:GetObjectVersion",
        "s3:ListBucketVersions"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ReadAuditLogs",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "logs:FilterLogEvents",
        "cloudtrail:LookupEvents"
      ],
      "Resource": [
        "arn:aws:s3:::sitelogix-logs-prod/*",
        "arn:aws:logs:us-east-1:ACCOUNT_ID:log-group:/aws/lambda/SiteLogix-*",
        "arn:aws:cloudtrail:us-east-1:ACCOUNT_ID:trail/SiteLogix-Audit-Trail"
      ]
    },
    {
      "Sid": "DenyModify",
      "Effect": "Deny",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 6. Audit Logging Infrastructure

### 6.1 CloudTrail Configuration

```json
{
  "TrailName": "SiteLogix-Audit-Trail",
  "S3BucketName": "sitelogix-logs-prod",
  "S3KeyPrefix": "cloudtrail/",
  "IncludeGlobalServiceEvents": true,
  "IsMultiRegionTrail": true,
  "EnableLogFileValidation": true,
  "EventSelectors": [
    {
      "ReadWriteType": "All",
      "IncludeManagementEvents": true,
      "DataResources": [
        {
          "Type": "AWS::S3::Object",
          "Values": [
            "arn:aws:s3:::sitelogix-audio-files-prod-v2/",
            "arn:aws:s3:::sitelogix-transcripts-prod-v2/"
          ]
        },
        {
          "Type": "AWS::DynamoDB::Table",
          "Values": [
            "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-reports",
            "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-personnel",
            "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/sitelogix-vendors"
          ]
        }
      ]
    }
  ],
  "InsightSelectors": [
    {
      "InsightType": "ApiCallRateInsight"
    }
  ],
  "Tags": [
    {"Key": "Project", "Value": "SiteLogix"},
    {"Key": "Purpose", "Value": "Compliance-RFC008"}
  ]
}
```

### 6.2 DynamoDB Streams to Audit Log

**Lambda Function: StreamToAuditLog**

```json
{
  "FunctionName": "SiteLogix-Stream-Audit-Logger",
  "Runtime": "nodejs18.x",
  "Handler": "index.handler",
  "MemorySize": 256,
  "Timeout": 60,
  "Environment": {
    "Variables": {
      "AUDIT_TABLE": "sitelogix-audit-log",
      "AUDIT_BUCKET": "sitelogix-logs-prod",
      "AUDIT_PREFIX": "dynamodb-changes/"
    }
  }
}
```

**Audit Log Table Schema:**

```json
{
  "TableName": "sitelogix-audit-log",
  "KeySchema": [
    {"AttributeName": "PK", "KeyType": "HASH"},
    {"AttributeName": "SK", "KeyType": "RANGE"}
  ],
  "AttributeDefinitions": [
    {"AttributeName": "PK", "AttributeType": "S"},
    {"AttributeName": "SK", "AttributeType": "S"}
  ],
  "BillingMode": "PAY_PER_REQUEST",
  "SSESpecification": {"Enabled": true, "SSEType": "KMS"},
  "StreamSpecification": {"StreamEnabled": false},
  "DeletionProtectionEnabled": true,
  "PointInTimeRecoveryEnabled": true
}
```

---

## 7. Cost Optimization Strategies

### 7.1 S3 Cost Optimization

**Strategy 1: Intelligent Tiering**
- Automatically move objects between access tiers
- No retrieval fees for frequent/infrequent access tiers
- Estimated savings: 40-70% on storage costs

**Strategy 2: Lifecycle Transitions**
- Hot (0-90 days): STANDARD ($0.023/GB)
- Warm (90-365 days): STANDARD_IA ($0.0125/GB)
- Cold (1-3 years): GLACIER ($0.004/GB)
- Deep Archive (3-7 years): DEEP_ARCHIVE ($0.00099/GB)

**Estimated Monthly Costs (100GB audio/month):**
- Month 1-3: $6.90 (STANDARD)
- Month 4-12: $3.75 (STANDARD_IA)
- Year 2-3: $1.20 (GLACIER)
- Year 4-7: $0.30 (DEEP_ARCHIVE)

**Strategy 3: Compression**
- Use WebM for audio (50% smaller than WAV)
- Gzip transcripts before upload
- Estimated savings: 50-60% storage costs

### 7.2 DynamoDB Cost Optimization

**Strategy 1: On-Demand vs. Provisioned**
- Current: Provisioned (5-10 RCU/WCU per table)
- Recommendation: Switch to On-Demand for variable workloads
- Estimated savings: 20-30% for unpredictable traffic

**Strategy 2: Archive Old Records**
- Move records >90 days to S3
- Query via Athena for historical analysis
- Estimated savings: 80-90% on storage costs

**Strategy 3: GSI Optimization**
- Use sparse indexes (only index records that need querying)
- Project only essential attributes
- Estimated savings: 30-40% on index costs

### 7.3 Lambda Cost Optimization

**Strategy 1: Right-Size Memory**
- Monitor execution duration vs. memory allocation
- Use Lambda Power Tuning tool
- Estimated savings: 20-40% on compute costs

**Strategy 2: Reserved Concurrency**
- Reserve for critical functions (archiver, validator)
- Prevents cold starts
- Cost: $0.015/month per reserved unit

**Strategy 3: Async Invocation**
- Use SQS for non-time-sensitive operations
- Batch processing where possible
- Estimated savings: 30-50% on invocations

### 7.4 Cost Monitoring Alerts

```json
{
  "BudgetName": "SiteLogix-Monthly-Budget",
  "BudgetLimit": {
    "Amount": "500",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST",
  "NotificationsWithSubscribers": [
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 80,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [
        {
          "SubscriptionType": "EMAIL",
          "Address": "jayson@impactconsulting931.com"
        }
      ]
    },
    {
      "Notification": {
        "NotificationType": "FORECASTED",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 100,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [
        {
          "SubscriptionType": "EMAIL",
          "Address": "jayson@impactconsulting931.com"
        }
      ]
    }
  ]
}
```

---

## 8. Implementation Timeline & Priority

### PHASE 1: IMMEDIATE (Day 1-2) - CRITICAL COMPLIANCE

**Priority: P0 (MUST DO)**

| Task | Commands | Duration | Risk |
|------|----------|----------|------|
| Enable PITR (all tables) | 4 CLI commands | 5 min | Low |
| Enable Deletion Protection | 4 CLI commands | 5 min | Low |
| Enable DynamoDB Streams | 4 CLI commands | 10 min | Low |
| Enable S3 Access Logging | Shell script | 15 min | Low |
| Enable CloudTrail data events | Console/CLI | 20 min | Low |
| Deploy critical alarms | CloudFormation | 30 min | Low |

**Total Phase 1 Time: 1.5 hours**

### PHASE 2: DATA PROTECTION (Day 3-5) - HIGH PRIORITY

**Priority: P1 (SHOULD DO)**

| Task | Effort | Duration | Risk |
|------|--------|----------|------|
| Create S3 lifecycle policies | Shell script | 30 min | Low |
| Deploy checksum validator Lambda | IaC deployment | 2 hours | Medium |
| Create missing DynamoDB tables | CloudFormation | 1 hour | Low |
| Deploy archival Lambda | IaC deployment | 3 hours | Medium |
| Set up AWS Backup plan | Console/CLI | 30 min | Low |

**Total Phase 2 Time: 7 hours**

### PHASE 3: OBJECT LOCK MIGRATION (Day 6-10) - REQUIRES PLANNING

**Priority: P2 (MUST DO, BUT COMPLEX)**

| Task | Effort | Duration | Risk |
|------|--------|----------|------|
| Create new Object Lock buckets | CLI | 1 hour | Low |
| Test data migration script | Development | 4 hours | Medium |
| Migrate existing files | Batch job | 6 hours | High |
| Update application configs | Code changes | 2 hours | High |
| Smoke test new buckets | Testing | 2 hours | Medium |
| Decommission old buckets | CLI | 1 hour | Low |

**Total Phase 3 Time: 16 hours (2 days)**

### PHASE 4: MONITORING & OPTIMIZATION (Day 11-14) - OPERATIONAL

**Priority: P3 (NICE TO HAVE)**

| Task | Effort | Duration | Risk |
|------|--------|----------|------|
| Deploy CloudWatch dashboard | JSON template | 1 hour | Low |
| Configure cost alerts | AWS Budgets | 30 min | Low |
| Set up performance monitoring | CloudWatch | 2 hours | Low |
| Create audit report Lambda | Development | 4 hours | Medium |
| Document runbooks | Documentation | 4 hours | Low |

**Total Phase 4 Time: 11.5 hours**

**TOTAL IMPLEMENTATION TIME: ~36 hours (4.5 days)**

---

## 9. Rollback Plans

### Rollback: DynamoDB PITR/Streams

**Risk:** Low - Non-destructive changes

**Rollback Procedure:**
```bash
# Disable PITR (if needed)
aws dynamodb update-continuous-backups \
  --table-name sitelogix-reports \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=false

# Disable Streams
aws dynamodb update-table \
  --table-name sitelogix-reports \
  --stream-specification StreamEnabled=false
```

### Rollback: S3 Lifecycle Policies

**Risk:** Low - Can be deleted without data loss

**Rollback Procedure:**
```bash
# Remove lifecycle configuration
aws s3api delete-bucket-lifecycle --bucket sitelogix-audio-files-prod-v2
```

### Rollback: Object Lock Migration

**Risk:** High - Requires re-migration

**Rollback Procedure:**
1. Update application to point back to old buckets
2. Keep new buckets for 30 days before deletion
3. Verify old buckets still have all data
4. Update DNS/configuration

---

## 10. Success Metrics

### Compliance Metrics

| Metric | Target | Current | Gap |
|--------|--------|---------|-----|
| PITR Enabled | 100% | 0% | 100% |
| Deletion Protection | 100% | 0% | 100% |
| Object Lock Enabled | 100% | 0% | 100% |
| Access Logging | 100% | 0% | 100% |
| Checksum Validation | 100% | 0% | 100% |
| CloudWatch Alarms | 10+ | 0 | 10 |
| Audit Trail Coverage | 100% | Unknown | TBD |

### Operational Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| RPO (Recovery Point Objective) | 5 minutes | PITR enabled |
| RTO (Recovery Time Objective) | 1 hour | Backup restoration test |
| Data Durability | 99.999999999% | S3 standard |
| Alarm Response Time | < 5 minutes | SNS delivery |
| Cost per Report | < $0.50 | CloudWatch billing |

### Audit Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Audit Log Completeness | 100% | CloudTrail coverage |
| File Integrity Checks | 100% | Monthly verification |
| Access Log Retention | 7 years | S3 lifecycle policy |
| Compliance Report Generation | < 1 hour | Automated query |

---

## 11. Next Steps

### Immediate Actions (This Week)

1. **Approve this plan** - Review with stakeholders
2. **Execute Phase 1** - Enable PITR, Deletion Protection, Streams, Logging (1.5 hours)
3. **Test alarms** - Trigger test events to verify SNS delivery
4. **Document runbooks** - Create operational procedures

### Short-Term (Next 2 Weeks)

1. **Execute Phase 2** - Deploy lifecycle policies and Lambda functions
2. **Create missing tables** - Work Logs and AI Analysis Cache
3. **Test backup restoration** - Verify PITR and AWS Backup work correctly

### Medium-Term (Next Month)

1. **Execute Phase 3** - Object Lock bucket migration (requires careful planning)
2. **Deploy monitoring** - CloudWatch dashboards and cost alerts
3. **Audit verification** - Test compliance with RFC-008 requirements

### Long-Term (Ongoing)

1. **Monthly integrity checks** - Automated verification jobs
2. **Quarterly compliance reviews** - Audit trail analysis
3. **Annual disaster recovery drill** - Full system restoration test
4. **Cost optimization reviews** - Quarterly analysis and tuning

---

## 12. Appendix

### A. Estimated Monthly Costs (Production)

| Service | Component | Monthly Cost |
|---------|-----------|--------------|
| DynamoDB | 6 tables + PITR + Backups | $80-120 |
| S3 | Storage (500GB) + Requests | $30-50 |
| Lambda | Archival + Validation functions | $10-20 |
| CloudWatch | Logs + Metrics + Alarms | $20-30 |
| CloudTrail | Data events logging | $10-15 |
| AWS Backup | Long-term backups | $15-25 |
| **TOTAL** | | **$165-260/month** |

### B. Key Contacts

| Role | Name | Email | Responsibility |
|------|------|-------|----------------|
| Product Owner | Jayson Rivas | jayson@impactconsulting931.com | Approval |
| DevOps Lead | TBD | TBD | Implementation |
| Database Admin | TBD | TBD | DynamoDB management |
| Security Lead | TBD | TBD | IAM policies |

### C. Reference Documents

- [RFC-008 - Database Planning Guidance](/Users/jhrstudio/Documents/GitHub/sitelogix-1.5/# RFC-008 - Database Planning Guidance.md)
- [S3 Folder Structure](/Users/jhrstudio/Documents/GitHub/sitelogix-1.5/docs/architecture/S3_FOLDER_STRUCTURE.md)
- [Database Design](/Users/jhrstudio/Documents/GitHub/sitelogix-1.5/DATABASE_DESIGN.md)
- [Build Plan](/Users/jhrstudio/Documents/GitHub/sitelogix-1.5/BUILD_PLAN.md)

---

**Document Status:** Ready for Review and Approval
**Last Updated:** November 4, 2025
**Next Review:** After Phase 1 completion
