#!/bin/bash

# Phase 1: S3 Bucket Migration Script
# Consolidates multiple SiteLogix buckets into sitelogix-prod with clean structure

set -e

echo "================================================"
echo "🗄️  SiteLogix S3 Bucket Migration - Phase 1"
echo "================================================"
echo ""
echo "⚠️  This script will:"
echo "   1. Copy files from sitelogix-transcripts-prod to sitelogix-prod"
echo "   2. Reorganize to new clean folder structure"
echo "   3. Verify all files copied successfully"
echo ""
echo "📝 Note: Original files will NOT be deleted (safe migration)"
echo ""

# Configuration
SOURCE_BUCKET="sitelogix-transcripts-prod"
DEST_BUCKET="sitelogix-prod"
REGION="us-east-1"
DRY_RUN=false

# Parse arguments
if [ "$1" == "--dry-run" ]; then
    DRY_RUN=true
    echo "🧪 DRY RUN MODE - No files will be copied"
    echo ""
fi

# Statistics
TOTAL_FILES=0
COPIED_FILES=0
FAILED_FILES=0

# Function to copy and reorganize a file
migrate_file() {
    local source_key=$1
    local filename=$(basename "$source_key")

    echo "📄 Processing: $filename"

    # Extract project ID from path
    # Example: SITELOGIX/projects/proj_001/transcripts/2025/11/rpt_xxx.txt
    if [[ $source_key =~ projects/([^/]+)/transcripts/([0-9]{4})/([0-9]{2})/(.+\.txt)$ ]]; then
        PROJECT_ID="${BASH_REMATCH[1]}"
        YEAR="${BASH_REMATCH[2]}"
        MONTH="${BASH_REMATCH[3]}"
        FILE="${BASH_REMATCH[4]}"

        # New destination path (remove SITELOGIX prefix, add raw/ subfolder)
        DEST_KEY="projects/${PROJECT_ID}/transcripts/raw/${YEAR}/${MONTH}/${FILE}"

        echo "   Source: s3://${SOURCE_BUCKET}/${source_key}"
        echo "   Dest:   s3://${DEST_BUCKET}/${DEST_KEY}"

        if [ "$DRY_RUN" = false ]; then
            # Copy file
            if aws s3 cp \
                "s3://${SOURCE_BUCKET}/${source_key}" \
                "s3://${DEST_BUCKET}/${DEST_KEY}" \
                --region $REGION \
                > /dev/null 2>&1; then

                echo "   ✅ Copied successfully"
                ((COPIED_FILES++))
            else
                echo "   ❌ Copy failed"
                ((FAILED_FILES++))
            fi
        else
            echo "   🧪 Would copy (dry run)"
        fi
    else
        echo "   ⚠️  Skipping: Path format not recognized"
    fi

    echo ""
}

# Step 1: List all files in source bucket
echo "🔍 Step 1: Scanning source bucket..."
echo ""

FILES=$(aws s3 ls s3://${SOURCE_BUCKET}/ --recursive --region $REGION | awk '{print $4}')

if [ -z "$FILES" ]; then
    echo "❌ No files found in source bucket"
    exit 1
fi

# Count files
TOTAL_FILES=$(echo "$FILES" | wc -l | tr -d ' ')
echo "📊 Found $TOTAL_FILES file(s) to migrate"
echo ""

# Step 2: Migrate each file
echo "🚀 Step 2: Migrating files..."
echo ""

while IFS= read -r file_key; do
    if [ ! -z "$file_key" ]; then
        migrate_file "$file_key"
    fi
done <<< "$FILES"

# Step 3: Summary
echo "================================================"
echo "📊 Migration Summary"
echo "================================================"
echo "Total Files Scanned:  $TOTAL_FILES"
echo "✅ Successfully Copied: $COPIED_FILES"
echo "❌ Failed:              $FAILED_FILES"

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "🧪 This was a DRY RUN - no files were actually copied"
    echo "   Run without --dry-run to execute migration"
fi

echo ""
echo "================================================"

if [ $FAILED_FILES -eq 0 ] && [ "$DRY_RUN" = false ]; then
    echo "✅ Migration Complete!"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Verify files in destination bucket"
    echo "   2. Test file access via API"
    echo "   3. Update batch-process-transcripts.js to use new paths"
    echo "   4. After verification (30 days), delete source bucket"
else
    echo "⚠️  Migration completed with issues"
    echo "   Review errors above before proceeding"
fi

echo "================================================"
echo ""
