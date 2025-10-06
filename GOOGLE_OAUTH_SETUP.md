# Google OAuth 2.0 Setup Guide - SiteLogix

This guide shows how to set up OAuth 2.0 authentication for Google Sheets access (NOT service account).

---

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name: `SiteLogix Production`
4. Click "Create"

---

## Step 2: Enable Google Sheets API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Sheets API"
3. Click "Google Sheets API"
4. Click "Enable"
5. Also enable "Google Drive API" (needed for file access)

---

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" (unless you have Google Workspace)
3. Click "Create"

### App Information:
- **App name**: SiteLogix
- **User support email**: your-email@example.com
- **App logo**: (optional)
- **Application home page**: https://sitelogix.com (or your domain)
- **Developer contact**: your-email@example.com

### Scopes:
4. Click "Add or Remove Scopes"
5. Add these scopes:
   - `https://www.googleapis.com/auth/spreadsheets` - View and manage spreadsheets
   - `https://www.googleapis.com/auth/drive.file` - View and manage files

6. Click "Update" → "Save and Continue"

### Test Users:
7. Add test users (the email addresses that will use this app)
   - Add your email
   - Add any other team members

8. Click "Save and Continue" → "Back to Dashboard"

---

## Step 4: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select application type: **"Web application"**

### Configure Web Application:
- **Name**: SiteLogix Backend
- **Authorized JavaScript origins**: (leave empty)
- **Authorized redirect URIs**:
  - `http://localhost:3000/oauth/callback` (for local testing)
  - `https://your-domain.com/oauth/callback` (for production)

4. Click "Create"

### Save Credentials:
You'll see a dialog with:
- **Client ID**: `123456789-abcdef.apps.googleusercontent.com`
- **Client secret**: `GOCSPX-abc123...`

⚠️ **IMPORTANT**: Copy these values immediately - you'll need them for environment variables

---

## Step 5: Get Refresh Token

You need to authorize the app once to get a refresh token. We'll use a helper script.

### Option A: Use the OAuth Helper Endpoint

1. Add this temporary endpoint to your backend:

\`\`\`typescript
// backend/src/functions/oauth-helper.ts
import { Handler } from 'aws-lambda';
import { GoogleSheetsService } from '../services/googleSheetsService';

export const handler: Handler = async (event) => {
  const { action, code } = event.queryStringParameters || {};

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  if (action === 'get-auth-url') {
    const authUrl = GoogleSheetsService.getAuthUrl(clientId, clientSecret, redirectUri);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: \`<html>
        <body>
          <h1>Google OAuth Authorization</h1>
          <p>Click the link below to authorize SiteLogix to access Google Sheets:</p>
          <a href="\${authUrl}">Authorize Google Sheets Access</a>
        </body>
      </html>\`
    };
  }

  if (action === 'callback' && code) {
    try {
      const tokens = await GoogleSheetsService.getTokensFromCode(code, clientId, clientSecret, redirectUri);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: \`<html>
          <body>
            <h1>Success!</h1>
            <p>Add these to your environment variables:</p>
            <pre>
GOOGLE_REFRESH_TOKEN=\${tokens.refreshToken}
GOOGLE_ACCESS_TOKEN=\${tokens.accessToken}
            </pre>
            <p><strong>Copy the GOOGLE_REFRESH_TOKEN value and save it securely!</strong></p>
          </body>
        </html>\`
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  }

  return {
    statusCode: 400,
    body: 'Invalid request'
  };
};
\`\`\`

2. Deploy this endpoint temporarily

3. Visit: `https://your-api-endpoint/oauth-helper?action=get-auth-url`

4. Click the authorization link

5. Sign in with Google and grant permissions

6. You'll be redirected to the callback with your **refresh token**

7. Copy the `GOOGLE_REFRESH_TOKEN` value

8. **Delete this endpoint after getting the token** (security best practice)

### Option B: Use Google OAuth Playground

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)

2. Click the gear icon (⚙️) in top right

3. Check "Use your own OAuth credentials"

4. Enter your Client ID and Client secret

5. In Step 1, find and select:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`

6. Click "Authorize APIs"

7. Sign in and grant permissions

8. In Step 2, click "Exchange authorization code for tokens"

9. Copy the **Refresh token** value

---

## Step 6: Configure Environment Variables

Add these to your `.env` file:

\`\`\`env
# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123...
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
GOOGLE_REFRESH_TOKEN=1//abc123...

# Google Sheets
GOOGLE_SHEETS_URL=https://docs.google.com/spreadsheets/d/1lb8nmFjvKdWmoqSLaowEKWEzGzNUPw7CuTTZ7k1FIg4/edit

# AI Services
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
\`\`\`

---

## Step 7: Test the Integration

Create a test script:

\`\`\`typescript
// test-google-sheets.ts
import { initializeGoogleSheetsService } from './backend/src/services/googleSheetsService';

const sheetsService = initializeGoogleSheetsService({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN!
});

async function test() {
  const url = process.env.GOOGLE_SHEETS_URL!;

  // Test connection
  const connected = await sheetsService.testConnection(url);
  console.log('Connected:', connected);

  // Write test data
  await sheetsService.writeDailyReport(url, {
    reportId: 'test_001',
    reportDate: '2025-10-05',
    projectName: 'Test Project',
    projectLocation: 'Test Location',
    managerName: 'Test Manager',
    personnel: [
      {
        fullName: 'John Doe',
        goByName: 'John',
        position: 'Foreman',
        teamAssignment: 'Team 1',
        healthStatus: 'Healthy',
        hoursWorked: 8,
        overtimeHours: 0
      }
    ],
    workLogs: [
      {
        teamId: 'Team 1',
        taskDescription: 'Test task',
        level: 'Level 1'
      }
    ],
    constraints: [],
    totalHeadcount: 1,
    totalRegularHours: 8,
    totalOvertimeHours: 0
  });

  console.log('✅ Test complete!');
}

test().catch(console.error);
\`\`\`

Run:
\`\`\`bash
npx ts-node test-google-sheets.ts
\`\`\`

---

## Security Best Practices

1. **Never commit credentials to git**
   - Add `.env` to `.gitignore`
   - Use AWS Secrets Manager for production

2. **Rotate tokens regularly**
   - Refresh tokens can be revoked
   - Re-authorize if compromised

3. **Limit scopes**
   - Only request necessary permissions
   - Currently: spreadsheets + drive.file (not full drive access)

4. **Monitor usage**
   - Check Google Cloud Console for API usage
   - Set up quotas and alerts

5. **Use environment-specific credentials**
   - Separate OAuth clients for dev/staging/production

---

## Troubleshooting

### "Access blocked: This app's request is invalid"
- Make sure you added your email to "Test users" in OAuth consent screen
- Check that redirect URI matches exactly (including http vs https)

### "Invalid grant"
- Refresh token may have expired
- Re-authorize to get new refresh token

### "Insufficient Permission"
- Make sure you granted both Sheets and Drive permissions
- Check scopes in OAuth consent screen

### "Daily Limit Exceeded"
- Free tier: 100 requests/100 seconds/user
- Paid tier: 500 requests/100 seconds/user
- Implement rate limiting if needed

---

## Production Deployment

For production, store credentials in AWS Secrets Manager:

\`\`\`bash
aws secretsmanager create-secret \\
  --name sitelogix/google-oauth \\
  --secret-string '{
    "clientId": "...",
    "clientSecret": "...",
    "refreshToken": "..."
  }'
\`\`\`

Update Lambda to fetch from Secrets Manager:

\`\`\`typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});
const response = await client.send(
  new GetSecretValueCommand({ SecretId: 'sitelogix/google-oauth' })
);
const secrets = JSON.parse(response.SecretString!);
\`\`\`

---

## Rate Limits & Quotas

**Google Sheets API Limits:**
- Read requests: 100 per 100 seconds per user (free)
- Write requests: 100 per 100 seconds per user (free)
- Can be increased with paid billing account

**Recommended Rate Limiting:**
- Batch multiple updates when possible
- Use exponential backoff on errors
- Cache frequently accessed data

---

## Next Steps

1. ✅ Complete OAuth setup
2. ✅ Get refresh token
3. ✅ Test connection
4. ⏳ Process first real report
5. ⏳ Monitor API usage
6. ⏳ Move to production with Secrets Manager
