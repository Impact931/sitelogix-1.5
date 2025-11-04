#!/bin/bash
# Phase 2: Implement S3 Lifecycle Policies and Data Archival
# Estimated Time: 2 hours
# Risk: Low (policies can be modified)

set -e

echo "=========================================="
echo "SiteLogix Phase 2: Lifecycle Policies"
echo "RFC-008 Hot/Warm/Cold Storage Strategy"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

REGION="us-east-1"
BUCKETS=("sitelogix-audio-files-prod" "sitelogix-transcripts-prod")

echo "Step 1: Configure S3 Lifecycle Policies"
echo "----------------------------------------"

# Audio Files Bucket - Aggressive Archival
AUDIO_BUCKET="sitelogix-audio-files-prod"

cat > /tmp/lifecycle-audio.json <<'EOF'
{
    "Rules": [
        {
            "Id": "Hot-to-Warm-90days",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "SiteLogix/projects/"
            },
            "Transitions": [
                {
                    "Days": 90,
                    "StorageClass": "STANDARD_IA"
                }
            ]
        },
        {
            "Id": "Warm-to-Cold-1year",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "SiteLogix/projects/"
            },
            "Transitions": [
                {
                    "Days": 365,
                    "StorageClass": "GLACIER_FLEXIBLE_RETRIEVAL"
                }
            ]
        },
        {
            "Id": "Cold-to-DeepArchive-3years",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "SiteLogix/projects/"
            },
            "Transitions": [
                {
                    "Days": 1095,
                    "StorageClass": "DEEP_ARCHIVE"
                }
            ]
        },
        {
            "Id": "Expire-Old-Versions-90days",
            "Status": "Enabled",
            "NoncurrentVersionExpiration": {
                "NoncurrentDays": 90,
                "NewerNoncurrentVersions": 3
            }
        }
    ]
}
EOF

echo "Applying lifecycle policy to: $AUDIO_BUCKET"
aws s3api put-bucket-lifecycle-configuration \
    --bucket $AUDIO_BUCKET \
    --lifecycle-configuration file:///tmp/lifecycle-audio.json \
    --region $REGION
print_status "Audio files lifecycle policy applied (90d→IA, 1y→Glacier, 3y→DeepArchive)"

# Transcripts Bucket - Moderate Archival
TRANSCRIPTS_BUCKET="sitelogix-transcripts-prod"

cat > /tmp/lifecycle-transcripts.json <<'EOF'
{
    "Rules": [
        {
            "Id": "Hot-to-Warm-90days",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "SiteLogix/projects/"
            },
            "Transitions": [
                {
                    "Days": 90,
                    "StorageClass": "STANDARD_IA"
                }
            ]
        },
        {
            "Id": "Warm-to-Glacier-1year",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "SiteLogix/projects/"
            },
            "Transitions": [
                {
                    "Days": 365,
                    "StorageClass": "GLACIER_FLEXIBLE_RETRIEVAL"
                }
            ]
        },
        {
            "Id": "Expire-Old-Versions-90days",
            "Status": "Enabled",
            "NoncurrentVersionExpiration": {
                "NoncurrentDays": 90,
                "NewerNoncurrentVersions": 3
            }
        }
    ]
}
EOF

echo "Applying lifecycle policy to: $TRANSCRIPTS_BUCKET"
aws s3api put-bucket-lifecycle-configuration \
    --bucket $TRANSCRIPTS_BUCKET \
    --lifecycle-configuration file:///tmp/lifecycle-transcripts.json \
    --region $REGION
print_status "Transcripts lifecycle policy applied (90d→IA, 1y→Glacier)"

# Logging Bucket - Long-term Archival
LOGGING_BUCKET="sitelogix-logs-prod"

cat > /tmp/lifecycle-logs.json <<'EOF'
{
    "Rules": [
        {
            "Id": "Logs-to-Glacier-90days",
            "Status": "Enabled",
            "Transitions": [
                {
                    "Days": 90,
                    "StorageClass": "GLACIER_FLEXIBLE_RETRIEVAL"
                }
            ]
        },
        {
            "Id": "Expire-Logs-7years",
            "Status": "Enabled",
            "Expiration": {
                "Days": 2555
            }
        }
    ]
}
EOF

aws s3api head-bucket --bucket $LOGGING_BUCKET 2>/dev/null
if [ $? -eq 0 ]; then
    echo "Applying lifecycle policy to: $LOGGING_BUCKET"
    aws s3api put-bucket-lifecycle-configuration \
        --bucket $LOGGING_BUCKET \
        --lifecycle-configuration file:///tmp/lifecycle-logs.json \
        --region $REGION
    print_status "Logs lifecycle policy applied (90d→Glacier, expire after 7 years)"
else
    print_warning "Logging bucket not found, skipping"
fi

echo ""
echo "Step 2: Enable S3 Intelligent-Tiering (Optional)"
echo "-------------------------------------------------"

read -p "Enable Intelligent-Tiering for automatic cost optimization? (y/n): " ENABLE_IT

if [ "$ENABLE_IT" = "y" ] || [ "$ENABLE_IT" = "Y" ]; then
    for BUCKET in "${BUCKETS[@]}"; do
        echo "Configuring Intelligent-Tiering for: $BUCKET"

        cat > /tmp/intelligent-tiering.json <<'EOF'
{
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
}
EOF

        aws s3api put-bucket-intelligent-tiering-configuration \
            --bucket $BUCKET \
            --id EntireBucket \
            --intelligent-tiering-configuration file:///tmp/intelligent-tiering.json \
            --region $REGION 2>/dev/null || print_warning "Could not enable Intelligent-Tiering for $BUCKET"
    done
    print_status "Intelligent-Tiering configured"
else
    print_warning "Skipping Intelligent-Tiering configuration"
fi

echo ""
echo "Step 3: Verification"
echo "--------------------"

for BUCKET in "${BUCKETS[@]}"; do
    echo ""
    echo "Bucket: $BUCKET"
    echo "Lifecycle Rules:"

    aws s3api get-bucket-lifecycle-configuration \
        --bucket $BUCKET \
        --region $REGION \
        --query 'Rules[*].[Id,Status]' \
        --output table 2>/dev/null || echo "  No lifecycle rules found"
done

echo ""
echo "=========================================="
echo "Phase 2 Complete!"
echo "=========================================="
echo ""
print_status "Lifecycle policies applied to ${#BUCKETS[@]} buckets"
print_status "Hot tier: 0-90 days (STANDARD)"
print_status "Warm tier: 90-365 days (STANDARD_IA)"
print_status "Cold tier: 1-3 years (GLACIER)"
print_status "Deep Archive: 3-7 years (DEEP_ARCHIVE)"
echo ""
echo "Expected Cost Savings:"
echo "  - Storage costs: 40-70% reduction over 7 years"
echo "  - Audio files: ~90% reduction after 3 years"
echo "  - Transcripts: ~80% reduction after 1 year"
echo ""
echo "Next Steps:"
echo "  1. Monitor storage costs in CloudWatch"
echo "  2. Verify transitions after 90 days"
echo "  3. Proceed to Phase 3: Object Lock Migration"
echo ""
