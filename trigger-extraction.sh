#!/bin/bash

# Trigger Batch Extraction via API
# Processes transcripts from S3 using Roxy AI in the cloud

set -e

API_ENDPOINT="https://6f10uv7ne0.execute-api.us-east-1.amazonaws.com/api"
LIMIT=${1:-10}

echo "================================================"
echo "🤖 Roxy AI - Batch Extraction Trigger"
echo "================================================"
echo ""
echo "API Endpoint: $API_ENDPOINT"
echo "Limit: $LIMIT transcripts"
echo ""

# Step 1: Seed master personnel
echo "👥 Step 1: Seeding master personnel..."
SEED_RESPONSE=$(curl -s -X POST "$API_ENDPOINT/extract/personnel/seed" \
  -H "Content-Type: application/json")

echo "$SEED_RESPONSE" | jq '.' 2>/dev/null || echo "$SEED_RESPONSE"
echo ""

# Step 2: Trigger batch extraction
echo "🚀 Step 2: Triggering batch extraction (limit: $LIMIT)..."
echo ""

BATCH_RESPONSE=$(curl -s -X POST "$API_ENDPOINT/extract/batch" \
  -H "Content-Type: application/json" \
  -d "{\"limit\": $LIMIT}")

echo "$BATCH_RESPONSE" | jq '.' 2>/dev/null || echo "$BATCH_RESPONSE"
echo ""

# Check if successful
if echo "$BATCH_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    SUCCEEDED=$(echo "$BATCH_RESPONSE" | jq -r '.succeeded')
    FAILED=$(echo "$BATCH_RESPONSE" | jq -r '.failed')
    TOTAL=$(echo "$BATCH_RESPONSE" | jq -r '.total')

    echo "================================================"
    echo "✅ Extraction Complete!"
    echo "================================================"
    echo "Total:     $TOTAL"
    echo "✅ Success: $SUCCEEDED"
    echo "❌ Failed:  $FAILED"
    echo ""

    # Show low confidence extractions if any
    LOW_CONF=$(echo "$BATCH_RESPONSE" | jq -r '.results[] | select(.confidence < 0.7) | "\(.filename): \(.confidence)"' 2>/dev/null)

    if [ ! -z "$LOW_CONF" ]; then
        echo "⚠️  Low Confidence Extractions (<0.7):"
        echo "$LOW_CONF"
        echo ""
    fi

    echo "Next steps:"
    echo "1. Check the Daily Reports in the app"
    echo "2. Review extracted data in DynamoDB"
    echo "3. Process more transcripts by running:"
    echo "   ./trigger-extraction.sh 50"
    echo ""
else
    echo "================================================"
    echo "❌ Extraction Failed"
    echo "================================================"
    echo "Error: $(echo "$BATCH_RESPONSE" | jq -r '.error' 2>/dev/null || echo 'Unknown error')"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check if Anthropic API key is set in Secrets Manager"
    echo "   Run: ./setup-anthropic-key.sh"
    echo "2. Check Lambda logs:"
    echo "   aws logs tail /aws/lambda/sitelogix-api --follow --region us-east-1"
    echo ""
    exit 1
fi
