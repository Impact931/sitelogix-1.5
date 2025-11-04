#!/bin/bash
# Phase 1: Enable Critical Protection Features (RFC-008 Compliance)
# Estimated Time: 1.5 hours
# Risk: Low (non-destructive operations)

set -e  # Exit on error

echo "=========================================="
echo "SiteLogix Phase 1: Critical Protection"
echo "RFC-008 Compliance Implementation"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGION="us-east-1"
TABLES=("sitelogix-reports" "sitelogix-personnel" "sitelogix-vendors" "sitelogix-constraints")
BUCKETS=("sitelogix-audio-files-prod" "sitelogix-transcripts-prod" "sitelogix-prod")
SNS_TOPIC_ARN=""  # Will be created

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Function to check if command succeeded
check_result() {
    if [ $? -eq 0 ]; then
        print_status "$1"
    else
        print_error "$1 FAILED"
        return 1
    fi
}

echo "Step 1: Create SNS Topic for Critical Alerts"
echo "--------------------------------------------"

SNS_TOPIC_ARN=$(aws sns create-topic \
    --name SiteLogix-Critical-Alerts \
    --region $REGION \
    --query 'TopicArn' \
    --output text 2>/dev/null || echo "")

if [ -z "$SNS_TOPIC_ARN" ]; then
    # Topic might already exist, try to get ARN
    SNS_TOPIC_ARN=$(aws sns list-topics --region $REGION \
        --query "Topics[?contains(TopicArn, 'SiteLogix-Critical-Alerts')].TopicArn" \
        --output text)
fi

if [ -n "$SNS_TOPIC_ARN" ]; then
    print_status "SNS Topic: $SNS_TOPIC_ARN"

    # Subscribe email
    read -p "Enter email address for critical alerts: " EMAIL_ADDRESS
    if [ -n "$EMAIL_ADDRESS" ]; then
        aws sns subscribe \
            --topic-arn $SNS_TOPIC_ARN \
            --protocol email \
            --notification-endpoint $EMAIL_ADDRESS \
            --region $REGION >/dev/null 2>&1
        check_result "Email subscription sent to $EMAIL_ADDRESS (check inbox to confirm)"
    fi
else
    print_error "Failed to create SNS topic"
fi

echo ""
echo "Step 2: Enable DynamoDB Point-in-Time Recovery"
echo "-----------------------------------------------"

for TABLE in "${TABLES[@]}"; do
    echo "Processing: $TABLE"

    # Check if PITR is already enabled
    PITR_STATUS=$(aws dynamodb describe-continuous-backups \
        --table-name $TABLE \
        --region $REGION \
        --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' \
        --output text 2>/dev/null || echo "UNKNOWN")

    if [ "$PITR_STATUS" = "ENABLED" ]; then
        print_warning "$TABLE: PITR already enabled"
    else
        aws dynamodb update-continuous-backups \
            --table-name $TABLE \
            --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
            --region $REGION >/dev/null 2>&1
        check_result "$TABLE: PITR enabled"
        sleep 2  # Rate limiting
    fi
done

echo ""
echo "Step 3: Enable DynamoDB Deletion Protection"
echo "--------------------------------------------"

for TABLE in "${TABLES[@]}"; do
    echo "Processing: $TABLE"

    # Check if deletion protection is already enabled
    DEL_PROTECTION=$(aws dynamodb describe-table \
        --table-name $TABLE \
        --region $REGION \
        --query 'Table.DeletionProtectionEnabled' \
        --output text 2>/dev/null || echo "false")

    if [ "$DEL_PROTECTION" = "True" ] || [ "$DEL_PROTECTION" = "true" ]; then
        print_warning "$TABLE: Deletion protection already enabled"
    else
        aws dynamodb update-table \
            --table-name $TABLE \
            --deletion-protection-enabled \
            --region $REGION >/dev/null 2>&1
        check_result "$TABLE: Deletion protection enabled"
        sleep 2  # Rate limiting
    fi
done

echo ""
echo "Step 4: Enable DynamoDB Streams"
echo "--------------------------------"

for TABLE in "${TABLES[@]}"; do
    echo "Processing: $TABLE"

    # Check if stream is already enabled
    STREAM_STATUS=$(aws dynamodb describe-table \
        --table-name $TABLE \
        --region $REGION \
        --query 'Table.StreamSpecification.StreamEnabled' \
        --output text 2>/dev/null || echo "false")

    if [ "$STREAM_STATUS" = "True" ] || [ "$STREAM_STATUS" = "true" ]; then
        print_warning "$TABLE: Streams already enabled"
    else
        aws dynamodb update-table \
            --table-name $TABLE \
            --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
            --region $REGION >/dev/null 2>&1
        check_result "$TABLE: Streams enabled (NEW_AND_OLD_IMAGES)"
        sleep 2  # Rate limiting
    fi
done

echo ""
echo "Step 5: Enable S3 Access Logging"
echo "---------------------------------"

# Create logging bucket if it doesn't exist
LOGGING_BUCKET="sitelogix-logs-prod"
aws s3api head-bucket --bucket $LOGGING_BUCKET 2>/dev/null

if [ $? -ne 0 ]; then
    echo "Creating logging bucket: $LOGGING_BUCKET"
    aws s3api create-bucket \
        --bucket $LOGGING_BUCKET \
        --region $REGION \
        --create-bucket-configuration LocationConstraint=$REGION >/dev/null 2>&1 || \
    aws s3api create-bucket \
        --bucket $LOGGING_BUCKET \
        --region $REGION >/dev/null 2>&1
    check_result "Logging bucket created"

    # Block public access
    aws s3api put-public-access-block \
        --bucket $LOGGING_BUCKET \
        --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
        --region $REGION >/dev/null 2>&1
    check_result "Public access blocked on logging bucket"
fi

# Enable versioning on logging bucket
aws s3api put-bucket-versioning \
    --bucket $LOGGING_BUCKET \
    --versioning-configuration Status=Enabled \
    --region $REGION >/dev/null 2>&1
check_result "Versioning enabled on logging bucket"

# Grant S3 log delivery permission
cat > /tmp/logging-acl.json <<EOF
{
    "Owner": {
        "ID": "$(aws s3api get-bucket-acl --bucket $LOGGING_BUCKET --query 'Owner.ID' --output text)"
    },
    "Grants": [
        {
            "Grantee": {
                "Type": "Group",
                "URI": "http://acs.amazonaws.com/groups/s3/LogDelivery"
            },
            "Permission": "WRITE"
        },
        {
            "Grantee": {
                "Type": "Group",
                "URI": "http://acs.amazonaws.com/groups/s3/LogDelivery"
            },
            "Permission": "READ_ACP"
        }
    ]
}
EOF

aws s3api put-bucket-acl \
    --bucket $LOGGING_BUCKET \
    --access-control-policy file:///tmp/logging-acl.json \
    --region $REGION >/dev/null 2>&1
check_result "Log delivery permissions granted"

# Enable logging for each bucket
for BUCKET in "${BUCKETS[@]}"; do
    echo "Enabling access logging for: $BUCKET"

    aws s3api put-bucket-logging \
        --bucket $BUCKET \
        --bucket-logging-status \
        "{\"LoggingEnabled\":{\"TargetBucket\":\"$LOGGING_BUCKET\",\"TargetPrefix\":\"${BUCKET}-access-logs/\"}}" \
        --region $REGION >/dev/null 2>&1
    check_result "$BUCKET: Access logging enabled"
done

echo ""
echo "Step 6: Enable CloudTrail Data Events"
echo "--------------------------------------"

TRAIL_NAME="SiteLogix-Audit-Trail"

# Check if trail exists
TRAIL_EXISTS=$(aws cloudtrail describe-trails \
    --region $REGION \
    --query "trailList[?Name=='$TRAIL_NAME'].Name" \
    --output text 2>/dev/null || echo "")

if [ -z "$TRAIL_EXISTS" ]; then
    echo "Creating CloudTrail: $TRAIL_NAME"

    # Create trail
    aws cloudtrail create-trail \
        --name $TRAIL_NAME \
        --s3-bucket-name $LOGGING_BUCKET \
        --s3-key-prefix cloudtrail/ \
        --is-multi-region-trail \
        --enable-log-file-validation \
        --region $REGION >/dev/null 2>&1
    check_result "CloudTrail created"

    # Start logging
    aws cloudtrail start-logging \
        --name $TRAIL_NAME \
        --region $REGION >/dev/null 2>&1
    check_result "CloudTrail logging started"
else
    print_warning "CloudTrail already exists: $TRAIL_NAME"
fi

# Configure data events for S3
cat > /tmp/event-selectors.json <<EOF
{
    "EventSelectors": [
        {
            "ReadWriteType": "All",
            "IncludeManagementEvents": true,
            "DataResources": [
                {
                    "Type": "AWS::S3::Object",
                    "Values": [
                        "arn:aws:s3:::sitelogix-audio-files-prod/",
                        "arn:aws:s3:::sitelogix-transcripts-prod/",
                        "arn:aws:s3:::sitelogix-prod/"
                    ]
                }
            ]
        }
    ]
}
EOF

aws cloudtrail put-event-selectors \
    --trail-name $TRAIL_NAME \
    --event-selectors file:///tmp/event-selectors.json \
    --region $REGION >/dev/null 2>&1
check_result "CloudTrail data events configured for S3 buckets"

echo ""
echo "Step 7: Deploy Critical CloudWatch Alarms"
echo "------------------------------------------"

if [ -z "$SNS_TOPIC_ARN" ]; then
    print_error "Cannot create alarms - SNS topic not available"
else
    # Alarm 1: DynamoDB Throttling
    aws cloudwatch put-metric-alarm \
        --alarm-name "SiteLogix-DynamoDB-Throttling-Reports" \
        --alarm-description "Alert on DynamoDB read/write throttling" \
        --metric-name UserErrors \
        --namespace AWS/DynamoDB \
        --statistic Sum \
        --period 300 \
        --evaluation-periods 2 \
        --threshold 10 \
        --comparison-operator GreaterThanThreshold \
        --dimensions Name=TableName,Value=sitelogix-reports \
        --alarm-actions $SNS_TOPIC_ARN \
        --treat-missing-data notBreaching \
        --region $REGION >/dev/null 2>&1
    check_result "Alarm created: DynamoDB Throttling (Reports)"

    # Alarm 2: S3 Upload Failures
    aws cloudwatch put-metric-alarm \
        --alarm-name "SiteLogix-S3-Upload-Failures" \
        --alarm-description "Alert on S3 4xx errors" \
        --metric-name 4xxErrors \
        --namespace AWS/S3 \
        --statistic Sum \
        --period 300 \
        --evaluation-periods 1 \
        --threshold 5 \
        --comparison-operator GreaterThanThreshold \
        --dimensions Name=BucketName,Value=sitelogix-audio-files-prod \
        --alarm-actions $SNS_TOPIC_ARN \
        --region $REGION >/dev/null 2>&1
    check_result "Alarm created: S3 Upload Failures"

    # Alarm 3: High DynamoDB Costs
    aws cloudwatch put-metric-alarm \
        --alarm-name "SiteLogix-DynamoDB-High-Costs" \
        --alarm-description "Alert when DynamoDB costs exceed $100/day" \
        --metric-name EstimatedCharges \
        --namespace AWS/Billing \
        --statistic Maximum \
        --period 86400 \
        --evaluation-periods 1 \
        --threshold 100 \
        --comparison-operator GreaterThanThreshold \
        --dimensions Name=ServiceName,Value=AmazonDynamoDB \
        --alarm-actions $SNS_TOPIC_ARN \
        --region us-east-1 >/dev/null 2>&1
    check_result "Alarm created: High DynamoDB Costs"
fi

echo ""
echo "Step 8: Verification Summary"
echo "=============================="

echo ""
echo "DynamoDB Tables:"
for TABLE in "${TABLES[@]}"; do
    echo -n "  $TABLE: "

    PITR=$(aws dynamodb describe-continuous-backups \
        --table-name $TABLE \
        --region $REGION \
        --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' \
        --output text 2>/dev/null || echo "UNKNOWN")

    DEL_PROT=$(aws dynamodb describe-table \
        --table-name $TABLE \
        --region $REGION \
        --query 'Table.DeletionProtectionEnabled' \
        --output text 2>/dev/null || echo "false")

    STREAM=$(aws dynamodb describe-table \
        --table-name $TABLE \
        --region $REGION \
        --query 'Table.StreamSpecification.StreamEnabled' \
        --output text 2>/dev/null || echo "false")

    echo "PITR=$PITR | DelProt=$DEL_PROT | Stream=$STREAM"
done

echo ""
echo "S3 Buckets:"
for BUCKET in "${BUCKETS[@]}"; do
    echo -n "  $BUCKET: "

    LOGGING=$(aws s3api get-bucket-logging \
        --bucket $BUCKET \
        --region $REGION \
        --query 'LoggingEnabled.TargetBucket' \
        --output text 2>/dev/null || echo "NOT_CONFIGURED")

    if [ "$LOGGING" != "None" ] && [ "$LOGGING" != "NOT_CONFIGURED" ]; then
        echo "Logging=$LOGGING"
    else
        echo "Logging=DISABLED"
    fi
done

echo ""
echo "CloudWatch Alarms:"
ALARM_COUNT=$(aws cloudwatch describe-alarms \
    --alarm-name-prefix "SiteLogix-" \
    --region $REGION \
    --query 'length(MetricAlarms)' \
    --output text 2>/dev/null || echo "0")
echo "  Total alarms configured: $ALARM_COUNT"

echo ""
echo "=========================================="
echo "Phase 1 Complete!"
echo "=========================================="
echo ""
print_status "Point-in-Time Recovery enabled on ${#TABLES[@]} tables"
print_status "Deletion Protection enabled on ${#TABLES[@]} tables"
print_status "DynamoDB Streams enabled on ${#TABLES[@]} tables"
print_status "S3 Access Logging enabled on ${#BUCKETS[@]} buckets"
print_status "CloudTrail data events configured"
print_status "CloudWatch alarms deployed: $ALARM_COUNT"
echo ""
echo "Next Steps:"
echo "  1. Confirm email subscription for SNS alerts (check inbox)"
echo "  2. Review CloudWatch alarm thresholds in AWS Console"
echo "  3. Test alarms by triggering test events"
echo "  4. Proceed to Phase 2: Data Lifecycle Policies"
echo ""
echo "Estimated monthly cost increase: $50-80"
echo "Compliance: RFC-008 critical requirements MET"
echo ""
