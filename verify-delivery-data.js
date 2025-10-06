/**
 * Verify Delivery Data with Status Column
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = '1lb8nmFjvKdWmoqSLaowEKWEzGzNUPw7CuTTZ7k1FIg4';

async function verifyDeliveries() {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.Google_Client_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_Secret;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.Google_Refresh_Token;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3000');
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  console.log('📦 Fetching latest deliveries...\n');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Delivery Log!A1:K20', // Get header + first 19 rows
  });

  const rows = response.data.values || [];

  if (rows.length === 0) {
    console.log('No deliveries found.');
    return;
  }

  // Display header
  const header = rows[0];
  console.log('HEADER:', header.join(' | '));
  console.log('='.repeat(100));

  // Display delivery data
  const deliveries = rows.slice(1);
  deliveries.forEach((row, index) => {
    const deliveryId = row[0] || '';
    const date = row[1] || '';
    const supplier = row[4] || '';
    const materials = row[5] || '';
    const status = row[7] || ''; // Status column
    const reportId = row[10] || '';

    console.log(`${index + 1}. ${deliveryId} | ${date} | ${supplier}`);
    console.log(`   Materials: ${materials}`);
    console.log(`   Status: ${status}`);
    console.log(`   Report: ${reportId}`);
    console.log('');
  });

  // Count statuses
  const statusCounts = {};
  deliveries.forEach(row => {
    const status = row[7] || 'Unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  console.log('='.repeat(100));
  console.log('STATUS BREAKDOWN:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
}

verifyDeliveries().catch(console.error);
