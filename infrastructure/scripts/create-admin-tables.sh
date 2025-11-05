#!/bin/bash

##############################################################################
# Script: create-admin-tables.sh
# Description: Creates all admin/project management DynamoDB tables
# Author: Database Architect
# Date: 2025-11-05
##############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Function to wait for table to be active
wait_for_table() {
    local table_name=$1
    print_info "Waiting for table '$table_name' to be active..."

    aws dynamodb wait table-exists --table-name "$table_name"

    # Wait for GSIs to be active
    local gsi_count=$(aws dynamodb describe-table --table-name "$table_name" \
        --query 'Table.GlobalSecondaryIndexes | length(@)' --output text)

    if [ "$gsi_count" != "None" ] && [ "$gsi_count" -gt 0 ]; then
        print_info "Waiting for $gsi_count GSI(s) to be active..."

        while true; do
            local inactive_count=$(aws dynamodb describe-table --table-name "$table_name" \
                --query "Table.GlobalSecondaryIndexes[?IndexStatus!='ACTIVE'] | length(@)" \
                --output text)

            if [ "$inactive_count" == "0" ]; then
                break
            fi

            sleep 5
        done
    fi

    print_success "Table '$table_name' is active!"
}

# Function to check if table exists
table_exists() {
    local table_name=$1
    aws dynamodb describe-table --table-name "$table_name" &> /dev/null
    return $?
}

##############################################################################
# Main Script
##############################################################################

echo "========================================="
echo "SiteLogix Admin Tables Creation Script"
echo "========================================="
echo ""

# Check AWS credentials
print_info "Checking AWS credentials..."
aws sts get-caller-identity > /dev/null 2>&1
if [ $? -ne 0 ]; then
    print_error "AWS credentials not configured. Please run 'aws configure'."
    exit 1
fi
print_success "AWS credentials verified"
echo ""

##############################################################################
# Create Enhanced Personnel Table (v2)
##############################################################################

print_info "Creating Enhanced Personnel Table (sitelogix-personnel-v2)..."

if table_exists "sitelogix-personnel-v2"; then
    print_error "Table 'sitelogix-personnel-v2' already exists!"
    echo "Do you want to delete and recreate it? (yes/no)"
    read -r response
    if [ "$response" == "yes" ]; then
        print_info "Deleting existing table..."
        aws dynamodb delete-table --table-name sitelogix-personnel-v2
        aws dynamodb wait table-not-exists --table-name sitelogix-personnel-v2
        print_success "Table deleted"
    else
        print_info "Skipping Personnel table creation"
    fi
fi

if ! table_exists "sitelogix-personnel-v2"; then
    aws dynamodb create-table \
        --table-name sitelogix-personnel-v2 \
        --attribute-definitions \
            AttributeName=PK,AttributeType=S \
            AttributeName=SK,AttributeType=S \
            AttributeName=full_name,AttributeType=S \
            AttributeName=employee_number,AttributeType=S \
            AttributeName=team_id,AttributeType=S \
            AttributeName=role,AttributeType=S \
            AttributeName=status,AttributeType=S \
        --key-schema \
            AttributeName=PK,KeyType=HASH \
            AttributeName=SK,KeyType=RANGE \
        --global-secondary-indexes \
            "[
                {
                    \"IndexName\": \"GSI1-NameIndex\",
                    \"KeySchema\": [{\"AttributeName\":\"full_name\",\"KeyType\":\"HASH\"}],
                    \"Projection\":{\"ProjectionType\":\"ALL\"},
                    \"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}
                },
                {
                    \"IndexName\": \"GSI2-EmployeeNumberIndex\",
                    \"KeySchema\": [{\"AttributeName\":\"employee_number\",\"KeyType\":\"HASH\"}],
                    \"Projection\":{\"ProjectionType\":\"ALL\"},
                    \"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}
                },
                {
                    \"IndexName\": \"GSI3-TeamIndex\",
                    \"KeySchema\": [
                        {\"AttributeName\":\"team_id\",\"KeyType\":\"HASH\"},
                        {\"AttributeName\":\"full_name\",\"KeyType\":\"RANGE\"}
                    ],
                    \"Projection\":{\"ProjectionType\":\"ALL\"},
                    \"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}
                },
                {
                    \"IndexName\": \"GSI4-RoleStatusIndex\",
                    \"KeySchema\": [
                        {\"AttributeName\":\"role\",\"KeyType\":\"HASH\"},
                        {\"AttributeName\":\"status\",\"KeyType\":\"RANGE\"}
                    ],
                    \"Projection\":{\"ProjectionType\":\"ALL\"},
                    \"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}
                }
            ]" \
        --provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=10 \
        --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
        --sse-specification Enabled=true,SSEType=AES256 \
        --tags Key=Project,Value=SiteLogix Key=Environment,Value=Production Key=Version,Value=2.0

    wait_for_table "sitelogix-personnel-v2"

    # Enable point-in-time recovery
    aws dynamodb update-continuous-backups \
        --table-name sitelogix-personnel-v2 \
        --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

    print_success "Enhanced Personnel Table created successfully!"
fi
echo ""

##############################################################################
# Create Projects Table
##############################################################################

print_info "Creating Projects Table (sitelogix-projects)..."

if table_exists "sitelogix-projects"; then
    print_error "Table 'sitelogix-projects' already exists!"
    echo "Do you want to delete and recreate it? (yes/no)"
    read -r response
    if [ "$response" == "yes" ]; then
        print_info "Deleting existing table..."
        aws dynamodb delete-table --table-name sitelogix-projects
        aws dynamodb wait table-not-exists --table-name sitelogix-projects
        print_success "Table deleted"
    else
        print_info "Skipping Projects table creation"
    fi
fi

if ! table_exists "sitelogix-projects"; then
    aws dynamodb create-table \
        --table-name sitelogix-projects \
        --attribute-definitions \
            AttributeName=PK,AttributeType=S \
            AttributeName=SK,AttributeType=S \
            AttributeName=project_name,AttributeType=S \
            AttributeName=status,AttributeType=S \
            AttributeName=manager_id,AttributeType=S \
            AttributeName=start_date,AttributeType=S \
        --key-schema \
            AttributeName=PK,KeyType=HASH \
            AttributeName=SK,KeyType=RANGE \
        --global-secondary-indexes \
            "[
                {
                    \"IndexName\": \"GSI1-ProjectNameIndex\",
                    \"KeySchema\": [{\"AttributeName\":\"project_name\",\"KeyType\":\"HASH\"}],
                    \"Projection\":{\"ProjectionType\":\"ALL\"},
                    \"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}
                },
                {
                    \"IndexName\": \"GSI2-StatusIndex\",
                    \"KeySchema\": [
                        {\"AttributeName\":\"status\",\"KeyType\":\"HASH\"},
                        {\"AttributeName\":\"start_date\",\"KeyType\":\"RANGE\"}
                    ],
                    \"Projection\":{\"ProjectionType\":\"ALL\"},
                    \"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}
                },
                {
                    \"IndexName\": \"GSI3-ManagerIndex\",
                    \"KeySchema\": [
                        {\"AttributeName\":\"manager_id\",\"KeyType\":\"HASH\"},
                        {\"AttributeName\":\"start_date\",\"KeyType\":\"RANGE\"}
                    ],
                    \"Projection\":{\"ProjectionType\":\"ALL\"},
                    \"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}
                }
            ]" \
        --provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=10 \
        --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
        --sse-specification Enabled=true,SSEType=AES256 \
        --tags Key=Project,Value=SiteLogix Key=Environment,Value=Production

    wait_for_table "sitelogix-projects"

    # Enable point-in-time recovery
    aws dynamodb update-continuous-backups \
        --table-name sitelogix-projects \
        --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

    print_success "Projects Table created successfully!"
fi
echo ""

##############################################################################
# Create Users/Auth Table
##############################################################################

print_info "Creating Users/Auth Table (sitelogix-users)..."

if table_exists "sitelogix-users"; then
    print_error "Table 'sitelogix-users' already exists!"
    echo "Do you want to delete and recreate it? (yes/no)"
    read -r response
    if [ "$response" == "yes" ]; then
        print_info "Deleting existing table..."
        aws dynamodb delete-table --table-name sitelogix-users
        aws dynamodb wait table-not-exists --table-name sitelogix-users
        print_success "Table deleted"
    else
        print_info "Skipping Users table creation"
    fi
fi

if ! table_exists "sitelogix-users"; then
    aws dynamodb create-table \
        --table-name sitelogix-users \
        --attribute-definitions \
            AttributeName=PK,AttributeType=S \
            AttributeName=SK,AttributeType=S \
            AttributeName=username,AttributeType=S \
            AttributeName=employee_id,AttributeType=S \
            AttributeName=role,AttributeType=S \
            AttributeName=account_status,AttributeType=S \
        --key-schema \
            AttributeName=PK,KeyType=HASH \
            AttributeName=SK,KeyType=RANGE \
        --global-secondary-indexes \
            "[
                {
                    \"IndexName\": \"GSI1-UsernameIndex\",
                    \"KeySchema\": [{\"AttributeName\":\"username\",\"KeyType\":\"HASH\"}],
                    \"Projection\":{\"ProjectionType\":\"ALL\"},
                    \"ProvisionedThroughput\":{\"ReadCapacityUnits\":10,\"WriteCapacityUnits\":5}
                },
                {
                    \"IndexName\": \"GSI2-EmployeeIndex\",
                    \"KeySchema\": [{\"AttributeName\":\"employee_id\",\"KeyType\":\"HASH\"}],
                    \"Projection\":{\"ProjectionType\":\"ALL\"},
                    \"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}
                },
                {
                    \"IndexName\": \"GSI3-RoleStatusIndex\",
                    \"KeySchema\": [
                        {\"AttributeName\":\"role\",\"KeyType\":\"HASH\"},
                        {\"AttributeName\":\"account_status\",\"KeyType\":\"RANGE\"}
                    ],
                    \"Projection\":{\"ProjectionType\":\"ALL\"},
                    \"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}
                }
            ]" \
        --provisioned-throughput ReadCapacityUnits=15,WriteCapacityUnits=10 \
        --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
        --sse-specification Enabled=true,SSEType=AES256 \
        --tags Key=Project,Value=SiteLogix Key=Environment,Value=Production Key=Sensitive,Value=true

    wait_for_table "sitelogix-users"

    # Enable point-in-time recovery (critical for auth table)
    aws dynamodb update-continuous-backups \
        --table-name sitelogix-users \
        --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

    print_success "Users/Auth Table created successfully!"
fi
echo ""

##############################################################################
# Create Time Tracking Table
##############################################################################

print_info "Creating Time Tracking Table (sitelogix-time-tracking)..."

if table_exists "sitelogix-time-tracking"; then
    print_error "Table 'sitelogix-time-tracking' already exists!"
    echo "Do you want to delete and recreate it? (yes/no)"
    read -r response
    if [ "$response" == "yes" ]; then
        print_info "Deleting existing table..."
        aws dynamodb delete-table --table-name sitelogix-time-tracking
        aws dynamodb wait table-not-exists --table-name sitelogix-time-tracking
        print_success "Table deleted"
    else
        print_info "Skipping Time Tracking table creation"
    fi
fi

if ! table_exists "sitelogix-time-tracking"; then
    aws dynamodb create-table \
        --table-name sitelogix-time-tracking \
        --attribute-definitions \
            AttributeName=PK,AttributeType=S \
            AttributeName=SK,AttributeType=S \
            AttributeName=project_id,AttributeType=S \
            AttributeName=date,AttributeType=S \
            AttributeName=week_number,AttributeType=S \
            AttributeName=month,AttributeType=S \
        --key-schema \
            AttributeName=PK,KeyType=HASH \
            AttributeName=SK,KeyType=RANGE \
        --global-secondary-indexes \
            "[
                {
                    \"IndexName\": \"GSI1-ProjectDateIndex\",
                    \"KeySchema\": [
                        {\"AttributeName\":\"project_id\",\"KeyType\":\"HASH\"},
                        {\"AttributeName\":\"date\",\"KeyType\":\"RANGE\"}
                    ],
                    \"Projection\":{\"ProjectionType\":\"ALL\"},
                    \"ProvisionedThroughput\":{\"ReadCapacityUnits\":10,\"WriteCapacityUnits\":10}
                },
                {
                    \"IndexName\": \"GSI2-WeekIndex\",
                    \"KeySchema\": [
                        {\"AttributeName\":\"week_number\",\"KeyType\":\"HASH\"},
                        {\"AttributeName\":\"PK\",\"KeyType\":\"RANGE\"}
                    ],
                    \"Projection\":{\"ProjectionType\":\"ALL\"},
                    \"ProvisionedThroughput\":{\"ReadCapacityUnits\":10,\"WriteCapacityUnits\":10}
                },
                {
                    \"IndexName\": \"GSI3-MonthIndex\",
                    \"KeySchema\": [
                        {\"AttributeName\":\"month\",\"KeyType\":\"HASH\"},
                        {\"AttributeName\":\"PK\",\"KeyType\":\"RANGE\"}
                    ],
                    \"Projection\":{\"ProjectionType\":\"ALL\"},
                    \"ProvisionedThroughput\":{\"ReadCapacityUnits\":10,\"WriteCapacityUnits\":10}
                }
            ]" \
        --provisioned-throughput ReadCapacityUnits=20,WriteCapacityUnits=20 \
        --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
        --sse-specification Enabled=true,SSEType=AES256 \
        --tags Key=Project,Value=SiteLogix Key=Environment,Value=Production

    wait_for_table "sitelogix-time-tracking"

    # Enable point-in-time recovery
    aws dynamodb update-continuous-backups \
        --table-name sitelogix-time-tracking \
        --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

    print_success "Time Tracking Table created successfully!"
fi
echo ""

##############################################################################
# Summary
##############################################################################

echo "========================================="
echo "Table Creation Summary"
echo "========================================="
echo ""

# List all created tables
print_info "Listing all SiteLogix tables:"
aws dynamodb list-tables --query 'TableNames[?contains(@, `sitelogix`)]' --output table

echo ""
print_success "All admin tables created successfully!"
echo ""
print_info "Next steps:"
echo "  1. Review table configurations with: aws dynamodb describe-table --table-name <TABLE_NAME>"
echo "  2. Load sample data with: node scripts/load-sample-data.js"
echo "  3. Test access patterns with: node scripts/test-access-patterns.js"
echo "  4. Begin migration from v1 to v2: see infrastructure/migration-plan.md"
echo ""
