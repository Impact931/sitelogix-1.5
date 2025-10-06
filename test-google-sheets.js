/**
 * Test Google Sheets Integration
 */

require('dotenv').config();
const { google } = require('googleapis');

async function testGoogleSheets() {
  console.log('='.repeat(80));
  console.log('🧪 Testing Google Sheets Integration');
  console.log('='.repeat(80));
  console.log('');

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.Google_Client_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_Secret;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.Google_Refresh_Token;
  const sheetsUrl = process.env.GOOGLE_SHEETS_URL;

  console.log('Client ID:', clientId);
  console.log('Client Secret:', clientSecret ? '***' + clientSecret.slice(-4) : 'NOT FOUND');
  console.log('Refresh Token:', refreshToken ? refreshToken.substring(0, 20) + '...' : 'NOT FOUND');
  console.log('Sheets URL:', sheetsUrl);
  console.log('');

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('❌ Missing credentials in .env file');
    process.exit(1);
  }

  try {
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:3000/oauth/callback'
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    console.log('🔐 OAuth client created');
    console.log('🔄 Refreshing access token...');

    // Get fresh access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    console.log('✅ Access token refreshed successfully!');
    console.log('   New Access Token:', credentials.access_token ? credentials.access_token.substring(0, 30) + '...' : 'none');
    console.log('');

    // Initialize Sheets API
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Extract spreadsheet ID from URL
    const spreadsheetId = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)[1];
    console.log('📊 Spreadsheet ID:', spreadsheetId);
    console.log('');

    // Test 1: Get spreadsheet metadata
    console.log('📋 Test 1: Getting spreadsheet metadata...');
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId
    });

    console.log('✅ Spreadsheet found!');
    console.log('   Title:', metadata.data.properties.title);
    console.log('   Sheets:', metadata.data.sheets.map(s => s.properties.title).join(', '));
    console.log('');

    // Test 2: Write test data
    console.log('📝 Test 2: Writing test data...');
    const testSheetName = 'SiteLogix_Test_' + new Date().toISOString().split('T')[0];

    // Create new sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: testSheetName
            }
          }
        }]
      }
    });

    console.log('✅ Test sheet created:', testSheetName);

    // Write test data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${testSheetName}!A1:D3`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['Test Report', '', '', 'Date: 2025-10-05'],
          ['Personnel', 'Position', 'Team', 'Hours'],
          ['John Doe', 'Foreman', 'Team 1', '8']
        ]
      }
    });

    console.log('✅ Test data written successfully!');
    console.log('');

    console.log('='.repeat(80));
    console.log('🎉 All tests passed!');
    console.log('='.repeat(80));
    console.log('');
    console.log('Next steps:');
    console.log('1. Check your Google Sheet for the new test sheet');
    console.log('2. The AI processing system is ready to use');
    console.log('3. Run a real report processing test');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Error during testing:');
    console.error('   Message:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('');
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testGoogleSheets();
