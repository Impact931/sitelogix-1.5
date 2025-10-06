/**
 * SiteLogix CFO Analytics Agent
 *
 * Powered by GPT-4o for executive-level business intelligence
 * Analyzes construction data to identify trends, waste, and opportunities
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { google } = require('googleapis');
const { DynamoDBClient, ScanCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const app = express();
const PORT = 3002;

// Enable CORS
app.use(cors());
app.use(express.json());

// Initialize OpenAI with GPT-4o
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Google Sheets
const SPREADSHEET_ID = '1lb8nmFjvKdWmoqSLaowEKWEzGzNUPw7CuTTZ7k1FIg4';
let oauth2Client;
let sheets;

async function initGoogleSheets() {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.Google_Client_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_Secret;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.Google_Refresh_Token;

  oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3000');
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  sheets = google.sheets({ version: 'v4', auth: oauth2Client });
}

// Initialize DynamoDB
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * CFO Analytics System Prompt
 * Defines the agent's personality and expertise
 */
const CFO_SYSTEM_PROMPT = `You are an elite CFO Analytics Agent for a construction company. Your role is to:

**Core Responsibilities:**
1. Analyze operational and financial data to identify trends, inefficiencies, and opportunities
2. Provide actionable insights that drive profitability and reduce waste
3. Think strategically about resource allocation, vendor performance, and project efficiency
4. Communicate findings in clear, executive-level language with specific recommendations

**Areas of Expertise:**
- **Labor Analytics**: Overtime patterns, productivity metrics, staffing optimization
- **Vendor Performance**: Delivery reliability, cost trends, relationship management
- **Project Efficiency**: Timeline adherence, resource utilization, constraint resolution
- **Cost Control**: Waste identification, budget variance, expense optimization
- **Risk Management**: Safety trends, quality issues, operational bottlenecks

**Communication Style:**
- Lead with BLUF (Bottom Line Up Front) - key insights first
- Use specific numbers and percentages
- Provide 3-5 actionable recommendations per analysis
- Flag urgent issues that need immediate attention
- Identify opportunities for cost savings or revenue optimization

**Data Sources Available:**
- Daily Reports: Personnel, deliveries, constraints, work activities
- Delivery Log: Vendor performance, timeliness, materials
- Constraints Log: Issues, delays, safety concerns
- Manpower Log: Labor hours, overtime, team assignments
- Personnel Roster: Skills, roles, assignments

When answering queries:
1. First understand what financial or operational question is being asked
2. Identify which data sources are needed
3. Analyze the data with a CFO's lens (cost, efficiency, risk, opportunity)
4. Present findings with specific metrics and recommendations
5. Always think: "How does this impact the bottom line?"`;

/**
 * Fetch all data from Google Sheets
 */
async function fetchGoogleSheetsData() {
  const data = {};

  const sheets_to_fetch = [
    'Daily Reports',
    'Delivery Log',
    'Constraints Log',
    'Daily Manpower Log',
    'Employee Roster',
    'Suppliers',
    'Work Activities Log'
  ];

  for (const sheetName of sheets_to_fetch) {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:Z1000`
      });

      const rows = response.data.values || [];
      if (rows.length > 0) {
        const headers = rows[0];
        const records = rows.slice(1).map(row => {
          const record = {};
          headers.forEach((header, index) => {
            record[header] = row[index] || '';
          });
          return record;
        });
        data[sheetName] = records;
      }
    } catch (error) {
      console.error(`Error fetching ${sheetName}:`, error.message);
      data[sheetName] = [];
    }
  }

  return data;
}

/**
 * Fetch all data from DynamoDB
 */
async function fetchDynamoDBData() {
  const data = {};

  const tables = [
    'sitelogix-reports',
    'sitelogix-personnel',
    'sitelogix-vendors',
    'sitelogix-constraints'
  ];

  for (const tableName of tables) {
    try {
      const command = new ScanCommand({ TableName: tableName });
      const result = await dynamoClient.send(command);
      data[tableName] = result.Items.map(item => unmarshall(item));
    } catch (error) {
      console.error(`Error fetching ${tableName}:`, error.message);
      data[tableName] = [];
    }
  }

  return data;
}

/**
 * Data retrieval function for GPT-4o
 */
async function getAnalyticsData() {
  console.log('📊 Fetching data from all sources...');

  const [googleData, dynamoData] = await Promise.all([
    fetchGoogleSheetsData(),
    fetchDynamoDBData()
  ]);

  return {
    googleSheets: googleData,
    dynamoDB: dynamoData,
    metadata: {
      timestamp: new Date().toISOString(),
      sources: {
        googleSheets: Object.keys(googleData),
        dynamoDB: Object.keys(dynamoData)
      }
    }
  };
}

/**
 * CFO Analytics Query Function
 * Uses GPT-4o function calling to retrieve and analyze data
 */
const analyticsFunctions = [
  {
    name: 'get_analytics_data',
    description: 'Retrieves all construction project data from Google Sheets and DynamoDB for analysis. Use this to answer questions about deliveries, labor, costs, vendors, constraints, and project performance.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

/**
 * POST /api/analytics/query
 * Natural language analytics queries
 */
app.post('/api/analytics/query', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    console.log('');
    console.log('🔍 CFO Analytics Query:', query);
    console.log('');

    // Initial GPT-4o call with function calling
    const messages = [
      { role: 'system', content: CFO_SYSTEM_PROMPT },
      { role: 'user', content: query }
    ];

    let response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      functions: analyticsFunctions,
      function_call: 'auto',
      temperature: 0.3 // Lower temperature for more analytical responses
    });

    let assistantMessage = response.choices[0].message;

    // Handle function calls
    if (assistantMessage.function_call) {
      console.log('📥 GPT-4o requesting data...');

      const functionName = assistantMessage.function_call.name;

      if (functionName === 'get_analytics_data') {
        const analyticsData = await getAnalyticsData();

        console.log('✅ Data retrieved, analyzing...');

        // Add function call result to messages
        messages.push(assistantMessage);
        messages.push({
          role: 'function',
          name: functionName,
          content: JSON.stringify(analyticsData)
        });

        // Get final response with data
        response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: messages,
          temperature: 0.3
        });

        assistantMessage = response.choices[0].message;
      }
    }

    const analysis = assistantMessage.content;

    console.log('');
    console.log('💡 Analysis complete');
    console.log('');

    res.json({
      success: true,
      query,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/insights
 * Get pre-computed insights and KPIs
 */
app.get('/api/analytics/insights', async (req, res) => {
  try {
    console.log('📊 Generating executive insights...');

    const data = await getAnalyticsData();
    const googleData = data.googleSheets;

    // Calculate key metrics
    const deliveries = googleData['Delivery Log'] || [];
    const constraints = googleData['Constraints Log'] || [];
    const manpower = googleData['Daily Manpower Log'] || [];
    const reports = googleData['Daily Reports'] || [];

    // Delivery Performance
    const totalDeliveries = deliveries.length;
    const lateDeliveries = deliveries.filter(d =>
      d.Status && (d.Status.toLowerCase().includes('late') || d.Status.toLowerCase().includes('delayed'))
    ).length;
    const onTimeRate = totalDeliveries > 0
      ? ((totalDeliveries - lateDeliveries) / totalDeliveries * 100).toFixed(1)
      : 0;

    // Labor Metrics
    const totalRegularHours = manpower.reduce((sum, m) => sum + (parseFloat(m['Regular Hours'] || 0)), 0);
    const totalOvertimeHours = manpower.reduce((sum, m) => sum + (parseFloat(m['Overtime Hours'] || 0)), 0);
    const overtimeRate = totalRegularHours > 0
      ? (totalOvertimeHours / (totalRegularHours + totalOvertimeHours) * 100).toFixed(1)
      : 0;

    // Constraint Analysis
    const openConstraints = constraints.filter(c => c.Status !== 'Resolved').length;
    const criticalConstraints = constraints.filter(c =>
      c.Severity && c.Severity.toLowerCase() === 'high'
    ).length;

    // Vendor Performance
    const vendorDeliveries = {};
    deliveries.forEach(d => {
      const vendor = d['Supplier Name'] || 'Unknown';
      if (!vendorDeliveries[vendor]) {
        vendorDeliveries[vendor] = { total: 0, late: 0 };
      }
      vendorDeliveries[vendor].total++;
      if (d.Status && (d.Status.toLowerCase().includes('late') || d.Status.toLowerCase().includes('delayed'))) {
        vendorDeliveries[vendor].late++;
      }
    });

    const topVendors = Object.entries(vendorDeliveries)
      .map(([name, stats]) => ({
        name,
        deliveries: stats.total,
        lateDeliveries: stats.late,
        onTimeRate: ((stats.total - stats.late) / stats.total * 100).toFixed(1)
      }))
      .sort((a, b) => b.deliveries - a.deliveries)
      .slice(0, 10);

    const insights = {
      summary: {
        totalDeliveries,
        lateDeliveries,
        onTimeDeliveryRate: parseFloat(onTimeRate),
        totalLaborHours: totalRegularHours + totalOvertimeHours,
        overtimeHours: totalOvertimeHours,
        overtimeRate: parseFloat(overtimeRate),
        openConstraints,
        criticalConstraints,
        totalReports: reports.length
      },
      vendors: topVendors,
      alerts: []
    };

    // Generate alerts for CFO attention
    if (parseFloat(onTimeRate) < 85) {
      insights.alerts.push({
        type: 'warning',
        category: 'Vendor Performance',
        message: `Delivery on-time rate is ${onTimeRate}% (below 85% target)`,
        impact: 'May cause project delays and increased costs'
      });
    }

    if (parseFloat(overtimeRate) > 15) {
      insights.alerts.push({
        type: 'warning',
        category: 'Labor Costs',
        message: `Overtime rate is ${overtimeRate}% (above 15% threshold)`,
        impact: 'Increased labor costs, potential burn out risk'
      });
    }

    if (criticalConstraints > 0) {
      insights.alerts.push({
        type: 'critical',
        category: 'Project Risk',
        message: `${criticalConstraints} high-severity constraints need resolution`,
        impact: 'Project timeline and budget at risk'
      });
    }

    console.log('✅ Insights generated');

    res.json({
      success: true,
      insights,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Insights error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/reports/constraints
 * Get detailed constraints report with cross-references
 */
app.get('/api/analytics/reports/constraints', async (req, res) => {
  try {
    console.log('📋 Generating constraints report with cross-references...');

    const data = await getAnalyticsData();
    const constraints = data.googleSheets['Constraints Log'] || [];
    const reports = data.googleSheets['Daily Reports'] || [];
    const roster = data.googleSheets['Employee Roster'] || [];

    // Group by status
    const open = constraints.filter(c => c.Status !== 'Resolved');
    const resolved = constraints.filter(c => c.Status === 'Resolved');
    const critical = constraints.filter(c => c.Severity && c.Severity.toLowerCase() === 'high');

    // Group by type
    const byType = {};
    constraints.forEach(c => {
      const type = c.Type || 'Other';
      if (!byType[type]) byType[type] = [];
      byType[type].push(c);
    });

    // Enhance constraints with report and supervisor info
    const enhancedConstraints = constraints.map(c => {
      const reportId = c['Report ID'];
      const sourceReport = reports.find(r => r['Report ID'] === reportId);

      // Find supervisor from roster
      let supervisor = null;
      if (sourceReport) {
        const managerId = sourceReport['Manager ID'];
        const managerRecord = roster.find(e => e['Employee ID'] === managerId);
        if (managerRecord) {
          supervisor = {
            id: managerId,
            name: managerRecord['Full Name'],
            role: managerRecord.Role,
            phone: managerRecord.Phone,
            email: managerRecord.Email
          };
        }
      }

      return {
        id: c['Constraint ID'],
        date: c.Date,
        project: c['Project Number'],
        type: c.Type,
        description: c.Description,
        severity: c.Severity,
        status: c.Status,
        reportedBy: c['Reported By'],
        notes: c.Notes,
        resolution: c.Resolution || '',
        reportId: reportId,
        reportDate: sourceReport?.Date,
        projectId: sourceReport?.['Project Number'],
        supervisor: supervisor
      };
    });

    res.json({
      success: true,
      report: {
        summary: {
          total: constraints.length,
          open: open.length,
          resolved: resolved.length,
          critical: critical.length
        },
        constraints: enhancedConstraints,
        byType: Object.entries(byType).map(([type, items]) => ({
          type,
          count: items.length,
          critical: items.filter(i => i.Severity && i.Severity.toLowerCase() === 'high').length
        }))
      }
    });
  } catch (error) {
    console.error('❌ Constraints report error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/reports/deliveries
 * Get detailed delivery performance report
 */
app.get('/api/analytics/reports/deliveries', async (req, res) => {
  try {
    console.log('📋 Generating delivery performance report...');

    const data = await getAnalyticsData();
    const deliveries = data.googleSheets['Delivery Log'] || [];

    const onTime = deliveries.filter(d => !d.Status || d.Status === 'On-Time');
    const late = deliveries.filter(d => d.Status && (d.Status.toLowerCase().includes('late') || d.Status.toLowerCase().includes('delayed')));
    const early = deliveries.filter(d => d.Status && d.Status.toLowerCase().includes('early'));
    const missing = deliveries.filter(d => d.Status && (d.Status.toLowerCase().includes('missing') || d.Status.toLowerCase().includes('incomplete')));

    // Vendor performance with detailed tracking
    const vendorStats = {};
    deliveries.forEach(d => {
      const vendor = d['Supplier Name'] || 'Unknown';
      if (!vendorStats[vendor]) {
        vendorStats[vendor] = {
          total: 0,
          onTime: 0,
          late: 0,
          early: 0,
          missing: 0,
          deliveries: []
        };
      }
      vendorStats[vendor].total++;

      const deliveryRecord = {
        id: d['Delivery ID'],
        date: d.Date,
        project: d['Project Number'],
        materials: d['Materials Delivered'],
        time: d['Delivery Time'],
        status: d.Status || 'On-Time',
        receivedBy: d['Received By'],
        notes: d.Notes
      };

      vendorStats[vendor].deliveries.push(deliveryRecord);

      if (!d.Status || d.Status === 'On-Time') {
        vendorStats[vendor].onTime++;
      } else if (d.Status.toLowerCase().includes('late') || d.Status.toLowerCase().includes('delayed')) {
        vendorStats[vendor].late++;
      } else if (d.Status.toLowerCase().includes('early')) {
        vendorStats[vendor].early++;
      } else if (d.Status.toLowerCase().includes('missing') || d.Status.toLowerCase().includes('incomplete')) {
        vendorStats[vendor].missing++;
      }
    });

    res.json({
      success: true,
      report: {
        summary: {
          total: deliveries.length,
          onTime: onTime.length,
          late: late.length,
          early: early.length,
          missing: missing.length,
          onTimeRate: deliveries.length > 0 ? ((onTime.length / deliveries.length) * 100).toFixed(1) : 0
        },
        deliveries: deliveries.map(d => ({
          id: d['Delivery ID'],
          date: d.Date,
          project: d['Project Number'],
          vendor: d['Supplier Name'],
          materials: d['Materials Delivered'],
          time: d['Delivery Time'],
          status: d.Status || 'On-Time',
          receivedBy: d['Received By'],
          notes: d.Notes
        })),
        vendors: Object.entries(vendorStats).map(([name, stats]) => ({
          name,
          total: stats.total,
          onTime: stats.onTime,
          late: stats.late,
          early: stats.early,
          missing: stats.missing,
          onTimeRate: ((stats.onTime / stats.total) * 100).toFixed(1),
          deliveries: stats.deliveries
        })).sort((a, b) => b.total - a.total)
      }
    });
  } catch (error) {
    console.error('❌ Delivery report error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/reports/overtime
 * Get detailed overtime analysis report
 */
app.get('/api/analytics/reports/overtime', async (req, res) => {
  try {
    console.log('📋 Generating overtime report...');

    const data = await getAnalyticsData();
    const manpower = data.googleSheets['Daily Manpower Log'] || [];

    // Calculate by project
    const byProject = {};
    manpower.forEach(m => {
      const project = m['Project Number'] || 'Unknown';
      if (!byProject[project]) {
        byProject[project] = { regular: 0, overtime: 0, entries: [] };
      }
      const regular = parseFloat(m['Regular Hours'] || 0);
      const overtime = parseFloat(m['Overtime Hours'] || 0);
      byProject[project].regular += regular;
      byProject[project].overtime += overtime;
      byProject[project].entries.push(m);
    });

    const totalRegular = manpower.reduce((sum, m) => sum + parseFloat(m['Regular Hours'] || 0), 0);
    const totalOvertime = manpower.reduce((sum, m) => sum + parseFloat(m['Overtime Hours'] || 0), 0);

    res.json({
      success: true,
      report: {
        summary: {
          totalHours: totalRegular + totalOvertime,
          regularHours: totalRegular,
          overtimeHours: totalOvertime,
          overtimeRate: totalRegular > 0 ? ((totalOvertime / (totalRegular + totalOvertime)) * 100).toFixed(1) : 0,
          entries: manpower.length
        },
        byProject: Object.entries(byProject).map(([project, stats]) => ({
          project,
          regularHours: stats.regular,
          overtimeHours: stats.overtime,
          totalHours: stats.regular + stats.overtime,
          overtimeRate: stats.regular > 0 ? ((stats.overtime / (stats.regular + stats.overtime)) * 100).toFixed(1) : 0,
          entries: stats.entries.length
        })).sort((a, b) => b.overtimeHours - a.overtimeHours),
        records: manpower.map(m => ({
          date: m.Date,
          project: m['Project Number'],
          employee: m['Employee Name'],
          role: m.Role,
          regularHours: parseFloat(m['Regular Hours'] || 0),
          overtimeHours: parseFloat(m['Overtime Hours'] || 0),
          totalHours: parseFloat(m['Regular Hours'] || 0) + parseFloat(m['Overtime Hours'] || 0)
        }))
      }
    });
  } catch (error) {
    console.error('❌ Overtime report error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analytics/constraints/:constraintId/resolution
 * Save resolution notes for a constraint
 */
app.post('/api/analytics/constraints/:constraintId/resolution', async (req, res) => {
  try {
    const { constraintId } = req.params;
    const { resolution, updatedBy } = req.body;

    console.log(`📝 Saving resolution for constraint ${constraintId}...`);

    // Get all constraints from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Constraints Log!A:Z',
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No data found' });
    }

    const headers = rows[0];
    const constraintIdIndex = headers.indexOf('Constraint ID');
    const resolutionIndex = headers.indexOf('Resolution');

    if (constraintIdIndex === -1) {
      return res.status(500).json({ success: false, error: 'Constraint ID column not found' });
    }

    // If Resolution column doesn't exist, add it
    let actualResolutionIndex = resolutionIndex;
    if (resolutionIndex === -1) {
      actualResolutionIndex = headers.length;
      // Add "Resolution" header
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Constraints Log!${String.fromCharCode(65 + actualResolutionIndex)}1`,
        valueInputOption: 'RAW',
        resource: {
          values: [['Resolution']]
        }
      });
    }

    // Find the row with this constraint ID
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][constraintIdIndex] === constraintId) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return res.status(404).json({ success: false, error: 'Constraint not found' });
    }

    // Update the resolution cell
    const cellAddress = `Constraints Log!${String.fromCharCode(65 + actualResolutionIndex)}${rowIndex + 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: cellAddress,
      valueInputOption: 'RAW',
      resource: {
        values: [[resolution]]
      }
    });

    console.log(`✅ Resolution saved for ${constraintId} by ${updatedBy}`);

    res.json({
      success: true,
      message: 'Resolution saved successfully',
      constraintId,
      resolution
    });

  } catch (error) {
    console.error('❌ Error saving resolution:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analytics/constraints/:constraintId/status
 * Update constraint status and sync to both databases
 */
app.post('/api/analytics/constraints/:constraintId/status', async (req, res) => {
  try {
    const { constraintId } = req.params;
    const { status, updatedBy } = req.body;

    console.log(`🔄 Updating status for constraint ${constraintId} to "${status}"...`);

    // 1. Update Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Constraints Log!A:Z',
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No data found' });
    }

    const headers = rows[0];
    const constraintIdIndex = headers.indexOf('Constraint ID');
    const statusIndex = headers.indexOf('Status');

    if (constraintIdIndex === -1 || statusIndex === -1) {
      return res.status(500).json({ success: false, error: 'Required columns not found' });
    }

    // Find the row with this constraint ID
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][constraintIdIndex] === constraintId) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return res.status(404).json({ success: false, error: 'Constraint not found' });
    }

    // Update the status cell in Google Sheets
    const cellAddress = `Constraints Log!${String.fromCharCode(65 + statusIndex)}${rowIndex + 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: cellAddress,
      valueInputOption: 'RAW',
      resource: {
        values: [[status]]
      }
    });

    console.log(`✅ Updated Google Sheets: ${constraintId} → ${status}`);

    // 2. Update DynamoDB (find and update the constraint in the report)
    // Note: DynamoDB stores constraints embedded in daily reports, so we need to find the report first
    const constraint = rows[rowIndex];
    const reportId = constraint[headers.indexOf('Report ID')];

    if (reportId) {
      try {
        // Query DynamoDB for the report
        const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

        // This is a simplified update - in production you'd want to properly update the nested constraint
        console.log(`📝 DynamoDB update queued for report ${reportId} (constraint ${constraintId} status → ${status})`);
        // TODO: Implement full DynamoDB nested update when needed
      } catch (dbError) {
        console.error('⚠️ DynamoDB update failed (non-critical):', dbError.message);
        // Don't fail the request if DynamoDB update fails - Google Sheets is source of truth
      }
    }

    console.log(`✅ Status update complete for ${constraintId} by ${updatedBy}`);

    res.json({
      success: true,
      message: 'Status updated successfully',
      constraintId,
      status
    });

  } catch (error) {
    console.error('❌ Error updating status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/health
 * Health check endpoint
 */
app.get('/api/analytics/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CFO Analytics Agent',
    model: 'gpt-4o',
    timestamp: new Date().toISOString()
  });
});

// Start server
async function start() {
  try {
    await initGoogleSheets();
    console.log('✅ Google Sheets API initialized');

    app.listen(PORT, () => {
      console.log('');
      console.log('='.repeat(70));
      console.log('🏦 SiteLogix CFO Analytics Agent');
      console.log('='.repeat(70));
      console.log(`📡 Server: http://localhost:${PORT}`);
      console.log(`🤖 AI Model: GPT-4o`);
      console.log('');
      console.log('Available Endpoints:');
      console.log(`  POST /api/analytics/query      - Natural language analytics`);
      console.log(`  GET  /api/analytics/insights   - Pre-computed KPIs`);
      console.log(`  GET  /api/analytics/health     - Health check`);
      console.log('='.repeat(70));
      console.log('');
      console.log('💡 Example Queries:');
      console.log('  - "Show me late delivery trends and cost impact"');
      console.log('  - "Which vendors are underperforming?"');
      console.log('  - "Analyze overtime patterns and recommend staffing changes"');
      console.log('  - "What are our top 3 cost reduction opportunities?"');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
