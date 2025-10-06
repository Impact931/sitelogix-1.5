#!/bin/bash
set -e

echo "Creating DynamoDB tables from JSON schemas..."
cd /Users/jhrstudio/Documents/GitHub/sitelogix-1.5/infrastructure

# Simpler approach - create tables without GSIs first, then add them
echo "Creating sitelogix-reports table..."
aws dynamodb create-table --cli-input-json file://table-reports.json --region us-east-1 2>&1 || echo "Table may exist"

echo "Creating sitelogix-personnel table..."
aws dynamodb create-table --cli-input-json file://table-personnel.json --region us-east-1 2>&1 || echo "Table may exist"

echo "Creating sitelogix-vendors table..."
aws dynamodb create-table --cli-input-json file://table-vendors.json --region us-east-1 2>&1 || echo "Table may exist"

echo "Creating sitelogix-constraints table..."
aws dynamodb create-table --cli-input-json file://table-constraints.json --region us-east-1 2>&1 || echo "Table may exist"

echo "✅ DynamoDB table creation initiated!"
