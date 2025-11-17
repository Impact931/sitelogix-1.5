require('dotenv').config();
const { google } = require('googleapis');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });

async function getSecret(secretId) {
  const command = new GetSecretValueCommand({ SecretId: secretId });
  const response = await secretsClient.send(command);
  return JSON.parse(response.SecretString);
}

async function checkSheetStructure() {
  const googleOAuth = await getSecret('sitelogix/google-oauth');
  const oauth2Client = new google.auth.OAuth2(
    googleOAuth.client_id,
    googleOAuth.client_secret,
    'http://localhost:3000'
  );
  oauth2Client.setCredentials({ refresh_token: googleOAuth.refresh_token });

  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  const HOURS_LOG_SPREADSHEET_ID = '1Slqb1pbhnByUo_PCNPUZ8e3lMBG710fHJNVKWl7hOHQ';

  // Read the first 10 rows to see the structure
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: HOURS_LOG_SPREADSHEET_ID,
    range: 'hours log!A1:I10'
  });

  console.log('📊 First 10 rows of "hours log" sheet:\n');
  if (response.data.values) {
    response.data.values.forEach((row, index) => {
      console.log(`Row ${index + 1}:`, row);
    });
  } else {
    console.log('Sheet is empty');
  }
}

checkSheetStructure();
