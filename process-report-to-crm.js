/**
 * Process Report to Construction CRM
 *
 * Complete workflow:
 * 1. Fetch transcript from S3
 * 2. Analyze with AI
 * 3. Populate Google Sheets database (with deduplication)
 * 4. Generate Google Doc report
 */

require('dotenv').config();
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');
const { generateHTMLReport } = require('./generate-html-report');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BUCKET = 'sitelogix-prod';
const SPREADSHEET_ID = '1lb8nmFjvKdWmoqSLaowEKWEzGzNUPw7CuTTZ7k1FIg4';
const REPORTS_FOLDER_ID = '1gm6m3B_eQnkYyRUuRKuVT7fbgXWy-edP';

// DynamoDB Table Names
const TABLES = {
  REPORTS: 'sitelogix-reports',
  PERSONNEL: 'sitelogix-personnel',
  VENDORS: 'sitelogix-vendors',
  CONSTRAINTS: 'sitelogix-constraints'
};

// Get command line argument
const s3Key = process.argv[2];

if (!s3Key) {
  console.error('Usage: node process-report-to-crm.js <s3-key>');
  console.error('');
  console.error('Available transcripts:');
  console.error('  SITELOGIX/projects/proj_001/reports/2025/10/04/rpt_20251005_mgr_001_1759706117587/transcript.json');
  console.error('  SITELOGIX/projects/proj_002/reports/2025/10/04/rpt_20251005_mgr_002_1759703743885/transcript.json');
  process.exit(1);
}

// Initialize Google APIs
let sheets, docs, drive, oauth2Client;

function initializeGoogle() {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.Google_Client_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_Secret;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.Google_Refresh_Token;

  oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3000');
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  docs = google.docs({ version: 'v1', auth: oauth2Client });
  drive = google.drive({ version: 'v3', auth: oauth2Client });
}

async function fetchTranscriptFromS3(key) {
  console.log(`📥 Fetching transcript from S3...`);
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3Client.send(command);
  const body = await response.Body.transformToString();
  return JSON.parse(body);
}

function extractReportInfo(s3Key) {
  // Path format: SITELOGIX/projects/{projectId}/reports/{year}/{month}/{day}/{reportId}/transcript.json
  const parts = s3Key.split('/');
  const reportId = parts[parts.length - 2];
  const projectId = parts[2]; // "proj_001" from path

  // Extract manager ID from reportId (format: rpt_YYYYMMDD_mgr_XXX_timestamp)
  const reportParts = reportId.split('_');
  const mgrIndex = reportParts.findIndex(p => p === 'mgr');
  const managerId = (mgrIndex >= 0 && reportParts[mgrIndex + 1]) ? reportParts[mgrIndex + 1] : 'unknown';

  const year = parts[4];
  const month = parts[5];
  const day = parts[6];

  return {
    reportId,
    projectId,
    managerId,
    reportDate: `${year}-${month}-${day}`,
    s3Url: `https://${BUCKET}.s3.amazonaws.com/${s3Key}`
  };
}

async function analyzeWithClaude(transcript, context) {
  console.log('🤖 Analyzing with Claude 3.5 Sonnet...');

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages = transcript.transcript || [];
  const rawText = messages.map(m =>
    `${m.role === 'user' ? 'Manager' : 'Roxy'}: ${m.message}`
  ).join('\n\n');

  const prompt = `Extract structured construction data from this daily report conversation.

CONTEXT:
- Project: ${context.projectName}
- Date: ${context.reportDate}

TRANSCRIPT:
${rawText}

CRITICAL INSTRUCTIONS:
1. Return ONLY valid, parseable JSON
2. NO comments (// ...) in the JSON
3. NO ellipsis (...) or placeholder text
4. Extract ALL personnel, tasks, and details completely
5. Use empty arrays [] if no data found for a section

Return JSON with this exact structure:
{
  "personnel": [...],
  "workLogs": [...],
  "constraints": [...],
  "vendors": [...],
  "timeSummary": {...}
}

PERSONNEL format: [{ fullName, goByName, position, teamAssignment, hoursWorked, overtimeHours, healthStatus, extractedFromText }]

WORK LOGS format - IMPORTANT:
- description: Combine building level + task into narrative (e.g., "Level 4: Electrical rough-in, pulling wire and setting junction boxes")
- teamId: If mentioned (e.g., "Team 1", "Team 2") extract it, otherwise null
- personnelAssigned: Array of names if mentioned individually, otherwise empty array [] (we'll look up team members from roster)
- personnelCount: Number if mentioned, otherwise null
- hoursWorked: Total hours for this activity
Format: [{ description, teamId, personnelAssigned: [names], personnelCount, hoursWorked, extractedFromText }]

CONSTRAINTS format: [{ category, level, severity, title, description, status, extractedFromText }]
VENDORS format: [{ companyName, vendorType, materialsDelivered, deliveryTime, receivedBy, extractedFromText }]
TIME SUMMARY format: { totalPersonnelCount, totalRegularHours, totalOvertimeHours, arrivalTime, departureTime }`;

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 8000,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }]
  });

  let jsonText = message.content[0].text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
  }

  // Try to parse, if fails, try to extract JSON from text
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    console.log('⚠️  JSON parse failed, attempting to extract...');
    console.log('Raw response (first 1000 chars):');
    console.log(jsonText.substring(0, 1000));
    console.log('---');

    // Try to find JSON object in text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log('Found JSON match, attempting to parse...');
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.log('Parse error:', parseError.message);
        console.log('Matched content (first 1000 chars):');
        console.log(jsonMatch[0].substring(0, 1000));
      }
    }
    throw new Error(`Failed to parse AI response: ${error.message}\n\nResponse:\n${jsonText.substring(0, 500)}...`);
  }
}

// Database helpers
async function getSheetData(sheetName) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`
  });
  return response.data.values || [];
}

async function lookupProjectName(projectId) {
  const projectSites = await getSheetData('Project Sites');
  const rows = projectSites.slice(1); // Skip header
  for (const row of rows) {
    if (row[0] === projectId) {
      return row[1] || projectId; // Return project name or ID if not found
    }
  }
  return projectId; // Default to project ID
}

async function lookupManagerName(managerId) {
  const roster = await getSheetData('Employee Roster');
  const rows = roster.slice(1); // Skip header

  // Try to match:
  // 1. Exact match (EMP001 === EMP001)
  // 2. Number match (001 matches EMP001)
  // 3. Fuzzy match
  for (const row of rows) {
    const empId = row[0];
    const position = row[3];

    // Only check Project Managers
    if (position === 'Project Manager') {
      if (empId === managerId) {
        return row[1]; // Full Name
      }

      // Check if managerId is just the number part
      if (empId.replace(/\D/g, '') === managerId.replace(/\D/g, '')) {
        return row[1];
      }
    }
  }

  return 'Unknown';
}

function generateShortId(prefix, counter) {
  // Generate shorter IDs using timestamp suffix (last 6 digits) + counter
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}${timestamp}${String(counter).padStart(2, '0')}`;
}

async function appendToSheet(sheetName, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'RAW',
    requestBody: { values }
  });
}

async function appendToSheetWithFormulas(sheetName, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED', // This allows formulas to be evaluated
    requestBody: { values }
  });
}

async function updateReportDocUrl(reportId, docUrl) {
  // Find the row with this reportId in Daily Reports
  const reports = await getSheetData('Daily Reports');
  let rowIndex = -1;

  for (let i = 1; i < reports.length; i++) {
    if (reports[i][0] === reportId) {
      rowIndex = i + 1; // +1 for 1-indexed sheets
      break;
    }
  }

  if (rowIndex > 0) {
    // Update column L (Report Doc URL)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Daily Reports!L${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[docUrl]]
      }
    });
  }
}

function normalizeString(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

function fuzzyMatch(str1, str2, threshold = 0.8) {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return true;

  // Simple fuzzy match using includes
  if (s1.includes(s2) || s2.includes(s1)) {
    return s1.length > 3 && s2.length > 3;
  }

  return false;
}

async function findOrCreateEmployee(person) {
  console.log(`  👤 Processing: ${person.fullName}`);

  const roster = await getSheetData('Employee Roster');
  const headers = roster[0];
  const rows = roster.slice(1);

  // Find existing employee
  for (const row of rows) {
    const rowName = row[1]; // Full Name column
    if (fuzzyMatch(rowName, person.fullName)) {
      const empId = row[0];
      console.log(`     ✓ Found existing employee: ${empId}`);
      return empId;
    }
  }

  // Create new employee
  const nextId = `EMP${String(rows.length + 1).padStart(3, '0')}`;
  const newRow = [
    nextId,
    person.fullName,
    person.goByName,
    person.position,
    '', // phone
    '', // email
    new Date().toISOString().split('T')[0], // hire date
    'Active',
    '', // current project
    'Auto-created from AI'
  ];

  await appendToSheet('Employee Roster', [newRow]);
  console.log(`     ✨ Created new employee: ${nextId}`);
  return nextId;
}

function normalizeTeamName(team) {
  // Convert word numbers to digits: "one" -> "1", "two" -> "2", etc.
  const numberWords = {
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
  };

  let normalized = team.toLowerCase();
  Object.keys(numberWords).forEach(word => {
    normalized = normalized.replace(new RegExp(word, 'g'), numberWords[word]);
  });

  // Remove all whitespace
  return normalized.replace(/\s+/g, '');
}

async function getTeamMembers(teamId, projectId) {
  // Look up all employees assigned to this team in the Employee Roster
  const roster = await getSheetData('Employee Roster');
  const rows = roster.slice(1);

  const teamMembers = [];
  const normalizedInput = normalizeTeamName(teamId);

  for (const row of rows) {
    const empId = row[0];
    const fullName = row[1];
    const teamAssignment = row[5]; // TEAM column (index 5)
    const currentProject = row[9]; // Current Project column (index 9)

    // Match team (e.g., "Team 1" or "Team one" matches input)
    if (teamAssignment) {
      const normalizedTeam = normalizeTeamName(teamAssignment);

      if (normalizedTeam === normalizedInput ||
          normalizedTeam.includes(normalizedInput) ||
          normalizedInput.includes(normalizedTeam)) {
        teamMembers.push({
          empId,
          fullName,
          teamAssignment
        });
      }
    }
  }

  return teamMembers;
}

async function findOrCreateSupplier(vendor) {
  console.log(`  🏢 Processing supplier: ${vendor.companyName}`);

  const suppliers = await getSheetData('Suppliers');
  const rows = suppliers.slice(1);

  // Find existing supplier
  for (const row of rows) {
    const rowName = row[1]; // Company Name column
    if (fuzzyMatch(rowName, vendor.companyName)) {
      const suppId = row[0];
      console.log(`     ✓ Found existing supplier: ${suppId}`);
      return suppId;
    }
  }

  // Create new supplier
  const nextId = `SUP${String(rows.length + 1).padStart(3, '0')}`;
  const newRow = [
    nextId,
    vendor.companyName,
    '', // contact name
    '', // phone
    '', // email
    vendor.vendorType,
    'Active',
    'Auto-created from AI'
  ];

  await appendToSheet('Suppliers', [newRow]);
  console.log(`     ✨ Created new supplier: ${nextId}`);
  return nextId;
}

// ========================================
// DYNAMODB FUNCTIONS
// ========================================

async function writeToDynamoDB_Report(extracted, context) {
  const { reportId, reportDate, projectId, managerName, conversationId, s3Url } = context;

  const item = {
    PK: `PROJECT#${projectId}`,
    SK: `REPORT#${reportDate}#${reportId}`,
    report_id: reportId,
    project_id: projectId,
    manager_id: context.managerId || 'unknown',
    report_date: reportDate,
    manager_name: managerName,
    conversation_id: conversationId || '',
    total_personnel: extracted.timeSummary.totalPersonnelCount,
    total_regular_hours: extracted.timeSummary.totalRegularHours,
    total_overtime_hours: extracted.timeSummary.totalOvertimeHours,
    transcript_s3_path: s3Url || '',
    report_html_url: '', // Will be updated after HTML generation
    status: 'Generated',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await docClient.send(new PutCommand({
    TableName: TABLES.REPORTS,
    Item: item
  }));

  console.log(`   ✅ DynamoDB: Report record saved`);
}

async function writeToDynamoDB_Personnel(extracted, context) {
  const { reportId, reportDate, projectId } = context;

  const batchItems = extracted.personnel.map(person => ({
    PutRequest: {
      Item: {
        PK: `REPORT#${reportId}`,
        SK: `PERSON#${person.fullName}`,
        full_name: person.fullName,
        go_by_name: person.goByName || person.fullName?.split(' ')[0] || '',
        position: person.position || 'Worker',
        team_assignment: person.teamAssignment || '',
        hours_worked: person.hoursWorked || 0,
        overtime_hours: person.overtimeHours || 0,
        health_status: person.healthStatus || 'Healthy',
        project_id: projectId,
        report_date: reportDate,
        report_id: reportId,
        created_at: new Date().toISOString()
      }
    }
  }));

  // DynamoDB batch write max 25 items at a time
  for (let i = 0; i < batchItems.length; i += 25) {
    const batch = batchItems.slice(i, i + 25);
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLES.PERSONNEL]: batch
      }
    }));
  }

  console.log(`   ✅ DynamoDB: ${extracted.personnel.length} personnel records saved`);
}

async function writeToDynamoDB_Vendors(extracted, context) {
  const { reportId, reportDate, projectId } = context;

  if (extracted.vendors.length === 0) return;

  const batchItems = extracted.vendors.map(vendor => {
    // Determine delivery status
    let deliveryStatus = 'On-Time';
    const notes = String(vendor.notes || vendor.extractedFromText || '');
    const notesLower = notes.toLowerCase();

    if (notesLower.includes('late') || notesLower.includes('delayed') || notesLower.includes('back-ordered')) {
      deliveryStatus = 'Late';
    } else if (notesLower.includes('early') || notesLower.includes('ahead')) {
      deliveryStatus = 'Early';
    } else if (notesLower.includes('cancel')) {
      deliveryStatus = 'Canceled';
    }

    return {
      PutRequest: {
        Item: {
          PK: `VENDOR#${vendor.companyName}`,
          SK: `DELIVERY#${reportDate}#${reportId}`,
          company_name: vendor.companyName || vendor.name || 'Unknown',
          materials_delivered: vendor.materialsDelivered || '',
          delivery_time: vendor.deliveryTime || '',
          delivery_status: deliveryStatus, // NEW: Status field
          notes: vendor.notes || '',
          project_id: projectId,
          report_date: reportDate,
          report_id: reportId,
          created_at: new Date().toISOString()
        }
      }
    };
  });

  for (let i = 0; i < batchItems.length; i += 25) {
    const batch = batchItems.slice(i, i + 25);
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLES.VENDORS]: batch
      }
    }));
  }

  console.log(`   ✅ DynamoDB: ${extracted.vendors.length} vendor records saved`);
}

async function writeToDynamoDB_Constraints(extracted, context) {
  const { reportId, reportDate, projectId } = context;

  if (extracted.constraints.length === 0) return;

  const batchItems = extracted.constraints.map((constraint, index) => ({
    PutRequest: {
      Item: {
        PK: `PROJECT#${projectId}`,
        SK: `CONSTRAINT#${reportDate}#${reportId}#${index}`,
        category: constraint.category || 'General',
        severity: constraint.severity || 'medium',
        level: constraint.level || '',
        title: constraint.title || '',
        description: constraint.description || '',
        status: constraint.status || 'Open',
        assigned_to: constraint.assignedTo || '',
        project_id: projectId,
        report_date: reportDate,
        report_id: reportId,
        created_at: new Date().toISOString()
      }
    }
  }));

  for (let i = 0; i < batchItems.length; i += 25) {
    const batch = batchItems.slice(i, i + 25);
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLES.CONSTRAINTS]: batch
      }
    }));
  }

  console.log(`   ✅ DynamoDB: ${extracted.constraints.length} constraint records saved`);
}

async function updateDynamoDB_ReportURL(reportId, projectId, htmlReportUrl) {
  // Update the report record with the HTML URL
  const params = {
    TableName: TABLES.REPORTS,
    Key: {
      PK: `PROJECT#${projectId}`,
      SK: { $gte: `REPORT#`, $lte: `REPORT#${reportId}` }
    },
    UpdateExpression: 'SET report_html_url = :url, updated_at = :updated',
    ExpressionAttributeValues: {
      ':url': htmlReportUrl,
      ':updated': new Date().toISOString()
    }
  };

  // Find the specific report first
  const queryParams = {
    TableName: TABLES.REPORTS,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `PROJECT#${projectId}`,
      ':sk': 'REPORT#'
    },
    FilterExpression: 'report_id = :rid',
    ExpressionAttributeValues: {
      ':pk': `PROJECT#${projectId}`,
      ':sk': 'REPORT#',
      ':rid': reportId
    }
  };

  try {
    const result = await docClient.send(new QueryCommand(queryParams));
    if (result.Items && result.Items.length > 0) {
      const item = result.Items[0];
      await docClient.send(new PutCommand({
        TableName: TABLES.REPORTS,
        Item: {
          ...item,
          report_html_url: htmlReportUrl,
          updated_at: new Date().toISOString()
        }
      }));
      console.log(`   ✅ DynamoDB: Report URL updated`);
    }
  } catch (err) {
    console.error(`   ⚠️  DynamoDB: Could not update report URL:`, err.message);
  }
}

async function populateDatabase(extracted, context) {
  console.log('');
  console.log('💾 Populating Database...');
  console.log('');

  const { reportId, reportDate, projectId } = context;

  // 1. Process Personnel
  console.log('👥 Processing Personnel...');
  const manpowerRows = [];
  let logIdCounter = 1;

  for (const person of extracted.personnel) {
    const empId = await findOrCreateEmployee(person);

    const logId = generateShortId('LOG', logIdCounter++);
    manpowerRows.push([
      logId,
      reportDate,
      projectId,
      empId,
      person.fullName,
      person.position,
      person.teamAssignment,
      person.hoursWorked || 0,
      person.overtimeHours || 0,
      person.healthStatus || 'Healthy',
      typeof person.extractedFromText === 'string' ? person.extractedFromText.substring(0, 200) : '',
      reportId
    ]);
  }

  if (manpowerRows.length > 0) {
    await appendToSheet('Daily Manpower Log', manpowerRows);
    console.log(`✅ Added ${manpowerRows.length} manpower entries`);
  }

  // 2. Process Vendors/Deliveries
  console.log('');
  console.log('📦 Processing Deliveries...');
  const deliveryRows = [];

  let deliveryCounter = 1;
  for (const vendor of extracted.vendors) {
    const suppId = await findOrCreateSupplier(vendor);

    // Determine delivery status based on notes or explicit status
    let deliveryStatus = 'On-Time'; // Default
    const notes = String(vendor.notes || vendor.extractedFromText || '');
    const notesLower = notes.toLowerCase();

    if (notesLower.includes('late') || notesLower.includes('delayed') || notesLower.includes('back-ordered')) {
      deliveryStatus = 'Late';
    } else if (notesLower.includes('early') || notesLower.includes('ahead')) {
      deliveryStatus = 'Early';
    } else if (notesLower.includes('cancel')) {
      deliveryStatus = 'Canceled';
    }

    const delivId = generateShortId('DEL', deliveryCounter++);
    deliveryRows.push([
      delivId,
      reportDate,
      projectId,
      suppId,
      vendor.companyName,
      vendor.materialsDelivered,
      vendor.deliveryTime || '',
      deliveryStatus, // NEW: Status column
      vendor.receivedBy || '',
      typeof vendor.extractedFromText === 'string' ? vendor.extractedFromText.substring(0, 200) : '',
      reportId
    ]);
  }

  if (deliveryRows.length > 0) {
    await appendToSheet('Delivery Log', deliveryRows);
    console.log(`✅ Added ${deliveryRows.length} delivery entries`);
  }

  // 3. Process Constraints
  console.log('');
  console.log('⚠️  Processing Constraints...');
  const constraintRows = [];

  let constraintCounter = 1;
  for (const constraint of extracted.constraints) {
    const issueId = generateShortId('ISS', constraintCounter++);
    constraintRows.push([
      issueId,
      reportDate,
      projectId,
      constraint.category,
      constraint.level,
      constraint.severity,
      constraint.title,
      constraint.description,
      constraint.status || 'Open',
      '', // assigned to
      '', // date resolved
      reportId
    ]);
  }

  if (constraintRows.length > 0) {
    await appendToSheet('Constraints Log', constraintRows);
    console.log(`✅ Added ${constraintRows.length} constraint entries`);
  }

  // 4. Process Work Activities
  console.log('');
  console.log('📝 Processing Work Activities...');
  const activityRows = [];

  let activityCounter = 1;
  for (const workLog of extracted.workLogs) {
    const actId = generateShortId('ACT', activityCounter++);

    // Determine personnel assigned
    let personnelNames = '';
    let personnelCount = 0;

    if (workLog.teamId) {
      // Team-based work: Look up team members from roster
      const teamMembers = await getTeamMembers(workLog.teamId, projectId);
      if (teamMembers.length > 0) {
        personnelNames = teamMembers.map(m => m.fullName).join(', ');
        personnelCount = teamMembers.length;
        console.log(`     👥 ${workLog.teamId}: ${personnelCount} members (${personnelNames})`);
      } else {
        // Team mentioned but no members found in roster
        personnelNames = workLog.personnelAssigned?.join(', ') || '';
        personnelCount = workLog.personnelCount || 0;
      }
    } else {
      // Individual work: Use names from AI extraction
      personnelNames = workLog.personnelAssigned?.join(', ') || '';
      personnelCount = workLog.personnelAssigned?.length || workLog.personnelCount || 0;
    }

    activityRows.push([
      actId,
      reportDate,
      projectId,
      workLog.description || workLog.taskDescription, // New combined description field
      workLog.teamId || '', // Team Assignment
      personnelNames, // Personnel Assigned (looked up or extracted)
      personnelCount, // Personnel Count
      workLog.hoursWorked || 0,
      reportId
    ]);
  }

  if (activityRows.length > 0) {
    await appendToSheet('Work Activities Log', activityRows);
    console.log(`✅ Added ${activityRows.length} activity entries`);
  }

  // 5. Add Daily Report record
  console.log('');
  console.log('📊 Recording Daily Report...');

  const { managerName, conversationId, s3Url } = context;

  // Get the next row number for the formula
  const existingReports = await getSheetData('Daily Reports');
  const nextRow = existingReports.length + 1;

  // Use VLOOKUP formula to auto-populate Project Name from Project Sites
  const projectNameFormula = `=IFERROR(VLOOKUP(C${nextRow},'Project Sites'!A:B,2,FALSE),C${nextRow})`;

  const reportRow = [[
    reportId,
    reportDate,
    projectId,
    projectNameFormula, // Formula instead of static value
    managerName,
    conversationId || '',
    'Generated',
    extracted.timeSummary.totalPersonnelCount,
    extracted.timeSummary.totalRegularHours,
    extracted.timeSummary.totalOvertimeHours,
    s3Url,
    '' // report doc URL (will add after generating)
  ]];

  await appendToSheetWithFormulas('Daily Reports', reportRow);
  console.log(`✅ Report record created with VLOOKUP formula`);

  // ========================================
  // WRITE TO DYNAMODB (Dual Database)
  // ========================================
  console.log('');
  console.log('🗄️  Writing to DynamoDB...');

  try {
    await writeToDynamoDB_Report(extracted, context);
    await writeToDynamoDB_Personnel(extracted, context);
    await writeToDynamoDB_Vendors(extracted, context);
    await writeToDynamoDB_Constraints(extracted, context);
    console.log('✅ All data synced to DynamoDB');
  } catch (error) {
    console.error('⚠️  DynamoDB write error:', error.message);
    console.error('   (Google Sheets data is still saved)');
  }

  return reportRow[0]; // Return for later update
}

async function generateGoogleDocReport(extracted, context) {
  console.log('');
  console.log('📄 Generating Google Doc Report...');

  const { reportId, reportDate, projectId, managerName } = context;

  // Get project name from Project Sites sheet
  const projectSites = await getSheetData('Project Sites');
  const projectRow = projectSites.find(row => row[0] === projectId);
  const projectName = projectRow ? projectRow[1] : projectId;

  // Format date nicely (e.g., "September 24, 2025")
  const dateObj = new Date(reportDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const formattedDate = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
  const shortDate = `${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}-${dateObj.getFullYear()}`;

  // Create new Google Doc
  const doc = await docs.documents.create({
    requestBody: {
      title: `Daily Report - ${projectName} - ${shortDate}`
    }
  });

  const docId = doc.data.documentId;
  console.log(`   Document created: ${docId}`);

  // Move to Reports folder - get current parent first, then add new and remove old
  const file = await drive.files.get({
    fileId: docId,
    fields: 'parents'
  });

  const previousParents = file.data.parents ? file.data.parents.join(',') : '';

  await drive.files.update({
    fileId: docId,
    addParents: REPORTS_FOLDER_ID,
    removeParents: previousParents,
    fields: 'id, parents'
  });

  console.log(`   Moved to Reports folder`);

  // Build professional BLUF-style report content
  let content = '';

  // === HEADER ===
  content += `PARKWAY CONSTRUCTION SERVICES\n`;
  content += `Daily Construction Report\n\n`;
  content += `═══════════════════════════════════════════════════════════════\n\n`;

  // === PROJECT INFO ===
  content += `PROJECT: ${projectName}\n`;
  content += `DATE: ${formattedDate}\n`;
  content += `PROJECT MANAGER: ${managerName}\n`;
  content += `REPORT ID: ${reportId}\n\n`;
  content += `═══════════════════════════════════════════════════════════════\n\n`;

  // === BLUF (BOTTOM LINE UP FRONT) ===
  content += `BOTTOM LINE UP FRONT\n\n`;

  // Check for critical issues
  const criticalIssues = extracted.constraints.filter(c => c.severity === 'high');
  const injuries = extracted.personnel.filter(p => p.healthStatus && p.healthStatus.toLowerCase().includes('injury'));
  const hasInjuries = injuries.length > 0;
  const hasCriticalIssues = criticalIssues.length > 0;

  if (hasInjuries || hasCriticalIssues) {
    content += `⚠️ CRITICAL ALERTS:\n`;
    if (hasInjuries) {
      for (const person of injuries) {
        content += `  • INJURY REPORTED: ${person.fullName} - ${person.healthStatus}\n`;
      }
    }
    if (hasCriticalIssues) {
      for (const issue of criticalIssues) {
        content += `  • HIGH SEVERITY ISSUE: ${issue.title} - ${issue.description}\n`;
      }
    }
    content += `\n`;
  }

  // Summary metrics
  content += `Personnel on Site: ${extracted.personnel.length}\n`;
  content += `Total Hours: ${extracted.timeSummary.totalRegularHours} regular + ${extracted.timeSummary.totalOvertimeHours} overtime = ${extracted.timeSummary.totalRegularHours + extracted.timeSummary.totalOvertimeHours} total\n`;
  content += `Work Activities: ${extracted.workLogs.length} completed\n`;
  if (extracted.constraints.length > 0) {
    content += `Issues: ${extracted.constraints.length} (${criticalIssues.length} high priority)\n`;
  }
  if (extracted.vendors.length > 0) {
    content += `Deliveries: ${extracted.vendors.length} received\n`;
  }
  content += `\n`;

  // === NARRATIVE SUMMARY ===
  content += `DAILY SUMMARY\n\n`;

  // Generate narrative from work activities
  const workByTeam = {};
  for (const work of extracted.workLogs) {
    const team = work.teamId || 'General';
    if (!workByTeam[team]) {
      workByTeam[team] = [];
    }
    workByTeam[team].push(work);
  }

  const teamCount = Object.keys(workByTeam).length;
  content += `Today's work involved ${extracted.personnel.length} personnel across ${teamCount} team${teamCount > 1 ? 's' : ''}, `;
  content += `completing ${extracted.workLogs.length} major activities. `;

  // Highlight key accomplishments
  const accomplishments = [];
  for (const [team, activities] of Object.entries(workByTeam)) {
    if (activities.length > 0) {
      accomplishments.push(`${team} focused on ${activities.map(a => a.description.toLowerCase()).join(', ')}`);
    }
  }
  content += accomplishments.join('; ') + '. ';

  if (extracted.vendors.length > 0) {
    content += `Material deliveries were received from ${extracted.vendors.map(v => v.companyName || v.name).join(', ')}. `;
  }

  if (extracted.constraints.length > 0) {
    content += `${extracted.constraints.length} issue${extracted.constraints.length > 1 ? 's were' : ' was'} identified requiring attention.`;
  } else {
    content += `No significant issues or delays reported.`;
  }

  content += `\n\n`;

  // === WORK ACTIVITIES & ACCOMPLISHMENTS ===
  content += `WORK ACTIVITIES & ACCOMPLISHMENTS\n\n`;

  for (const [team, activities] of Object.entries(workByTeam)) {
    content += `${team}:\n`;
    for (const activity of activities) {
      content += `  • ${activity.description}\n`;
      if (activity.personnelAssigned && activity.personnelAssigned.length > 0) {
        content += `    Crew: ${activity.personnelAssigned.join(', ')}\n`;
      }
      if (activity.hoursWorked) {
        content += `    Hours: ${activity.hoursWorked}\n`;
      }
    }
    content += `\n`;
  }

  // === ISSUES & CONSTRAINTS ===
  if (extracted.constraints.length > 0) {
    content += `ISSUES & CONSTRAINTS\n\n`;

    // Group by severity, then by level
    const highPriority = extracted.constraints.filter(c => c.severity === 'high');
    const mediumPriority = extracted.constraints.filter(c => c.severity === 'medium');
    const lowPriority = extracted.constraints.filter(c => c.severity === 'low' || !c.severity);

    const printConstraints = (constraints, severityLabel) => {
      if (constraints.length === 0) return;

      content += `${severityLabel}:\n`;

      const byLevel = {};
      for (const constraint of constraints) {
        const level = constraint.level || 'General';
        if (!byLevel[level]) byLevel[level] = [];
        byLevel[level].push(constraint);
      }

      for (const [level, items] of Object.entries(byLevel)) {
        content += `  ${level}:\n`;
        for (const item of items) {
          content += `    • ${item.title}\n`;
          content += `      Description: ${item.description}\n`;
          content += `      Status: ${item.status}\n`;
          if (item.assignedTo) {
            content += `      Assigned to: ${item.assignedTo}\n`;
          }
        }
      }
      content += `\n`;
    };

    printConstraints(highPriority, '🔴 HIGH PRIORITY');
    printConstraints(mediumPriority, '🟡 MEDIUM PRIORITY');
    printConstraints(lowPriority, '🟢 LOW PRIORITY');
  }

  // === DELIVERIES ===
  if (extracted.vendors.length > 0) {
    content += `MATERIAL DELIVERIES\n\n`;

    // Table header
    content += `Supplier\tMaterials\tDelivery Time\tNotes\n`;
    content += `─────────────────────────────────────────────────────────────────\n`;

    for (const vendor of extracted.vendors) {
      const supplier = vendor.companyName || vendor.name || 'Unknown';
      const materials = vendor.materialsDelivered || 'N/A';
      const time = vendor.deliveryTime || 'N/A';
      const notes = vendor.notes || '-';

      content += `${supplier}\t${materials}\t${time}\t${notes}\n`;
    }
    content += `\n`;

    // Narrative section if there are delivery notes
    const vendorsWithNotes = extracted.vendors.filter(v => v.notes && v.notes.length > 10);
    if (vendorsWithNotes.length > 0) {
      content += `Delivery Notes:\n`;
      for (const vendor of vendorsWithNotes) {
        content += `  • ${vendor.companyName || vendor.name}: ${vendor.notes}\n`;
      }
      content += `\n`;
    }
  }

  // === PERSONNEL ROSTER (AT BOTTOM) ===
  content += `PERSONNEL ROSTER\n\n`;

  // Group by team for better readability
  const personnelByTeam = {};
  for (const person of extracted.personnel) {
    const team = person.teamAssignment || 'Management/Support';
    if (!personnelByTeam[team]) {
      personnelByTeam[team] = [];
    }
    personnelByTeam[team].push(person);
  }

  for (const [team, people] of Object.entries(personnelByTeam)) {
    content += `${team} (${people.length} personnel):\n`;
    for (const person of people) {
      const goByName = person.goByName || person.fullName?.split(' ')[0] || '';
      const status = person.healthStatus === 'Healthy' ? '✓' : '⚠';
      content += `  ${status} ${person.fullName} (${goByName}) - ${person.position || 'Worker'} - ${person.hoursWorked || 8}h`;
      if (person.overtimeHours && person.overtimeHours > 0) {
        content += ` + ${person.overtimeHours}h OT`;
      }
      if (person.healthStatus && person.healthStatus !== 'Healthy') {
        content += ` [${person.healthStatus}]`;
      }
      content += `\n`;
    }
    content += `\n`;
  }

  // === FOOTER ===
  content += `═══════════════════════════════════════════════════════════════\n\n`;
  content += `Report generated: ${new Date().toLocaleString()}\n`;
  content += `Contact: ${managerName}\n`;

  // Insert all content
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: content
          }
        }
      ]
    }
  });

  // Apply formatting
  const formatRequests = [];
  let currentIndex = 1;

  // Company name - large, bold, centered
  formatRequests.push({
    updateTextStyle: {
      range: { startIndex: currentIndex, endIndex: currentIndex + 'PARKWAY CONSTRUCTION SERVICES'.length },
      textStyle: {
        bold: true,
        fontSize: { magnitude: 18, unit: 'PT' },
        foregroundColor: { color: { rgbColor: { red: 0.2, green: 0.4, blue: 0.6 } } }
      },
      fields: 'bold,fontSize,foregroundColor'
    }
  });

  formatRequests.push({
    updateParagraphStyle: {
      range: { startIndex: currentIndex, endIndex: currentIndex + 'PARKWAY CONSTRUCTION SERVICES'.length + 1 },
      paragraphStyle: { alignment: 'CENTER' },
      fields: 'alignment'
    }
  });

  currentIndex += 'PARKWAY CONSTRUCTION SERVICES'.length + 1;

  // Subtitle - centered
  formatRequests.push({
    updateTextStyle: {
      range: { startIndex: currentIndex, endIndex: currentIndex + 'Daily Construction Report'.length },
      textStyle: {
        bold: true,
        fontSize: { magnitude: 14, unit: 'PT' }
      },
      fields: 'bold,fontSize'
    }
  });

  formatRequests.push({
    updateParagraphStyle: {
      range: { startIndex: currentIndex, endIndex: currentIndex + 'Daily Construction Report'.length + 1 },
      paragraphStyle: { alignment: 'CENTER' },
      fields: 'alignment'
    }
  });

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests: formatRequests }
  });

  const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
  console.log(`✅ Report generated: ${docUrl}`);

  return docUrl;
}

async function saveHTMLReportToS3(extracted, context) {
  console.log('');
  console.log('📄 Generating HTML Report...');

  const { reportId, reportDate, projectId, managerName, projectName } = context;

  // Generate beautiful HTML report
  const htmlContent = generateHTMLReport(extracted, context);

  // Save to S3 in the same folder as the transcript
  const [year, month, day] = reportDate.split('-');
  const s3Key = `SITELOGIX/projects/${projectId}/reports/${year}/${month}/${day}/${reportId}/report.html`;

  console.log(`   Uploading HTML to S3: ${s3Key}`);

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: htmlContent,
    ContentType: 'text/html',
    CacheControl: 'no-cache'
  });

  await s3Client.send(command);

  // Generate public URL
  const reportUrl = `https://${BUCKET}.s3.amazonaws.com/${s3Key}`;

  console.log(`✅ HTML Report saved: ${reportUrl}`);

  return reportUrl;
}

async function main() {
  try {
    console.log('='.repeat(80));
    console.log('🚀 Processing Report to Construction CRM');
    console.log('='.repeat(80));

    initializeGoogle();

    const info = extractReportInfo(s3Key);
    console.log('');
    console.log('Report Info:');
    console.log(`  Report ID: ${info.reportId}`);
    console.log(`  Project ID: ${info.projectId}`);
    console.log(`  Manager ID: ${info.managerId}`);
    console.log(`  Date: ${info.reportDate}`);
    console.log('');

    // Fetch transcript
    const transcript = await fetchTranscriptFromS3(s3Key);
    console.log(`📥 Fetching transcript from S3...`);
    console.log(`✅ Transcript loaded (${transcript.transcript?.length || 0} messages)`);

    // Extract conversation ID from transcript
    const conversationId = transcript.conversationId || transcript.conversation_id || '';

    // Lookup project name and manager name
    console.log(`🔍 Looking up project and manager details...`);
    const projectName = await lookupProjectName(info.projectId);
    const managerName = await lookupManagerName(info.managerId);
    console.log(`   Project: ${projectName}`);
    console.log(`   Manager: ${managerName}`);
    console.log(`   Conversation ID: ${conversationId || 'N/A'}`);

    const extracted = await analyzeWithClaude(transcript, {
      projectName,
      reportDate: info.reportDate
    });

    console.log('✅ AI Analysis complete:');
    console.log(`   Personnel: ${extracted.personnel.length}`);
    console.log(`   Work Logs: ${extracted.workLogs.length}`);
    console.log(`   Constraints: ${extracted.constraints.length}`);
    console.log(`   Vendors: ${extracted.vendors.length}`);

    await populateDatabase(extracted, {
      reportId: info.reportId,
      reportDate: info.reportDate,
      projectId: info.projectId,
      managerId: info.managerId,
      managerName,
      conversationId,
      s3Url: info.s3Url
    });

    // Generate HTML Report (saved to S3)
    const htmlReportUrl = await saveHTMLReportToS3(extracted, {
      reportId: info.reportId,
      reportDate: info.reportDate,
      projectId: info.projectId,
      projectName,
      managerName
    });

    // Also generate Google Doc for backup
    const docUrl = await generateGoogleDocReport(extracted, {
      reportId: info.reportId,
      reportDate: info.reportDate,
      projectId: info.projectId,
      projectName,
      managerName
    });

    // Update Daily Report with doc URL (use HTML report URL)
    await updateReportDocUrl(info.reportId, htmlReportUrl);

    // Update DynamoDB with HTML report URL
    await updateDynamoDB_ReportURL(info.reportId, info.projectId, htmlReportUrl);

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ Processing Complete!');
    console.log('='.repeat(80));
    console.log('');
    console.log('📊 Database Updated:');
    console.log(`   View: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
    console.log('');
    console.log('📄 HTML Report:');
    console.log(`   View: ${htmlReportUrl}`);
    console.log('');
    console.log('📄 Google Doc Backup:');
    console.log(`   View: ${docUrl}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
