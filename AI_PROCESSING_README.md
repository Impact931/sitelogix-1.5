# SiteLogix AI Processing System - Complete Guide

## 🎯 Overview

The SiteLogix AI Processing System automatically extracts structured data from voice conversation transcripts and generates formatted construction daily reports. It uses Claude 3.5 Sonnet (or GPT-4) to analyze natural conversations and populate both DynamoDB and Google Sheets.

---

## 📊 What It Does

```
Voice Conversation with Roxy (ElevenLabs)
         ↓
  Audio + Transcript saved to S3/DynamoDB
         ↓
  AI Analysis (Claude 3.5 Sonnet / GPT-4)
         ↓
  Extract structured data:
  - Personnel (with deduplication)
  - Work activities by team
  - Constraints and issues
  - Vendor deliveries
         ↓
  Save to DynamoDB with relationships
         ↓
  Generate Daily Report:
  - Google Sheets (Parkway format)
  - PDF Report (future)
```

---

## 🏗️ Architecture Components

### 1. **AI Transcript Analysis Service**
- **File**: `backend/src/services/transcriptAnalysisService.ts`
- **Purpose**: Extract structured data from natural conversation
- **Models**: Claude 3.5 Sonnet (primary), GPT-4 Turbo (fallback)
- **Extracts**:
  - Personnel information
  - Work logs by team/level
  - Constraints and issues
  - Vendor deliveries
  - Time summaries

### 2. **Personnel Deduplication Service**
- **File**: `backend/src/services/personnelDeduplicationService.ts`
- **Purpose**: Prevent duplicate employee records
- **Features**:
  - Fuzzy name matching (Levenshtein distance)
  - Nickname tracking
  - Position history
  - Hours aggregation over time

### 3. **Vendor Deduplication Service**
- **File**: `backend/src/services/vendorDeduplicationService.ts`
- **Purpose**: Prevent duplicate vendor/supplier records
- **Features**:
  - Company name normalization
  - Variation tracking
  - Delivery history

### 4. **Google Sheets Integration**
- **File**: `backend/src/services/googleSheetsService.ts`
- **Purpose**: Write formatted reports to Google Sheets
- **Auth**: OAuth 2.0 (user authorization)
- **Features**:
  - Auto-create sheets by date
  - Apply Parkway Construction formatting
  - Personnel table
  - Tasks by team
  - Constraints by level

### 5. **Report Processing Orchestrator**
- **File**: `backend/src/services/reportProcessingService.ts`
- **Purpose**: Coordinate entire pipeline
- **Steps**:
  1. Fetch report from DynamoDB
  2. Get transcript from S3
  3. Analyze with AI
  4. Deduplicate personnel
  5. Deduplicate vendors
  6. Store work logs
  7. Store constraints
  8. Generate Google Sheets report
  9. Update report status

### 6. **Lambda Function**
- **File**: `backend/src/functions/process-report.ts`
- **Trigger**: Invoked after report is saved
- **Input**: `{ reportId, googleSheetsUrl }`
- **Output**: Processed report in database + Google Sheets

---

## 🗄️ Database Schema

### Enhanced Tables

1. **sitelogix-reports** (Main reports table)
   - Stores raw transcript text for AI re-analysis
   - Status tracking: `pending_analysis` → `analyzed` → `published`
   - AI processing metadata

2. **sitelogix-personnel** (Master employee registry)
   - Deduplicated personnel profiles
   - Nickname variations
   - Employment history (PK: PERSON#{id}, SK: HISTORY#{reportId})

3. **sitelogix-vendors** (Vendor/supplier registry)
   - Deduplicated vendor profiles
   - Company name variations
   - Delivery history (PK: VENDOR#{id}, SK: DELIVERY#{reportId})

4. **sitelogix-work-logs** (Daily work activities)
   - Team-based work tracking
   - Hours by level/area

5. **sitelogix-constraints** (Issues and delays)
   - Categorized by type and severity
   - Building level tracking
   - Status tracking (open/in_progress/resolved)

6. **sitelogix-ai-analysis-cache** (AI processing cache)
   - Stores AI-generated extractions
   - Model version tracking
   - Re-analysis flags

---

## 🚀 Setup Instructions

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

This installs:
- `@anthropic-ai/sdk` - Claude API
- `openai` - GPT-4 API
- `googleapis` - Google Sheets API
- `uuid` - ID generation
- AWS SDK packages

### Step 2: Set Up Google OAuth

Follow the detailed guide in `GOOGLE_OAUTH_SETUP.md`:

1. Create Google Cloud Project
2. Enable Google Sheets API + Drive API
3. Configure OAuth consent screen
4. Create OAuth 2.0 credentials
5. Get refresh token
6. Add to environment variables

### Step 3: Configure Environment Variables

Create/update `.env`:

```env
# AI Services
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...

# Google OAuth 2.0
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123...
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
GOOGLE_REFRESH_TOKEN=1//abc123...

# Google Sheets
GOOGLE_SHEETS_URL=https://docs.google.com/spreadsheets/d/1lb8nmFjvKdWmoqSLaowEKWEzGzNUPw7CuTTZ7k1FIg4/edit

# DynamoDB Tables
REPORTS_TABLE=sitelogix-reports
PERSONNEL_TABLE=sitelogix-personnel
VENDORS_TABLE=sitelogix-vendors
WORK_LOGS_TABLE=sitelogix-work-logs
CONSTRAINTS_TABLE=sitelogix-constraints
AI_CACHE_TABLE=sitelogix-ai-analysis-cache

# S3
VITE_S3_BUCKET=sitelogix-prod

# AWS Region
AWS_REGION=us-east-1
```

### Step 4: Deploy Enhanced Database Schema

```bash
cd infrastructure

# Create new tables
aws dynamodb create-table --cli-input-json file://dynamodb-schemas-enhanced.json
```

Or update the create script:

```bash
./scripts/create-dynamodb-tables.sh
```

### Step 5: Deploy Lambda Function

Update `serverless.yml` or CDK to include the new function:

```yaml
functions:
  processReport:
    handler: src/functions/process-report.handler
    timeout: 300  # 5 minutes
    memorySize: 1024
    environment:
      ANTHROPIC_API_KEY: ${env:ANTHROPIC_API_KEY}
      OPENAI_API_KEY: ${env:OPENAI_API_KEY}
      GOOGLE_CLIENT_ID: ${env:GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${env:GOOGLE_CLIENT_SECRET}
      GOOGLE_REDIRECT_URI: ${env:GOOGLE_REDIRECT_URI}
      GOOGLE_REFRESH_TOKEN: ${env:GOOGLE_REFRESH_TOKEN}
      GOOGLE_SHEETS_URL: ${env:GOOGLE_SHEETS_URL}
    events:
      - eventBridge:
          pattern:
            source:
              - custom.sitelogix
            detail-type:
              - ReportCreated
```

---

## 🧪 Testing

### Test with Sample Report

Create `test-processing.ts`:

```typescript
import { initializeTranscriptAnalysisService } from './backend/src/services/transcriptAnalysisService';
import { initializeGoogleSheetsService } from './backend/src/services/googleSheetsService';
import { getReportProcessingService } from './backend/src/services/reportProcessingService';

async function testProcessing() {
  // Initialize services
  initializeTranscriptAnalysisService({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    preferredModel: 'claude'
  });

  initializeGoogleSheetsService({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI!,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN!
  });

  // Process a report
  const processingService = getReportProcessingService();
  await processingService.processReport(
    'rpt_20251030_mgr_002_1730318400',
    process.env.GOOGLE_SHEETS_URL
  );
}

testProcessing().catch(console.error);
```

Run:
```bash
npx ts-node test-processing.ts
```

### Expected Output

```
================================================================================
🚀 Starting AI processing for report: rpt_20251030_mgr_002_1730318400
================================================================================
📄 Fetching report from DynamoDB...
📥 Fetching transcript from S3...
🤖 Analyzing transcript with Claude 3.5 Sonnet...
✅ Transcript analysis complete:
   - Personnel: 14
   - Work Logs: 5
   - Constraints: 1
   - Vendors: 0
💾 Saving AI analysis to cache...
👥 Processing personnel with deduplication...
✨ Created new person: Aaron Trask (person_abc123)
✨ Created new person: Corey Birchfield (person_def456)
🔄 Updated person: Roger Brake (person_xyz789)
...
🏢 Processing vendors with deduplication...
📝 Storing work logs...
⚠️  Storing constraints...
📊 Generating Google Sheets report...
✅ Updating report status to "analyzed"...
================================================================================
✅ Report processing complete!
================================================================================
Personnel processed: 14
Work logs created: 5
Constraints identified: 1
Vendors tracked: 0
================================================================================
```

---

## 💰 Cost Estimation

### Per Report Processing

**AI Analysis (Claude 3.5 Sonnet)**:
- Average transcript: ~5,000 input tokens
- Extraction output: ~2,000 tokens
- Cost: ~$0.015 per report

**AI Analysis (GPT-4 Turbo)**:
- Same token counts
- Cost: ~$0.07 per report

**Google Sheets API**:
- Free tier: 100 requests per 100 seconds
- Typical report: 5-10 API calls
- Cost: $0 (within free tier)

**DynamoDB**:
- Write requests: ~20 per report
- Read requests: ~5 per report
- Cost: ~$0.001 per report

**S3**:
- Storage: ~1 MB per report (audio + transcript)
- Cost: ~$0.00002 per report

**Total per report**: ~$0.02 - $0.08 depending on AI model used

**Recommendations**:
- Use Claude 3.5 Sonnet for production (faster, cheaper, better extraction)
- Cache AI results to avoid re-processing
- Use GPT-4 only for complex/ambiguous transcripts

---

## 🔒 Security

### Secrets Management

**Development**: Use `.env` file (NOT committed to git)

**Production**: Use AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name sitelogix/ai-processing \
  --secret-string '{
    "anthropicApiKey": "sk-ant-...",
    "openaiApiKey": "sk-...",
    "googleClientId": "...",
    "googleClientSecret": "...",
    "googleRefreshToken": "..."
  }'
```

Update Lambda to fetch:

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});
const response = await client.send(
  new GetSecretValueCommand({ SecretId: 'sitelogix/ai-processing' })
);
const secrets = JSON.parse(response.SecretString!);
```

### IAM Permissions

Lambda execution role needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/sitelogix-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::sitelogix-prod/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:sitelogix/*"
      ]
    }
  ]
}
```

---

## 🔄 Integration with Existing Flow

### Updated Report Save Flow

1. User completes voice conversation with Roxy
2. Frontend calls `saveReport()` (existing)
3. Report saved to S3 + DynamoDB with status `pending_analysis`
4. **NEW**: Trigger `process-report` Lambda
5. Lambda processes report with AI
6. Report status updated to `analyzed`
7. **NEW**: Google Sheets populated
8. User can view processed report

### Trigger Options

**Option A: EventBridge (Recommended)**
```typescript
// In upload-report.ts, after saving report:
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const eventBridge = new EventBridgeClient({});
await eventBridge.send(
  new PutEventsCommand({
    Entries: [{
      Source: 'custom.sitelogix',
      DetailType: 'ReportCreated',
      Detail: JSON.stringify({
        reportId,
        googleSheetsUrl: process.env.GOOGLE_SHEETS_URL
      })
    }]
  })
);
```

**Option B: Direct Invocation**
```typescript
// In upload-report.ts:
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({});
await lambda.send(
  new InvokeCommand({
    FunctionName: 'process-report',
    InvocationType: 'Event', // Async
    Payload: JSON.stringify({
      reportId,
      googleSheetsUrl: process.env.GOOGLE_SHEETS_URL
    })
  })
);
```

**Option C: Manual Testing**
```bash
aws lambda invoke \
  --function-name process-report \
  --payload '{"reportId":"rpt_20251030_mgr_002_1730318400","googleSheetsUrl":"https://docs.google.com/spreadsheets/d/1lb8nmFjvKdWmoqSLaowEKWEzGzNUPw7CuTTZ7k1FIg4/edit"}' \
  response.json
```

---

## 📈 Monitoring

### CloudWatch Logs

```bash
# View processing logs
aws logs tail /aws/lambda/process-report --follow

# Filter for errors
aws logs filter-pattern /aws/lambda/process-report '[ERROR]'
```

### Metrics to Track

1. **Processing Success Rate**
   - Reports processed / Reports created
   - Target: >95%

2. **Processing Time**
   - Average time to process
   - Target: <60 seconds

3. **AI Extraction Accuracy**
   - Personnel count matches
   - Required fields captured
   - Target: >90%

4. **Deduplication Rate**
   - New vs updated personnel
   - New vs updated vendors

---

## 🐛 Troubleshooting

### "Report processing failed"

Check:
1. AI API keys are valid
2. Transcript exists in S3
3. DynamoDB tables exist
4. Lambda has correct IAM permissions

### "Google Sheets API error"

Check:
1. Refresh token is valid (may need to re-authorize)
2. Sheet URL is correct
3. OAuth client has correct redirect URI
4. User is in "Test users" list

### "Personnel deduplication not working"

Check:
1. Names are being normalized correctly
2. Fuzzy matching threshold (85%) may need adjustment
3. Check CloudWatch logs for matching scores

---

## 📚 Documentation

- **Database Design**: `DATABASE_DESIGN.md`
- **AI Architecture**: `AI_PROCESSING_ARCHITECTURE.md`
- **Google OAuth Setup**: `GOOGLE_OAUTH_SETUP.md`
- **ElevenLabs Integration**: `ELEVENLABS_INTEGRATION_GUIDE.md`

---

## ✅ Checklist for Production

- [ ] Google OAuth credentials configured
- [ ] Refresh token obtained and stored securely
- [ ] Enhanced DynamoDB tables deployed
- [ ] Lambda function deployed with correct environment variables
- [ ] IAM roles configured with minimum permissions
- [ ] Secrets moved to AWS Secrets Manager
- [ ] CloudWatch alarms configured
- [ ] Test report processed successfully
- [ ] Google Sheets formatting verified
- [ ] Personnel deduplication tested
- [ ] Vendor deduplication tested
- [ ] Error handling tested

---

## 🎯 Next Steps

1. Complete Google OAuth setup
2. Test with sample transcript
3. Verify Google Sheets output matches template
4. Deploy to production
5. Monitor first few reports
6. Add PDF generation (future)
7. Add email notifications (future)
