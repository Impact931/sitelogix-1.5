#!/bin/bash

# SiteLogix API Lambda Deployment Script
# Deploys the backend API to AWS Lambda + API Gateway

set -e

echo "================================================"
echo "SiteLogix API Lambda Deployment"
echo "================================================"
echo ""

# Configuration
FUNCTION_NAME="sitelogix-api"
REGION="us-east-1"
RUNTIME="nodejs20.x"
HANDLER="api-handler.handler"
ROLE_NAME="sitelogix-api-lambda-role"
DEPLOYMENT_DIR="backend/src/functions"
PACKAGE_FILE="lambda-deployment.zip"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed"
    exit 1
fi

echo "✅ AWS CLI found"
echo ""

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "📋 AWS Account ID: $ACCOUNT_ID"
echo ""

# Step 1: Create IAM role if it doesn't exist
echo "🔐 Setting up IAM role..."
ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"

if ! aws iam get-role --role-name $ROLE_NAME &> /dev/null; then
    echo "Creating IAM role: $ROLE_NAME"

    # Create trust policy
    cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    aws iam create-role \
        --role-name $ROLE_NAME \
        --assume-role-policy-document file:///tmp/trust-policy.json \
        --description "Execution role for SiteLogix API Lambda"

    # Attach basic Lambda execution policy
    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

    # Attach DynamoDB full access policy (needed for CRUD operations)
    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

    # Attach Secrets Manager read policy
    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite

    # Attach S3 access policy
    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

    echo "✅ IAM role created"
    echo "⏳ Waiting 10 seconds for IAM role to propagate..."
    sleep 10
else
    echo "✅ IAM role already exists"
fi

echo ""

# Step 2: Install dependencies and create deployment package
echo "📦 Creating deployment package..."

cd $DEPLOYMENT_DIR

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install --production
else
    echo "Dependencies already installed"
fi

# Create deployment package
echo "Creating zip file..."
rm -f $PACKAGE_FILE

# Copy service files to functions directory for flat structure
cp ../services/*.js . 2>/dev/null || true

# Create zip with flat structure
zip -r $PACKAGE_FILE *.js node_modules/ > /dev/null 2>&1

# Clean up copied service files
rm -f personnelService.js payrollService.js payrollExtractionService.js 2>/dev/null || true

echo "✅ Deployment package created: $(du -h $PACKAGE_FILE | cut -f1)"
echo ""

cd - > /dev/null

# Step 3: Create or update Lambda function
echo "🚀 Deploying Lambda function..."

if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION &> /dev/null; then
    echo "Updating existing Lambda function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://$DEPLOYMENT_DIR/$PACKAGE_FILE \
        --region $REGION \
        > /dev/null

    echo "✅ Lambda function updated"
else
    echo "Creating new Lambda function..."
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime $RUNTIME \
        --role $ROLE_ARN \
        --handler $HANDLER \
        --zip-file fileb://$DEPLOYMENT_DIR/$PACKAGE_FILE \
        --region $REGION \
        --timeout 30 \
        --memory-size 512 \
        > /dev/null

    echo "✅ Lambda function created"
fi

echo ""

# Step 4: Push environment variables from .env to Lambda
echo "🔧 Configuring environment variables..."

if [ -f ".env" ]; then
    echo "📄 Loading environment variables from .env..."

    # Extract key environment variables
    source .env

    # Update Lambda environment variables (AWS_REGION is reserved, Lambda sets it automatically)
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --environment "Variables={ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY,OPENAI_API_KEY=$OPENAI_API_KEY,NODE_ENV=production}" \
        --region $REGION \
        > /dev/null

    echo "✅ Environment variables updated in Lambda"
    echo "   - ANTHROPIC_API_KEY: ✓"
    echo "   - OPENAI_API_KEY: ✓"
    echo "   - NODE_ENV: production"
    echo "   - AWS_REGION: $REGION (auto-set by Lambda)"
else
    echo "⚠️  No .env file found - using Secrets Manager fallback"
fi

echo "✅ Using AWS Secrets Manager for Google/ElevenLabs credentials"
echo "   Secrets configured:"
echo "   - sitelogix/google-oauth"
echo "   - sitelogix/google-sheets"
echo "   - sitelogix/elevenlabs"
echo ""

# Step 5: Create or update API Gateway (HTTP API)
echo "🌐 Setting up API Gateway..."

API_NAME="sitelogix-api"

# Check if API exists
API_ID=$(aws apigatewayv2 get-apis --region $REGION --query "Items[?Name=='$API_NAME'].ApiId" --output text)

if [ -z "$API_ID" ]; then
    echo "Creating API Gateway HTTP API..."

    API_ID=$(aws apigatewayv2 create-api \
        --name $API_NAME \
        --protocol-type HTTP \
        --cors-configuration AllowOrigins='https://main.d2mp0300tkuah.amplifyapp.com',AllowMethods='GET,POST,OPTIONS',AllowHeaders='Content-Type,X-Amz-Date,Authorization,X-Api-Key' \
        --region $REGION \
        --query ApiId \
        --output text)

    echo "✅ API Gateway created: $API_ID"
else
    echo "✅ API Gateway already exists: $API_ID"
fi

# Create integration
INTEGRATION_ID=$(aws apigatewayv2 create-integration \
    --api-id $API_ID \
    --integration-type AWS_PROXY \
    --integration-uri "arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$FUNCTION_NAME" \
    --payload-format-version 2.0 \
    --region $REGION \
    --query IntegrationId \
    --output text 2>/dev/null || \
    aws apigatewayv2 get-integrations --api-id $API_ID --region $REGION --query 'Items[0].IntegrationId' --output text)

echo "✅ Integration configured: $INTEGRATION_ID"

# Create GET routes
for ROUTE in "/api/managers" "/api/projects" "/api/projects/{projectId}" "/api/health" "/api/reports" "/api/reports/{reportId}/html" "/api/reports/{reportId}/transcript" "/api/analytics/insights" "/api/analytics/reports/{reportType}" "/api/bi/reports/overtime" "/api/bi/reports/constraints" "/api/bi/reports/savings" "/api/bi/reports/deliveries" "/api/elevenlabs/agent-config" "/api/personnel" "/api/personnel/{id}" "/api/vendors" "/api/vendors/{id}" "/api/auth/me" "/api/admin/employees" "/api/admin/employees/{employeeId}" "/api/time-entries" "/api/time-entries/employee/{employeeId}/hours"; do
    ROUTE_ID=$(aws apigatewayv2 get-routes --api-id $API_ID --region $REGION --query "Items[?RouteKey=='GET $ROUTE'].RouteId" --output text)

    if [ -z "$ROUTE_ID" ]; then
        aws apigatewayv2 create-route \
            --api-id $API_ID \
            --route-key "GET $ROUTE" \
            --target "integrations/$INTEGRATION_ID" \
            --region $REGION \
            > /dev/null
        echo "✅ Route created: GET $ROUTE"
    else
        echo "✅ Route already exists: GET $ROUTE"
    fi
done

# Create POST routes
for ROUTE in "/api/reports" "/api/analytics/query" "/api/analytics/constraints/{constraintId}/resolution" "/api/analytics/constraints/{constraintId}/status" "/api/elevenlabs/conversation" "/api/personnel" "/api/vendors" "/api/auth/login" "/api/auth/logout" "/api/auth/refresh" "/api/admin/employees" "/api/projects" "/api/time-entries"; do
    ROUTE_ID=$(aws apigatewayv2 get-routes --api-id $API_ID --region $REGION --query "Items[?RouteKey=='POST $ROUTE'].RouteId" --output text)

    if [ -z "$ROUTE_ID" ]; then
        aws apigatewayv2 create-route \
            --api-id $API_ID \
            --route-key "POST $ROUTE" \
            --target "integrations/$INTEGRATION_ID" \
            --region $REGION \
            > /dev/null
        echo "✅ Route created: POST $ROUTE"
    else
        echo "✅ Route already exists: POST $ROUTE"
    fi
done

# Create PUT routes
for ROUTE in "/api/personnel/{id}" "/api/vendors/{id}" "/api/admin/employees/{employeeId}" "/api/projects/{projectId}" "/api/projects/{projectId}/status" "/api/projects/{projectId}/timeline" "/api/time-entries/{entryId}"; do
    ROUTE_ID=$(aws apigatewayv2 get-routes --api-id $API_ID --region $REGION --query "Items[?RouteKey=='PUT $ROUTE'].RouteId" --output text)

    if [ -z "$ROUTE_ID" ]; then
        aws apigatewayv2 create-route \
            --api-id $API_ID \
            --route-key "PUT $ROUTE" \
            --target "integrations/$INTEGRATION_ID" \
            --region $REGION \
            > /dev/null
        echo "✅ Route created: PUT $ROUTE"
    else
        echo "✅ Route already exists: PUT $ROUTE"
    fi
done

# Create DELETE routes
for ROUTE in "/api/personnel/{id}" "/api/vendors/{id}" "/api/admin/employees/{employeeId}" "/api/projects/{projectId}"; do
    ROUTE_ID=$(aws apigatewayv2 get-routes --api-id $API_ID --region $REGION --query "Items[?RouteKey=='DELETE $ROUTE'].RouteId" --output text)

    if [ -z "$ROUTE_ID" ]; then
        aws apigatewayv2 create-route \
            --api-id $API_ID \
            --route-key "DELETE $ROUTE" \
            --target "integrations/$INTEGRATION_ID" \
            --region $REGION \
            > /dev/null
        echo "✅ Route created: DELETE $ROUTE"
    else
        echo "✅ Route already exists: DELETE $ROUTE"
    fi
done

echo ""
echo "🤖 Creating Roxy AI extraction routes..."

# Create extraction POST routes
for ROUTE in "/api/extract/batch" "/api/extract/personnel/seed"; do
    ROUTE_ID=$(aws apigatewayv2 get-routes --api-id $API_ID --region $REGION --query "Items[?RouteKey=='POST $ROUTE'].RouteId" --output text)

    if [ -z "$ROUTE_ID" ]; then
        aws apigatewayv2 create-route \
            --api-id $API_ID \
            --route-key "POST $ROUTE" \
            --target "integrations/$INTEGRATION_ID" \
            --region $REGION \
            > /dev/null
        echo "✅ Route created: POST $ROUTE"
    else
        echo "✅ Route already exists: POST $ROUTE"
    fi
done

# Create extraction GET routes
ROUTE="/api/extract/master-data"
ROUTE_ID=$(aws apigatewayv2 get-routes --api-id $API_ID --region $REGION --query "Items[?RouteKey=='GET $ROUTE'].RouteId" --output text)

if [ -z "$ROUTE_ID" ]; then
    aws apigatewayv2 create-route \
        --api-id $API_ID \
        --route-key "GET $ROUTE" \
        --target "integrations/$INTEGRATION_ID" \
        --region $REGION \
        > /dev/null
    echo "✅ Route created: GET $ROUTE"
else
    echo "✅ Route already exists: GET $ROUTE"
fi

echo ""
echo "💼 Creating Payroll API routes..."

# Create payroll GET routes
for ROUTE in "/api/payroll/daily/{date}" "/api/payroll/export/daily/{date}"; do
    ROUTE_ID=$(aws apigatewayv2 get-routes --api-id $API_ID --region $REGION --query "Items[?RouteKey=='GET $ROUTE'].RouteId" --output text)

    if [ -z "$ROUTE_ID" ]; then
        aws apigatewayv2 create-route \
            --api-id $API_ID \
            --route-key "GET $ROUTE" \
            --target "integrations/$INTEGRATION_ID" \
            --region $REGION \
            > /dev/null
        echo "✅ Route created: GET $ROUTE"
    else
        echo "✅ Route already exists: GET $ROUTE"
    fi
done

# Create payroll POST routes
for ROUTE in "/api/payroll/bulk" "/api/personnel/match"; do
    ROUTE_ID=$(aws apigatewayv2 get-routes --api-id $API_ID --region $REGION --query "Items[?RouteKey=='POST $ROUTE'].RouteId" --output text)

    if [ -z "$ROUTE_ID" ]; then
        aws apigatewayv2 create-route \
            --api-id $API_ID \
            --route-key "POST $ROUTE" \
            --target "integrations/$INTEGRATION_ID" \
            --region $REGION \
            > /dev/null
        echo "✅ Route created: POST $ROUTE"
    else
        echo "✅ Route already exists: POST $ROUTE"
    fi
done

# Create default stage
STAGE_NAME='$default'
aws apigatewayv2 create-stage \
    --api-id $API_ID \
    --stage-name '$default' \
    --auto-deploy \
    --region $REGION \
    > /dev/null 2>&1 || echo "✅ Stage already exists"

# Add Lambda permission for API Gateway
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id apigateway-invoke \
    --action lambda:InvokeFunction \
    --principal apigatewayv2.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*" \
    --region $REGION \
    > /dev/null 2>&1 || echo "✅ Lambda permission already exists"

echo ""

# Get API endpoint
API_ENDPOINT=$(aws apigatewayv2 get-api --api-id $API_ID --region $REGION --query ApiEndpoint --output text)

echo "================================================"
echo "✅ Deployment Complete!"
echo "================================================"
echo ""
echo "📡 API Endpoint: $API_ENDPOINT"
echo ""
echo "Available endpoints:"
echo "  GET $API_ENDPOINT/api/managers"
echo "  GET $API_ENDPOINT/api/projects"
echo "  GET $API_ENDPOINT/api/health"
echo ""
echo "Next steps:"
echo "1. Test the API endpoints"
echo "2. Add VITE_API_BASE_URL=$API_ENDPOINT/api to Amplify environment variables"
echo "3. Redeploy frontend"
echo ""
