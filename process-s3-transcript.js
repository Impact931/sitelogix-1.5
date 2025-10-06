/**
 * Process Transcript Directly from S3
 *
 * This processes a transcript file from S3 without needing a DynamoDB report record
 */

require('dotenv').config();
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = 'sitelogix-prod';

// Get command line argument
const s3Key = process.argv[2];

if (!s3Key) {
  console.error('Usage: node process-s3-transcript.js <s3-key>');
  console.error('');
  console.error('Available transcripts:');
  console.error('  SITELOGIX/projects/proj_001/reports/2025/10/04/rpt_20251005_mgr_001_1759706117587/transcript.json');
  console.error('  SITELOGIX/projects/proj_002/reports/2025/10/04/rpt_20251005_mgr_002_1759702702561/transcript.json');
  console.error('  SITELOGIX/projects/proj_002/reports/2025/10/04/rpt_20251005_mgr_002_1759703743885/transcript.json');
  process.exit(1);
}

async function fetchTranscriptFromS3(key) {
  console.log(`📥 Fetching transcript from S3: ${key}`);

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key
  });

  const response = await s3Client.send(command);
  const body = await response.Body.transformToString();
  return JSON.parse(body);
}

function extractReportInfo(s3Key) {
  // Extract from path: SITELOGIX/projects/{projectId}/reports/{year}/{month}/{day}/{reportId}/transcript.json
  const parts = s3Key.split('/');
  const reportId = parts[parts.length - 2];
  const projectId = parts[3];
  const year = parts[5];
  const month = parts[6];
  const day = parts[7];
  const reportDate = `${year}-${month}-${day}`;

  return {
    reportId,
    projectId,
    reportDate
  };
}

async function analyzeWithClaude(transcript, context) {
  console.log('🤖 Analyzing with Claude 3.5 Sonnet...');

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  // Convert transcript to text
  const messages = transcript.transcript || [];
  const rawText = messages.map(m =>
    `${m.role === 'user' ? 'Manager' : 'Roxy'}: ${m.message}`
  ).join('\n\n');

  const prompt = `You are an AI assistant specialized in extracting structured construction data from daily report conversations.

CONTEXT:
- Project: ${context.projectName || 'Unknown'}
- Report Date: ${context.reportDate}

TRANSCRIPT:
${rawText}

TASK:
Extract ALL of the following information in JSON format:

1. PERSONNEL:
For each person mentioned, extract:
- fullName: Full name
- goByName: Nickname or "go by" name
- position: Position (Project Manager, Foreman, Journeyman, Apprentice)
- teamAssignment: Team (Project Manager, Team 1, Team 2, etc.)
- hoursWorked: Hours worked (number)
- overtimeHours: Overtime hours (number, default 0)
- healthStatus: Health status (Healthy, N/A, or limitation)
- extractedFromText: Quote the exact text

2. WORK ACTIVITIES (workLogs):
For each team, extract:
- teamId: Team identifier
- level: Building level or area
- personnelAssigned: Array of names
- personnelCount: Number of personnel
- taskDescription: What they worked on
- hoursWorked: Total team hours
- extractedFromText: Quote exact text

3. CONSTRAINTS (constraints):
For each issue, extract:
- category: delay, safety, material, weather, labor, coordination, other
- level: Building level
- severity: low, medium, high, critical
- title: Short title
- description: Full description
- status: open, in_progress, resolved
- extractedFromText: Quote exact text

4. VENDORS (vendors):
For each delivery, extract:
- companyName: Company name
- vendorType: supplier, subcontractor, rental, other
- materialsDelivered: Description
- deliveryTime: Time if mentioned
- receivedBy: Person who received
- extractedFromText: Quote exact text

5. TIME SUMMARY (timeSummary):
- totalPersonnelCount: Total unique personnel
- totalRegularHours: Sum of all regular hours
- totalOvertimeHours: Sum of overtime hours
- arrivalTime: Arrival time if mentioned
- departureTime: Departure time if mentioned

Return ONLY valid JSON with structure: { personnel, workLogs, constraints, vendors, timeSummary }`;

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 8000,
    temperature: 0,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  const content = message.content[0];
  let jsonText = content.text.trim();

  // Remove markdown code fences if present
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n/, '').replace(/\n```$/, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n/, '').replace(/\n```$/, '');
  }

  return JSON.parse(jsonText);
}

async function writeToGoogleSheets(reportData) {
  console.log('📊 Writing to Google Sheets...');

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.Google_Client_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_Secret;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.Google_Refresh_Token;
  const sheetsUrl = process.env.GOOGLE_SHEETS_URL;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3000');
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  const spreadsheetId = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)[1];
  const sheetName = reportData.reportDate;

  // Create new sheet
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title: sheetName }
          }
        }]
      }
    });
  } catch (error) {
    if (!error.message.includes('already exists')) {
      throw error;
    }
  }

  // Build data
  const headerData = [
    ['', '', '', 'Parkway Construction Services', '', '', '', `Date:${reportData.reportDate}`],
    ['', '', '', reportData.projectName, '', '', '', ''],
    ['']
  ];

  const columnHeaders = [
    ['Full Name', 'Go By', 'Position', 'Team #', 'Limitations', 'Hours', 'O/T']
  ];

  const personnelRows = reportData.personnel.map(p => [
    p.fullName,
    p.goByName,
    p.position,
    p.teamAssignment,
    p.healthStatus || 'Healthy',
    p.hoursWorked || 0,
    p.overtimeHours || 0
  ]);

  const totalRow = [
    [`Total pax:`, reportData.totalHeadcount, '', '', '', '', '', '', '', '', '', 'Regular', 'Overtime'],
    ['', '', '', '', '', '', '', '', '', '', 'Total Hours:', reportData.totalRegularHours, reportData.totalOvertimeHours]
  ];

  const tasksSectionHeader = [
    ['', '', '', '', 'TASKS', '', '', '', 'CONSTRAINTS BY LEVEL']
  ];

  const tasksHeaders = [
    ['Team', '', 'Task:', '', '', '', '', 'Level', 'Constraint']
  ];

  const maxRows = Math.max(reportData.workLogs.length, reportData.constraints.length);
  const tasksAndConstraintsRows = [];

  for (let i = 0; i < maxRows; i++) {
    const workLog = reportData.workLogs[i];
    const constraint = reportData.constraints[i];

    tasksAndConstraintsRows.push([
      workLog?.teamId || '',
      '',
      workLog?.taskDescription || '',
      '',
      '',
      '',
      '',
      constraint?.level || '',
      constraint?.description || ''
    ]);
  }

  // Write all data
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: `${sheetName}!A1:H3`, values: headerData },
        { range: `${sheetName}!A7:G7`, values: columnHeaders },
        { range: `${sheetName}!A8:G${7 + personnelRows.length}`, values: personnelRows },
        { range: `${sheetName}!A${8 + personnelRows.length}:M${9 + personnelRows.length}`, values: totalRow },
        { range: `${sheetName}!A${12 + personnelRows.length}:I${12 + personnelRows.length}`, values: tasksSectionHeader },
        { range: `${sheetName}!A${14 + personnelRows.length}:I${14 + personnelRows.length}`, values: tasksHeaders },
        { range: `${sheetName}!A${15 + personnelRows.length}:I${14 + personnelRows.length + tasksAndConstraintsRows.length}`, values: tasksAndConstraintsRows }
      ]
    }
  });

  console.log(`✅ Report written to sheet: ${sheetName}`);
}

async function main() {
  try {
    console.log('='.repeat(80));
    console.log('🚀 Processing S3 Transcript');
    console.log('='.repeat(80));
    console.log('');

    // Extract report info from path
    const info = extractReportInfo(s3Key);
    console.log('Report Info:');
    console.log(`  Report ID: ${info.reportId}`);
    console.log(`  Project ID: ${info.projectId}`);
    console.log(`  Report Date: ${info.reportDate}`);
    console.log('');

    // Fetch transcript
    const transcript = await fetchTranscriptFromS3(s3Key);
    console.log(`✅ Transcript loaded (${transcript.transcript?.length || 0} messages)`);
    console.log('');

    // Analyze with AI
    const extracted = await analyzeWithClaude(transcript, {
      projectName: info.projectId,
      reportDate: info.reportDate
    });

    console.log('✅ AI Analysis complete:');
    console.log(`   Personnel: ${extracted.personnel.length}`);
    console.log(`   Work Logs: ${extracted.workLogs.length}`);
    console.log(`   Constraints: ${extracted.constraints.length}`);
    console.log(`   Vendors: ${extracted.vendors.length}`);
    console.log('');

    // Prepare report data for Google Sheets
    const reportData = {
      reportId: info.reportId,
      reportDate: info.reportDate,
      projectName: info.projectId,
      projectLocation: 'Unknown',
      managerName: 'Unknown',
      personnel: extracted.personnel,
      workLogs: extracted.workLogs,
      constraints: extracted.constraints,
      totalHeadcount: extracted.timeSummary.totalPersonnelCount,
      totalRegularHours: extracted.timeSummary.totalRegularHours,
      totalOvertimeHours: extracted.timeSummary.totalOvertimeHours
    };

    // Write to Google Sheets
    await writeToGoogleSheets(reportData);

    console.log('='.repeat(80));
    console.log('✅ Processing Complete!');
    console.log('='.repeat(80));
    console.log('');
    console.log('Check your Google Sheets for the new report.');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
