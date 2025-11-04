#!/bin/bash
# RFC-008 Compliance Verification Script
# Checks all critical compliance requirements

set -e

echo "=========================================="
echo "SiteLogix RFC-008 Compliance Check"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

REGION="us-east-1"
COMPLIANCE_SCORE=0
TOTAL_CHECKS=0

check_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    COMPLIANCE_SCORE=$((COMPLIANCE_SCORE + 1))
}

check_fail() {
    echo -e "  ${RED}✗${NC} $1"
}

check_warning() {
    echo -e "  ${YELLOW}!${NC} $1"
}

echo "1. DynamoDB Tables Protection"
echo "------------------------------"

TABLES=("sitelogix-reports" "sitelogix-personnel" "sitelogix-vendors" "sitelogix-constraints" "sitelogix-work-logs" "sitelogix-ai-analysis")

for TABLE in "${TABLES[@]}"; do
    TOTAL_CHECKS=$((TOTAL_CHECKS + 3))
    echo ""
    echo "Checking: $TABLE"

    # Check if table exists
    TABLE_EXISTS=$(aws dynamodb describe-table --table-name $TABLE --region $REGION 2>/dev/null && echo "true" || echo "false")

    if [ "$TABLE_EXISTS" = "false" ]; then
        check_fail "Table does not exist"
        TOTAL_CHECKS=$((TOTAL_CHECKS - 3))
        continue
    fi

    # Check PITR
    PITR=$(aws dynamodb describe-continuous-backups \
        --table-name $TABLE \
        --region $REGION \
        --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' \
        --output text 2>/dev/null || echo "UNKNOWN")

    if [ "$PITR" = "ENABLED" ]; then
        check_pass "PITR enabled"
    else
        check_fail "PITR not enabled (Status: $PITR)"
    fi

    # Check Deletion Protection
    DEL_PROT=$(aws dynamodb describe-table \
        --table-name $TABLE \
        --region $REGION \
        --query 'Table.DeletionProtectionEnabled' \
        --output text 2>/dev/null || echo "false")

    if [ "$DEL_PROT" = "True" ] || [ "$DEL_PROT" = "true" ]; then
        check_pass "Deletion Protection enabled"
    else
        check_fail "Deletion Protection not enabled"
    fi

    # Check Streams
    STREAM=$(aws dynamodb describe-table \
        --table-name $TABLE \
        --region $REGION \
        --query 'Table.StreamSpecification.StreamEnabled' \
        --output text 2>/dev/null || echo "false")

    if [ "$STREAM" = "True" ] || [ "$STREAM" = "true" ]; then
        check_pass "Streams enabled"
    else
        check_fail "Streams not enabled"
    fi
done

echo ""
echo "2. S3 Buckets Configuration"
echo "---------------------------"

BUCKETS=("sitelogix-audio-files-prod" "sitelogix-transcripts-prod" "sitelogix-logs-prod" "sitelogix-audio-files-prod-v2" "sitelogix-transcripts-prod-v2")

for BUCKET in "${BUCKETS[@]}"; do
    TOTAL_CHECKS=$((TOTAL_CHECKS + 3))
    echo ""
    echo "Checking: $BUCKET"

    # Check if bucket exists
    aws s3api head-bucket --bucket $BUCKET 2>/dev/null
    if [ $? -ne 0 ]; then
        check_warning "Bucket does not exist (may be planned)"
        TOTAL_CHECKS=$((TOTAL_CHECKS - 3))
        continue
    fi

    # Check Versioning
    VERSIONING=$(aws s3api get-bucket-versioning \
        --bucket $BUCKET \
        --region $REGION \
        --query 'Status' \
        --output text 2>/dev/null || echo "NOT_CONFIGURED")

    if [ "$VERSIONING" = "Enabled" ]; then
        check_pass "Versioning enabled"
    else
        check_fail "Versioning not enabled (Status: $VERSIONING)"
    fi

    # Check Object Lock
    OBJECT_LOCK=$(aws s3api get-object-lock-configuration \
        --bucket $BUCKET \
        --region $REGION 2>/dev/null && echo "ENABLED" || echo "NOT_CONFIGURED")

    if [ "$OBJECT_LOCK" = "ENABLED" ]; then
        check_pass "Object Lock enabled"
    else
        if [[ "$BUCKET" == *"-v2" ]]; then
            check_fail "Object Lock not enabled (v2 bucket should have it)"
        else
            check_warning "Object Lock not enabled (requires migration to new bucket)"
        fi
    fi

    # Check Access Logging
    LOGGING=$(aws s3api get-bucket-logging \
        --bucket $BUCKET \
        --region $REGION \
        --query 'LoggingEnabled.TargetBucket' \
        --output text 2>/dev/null || echo "NOT_CONFIGURED")

    if [ "$LOGGING" != "None" ] && [ "$LOGGING" != "NOT_CONFIGURED" ]; then
        check_pass "Access logging enabled (Target: $LOGGING)"
    else
        check_fail "Access logging not configured"
    fi

    # Check Lifecycle Policies (bonus check)
    LIFECYCLE=$(aws s3api get-bucket-lifecycle-configuration \
        --bucket $BUCKET \
        --region $REGION \
        --query 'Rules[*].Id' \
        --output text 2>/dev/null || echo "NONE")

    if [ "$LIFECYCLE" != "NONE" ]; then
        RULE_COUNT=$(echo "$LIFECYCLE" | wc -w)
        check_pass "Lifecycle policies configured ($RULE_COUNT rules)"
    else
        check_warning "No lifecycle policies configured"
    fi
done

echo ""
echo "3. CloudTrail Configuration"
echo "---------------------------"
TOTAL_CHECKS=$((TOTAL_CHECKS + 2))

TRAIL_NAME="SiteLogix-Audit-Trail"
TRAIL_EXISTS=$(aws cloudtrail describe-trails \
    --region $REGION \
    --query "trailList[?Name=='$TRAIL_NAME'].Name" \
    --output text 2>/dev/null || echo "")

if [ -n "$TRAIL_EXISTS" ]; then
    check_pass "CloudTrail exists: $TRAIL_NAME"

    # Check if logging is enabled
    LOGGING_STATUS=$(aws cloudtrail get-trail-status \
        --name $TRAIL_NAME \
        --region $REGION \
        --query 'IsLogging' \
        --output text 2>/dev/null || echo "false")

    if [ "$LOGGING_STATUS" = "True" ]; then
        check_pass "CloudTrail logging active"
    else
        check_fail "CloudTrail logging not active"
    fi
else
    check_fail "CloudTrail not configured"
    check_fail "CloudTrail logging not active"
fi

echo ""
echo "4. CloudWatch Alarms"
echo "--------------------"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

ALARM_COUNT=$(aws cloudwatch describe-alarms \
    --alarm-name-prefix "SiteLogix-" \
    --region $REGION \
    --query 'length(MetricAlarms)' \
    --output text 2>/dev/null || echo "0")

if [ "$ALARM_COUNT" -ge 5 ]; then
    check_pass "$ALARM_COUNT alarms configured (Target: 5+)"
else
    check_fail "Only $ALARM_COUNT alarms configured (Target: 5+)"
fi

echo ""
echo "5. AWS Backup Plan"
echo "------------------"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

BACKUP_PLAN=$(aws backup list-backup-plans \
    --region $REGION \
    --query "BackupPlansList[?contains(BackupPlanName, 'SiteLogix')].BackupPlanName" \
    --output text 2>/dev/null || echo "")

if [ -n "$BACKUP_PLAN" ]; then
    check_pass "Backup plan configured: $BACKUP_PLAN"
else
    check_fail "No backup plan configured"
fi

echo ""
echo "6. SNS Alert Configuration"
echo "--------------------------"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

SNS_TOPIC=$(aws sns list-topics \
    --region $REGION \
    --query "Topics[?contains(TopicArn, 'SiteLogix-Critical-Alerts')].TopicArn" \
    --output text 2>/dev/null || echo "")

if [ -n "$SNS_TOPIC" ]; then
    check_pass "SNS topic configured for alerts"

    # Check subscriptions
    SUBSCRIPTION_COUNT=$(aws sns list-subscriptions-by-topic \
        --topic-arn $SNS_TOPIC \
        --region $REGION \
        --query 'length(Subscriptions)' \
        --output text 2>/dev/null || echo "0")

    if [ "$SUBSCRIPTION_COUNT" -gt 0 ]; then
        check_pass "$SUBSCRIPTION_COUNT email subscription(s) configured"
    else
        check_warning "No email subscriptions configured"
    fi
else
    check_fail "SNS topic not configured"
fi

echo ""
echo "=========================================="
echo "Compliance Summary"
echo "=========================================="
echo ""

COMPLIANCE_PERCENTAGE=$((COMPLIANCE_SCORE * 100 / TOTAL_CHECKS))

echo "Checks Passed: $COMPLIANCE_SCORE / $TOTAL_CHECKS"
echo "Compliance Score: $COMPLIANCE_PERCENTAGE%"
echo ""

if [ "$COMPLIANCE_PERCENTAGE" -ge 90 ]; then
    echo -e "${GREEN}Status: COMPLIANT${NC}"
    echo "All critical RFC-008 requirements met."
elif [ "$COMPLIANCE_PERCENTAGE" -ge 70 ]; then
    echo -e "${YELLOW}Status: PARTIALLY COMPLIANT${NC}"
    echo "Some requirements need attention. Review failures above."
else
    echo -e "${RED}Status: NON-COMPLIANT${NC}"
    echo "Critical requirements not met. Execute Phase 1 immediately."
fi

echo ""
echo "Recommended Actions:"
echo ""

if [ "$COMPLIANCE_PERCENTAGE" -lt 70 ]; then
    echo "  1. Run Phase 1 script: ./phase1-enable-protection.sh"
    echo "  2. Run Phase 2 script: ./phase2-lifecycle-policies.sh"
    echo "  3. Deploy missing tables: CloudFormation stack"
fi

if [ "$COMPLIANCE_PERCENTAGE" -ge 70 ] && [ "$COMPLIANCE_PERCENTAGE" -lt 90 ]; then
    echo "  1. Review failed checks above"
    echo "  2. Address missing configurations"
    echo "  3. Consider Object Lock migration (Phase 4)"
fi

if [ "$COMPLIANCE_PERCENTAGE" -ge 90 ]; then
    echo "  1. Review warnings (if any)"
    echo "  2. Consider Object Lock migration for v2 buckets"
    echo "  3. Schedule monthly integrity checks"
    echo "  4. Plan disaster recovery drill"
fi

echo ""
echo "Report generated: $(date)"
echo ""

# Exit with error if non-compliant
if [ "$COMPLIANCE_PERCENTAGE" -lt 70 ]; then
    exit 1
fi

exit 0
