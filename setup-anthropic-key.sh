#!/bin/bash

# Setup Anthropic API Key in AWS Secrets Manager
# This stores the API key securely for Lambda function access

set -e

echo "================================================"
echo "🔐 Anthropic API Key Setup"
echo "================================================"
echo ""

# Check if secret already exists
if aws secretsmanager describe-secret --secret-id sitelogix/anthropic --region us-east-1 &> /dev/null; then
    echo "✅ Secret 'sitelogix/anthropic' already exists"
    echo ""
    read -p "Do you want to update it? (y/n): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping update"
        exit 0
    fi
fi

echo "Please enter your Anthropic API key:"
read -s API_KEY

if [ -z "$API_KEY" ]; then
    echo "❌ API key cannot be empty"
    exit 1
fi

echo ""
echo "Creating/updating secret in AWS Secrets Manager..."

# Create or update the secret
if aws secretsmanager describe-secret --secret-id sitelogix/anthropic --region us-east-1 &> /dev/null; then
    # Update existing secret
    aws secretsmanager update-secret \
        --secret-id sitelogix/anthropic \
        --secret-string "{\"api_key\":\"$API_KEY\"}" \
        --region us-east-1 \
        > /dev/null

    echo "✅ Secret updated successfully"
else
    # Create new secret
    aws secretsmanager create-secret \
        --name sitelogix/anthropic \
        --description "Anthropic API key for Roxy AI extraction" \
        --secret-string "{\"api_key\":\"$API_KEY\"}" \
        --region us-east-1 \
        > /dev/null

    echo "✅ Secret created successfully"
fi

echo ""
echo "================================================"
echo "✅ Setup Complete!"
echo "================================================"
echo ""
echo "The Anthropic API key has been securely stored in AWS Secrets Manager."
echo "The Lambda function will now be able to access it for Roxy AI extraction."
echo ""
echo "Next step: Run the extraction pipeline"
echo "  curl -X POST https://6f10uv7ne0.execute-api.us-east-1.amazonaws.com/api/extract/batch \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"limit\": 10}'"
echo ""
