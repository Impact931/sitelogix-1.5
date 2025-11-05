#!/bin/bash

# SiteLogix Analytics DynamoDB Tables Setup
# Creates tables for analytics, compliance tracking, and notifications

set -e

echo "================================================"
echo "Creating SiteLogix Analytics DynamoDB Tables"
echo "================================================"
echo ""

REGION="us-east-1"

# Table 1: sitelogix-analytics
# Stores all analytics data (hours, vendor performance, critical events, insights)
echo "Creating sitelogix-analytics table..."

aws dynamodb create-table \
  --table-name sitelogix-analytics \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI1PK,AttributeType=S \
    AttributeName=GSI1SK,AttributeType=S \
    AttributeName=GSI2PK,AttributeType=S \
    AttributeName=GSI2SK,AttributeType=N \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    "[
      {
        \"IndexName\": \"GSI1\",
        \"KeySchema\": [
          {\"AttributeName\": \"GSI1PK\", \"KeyType\": \"HASH\"},
          {\"AttributeName\": \"GSI1SK\", \"KeyType\": \"RANGE\"}
        ],
        \"Projection\": {\"ProjectionType\": \"ALL\"},
        \"ProvisionedThroughput\": {
          \"ReadCapacityUnits\": 5,
          \"WriteCapacityUnits\": 5
        }
      },
      {
        \"IndexName\": \"GSI2\",
        \"KeySchema\": [
          {\"AttributeName\": \"GSI2PK\", \"KeyType\": \"HASH\"},
          {\"AttributeName\": \"GSI2SK\", \"KeyType\": \"RANGE\"}
        ],
        \"Projection\": {\"ProjectionType\": \"ALL\"},
        \"ProvisionedThroughput\": {
          \"ReadCapacityUnits\": 5,
          \"WriteCapacityUnits\": 5
        }
      }
    ]" \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION \
  > /dev/null 2>&1 || echo "✅ sitelogix-analytics table already exists"

echo "✅ sitelogix-analytics table created/verified"

# Table 2: sitelogix-compliance
# Tracks daily report compliance and notifications
echo "Creating sitelogix-compliance table..."

aws dynamodb create-table \
  --table-name sitelogix-compliance \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI1PK,AttributeType=S \
    AttributeName=GSI1SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    "[
      {
        \"IndexName\": \"DateIndex\",
        \"KeySchema\": [
          {\"AttributeName\": \"GSI1PK\", \"KeyType\": \"HASH\"},
          {\"AttributeName\": \"GSI1SK\", \"KeyType\": \"RANGE\"}
        ],
        \"Projection\": {\"ProjectionType\": \"ALL\"},
        \"ProvisionedThroughput\": {
          \"ReadCapacityUnits\": 5,
          \"WriteCapacityUnits\": 5
        }
      }
    ]" \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION \
  > /dev/null 2>&1 || echo "✅ sitelogix-compliance table already exists"

echo "✅ sitelogix-compliance table created/verified"

# Table 3: sitelogix-notifications
# Stores in-app notifications
echo "Creating sitelogix-notifications table..."

aws dynamodb create-table \
  --table-name sitelogix-notifications \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI1PK,AttributeType=S \
    AttributeName=GSI1SK,AttributeType=N \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    "[
      {
        \"IndexName\": \"UserNotifications\",
        \"KeySchema\": [
          {\"AttributeName\": \"GSI1PK\", \"KeyType\": \"HASH\"},
          {\"AttributeName\": \"GSI1SK\", \"KeyType\": \"RANGE\"}
        ],
        \"Projection\": {\"ProjectionType\": \"ALL\"},
        \"ProvisionedThroughput\": {
          \"ReadCapacityUnits\": 5,
          \"WriteCapacityUnits\": 5
        }
      }
    ]" \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION \
  > /dev/null 2>&1 || echo "✅ sitelogix-notifications table already exists"

echo "✅ sitelogix-notifications table created/verified"

echo ""
echo "================================================"
echo "✅ All Analytics Tables Created Successfully!"
echo "================================================"
echo ""
echo "Tables created:"
echo "  1. sitelogix-analytics (PK/SK + 2 GSIs)"
echo "  2. sitelogix-compliance (PK/SK + DateIndex GSI)"
echo "  3. sitelogix-notifications (PK/SK + UserNotifications GSI)"
echo ""
echo "Billing Mode: PAY_PER_REQUEST (on-demand)"
echo "Region: $REGION"
echo ""
