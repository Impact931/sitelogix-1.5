/**
 * Test Google Sheets Logging with Sample Data
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

async function getGoogleSheetsClient() {
  const googleOAuth = await getSecret('sitelogix/google-oauth');
  const oauth2Client = new google.auth.OAuth2(
    googleOAuth.client_id,
    googleOAuth.client_secret,
    'http://localhost:3000'
  );
  oauth2Client.setCredentials({ refresh_token: googleOAuth.refresh_token });

  return {
    client: google.sheets({ version: 'v4', auth: oauth2Client }),
    oauth2Client
  };
}

async function testSheetsLogging() {
  try {
    console.log('🔑 Fetching OAuth credentials...');
    const { client: sheets } = await getGoogleSheetsClient();
    console.log('✅ OAuth client created');

    const HOURS_LOG_SPREADSHEET_ID = '1Slqb1pbhnByUo_PCNPUZ8e3lMBG710fHJNVKWl7hOHQ';
    const SHEET_NAME = 'hours log';

    // Sample extracted data matching Claude's output format
    const sampleExtractedData = {
      personnel: [
        {
          employeeNumber: '1001',
          fullName: 'John Smith',
          position: 'Foreman',
          hoursWorked: 8,
          overtimeHours: 2
        },
        {
          employeeNumber: '1002',
          fullName: 'Jane Doe',
          position: 'Carpenter',
          hoursWorked: 8,
          overtimeHours: 0
        },
        {
          employeeId: '1003',
          firstName: 'Bob',
          lastName: 'Johnson',
          role: 'Electrician',
          regularHours: 8,
          overtimeHours: 4
        }
      ]
    };

    const reportData = {
      report_id: 'test_rpt_20251117',
      project_id: 'test_proj_123',
      project_name: 'Test Construction Site',
      manager_name: 'Test Manager',
      report_date: '2025-11-17'
    };

    console.log('\n📊 Testing Google Sheets logging with sample data...');
    console.log(`   Personnel count: ${sampleExtractedData.personnel.length}`);

    // Prepare rows
    const rows = sampleExtractedData.personnel.map(person => {
      const reportDate = reportData.report_date;
      const employeeNumber = person.employeeNumber || person.employeeId || '';
      const fullName = person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim();
      const projectName = reportData.project_name;
      const position = person.position || person.role || '';
      const regularHours = person.hoursWorked || person.regularHours || 0;
      const overtimeHours = person.overtimeHours || 0;
      const totalHours = regularHours + overtimeHours;

      return [
        reportDate,
        employeeNumber,
        fullName,
        projectName,
        position,
        regularHours,
        overtimeHours,
        totalHours,
        reportData.report_id
      ];
    });

    console.log('\n📋 Rows to append:');
    rows.forEach((row, i) => {
      console.log(`   Row ${i + 1}:`, row);
    });

    // Append rows
    console.log('\n📤 Appending to Google Sheets...');
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: HOURS_LOG_SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:I`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rows
      }
    });

    console.log('\n✅ Successfully logged to Google Sheets!');
    console.log(`   Updated range: ${response.data.updates.updatedRange}`);
    console.log(`   Updated rows: ${response.data.updates.updatedRows}`);
    console.log(`   Updated columns: ${response.data.updates.updatedColumns}`);
    console.log(`   Updated cells: ${response.data.updates.updatedCells}`);

    // Verify the data was written
    console.log('\n🔍 Verifying data in sheet...');
    const verifyResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: HOURS_LOG_SPREADSHEET_ID,
      range: `${SHEET_NAME}!A5:I10`
    });

    console.log('   Recent data rows:', verifyResponse.data.values);

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('   Error details:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

testSheetsLogging()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
