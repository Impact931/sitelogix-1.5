/**
 * Update Delivery Log Header to Add Status Column
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = '1lb8nmFjvKdWmoqSLaowEKWEzGzNUPw7CuTTZ7k1FIg4';

async function updateHeader() {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.Google_Client_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_Secret;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.Google_Refresh_Token;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3000');
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  console.log('📝 Updating Delivery Log header...\n');

  // New header with Status column
  const newHeader = [
    'Delivery ID',
    'Date',
    'Project Number',
    'Supplier ID',
    'Supplier Name',
    'Materials Delivered',
    'Delivery Time',
    'Status',  // NEW COLUMN
    'Received By',
    'Notes',
    'Report ID'
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Delivery Log!A1:K1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [newHeader]
    }
  });

  console.log('✅ Delivery Log header updated with Status column');
  console.log('');
  console.log('New header:', newHeader.join(' | '));
}

updateHeader().catch(console.error);
