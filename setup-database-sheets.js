/**
 * Setup Complete Construction CRM Database in Google Sheets
 *
 * Creates all necessary sheets with proper headers and sample data
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = '1lb8nmFjvKdWmoqSLaowEKWEzGzNUPw7CuTTZ7k1FIg4';

async function setupDatabase() {
  console.log('='.repeat(80));
  console.log('🏗️  Setting Up Construction CRM Database');
  console.log('='.repeat(80));
  console.log('');

  // Initialize Google Sheets API
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.Google_Client_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_Secret;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.Google_Refresh_Token;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3000');
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  // Define all sheets to create
  const sheetsToCreate = [
    {
      name: 'Employee Roster',
      headers: ['Employee ID', 'Full Name', 'Go By Name', 'Position', 'Phone', 'Email', 'Hire Date', 'Status', 'Current Project', 'Notes'],
      sampleData: [
        ['EMP001', 'Aaron Trask', 'Aaron', 'Project Manager', '555-0101', 'aaron@parkway.com', '2023-01-15', 'Active', 'PRJ001', ''],
        ['EMP002', 'Corey Birchfield', 'Corey', 'Project Manager', '555-0102', 'corey@parkway.com', '2023-02-01', 'Active', 'PRJ002', ''],
        ['EMP003', 'Roger Brake', 'Roger', 'Foreman', '555-0103', 'roger@parkway.com', '2022-06-10', 'Active', 'PRJ001', ''],
        ['EMP004', 'Jerimiah Brigham', 'Jerimiah', 'Journeyman', '555-0104', '', '2023-03-15', 'Active', 'PRJ001', ''],
        ['EMP005', 'Dorian Reed', 'Dorian', 'Apprentice', '555-0105', '', '2024-01-10', 'Active', 'PRJ001', ''],
        ['EMP006', 'Bryce Shanklin', 'Bryce', 'Journeyman', '555-0106', '', '2023-05-20', 'Active', 'PRJ001', ''],
        ['EMP007', 'Kevin Zamarripa-Reyes', 'Kevin', 'Apprentice', '555-0107', '', '2024-02-01', 'Active', 'PRJ001', '']
      ]
    },
    {
      name: 'Daily Manpower Log',
      headers: ['Log ID', 'Date', 'Project Number', 'Employee ID', 'Employee Name', 'Position', 'Team Assignment', 'Hours Worked', 'Overtime Hours', 'Health Status', 'Activities Performed', 'Report ID'],
      sampleData: []
    },
    {
      name: 'Suppliers',
      headers: ['Supplier ID', 'Company Name', 'Contact Name', 'Phone', 'Email', 'Type', 'Status', 'Notes'],
      sampleData: [
        ['SUP001', 'ABC Supply', 'John Smith', '555-1001', 'john@abcsupply.com', 'Supplier', 'Active', 'Plumbing supplies'],
        ['SUP002', 'XYZ Materials', 'Jane Doe', '555-1002', 'jane@xyzmaterials.com', 'Supplier', 'Active', 'Building materials'],
        ['SUP003', 'Elite Rentals', 'Bob Johnson', '555-1003', 'bob@eliterentals.com', 'Rental', 'Active', 'Equipment rental']
      ]
    },
    {
      name: 'Delivery Log',
      headers: ['Delivery ID', 'Date', 'Project Number', 'Supplier ID', 'Supplier Name', 'Materials Delivered', 'Delivery Time', 'Received By', 'Notes', 'Report ID'],
      sampleData: []
    },
    {
      name: 'Constraints Log',
      headers: ['Issue ID', 'Date Identified', 'Project Number', 'Category', 'Level', 'Severity', 'Title', 'Description', 'Status', 'Assigned To', 'Date Resolved', 'Report ID'],
      sampleData: []
    },
    {
      name: 'Work Activities Log',
      headers: ['Activity ID', 'Date', 'Project Number', 'Description', 'Team Assignment', 'Personnel Assigned', 'Personnel Count', 'Hours Worked', 'Report ID'],
      sampleData: []
    },
    {
      name: 'Daily Reports',
      headers: ['Report ID', 'Date', 'Project Number', 'Project Name', 'Project Manager', 'Conversation ID', 'Status', 'Total Personnel', 'Total Hours', 'Total Overtime', 'Transcript S3 Path', 'Report Doc URL'],
      sampleData: []
    }
  ];

  try {
    // Get existing sheets
    console.log('📋 Checking existing sheets...');
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);
    console.log('   Existing sheets:', existingSheets.join(', '));
    console.log('');

    // Create new sheets
    const requests = [];

    for (const sheetDef of sheetsToCreate) {
      if (!existingSheets.includes(sheetDef.name)) {
        console.log(`➕ Creating sheet: ${sheetDef.name}`);
        requests.push({
          addSheet: {
            properties: {
              title: sheetDef.name,
              gridProperties: {
                frozenRowCount: 1,
                frozenColumnCount: 1
              }
            }
          }
        });
      } else {
        console.log(`✓ Sheet already exists: ${sheetDef.name}`);
      }
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests }
      });
      console.log(`✅ Created ${requests.length} new sheets`);
    }
    console.log('');

    // Write headers and data to each sheet
    console.log('📝 Writing headers and sample data...');
    const dataUpdates = [];

    for (const sheetDef of sheetsToCreate) {
      // Headers
      dataUpdates.push({
        range: `${sheetDef.name}!A1:${String.fromCharCode(64 + sheetDef.headers.length)}1`,
        values: [sheetDef.headers]
      });

      // Sample data
      if (sheetDef.sampleData.length > 0) {
        dataUpdates.push({
          range: `${sheetDef.name}!A2:${String.fromCharCode(64 + sheetDef.headers.length)}${1 + sheetDef.sampleData.length}`,
          values: sheetDef.sampleData
        });
        console.log(`   ✓ ${sheetDef.name}: ${sheetDef.headers.length} columns, ${sheetDef.sampleData.length} sample rows`);
      } else {
        console.log(`   ✓ ${sheetDef.name}: ${sheetDef.headers.length} columns (empty)`);
      }
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: dataUpdates
      }
    });

    console.log('✅ All data written successfully');
    console.log('');

    // Apply formatting
    console.log('🎨 Applying formatting...');
    const formatRequests = [];

    // Get sheet IDs
    const updatedSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetMap = {};
    updatedSpreadsheet.data.sheets.forEach(s => {
      sheetMap[s.properties.title] = s.properties.sheetId;
    });

    for (const sheetDef of sheetsToCreate) {
      const sheetId = sheetMap[sheetDef.name];
      if (!sheetId && sheetId !== 0) continue;

      // Format header row (bold, background color)
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.2, green: 0.3, blue: 0.4 },
              textFormat: {
                bold: true,
                foregroundColor: { red: 1, green: 1, blue: 1 }
              },
              horizontalAlignment: 'CENTER'
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
        }
      });

      // Auto-resize columns
      formatRequests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: sheetDef.headers.length
          }
        }
      });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: formatRequests }
    });

    console.log('✅ Formatting applied');
    console.log('');

    console.log('='.repeat(80));
    console.log('✅ Database Setup Complete!');
    console.log('='.repeat(80));
    console.log('');
    console.log('Created/Updated Sheets:');
    sheetsToCreate.forEach(s => {
      console.log(`  ✓ ${s.name}`);
    });
    console.log('');
    console.log('📊 View your database:');
    console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

setupDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
