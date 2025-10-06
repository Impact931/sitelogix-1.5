#!/bin/bash

# Configure CORS for SiteLogix S3 Buckets
# This allows the frontend to upload directly to S3

set -e

AUDIO_BUCKET="sitelogix-audio-files-prod"
TRANSCRIPTS_BUCKET="sitelogix-transcripts-prod"

# CORS configuration JSON
CORS_CONFIG='{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}'

echo "Configuring CORS for $AUDIO_BUCKET..."
aws s3api put-bucket-cors \
  --bucket "$AUDIO_BUCKET" \
  --cors-configuration "$CORS_CONFIG"

echo "Configuring CORS for $TRANSCRIPTS_BUCKET..."
aws s3api put-bucket-cors \
  --bucket "$TRANSCRIPTS_BUCKET" \
  --cors-configuration "$CORS_CONFIG"

echo "CORS configuration complete!"
echo ""
echo "Verifying CORS configuration for $AUDIO_BUCKET:"
aws s3api get-bucket-cors --bucket "$AUDIO_BUCKET"

echo ""
echo "Verifying CORS configuration for $TRANSCRIPTS_BUCKET:"
aws s3api get-bucket-cors --bucket "$TRANSCRIPTS_BUCKET"
