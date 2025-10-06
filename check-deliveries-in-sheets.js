/**
 * Check Deliveries in Google Sheets Database
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = '1lb8nmFjvKdWmoqSLaowEKWEzGzNUPw7CuTTZ7k1FIg4';

async function checkDeliveries() {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.Google_Client_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_Secret;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.Google_Refresh_Token;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3000');
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  console.log('📋 Fetching Deliveries from Google Sheets...\n');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Deliveries!A2:Z1000',
  });

  const rows = response.data.values || [];

  console.log(`Found ${rows.length} delivery records\n`);

  if (rows.length === 0) {
    console.log('No deliveries found in the database.');
    return;
  }

  // Count late deliveries
  let lateCount = 0;
  let onTimeCount = 0;
  const lateDetails = [];

  rows.forEach((row, index) => {
    const status = row[5] || ''; // Status column (F)
    const notes = row[6] || '';  // Notes column (G)

    const isLate = status.toLowerCase().includes('late') ||
                   status.toLowerCase().includes('delayed') ||
                   notes.toLowerCase().includes('late') ||
                   notes.toLowerCase().includes('delayed');

    if (isLate) {
      lateCount++;
      lateDetails.push({
        deliveryId: row[0] || '',
        reportId: row[1] || '',
        vendor: row[2] || '',
        item: row[3] || '',
        time: row[4] || '',
        status: row[5] || '',
        notes: row[6] || ''
      });
    } else {
      onTimeCount++;
    }
  });

  console.log('='.repeat(80));
  console.log('📊 DELIVERY SUMMARY FROM GOOGLE SHEETS');
  console.log('='.repeat(80));
  console.log(`Total Deliveries: ${rows.length}`);
  console.log(`Late/Delayed Deliveries: ${lateCount}`);
  console.log(`On-Time Deliveries: ${onTimeCount}`);

  if (rows.length > 0) {
    const latePercentage = ((lateCount / rows.length) * 100).toFixed(1);
    console.log(`Late Delivery Rate: ${latePercentage}%`);
  }

  console.log('='.repeat(80));

  if (lateDetails.length > 0) {
    console.log('\n📋 LATE DELIVERY DETAILS:\n');
    lateDetails.forEach((detail, index) => {
      console.log(`${index + 1}. Delivery ID: ${detail.deliveryId}`);
      console.log(`   Report: ${detail.reportId}`);
      console.log(`   Vendor: ${detail.vendor}`);
      console.log(`   Item: ${detail.item}`);
      console.log(`   Time: ${detail.time}`);
      console.log(`   Status: ${detail.status}`);
      console.log(`   Notes: ${detail.notes}`);
      console.log('');
    });
  }

  // Show first 5 deliveries as sample
  console.log('\n📦 SAMPLE DELIVERIES (First 5):\n');
  rows.slice(0, 5).forEach((row, index) => {
    console.log(`${index + 1}. ${row[2] || 'Unknown Vendor'} - ${row[3] || 'Unknown Item'}`);
    console.log(`   Time: ${row[4] || 'N/A'} | Status: ${row[5] || 'N/A'}`);
    console.log('');
  });
}

checkDeliveries().catch(console.error);
