#!/bin/bash

# Simple script to download and view HTML reports from S3

if [ -z "$1" ]; then
  echo "Usage: ./view-report.sh <s3-key-or-report-id>"
  echo ""
  echo "Examples:"
  echo "  ./view-report.sh SITELOGIX/projects/proj_001/reports/2025/09/24/rpt_20250924_mgr_001_1759721473685/report.html"
  echo "  ./view-report.sh rpt_20250924_mgr_001_1759721473685"
  exit 1
fi

S3_KEY="$1"

# If it's just a report ID, find it in S3
if [[ ! "$S3_KEY" =~ "/" ]]; then
  echo "🔍 Searching for report: $S3_KEY..."
  FULL_KEY=$(aws s3 ls s3://sitelogix-prod/SITELOGIX/projects/ --recursive | grep "$S3_KEY/report.html" | awk '{print $4}' | head -1)

  if [ -z "$FULL_KEY" ]; then
    echo "❌ Report not found: $S3_KEY"
    exit 1
  fi

  S3_KEY="$FULL_KEY"
  echo "✅ Found: $S3_KEY"
fi

# Download and open
TMP_FILE="/tmp/sitelogix-report-$(date +%s).html"

echo "📥 Downloading report..."
aws s3 cp "s3://sitelogix-prod/$S3_KEY" "$TMP_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Report downloaded"
  echo "🌐 Opening in browser..."
  open "$TMP_FILE"
  echo ""
  echo "Report saved to: $TMP_FILE"
else
  echo "❌ Failed to download report"
  exit 1
fi
