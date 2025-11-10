#!/bin/bash

###############################################################################
# SiteLogix Payroll Tables Creation Script
#
# This script creates the DynamoDB tables needed for payroll tracking:
# 1. Enhanced sitelogix-personnel table (or updates existing)
# 2. New sitelogix-payroll-entries table
# 3. Adds new GSI to existing sitelogix-reports table
#
# Usage:
#   ./create-payroll-tables.sh [--region us-east-1] [--profile default]
#
# Prerequisites:
#   - AWS CLI installed and configured
#   - Appropriate IAM permissions for DynamoDB operations
###############################################################################

set -e  # Exit on error

# Default values
REGION="us-east-1"
PROFILE="default"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --region)
      REGION="$2"
      shift 2
      ;;
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [--region REGION] [--profile PROFILE]"
      echo ""
      echo "Options:"
      echo "  --region   AWS region (default: us-east-1)"
      echo "  --profile  AWS CLI profile (default: default)"
      echo "  -h, --help Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

AWS_CMD="aws --region $REGION --profile $PROFILE"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}SiteLogix Payroll Tables Creation${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "Region:  ${GREEN}$REGION${NC}"
echo -e "Profile: ${GREEN}$PROFILE${NC}"
echo ""

###############################################################################
# Function: Check if table exists
###############################################################################
table_exists() {
  local table_name=$1
  $AWS_CMD dynamodb describe-table --table-name "$table_name" &>/dev/null
  return $?
}

###############################################################################
# Function: Wait for table to be active
###############################################################################
wait_for_table() {
  local table_name=$1
  echo -e "${YELLOW}Waiting for table $table_name to be active...${NC}"
  $AWS_CMD dynamodb wait table-exists --table-name "$table_name"
  echo -e "${GREEN}Table $table_name is now active${NC}"
}

###############################################################################
# Step 1: Create or Update Personnel Table
###############################################################################
echo -e "${BLUE}Step 1: Personnel Table${NC}"
echo "----------------------------------------"

PERSONNEL_TABLE="sitelogix-personnel"

if table_exists "$PERSONNEL_TABLE"; then
  echo -e "${YELLOW}Table $PERSONNEL_TABLE already exists${NC}"
  echo "Checking for missing GSI..."

  # Check if GSI3-StatusIndex exists
  GSI3_EXISTS=$($AWS_CMD dynamodb describe-table --table-name "$PERSONNEL_TABLE" \
    --query "Table.GlobalSecondaryIndexes[?IndexName=='GSI3-StatusIndex'].IndexName" \
    --output text)

  if [ -z "$GSI3_EXISTS" ]; then
    echo -e "${YELLOW}Adding GSI3-StatusIndex...${NC}"
    $AWS_CMD dynamodb update-table \
      --table-name "$PERSONNEL_TABLE" \
      --attribute-definitions \
        AttributeName=employment_status,AttributeType=S \
        AttributeName=last_seen_date,AttributeType=S \
      --global-secondary-index-updates '[{
        "Create": {
          "IndexName": "GSI3-StatusIndex",
          "KeySchema": [
            {"AttributeName": "employment_status", "KeyType": "HASH"},
            {"AttributeName": "last_seen_date", "KeyType": "RANGE"}
          ],
          "Projection": {"ProjectionType": "ALL"},
          "ProvisionedThroughput": {
            "ReadCapacityUnits": 5,
            "WriteCapacityUnits": 5
          }
        }
      }]'
    echo -e "${GREEN}GSI3-StatusIndex added successfully${NC}"
  else
    echo -e "${GREEN}GSI3-StatusIndex already exists${NC}"
  fi

  # Enable streams if not already enabled
  STREAM_ENABLED=$($AWS_CMD dynamodb describe-table --table-name "$PERSONNEL_TABLE" \
    --query "Table.StreamSpecification.StreamEnabled" --output text)

  if [ "$STREAM_ENABLED" != "True" ]; then
    echo -e "${YELLOW}Enabling DynamoDB Streams...${NC}"
    $AWS_CMD dynamodb update-table \
      --table-name "$PERSONNEL_TABLE" \
      --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES
    echo -e "${GREEN}Streams enabled${NC}"
  else
    echo -e "${GREEN}Streams already enabled${NC}"
  fi

else
  echo -e "${YELLOW}Creating table $PERSONNEL_TABLE...${NC}"
  $AWS_CMD dynamodb create-table \
    --cli-input-json file://"$INFRA_DIR/table-personnel-enhanced.json"
  wait_for_table "$PERSONNEL_TABLE"
  echo -e "${GREEN}Table $PERSONNEL_TABLE created successfully${NC}"
fi

echo ""

###############################################################################
# Step 2: Create Payroll Entries Table
###############################################################################
echo -e "${BLUE}Step 2: Payroll Entries Table${NC}"
echo "----------------------------------------"

PAYROLL_TABLE="sitelogix-payroll-entries"

if table_exists "$PAYROLL_TABLE"; then
  echo -e "${YELLOW}Table $PAYROLL_TABLE already exists${NC}"
  echo -e "${GREEN}Skipping creation${NC}"
else
  echo -e "${YELLOW}Creating table $PAYROLL_TABLE...${NC}"
  $AWS_CMD dynamodb create-table \
    --cli-input-json file://"$INFRA_DIR/table-payroll-entries.json"
  wait_for_table "$PAYROLL_TABLE"
  echo -e "${GREEN}Table $PAYROLL_TABLE created successfully${NC}"
fi

echo ""

###############################################################################
# Step 3: Update Reports Table with Payroll GSI
###############################################################################
echo -e "${BLUE}Step 3: Update Reports Table${NC}"
echo "----------------------------------------"

REPORTS_TABLE="sitelogix-reports"

if table_exists "$REPORTS_TABLE"; then
  echo -e "${YELLOW}Checking for GSI3-PayrollStatusIndex...${NC}"

  # Check if GSI3 exists
  GSI3_EXISTS=$($AWS_CMD dynamodb describe-table --table-name "$REPORTS_TABLE" \
    --query "Table.GlobalSecondaryIndexes[?IndexName=='GSI3-PayrollStatusIndex'].IndexName" \
    --output text)

  if [ -z "$GSI3_EXISTS" ]; then
    echo -e "${YELLOW}Adding GSI3-PayrollStatusIndex to $REPORTS_TABLE...${NC}"
    $AWS_CMD dynamodb update-table \
      --table-name "$REPORTS_TABLE" \
      --attribute-definitions \
        AttributeName=payroll_extracted,AttributeType=S \
        AttributeName=report_date,AttributeType=S \
      --global-secondary-index-updates '[{
        "Create": {
          "IndexName": "GSI3-PayrollStatusIndex",
          "KeySchema": [
            {"AttributeName": "payroll_extracted", "KeyType": "HASH"},
            {"AttributeName": "report_date", "KeyType": "RANGE"}
          ],
          "Projection": {"ProjectionType": "ALL"},
          "ProvisionedThroughput": {
            "ReadCapacityUnits": 5,
            "WriteCapacityUnits": 5
          }
        }
      }]'

    # Wait for GSI to be active
    echo -e "${YELLOW}Waiting for GSI3-PayrollStatusIndex to be active...${NC}"
    while true; do
      GSI_STATUS=$($AWS_CMD dynamodb describe-table --table-name "$REPORTS_TABLE" \
        --query "Table.GlobalSecondaryIndexes[?IndexName=='GSI3-PayrollStatusIndex'].IndexStatus" \
        --output text)

      if [ "$GSI_STATUS" = "ACTIVE" ]; then
        echo -e "${GREEN}GSI3-PayrollStatusIndex is now active${NC}"
        break
      fi

      echo -e "${YELLOW}GSI status: $GSI_STATUS (waiting...)${NC}"
      sleep 5
    done
  else
    echo -e "${GREEN}GSI3-PayrollStatusIndex already exists${NC}"
  fi

  # Enable streams if not already enabled
  STREAM_ENABLED=$($AWS_CMD dynamodb describe-table --table-name "$REPORTS_TABLE" \
    --query "Table.StreamSpecification.StreamEnabled" --output text)

  if [ "$STREAM_ENABLED" != "True" ]; then
    echo -e "${YELLOW}Enabling DynamoDB Streams on $REPORTS_TABLE...${NC}"
    $AWS_CMD dynamodb update-table \
      --table-name "$REPORTS_TABLE" \
      --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES
    echo -e "${GREEN}Streams enabled${NC}"
  else
    echo -e "${GREEN}Streams already enabled${NC}"
  fi

else
  echo -e "${RED}ERROR: Table $REPORTS_TABLE does not exist!${NC}"
  echo -e "${RED}Please create the reports table first.${NC}"
  exit 1
fi

echo ""

###############################################################################
# Step 4: Verify All Tables
###############################################################################
echo -e "${BLUE}Step 4: Verification${NC}"
echo "----------------------------------------"

echo -e "${YELLOW}Verifying all tables...${NC}"
echo ""

# Check personnel table
if table_exists "$PERSONNEL_TABLE"; then
  GSI_COUNT=$($AWS_CMD dynamodb describe-table --table-name "$PERSONNEL_TABLE" \
    --query "length(Table.GlobalSecondaryIndexes)" --output text)
  echo -e "${GREEN}✓${NC} $PERSONNEL_TABLE exists with $GSI_COUNT GSIs"
else
  echo -e "${RED}✗${NC} $PERSONNEL_TABLE does not exist"
fi

# Check payroll table
if table_exists "$PAYROLL_TABLE"; then
  GSI_COUNT=$($AWS_CMD dynamodb describe-table --table-name "$PAYROLL_TABLE" \
    --query "length(Table.GlobalSecondaryIndexes)" --output text)
  echo -e "${GREEN}✓${NC} $PAYROLL_TABLE exists with $GSI_COUNT GSIs"
else
  echo -e "${RED}✗${NC} $PAYROLL_TABLE does not exist"
fi

# Check reports table
if table_exists "$REPORTS_TABLE"; then
  GSI_COUNT=$($AWS_CMD dynamodb describe-table --table-name "$REPORTS_TABLE" \
    --query "length(Table.GlobalSecondaryIndexes)" --output text)
  echo -e "${GREEN}✓${NC} $REPORTS_TABLE exists with $GSI_COUNT GSIs"
else
  echo -e "${RED}✗${NC} $REPORTS_TABLE does not exist"
fi

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}Payroll tables setup complete!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "Next steps:"
echo "1. Review the table schemas in AWS Console"
echo "2. Load sample data: ./load-sample-payroll-data.sh"
echo "3. Implement payroll extraction service"
echo "4. Build payroll CSV export API"
echo ""
echo "Documentation: infrastructure/PAYROLL_SCHEMA_DESIGN.md"
echo ""
