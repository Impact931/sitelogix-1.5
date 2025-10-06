#!/bin/bash
set -e

echo "Creating DynamoDB tables for SiteLogix..."

# Create reports table
echo "Creating sitelogix-reports table..."
aws dynamodb create-table \
  --table-name sitelogix-reports \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=project_id,AttributeType=S \
    AttributeName=manager_id,AttributeType=S \
    AttributeName=report_date,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=GSI1-ProjectIndex,KeySchema=[{AttributeName=project_id,KeyType=HASH},{AttributeName=report_date,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
    IndexName=GSI2-ManagerIndex,KeySchema=[{AttributeName=manager_id,KeyType=HASH},{AttributeName=report_date,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PROVISIONED \
  --provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=10 \
  --sse-specification Enabled=true \
  --tags Key=Project,Value=SiteLogix Key=Environment,Value=Production \
  --region us-east-1 || echo "Table may already exist"

echo "Waiting for reports table to be active..."
aws dynamodb wait table-exists --table-name sitelogix-reports --region us-east-1

# Create personnel table
echo "Creating sitelogix-personnel table..."
aws dynamodb create-table \
  --table-name sitelogix-personnel \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=full_name,AttributeType=S \
    AttributeName=project_id,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=GSI1-NameIndex,KeySchema=[{AttributeName=full_name,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
    IndexName=GSI2-ProjectIndex,KeySchema=[{AttributeName=project_id,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PROVISIONED \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --sse-specification Enabled=true \
  --tags Key=Project,Value=SiteLogix Key=Environment,Value=Production \
  --region us-east-1 || echo "Table may already exist"

echo "Waiting for personnel table to be active..."
aws dynamodb wait table-exists --table-name sitelogix-personnel --region us-east-1

# Create vendors table
echo "Creating sitelogix-vendors table..."
aws dynamodb create-table \
  --table-name sitelogix-vendors \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=company_name,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=GSI1-CompanyIndex,KeySchema=[{AttributeName=company_name,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PROVISIONED \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --sse-specification Enabled=true \
  --tags Key=Project,Value=SiteLogix Key=Environment,Value=Production \
  --region us-east-1 || echo "Table may already exist"

echo "Waiting for vendors table to be active..."
aws dynamodb wait table-exists --table-name sitelogix-vendors --region us-east-1

# Create constraints table
echo "Creating sitelogix-constraints table..."
aws dynamodb create-table \
  --table-name sitelogix-constraints \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=category,AttributeType=S \
    AttributeName=project_id,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=GSI1-CategoryIndex,KeySchema=[{AttributeName=category,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
    IndexName=GSI2-ProjectIndex,KeySchema=[{AttributeName=project_id,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PROVISIONED \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --sse-specification Enabled=true \
  --tags Key=Project,Value=SiteLogix Key=Environment,Value=Production \
  --region us-east-1 || echo "Table may already exist"

echo "Waiting for constraints table to be active..."
aws dynamodb wait table-exists --table-name sitelogix-constraints --region us-east-1

echo "✅ All DynamoDB tables created successfully!"
echo ""
echo "Created tables:"
echo "  - sitelogix-reports"
echo "  - sitelogix-personnel"
echo "  - sitelogix-vendors"
echo "  - sitelogix-constraints"
