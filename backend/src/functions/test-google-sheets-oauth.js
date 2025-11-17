/**
 * Test Google Sheets OAuth Connection
 */
require('dotenv').config();
const { google } = require('googleapis');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });

async function getSecret(secretId) {
  const command = new GetSecretValueCommand({ SecretId: secretId });
  const response = await secretsClient.send(command);
  return JSON.parse(response.SecretString);
}

async function testGoogleSheetsAccess() {
  try {
    console.log('🔑 Fetching OAuth credentials from AWS Secrets Manager...');
    const googleOAuth = await getSecret('sitelogix/google-oauth');
    
    console.log('✅ OAuth credentials retrieved');
    console.log('   Client ID:', googleOAuth.client_id.substring(0, 20) + '...');
    console.log('   Has refresh token:', !!googleOAuth.refresh_token);

    console.log('\n🔐 Creating OAuth2 client...');
    const oauth2Client = new google.auth.OAuth2(
      googleOAuth.client_id,
      googleOAuth.client_secret,
      'http://localhost:3000'
    );
    oauth2Client.setCredentials({ refresh_token: googleOAuth.refresh_token });

    console.log('✅ OAuth2 client created');

    console.log('\n📊 Testing Google Sheets API access...');
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    
    const HOURS_LOG_SPREADSHEET_ID = '1Slqb1pbhnByUo_PCNPUZ8e3lMBG710fHJNVKWl7hOHQ';
    
    // Try to get spreadsheet metadata
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId: HOURS_LOG_SPREADSHEET_ID
    });

    console.log('✅ Successfully connected to Google Sheets!');
    console.log('   Spreadsheet Title:', metadata.data.properties.title);
    console.log('   Sheets:', metadata.data.sheets.map(s => s.properties.title).join(', '));

    // Check if "hours log" sheet exists
    const hoursLogSheet = metadata.data.sheets.find(s => 
      s.properties.title.toLowerCase() === 'hours log'
    );

    if (hoursLogSheet) {
      console.log('\n✅ "hours log" sheet found!');
      console.log('   Sheet ID:', hoursLogSheet.properties.sheetId);
      console.log('   Grid Properties:', hoursLogSheet.properties.gridProperties);
      
      // Try to read the header row
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: HOURS_LOG_SPREADSHEET_ID,
        range: 'hours log!A1:I1'
      });
      
      console.log('\n📋 Header Row:', headerResponse.data.values?.[0] || 'Empty');
      
      console.log('\n✅ OAuth connection is fully functional!');
      console.log('✅ Ready to log personnel hours automatically');
    } else {
      console.warn('\n⚠️  "hours log" sheet not found. Available sheets:', 
        metadata.data.sheets.map(s => s.properties.title).join(', '));
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('   Error details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testGoogleSheetsAccess()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
