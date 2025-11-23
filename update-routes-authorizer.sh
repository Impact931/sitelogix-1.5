#!/bin/bash

# API Gateway configuration
API_ID="6f10uv7ne0"
AUTHORIZER_ID="bpbjcs"
REGION="us-east-1"

# Public routes (no authorization required)
PUBLIC_ROUTES=(
  "POST /api/auth/login"
  "POST /api/auth/register"
  "GET /api/health"
)

# Get all routes
ROUTES=$(aws apigatewayv2 get-routes --api-id $API_ID --region $REGION --query 'Items[*].[RouteId,RouteKey]' --output text)

echo "Updating routes to use Cognito authorizer..."
echo ""

# Process each route
while IFS=$'\t' read -r ROUTE_ID ROUTE_KEY; do
  # Check if route is in public routes list
  IS_PUBLIC=false
  for PUBLIC_ROUTE in "${PUBLIC_ROUTES[@]}"; do
    if [ "$ROUTE_KEY" = "$PUBLIC_ROUTE" ]; then
      IS_PUBLIC=true
      echo "Skipping public route: $ROUTE_KEY"
      break
    fi
  done

  # Update route if not public
  if [ "$IS_PUBLIC" = false ]; then
    echo "Updating route: $ROUTE_KEY"
    aws apigatewayv2 update-route \
      --api-id $API_ID \
      --route-id $ROUTE_ID \
      --authorizer-id $AUTHORIZER_ID \
      --authorization-type JWT \
      --region $REGION \
      --output text \
      --query 'RouteKey' > /dev/null 2>&1

    if [ $? -eq 0 ]; then
      echo "  ✓ Updated successfully"
    else
      echo "  ✗ Failed to update"
    fi
  fi
  echo ""
done <<< "$ROUTES"

echo "Route update complete!"
