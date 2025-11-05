/**
 * Lambda handler for SiteLogix API endpoints
 * Provides /managers and /projects endpoints for frontend
 */

const { google } = require('googleapis');
const { DynamoDBClient, ScanCommand, QueryCommand, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall, marshall } = require('@aws-sdk/util-dynamodb');
const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const { normalizeExtractedData, getMasterPersonnel, getMasterProjects } = require('./entityNormalizationService');
const {
  getExecutiveDashboard,
  getPersonnelIntelligence,
  getVendorIntelligence,
  getProjectHealth,
  getConstraintAnalytics,
  getStrategicInsights,
  queryWithAI,
  getOvertimeReport,
  getConstraintsReport,
  getCostAnalysisReport,
  getDeliveryPerformanceReport
} = require('./bi-endpoints');

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Cache for secrets to avoid repeated API calls
const secretsCache = {};

/**
 * Get secret from AWS Secrets Manager with caching
 */
async function getSecret(secretName) {
  if (secretsCache[secretName]) {
    return secretsCache[secretName];
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsClient.send(command);
    const secret = JSON.parse(response.SecretString);
    secretsCache[secretName] = secret;
    return secret;
  } catch (error) {
    console.error(`Error retrieving secret ${secretName}:`, error);
    throw error;
  }
}

/**
 * Initialize Google Sheets API client
 */
async function getGoogleSheetsClient() {
  // Get credentials from Secrets Manager
  const googleOAuth = await getSecret('sitelogix/google-oauth');
  const sheetsConfig = await getSecret('sitelogix/google-sheets');

  const oauth2Client = new google.auth.OAuth2(
    googleOAuth.client_id,
    googleOAuth.client_secret,
    'http://localhost:3000'
  );
  oauth2Client.setCredentials({ refresh_token: googleOAuth.refresh_token });

  return {
    client: google.sheets({ version: 'v4', auth: oauth2Client }),
    spreadsheetId: sheetsConfig.spreadsheet_id
  };
}

/**
 * Fetch managers from Google Sheets
 */
async function getManagers() {
  try {
    console.log('📋 Fetching managers from Employee Roster...');
    const { client: sheets, spreadsheetId } = await getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Employee Roster!A2:J100', // Skip header row
    });

    const rows = response.data.values || [];

    // Filter for Project Managers and Foremen
    const managers = rows
      .filter(row => {
        const position = row[3] || ''; // Position column
        return position.toLowerCase().includes('manager') || position.toLowerCase().includes('foreman');
      })
      .map(row => ({
        id: row[0] || '', // Employee ID
        name: row[1] || '', // Full Name
        goByName: row[2] || '', // Go By Name
        position: row[3] || '',
        phone: row[4] || '',
        email: row[5] || '',
        currentProject: row[8] || ''
      }));

    console.log(`✅ Found ${managers.length} managers`);
    return { success: true, managers };
  } catch (error) {
    console.error('❌ Error fetching managers:', error.message);
    throw error;
  }
}

/**
 * Fetch projects from DynamoDB
 */
async function getProjects() {
  try {
    console.log('🏗️  Fetching projects from DynamoDB...');

    // Scan the reports table to get unique project IDs
    const command = new ScanCommand({
      TableName: 'sitelogix-reports',
      ProjectionExpression: 'project_id, project_name, manager_id'
    });

    const result = await dynamoClient.send(command);
    const items = result.Items.map(item => unmarshall(item));

    // Get unique projects
    const projectMap = new Map();
    items.forEach(item => {
      if (item.project_id && !projectMap.has(item.project_id)) {
        projectMap.set(item.project_id, {
          id: item.project_id,
          name: item.project_name || getProjectName(item.project_id),
          location: 'TBD', // Would come from a projects table in production
          managerId: item.manager_id || ''
        });
      }
    });

    const projects = Array.from(projectMap.values());

    console.log(`✅ Found ${projects.length} projects`);
    return { success: true, projects };
  } catch (error) {
    console.error('❌ Error fetching projects:', error.message);

    // Return mock data for development if DynamoDB fails
    const mockProjects = [
      { id: 'PRJ001', name: 'Parkway Plaza Development', location: 'Downtown District', managerId: 'MGR001' },
      { id: 'PRJ002', name: 'Sunset Ridge Construction', location: 'West Side', managerId: 'MGR002' },
      { id: 'PRJ003', name: 'Harbor View Complex', location: 'Waterfront', managerId: 'MGR003' }
    ];

    console.log('⚠️  Using mock project data');
    return { success: true, projects: mockProjects, mock: true };
  }
}

/**
 * Helper function to convert project ID to friendly name
 */
function getProjectName(projectId) {
  const projectNames = {
    'proj_001': 'Parkway Plaza Development',
    'proj_002': 'Sunset Ridge Construction',
    'PRJ001': 'Parkway Plaza Development',
    'PRJ002': 'Sunset Ridge Construction',
    'PRJ003': 'Harbor View Complex'
  };

  return projectNames[projectId] || projectId;
}

/**
 * Fetch reports from DynamoDB
 */
async function getReports(queryParams = {}) {
  try {
    console.log('📊 Fetching reports from DynamoDB...', queryParams);

    let command;

    // Query by project_id if provided (using correct PK format)
    if (queryParams.projectId) {
      command = new QueryCommand({
        TableName: 'sitelogix-reports',
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': { S: `PROJECT#${queryParams.projectId}` }
        }
      });
    }
    // Scan with filter for manager_id if provided
    else if (queryParams.managerId) {
      command = new ScanCommand({
        TableName: 'sitelogix-reports',
        FilterExpression: 'manager_id = :managerId',
        ExpressionAttributeValues: {
          ':managerId': { S: queryParams.managerId }
        }
      });
    }
    // Otherwise scan all reports
    else {
      command = new ScanCommand({
        TableName: 'sitelogix-reports'
      });
    }

    const result = await dynamoClient.send(command);
    const reports = result.Items.map(item => unmarshall(item));

    console.log(`✅ Found ${reports.length} reports`);
    return { success: true, reports };
  } catch (error) {
    console.error('❌ Error fetching reports:', error.message);
    return { success: false, error: error.message, reports: [] };
  }
}

/**
 * Fetch a single report's HTML content
 */
async function getReportHtml(reportId, projectId, reportDate) {
  try {
    console.log(`📄 Fetching HTML for report ${reportId}...`);

    // Use current key schema: PK: REPORT#{reportId}, SK: METADATA
    const command = new GetItemCommand({
      TableName: 'sitelogix-reports',
      Key: {
        PK: { S: `REPORT#${reportId}` },
        SK: { S: 'METADATA' }
      }
    });

    const result = await dynamoClient.send(command);

    if (!result.Item) {
      console.warn(`⚠️ Report ${reportId} not found with key structure`);
      return { success: false, error: 'Report not found' };
    }

    const report = unmarshall(result.Item);

    // If report has S3 URL, fetch from S3
    if (report.report_html_url) {
      console.log(`Fetching HTML from S3: ${report.report_html_url}`);

      try {
        // Parse S3 URL to get bucket and key
        const url = new URL(report.report_html_url);
        const bucket = url.hostname.split('.')[0];
        const key = url.pathname.substring(1); // Remove leading slash

        const s3Command = new GetObjectCommand({
          Bucket: bucket,
          Key: key
        });

        const s3Result = await s3Client.send(s3Command);
        const html = await s3Result.Body.transformToString();

        console.log(`✅ Retrieved HTML from S3 for report ${reportId}`);
        return { success: true, html };
      } catch (s3Error) {
        console.error('❌ Error fetching from S3:', s3Error.message);
        // Fall through to check for inline HTML
      }
    }

    // Fall back to inline HTML if available
    if (report.report_html) {
      console.log(`✅ Retrieved inline HTML for report ${reportId}`);
      return { success: true, html: report.report_html };
    }

    // Generate HTML from extracted_data if available
    if (report.extracted_data) {
      console.log(`📝 Generating HTML from extracted data for report ${reportId}`);

      let extractedData;
      try {
        extractedData = typeof report.extracted_data === 'string'
          ? JSON.parse(report.extracted_data)
          : report.extracted_data;
      } catch (parseError) {
        console.error('Failed to parse extracted_data:', parseError);
        return { success: false, error: 'Invalid extracted data format' };
      }

      const html = generateReportHTML(report, extractedData);
      return { success: true, html };
    }

    return { success: false, error: 'Report HTML not found' };
  } catch (error) {
    console.error('❌ Error fetching report HTML:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate HTML report from extracted data
 */
function generateReportHTML(report, extractedData) {
  const date = new Date(report.report_date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Report - ${date}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 20px; background: #0f172a; color: #e2e8f0; }
    .header { background: linear-gradient(135deg, #d4af37 0%, #c4941f 100%); color: #0f172a; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
    .header h1 { margin: 0 0 10px 0; font-size: 2.5em; }
    .header p { margin: 5px 0; opacity: 0.9; }
    .section { background: rgba(255,255,255,0.05); padding: 25px; margin-bottom: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); }
    .section h2 { color: #d4af37; margin-top: 0; font-size: 1.5em; border-bottom: 2px solid #d4af37; padding-bottom: 10px; }
    .section ul { margin: 10px 0; padding-left: 20px; }
    .section li { margin: 8px 0; color: #cbd5e1; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 0.85em; font-weight: 600; margin-right: 8px; }
    .badge-success { background: rgba(34,197,94,0.2); color: #86efac; }
    .badge-warning { background: rgba(251,191,36,0.2); color: #fde047; }
    .badge-danger { background: rgba(239,68,68,0.2); color: #fca5a5; }
    .badge-info { background: rgba(59,130,246,0.2); color: #93c5fd; }
    .confidence { text-align: right; font-size: 0.9em; color: #94a3b8; margin-top: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 15px 0; }
    .stat-card { background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; border: 1px solid rgba(212,175,55,0.2); }
    .stat-card h3 { margin: 0 0 5px 0; font-size: 0.9em; color: #94a3b8; }
    .stat-card p { margin: 0; font-size: 1.8em; font-weight: bold; color: #d4af37; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 Daily Construction Report</h1>
    <p><strong>Date:</strong> ${date}</p>
    <p><strong>Project:</strong> ${report.project_name || 'Unknown'}</p>
    <p><strong>Reporter:</strong> ${report.reporter_name || 'Unknown'}</p>
  </div>

  ${extractedData.work_completed && extractedData.work_completed.length > 0 ? `
  <div class="section">
    <h2>✅ Work Completed</h2>
    <span class="badge badge-success">${extractedData.work_completed.length} Tasks</span>
    <ul>
      ${extractedData.work_completed.map(item => `<li>${item}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  ${extractedData.work_in_progress && extractedData.work_in_progress.length > 0 ? `
  <div class="section">
    <h2>🔨 Work In Progress</h2>
    <span class="badge badge-info">${extractedData.work_in_progress.length} Items</span>
    <ul>
      ${extractedData.work_in_progress.map(item => `<li>${item}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  ${extractedData.issues && extractedData.issues.length > 0 ? `
  <div class="section">
    <h2>⚠️ Issues & Constraints</h2>
    <span class="badge badge-danger">${extractedData.issues.length} Issues</span>
    <ul>
      ${extractedData.issues.map(item => `<li>${item}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  ${extractedData.vendors && extractedData.vendors.length > 0 ? `
  <div class="section">
    <h2>📦 Vendor Deliveries</h2>
    <span class="badge badge-info">${extractedData.vendors.length} Deliveries</span>
    <ul>
      ${extractedData.vendors.map(v => `<li><strong>${v.company || 'Unknown'}:</strong> ${v.delivery_type || 'Delivery'} at ${v.time || 'TBD'}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  ${extractedData.additional_personnel && extractedData.additional_personnel.length > 0 ? `
  <div class="section">
    <h2>👷 Personnel On Site</h2>
    <div class="grid">
      ${extractedData.additional_personnel.map(p => `
        <div class="stat-card">
          <h3>${p.name || p.canonical_name || 'Unknown'}</h3>
          <p>${p.hours || 0} hrs</p>
          ${p.role ? `<p style="font-size: 0.9em; color: #94a3b8; margin-top: 5px;">${p.role}</p>` : ''}
        </div>
      `).join('')}
    </div>
    <p style="margin-top: 15px; color: #94a3b8;">
      <strong>Total Hours:</strong> ${report.total_hours || extractedData.additional_personnel.reduce((sum, p) => sum + (p.hours || 0), 0)} hours
    </p>
  </div>
  ` : ''}

  ${extractedData.ambiguities && extractedData.ambiguities.length > 0 ? `
  <div class="section">
    <h2>ℹ️ Notes & Ambiguities</h2>
    <span class="badge badge-warning">${extractedData.ambiguities.length} Items</span>
    <ul>
      ${extractedData.ambiguities.map(item => `<li>${item}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  <div class="confidence">
    <p>🤖 Extracted by Roxy AI | Confidence: ${((report.extraction_confidence || 0.9) * 100).toFixed(0)}% | ${new Date(report.created_at).toLocaleString()}</p>
  </div>

  <!-- Navigation Buttons -->
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 10px; justify-content: space-between;">
    <button onclick="window.close(); window.history.back();" style="padding: 12px 24px; background: rgba(255,255,255,0.1); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;">
      ← Back to Reports
    </button>
    <a href="${report.transcript_s3_key ? '#' : '#'}"
       onclick="if('${report.transcript_s3_key}') { window.open('/api/reports/${report.report_id}/transcript', '_blank'); return false; }"
       style="padding: 12px 24px; background: linear-gradient(135deg, #d4af37 0%, #c4941f 100%); color: #0f172a; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-block;">
      📄 View Original Transcript
    </a>
  </div>
</body>
</html>`;
}

/**
 * Get analytics insights from processed analytics data
 */
async function getAnalyticsInsights() {
  try {
    console.log('📊 Fetching analytics insights from sitelogix-analytics table...');

    // Fetch all analytics data with pagination
    let allItems = [];
    let lastEvaluatedKey = null;

    do {
      const command = new ScanCommand({
        TableName: 'sitelogix-analytics',
        ExclusiveStartKey: lastEvaluatedKey
      });

      const result = await dynamoClient.send(command);
      allItems = allItems.concat(result.Items.map(item => unmarshall(item)));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`   Fetched ${allItems.length} analytics records`);

    // Separate data by type
    const hoursSummaries = allItems.filter(item => item.PK?.startsWith('HOURS_SUMMARY#'));
    const personnelHours = allItems.filter(item => item.PK?.startsWith('PERSONNEL_HOURS#'));
    const vendorPerformance = allItems.filter(item => item.PK?.startsWith('VENDOR_PERFORMANCE#'));
    const criticalEvents = allItems.filter(item => item.PK?.startsWith('CRITICAL_EVENT#'));

    console.log(`   Hours Summaries: ${hoursSummaries.length}`);
    console.log(`   Personnel Hours: ${personnelHours.length}`);
    console.log(`   Vendor Performance: ${vendorPerformance.length}`);
    console.log(`   Critical Events: ${criticalEvents.length}`);

    // Calculate labor hours from HOURS_SUMMARY entries
    const totalLaborHours = hoursSummaries.reduce((sum, s) => sum + (s.total_regular_hours || 0), 0);
    const overtimeHours = hoursSummaries.reduce((sum, s) => sum + (s.total_overtime_hours || 0), 0);
    const totalHours = totalLaborHours + overtimeHours;
    const overtimeRate = totalHours > 0 ? ((overtimeHours / totalHours) * 100).toFixed(1) : 0;

    // Calculate vendor delivery metrics
    const vendorMap = new Map();
    vendorPerformance.forEach(vp => {
      const vendorName = vp.vendor_name || 'Unknown';
      if (!vendorMap.has(vendorName)) {
        vendorMap.set(vendorName, {
          deliveries: 0,
          lateDeliveries: 0,
          totalScore: 0,
          count: 0
        });
      }
      const stats = vendorMap.get(vendorName);
      stats.deliveries++;
      if (vp.delivery_status === 'late' || vp.delivery_status === 'missed') {
        stats.lateDeliveries++;
      }
      if (vp.performance_score) {
        stats.totalScore += vp.performance_score;
        stats.count++;
      }
    });

    const vendors = Array.from(vendorMap.entries())
      .map(([name, stats]) => ({
        name,
        deliveries: stats.deliveries,
        lateDeliveries: stats.lateDeliveries,
        onTimeRate: stats.deliveries > 0
          ? (((stats.deliveries - stats.lateDeliveries) / stats.deliveries) * 100).toFixed(1) + '%'
          : '100%',
        averageScore: stats.count > 0 ? (stats.totalScore / stats.count).toFixed(0) : 'N/A'
      }))
      .sort((a, b) => b.deliveries - a.deliveries)
      .slice(0, 5);

    const totalDeliveries = vendorPerformance.length;
    const lateDeliveries = vendorPerformance.filter(vp =>
      vp.delivery_status === 'late' || vp.delivery_status === 'missed'
    ).length;
    const onTimeDeliveryRate = totalDeliveries > 0
      ? (((totalDeliveries - lateDeliveries) / totalDeliveries) * 100).toFixed(1)
      : 100;

    // Count critical events by status
    const openCriticalEvents = criticalEvents.filter(e => e.status === 'open').length;
    const criticalBySeverity = criticalEvents.filter(e =>
      e.status === 'open' && e.severity >= 7
    ).length;

    // Generate alerts based on analytics data
    const alerts = [];

    // Critical events alert
    if (openCriticalEvents > 0) {
      alerts.push({
        type: 'critical',
        category: 'Safety & Operations',
        message: `${openCriticalEvents} critical events require immediate attention`,
        impact: 'High'
      });
    }

    // High severity events
    if (criticalBySeverity > 0) {
      alerts.push({
        type: 'critical',
        category: 'Critical Events',
        message: `${criticalBySeverity} high-severity events (7+) need executive escalation`,
        impact: 'High'
      });
    }

    // Overtime alert
    if (parseFloat(overtimeRate) > 20) {
      alerts.push({
        type: 'warning',
        category: 'Labor',
        message: `Overtime rate at ${overtimeRate}% exceeds recommended 20% threshold`,
        impact: 'Medium'
      });
    }

    // Vendor delivery alert
    if (parseFloat(onTimeDeliveryRate) < 90 && totalDeliveries > 0) {
      alerts.push({
        type: 'warning',
        category: 'Deliveries',
        message: `On-time delivery rate at ${onTimeDeliveryRate}% below 90% target`,
        impact: 'Medium'
      });
    }

    // High-risk vendors
    const highRiskVendors = vendorPerformance.filter(vp => vp.risk_level === 'critical' || vp.risk_level === 'high');
    if (highRiskVendors.length > 0) {
      alerts.push({
        type: 'warning',
        category: 'Vendor Performance',
        message: `${highRiskVendors.length} vendors flagged as high-risk or critical`,
        impact: 'Medium'
      });
    }

    // Get unique report count from hours summaries
    const uniqueReports = new Set(hoursSummaries.map(s => s.report_id)).size;

    const insights = {
      summary: {
        totalDeliveries,
        lateDeliveries,
        onTimeDeliveryRate: parseFloat(onTimeDeliveryRate),
        totalLaborHours: Math.round(totalLaborHours),
        overtimeHours: Math.round(overtimeHours),
        overtimeRate: parseFloat(overtimeRate),
        openConstraints: openCriticalEvents, // Using critical events as constraints
        criticalConstraints: criticalBySeverity,
        totalReports: uniqueReports || hoursSummaries.length
      },
      vendors,
      alerts
    };

    console.log(`✅ Analytics insights calculated from ${allItems.length} records`);
    return { success: true, insights };
  } catch (error) {
    console.error('❌ Error fetching analytics insights:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Handle analytics query (simplified AI-style response)
 */
async function handleAnalyticsQuery(query) {
  try {
    console.log('🤔 Processing analytics query:', query);

    // Get insights for context
    const insightsResult = await getAnalyticsInsights();
    if (!insightsResult.success) {
      return { success: false, analysis: 'Unable to access analytics data.' };
    }

    const insights = insightsResult.insights;
    const summary = insights.summary;

    // Simple query matching
    const queryLower = query.toLowerCase();

    let analysis = '';

    if (queryLower.includes('overtime')) {
      analysis = `Current overtime rate is ${summary.overtimeRate}% with ${summary.overtimeHours} overtime hours out of ${summary.totalLaborHours} total labor hours. `;
      if (summary.overtimeRate > 20) {
        analysis += 'This exceeds the recommended 20% threshold and should be monitored closely.';
      } else {
        analysis += 'This is within acceptable limits.';
      }
    } else if (queryLower.includes('delivery') || queryLower.includes('deliveries')) {
      analysis = `Delivery performance: ${summary.totalDeliveries} total deliveries with ${summary.lateDeliveries} late deliveries. `;
      analysis += `On-time delivery rate is ${summary.onTimeDeliveryRate}%. `;
      if (summary.onTimeDeliveryRate < 90) {
        analysis += 'Performance is below the 90% target. ';
        if (insights.vendors.length > 0) {
          const worstVendor = insights.vendors.reduce((worst, v) =>
            parseFloat(v.onTimeRate) < parseFloat(worst.onTimeRate) ? v : worst
          );
          analysis += `${worstVendor.name} has the lowest on-time rate at ${worstVendor.onTimeRate}.`;
        }
      }
    } else if (queryLower.includes('constraint')) {
      analysis = `There are currently ${summary.openConstraints} open constraints, including ${summary.criticalConstraints} critical issues. `;
      if (summary.criticalConstraints > 0) {
        analysis += 'Critical constraints should be prioritized for immediate resolution.';
      } else {
        analysis += 'No critical constraints at this time.';
      }
    } else if (queryLower.includes('labor')) {
      analysis = `Total labor hours: ${summary.totalLaborHours} hours across ${summary.totalReports} reports. `;
      analysis += `Overtime accounts for ${summary.overtimeHours} hours (${summary.overtimeRate}%).`;
    } else {
      // General summary
      analysis = `Based on ${summary.totalReports} reports:\n\n`;
      analysis += `• On-time delivery rate: ${summary.onTimeDeliveryRate}%\n`;
      analysis += `• Labor hours: ${summary.totalLaborHours} (${summary.overtimeRate}% overtime)\n`;
      analysis += `• Open constraints: ${summary.openConstraints} (${summary.criticalConstraints} critical)\n\n`;
      analysis += 'Ask me about specific metrics like "overtime", "deliveries", or "constraints" for detailed analysis.';
    }

    return { success: true, analysis };
  } catch (error) {
    console.error('❌ Error processing query:', error.message);
    return { success: false, analysis: 'Error processing query. Please try again.' };
  }
}

/**
 * Get constraint report by type
 */
async function getConstraintReport(reportType) {
  try {
    console.log(`📋 Fetching ${reportType} constraints...`);

    // Fetch all reports
    const command = new ScanCommand({
      TableName: 'sitelogix-reports'
    });

    const result = await dynamoClient.send(command);
    const reports = result.Items.map(item => unmarshall(item));

    // Extract all constraints
    let allConstraints = [];
    reports.forEach(report => {
      if (report.constraints && Array.isArray(report.constraints)) {
        const constraintsWithMeta = report.constraints.map(c => ({
          ...c,
          reportId: report.report_id,
          projectId: report.project_id,
          projectName: report.project_name || report.project_id,
          reportDate: report.report_date,
          managerName: report.manager_name || 'Unknown'
        }));
        allConstraints = allConstraints.concat(constraintsWithMeta);
      }
    });

    // Filter by report type
    let filteredConstraints = allConstraints;
    if (reportType === 'critical') {
      filteredConstraints = allConstraints.filter(c =>
        c.severity === 'High' && c.status !== 'Resolved'
      );
    } else if (reportType === 'open') {
      filteredConstraints = allConstraints.filter(c => c.status !== 'Resolved');
    } else if (reportType === 'resolved') {
      filteredConstraints = allConstraints.filter(c => c.status === 'Resolved');
    }

    // Calculate summary
    const open = filteredConstraints.filter(c => c.status !== 'Resolved').length;
    const resolved = filteredConstraints.filter(c => c.status === 'Resolved').length;

    const report = {
      type: reportType,
      summary: {
        total: filteredConstraints.length,
        open,
        resolved
      },
      constraints: filteredConstraints
    };

    console.log(`✅ Found ${filteredConstraints.length} ${reportType} constraints`);
    return { success: true, report };
  } catch (error) {
    console.error('❌ Error fetching constraint report:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get delivery performance report
 */
async function getDeliveryReport() {
  try {
    console.log('📦 Fetching delivery performance report...');

    // Fetch all vendor performance records from analytics table
    const command = new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: marshall({
        ':pk': 'VENDOR_PERFORMANCE#'
      })
    });

    const result = await dynamoClient.send(command);
    const vendorPerformance = result.Items.map(item => unmarshall(item));

    console.log(`   Found ${vendorPerformance.length} vendor performance records`);

    // Calculate vendor-level statistics
    const vendorMap = new Map();
    const allDeliveries = [];

    vendorPerformance.forEach(vp => {
      const vendorName = vp.vendor_name || 'Unknown';

      // Add to deliveries list
      allDeliveries.push({
        vendor: vendorName,
        materials: vp.items_delivered || vp.delivery_notes || 'Materials delivered',
        date: vp.delivery_date || vp.report_date || 'Unknown date',
        time: vp.delivery_time || '',
        status: vp.delivery_status === 'late' ? 'Late' :
                vp.delivery_status === 'missed' ? 'Missing' :
                vp.delivery_status === 'early' ? 'Early' : 'On-Time',
        notes: vp.delivery_notes || '',
        project: vp.project_name || vp.project_id || 'Unknown',
        receivedBy: vp.received_by || ''
      });

      // Aggregate vendor stats
      if (!vendorMap.has(vendorName)) {
        vendorMap.set(vendorName, {
          name: vendorName,
          total: 0,
          onTime: 0,
          late: 0,
          early: 0,
          missing: 0,
          deliveries: []
        });
      }

      const vendor = vendorMap.get(vendorName);
      vendor.total++;
      vendor.deliveries.push(allDeliveries[allDeliveries.length - 1]);

      if (vp.delivery_status === 'late') {
        vendor.late++;
      } else if (vp.delivery_status === 'missed') {
        vendor.missing++;
      } else if (vp.delivery_status === 'early') {
        vendor.early++;
      } else {
        vendor.onTime++;
      }
    });

    // Convert to array and calculate on-time rates
    const vendors = Array.from(vendorMap.values()).map(v => ({
      ...v,
      onTimeRate: v.total > 0 ? ((v.onTime / v.total) * 100).toFixed(1) : '0.0'
    })).sort((a, b) => b.total - a.total);

    // Calculate overall summary
    const total = allDeliveries.length;
    const onTime = allDeliveries.filter(d => d.status === 'On-Time').length;
    const late = allDeliveries.filter(d => d.status === 'Late').length;
    const early = allDeliveries.filter(d => d.status === 'Early').length;
    const missing = allDeliveries.filter(d => d.status === 'Missing').length;
    const onTimeRate = total > 0 ? (((onTime + early) / total) * 100).toFixed(1) : '100.0';

    const report = {
      type: 'deliveries',
      summary: {
        total,
        onTime,
        late,
        early,
        missing,
        onTimeRate
      },
      vendors,
      deliveries: allDeliveries.sort((a, b) => new Date(b.date) - new Date(a.date))
    };

    console.log(`✅ Delivery report: ${total} total, ${late} late, ${missing} missing`);
    return { success: true, report };
  } catch (error) {
    console.error('❌ Error fetching delivery report:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get overtime/labor hours report
 */
async function getOvertimeReport() {
  try {
    console.log('⏰ Fetching overtime/labor report...');

    // Fetch hours summaries and personnel hours from analytics table
    let allItems = [];
    let lastEvaluatedKey = null;

    do {
      const command = new ScanCommand({
        TableName: 'sitelogix-analytics',
        ExclusiveStartKey: lastEvaluatedKey
      });

      const result = await dynamoClient.send(command);
      allItems = allItems.concat(result.Items.map(item => unmarshall(item)));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const hoursSummaries = allItems.filter(item => item.PK?.startsWith('HOURS_SUMMARY#'));
    const personnelHours = allItems.filter(item => item.PK?.startsWith('PERSONNEL_HOURS#'));

    console.log(`   Found ${hoursSummaries.length} hours summaries, ${personnelHours.length} personnel records`);

    // Calculate overall summary
    const totalRegularHours = hoursSummaries.reduce((sum, s) => sum + (s.total_regular_hours || 0), 0);
    const totalOvertimeHours = hoursSummaries.reduce((sum, s) => sum + (s.total_overtime_hours || 0), 0);
    const totalHours = totalRegularHours + totalOvertimeHours;
    const overtimeRate = totalHours > 0 ? ((totalOvertimeHours / totalHours) * 100).toFixed(1) : '0.0';

    // Aggregate by project
    const projectMap = new Map();
    hoursSummaries.forEach(hs => {
      const projectName = hs.project_name || hs.project_id || 'Unknown Project';

      if (!projectMap.has(projectName)) {
        projectMap.set(projectName, {
          project: projectName,
          regularHours: 0,
          overtimeHours: 0,
          totalHours: 0
        });
      }

      const proj = projectMap.get(projectName);
      proj.regularHours += hs.total_regular_hours || 0;
      proj.overtimeHours += hs.total_overtime_hours || 0;
      proj.totalHours += (hs.total_regular_hours || 0) + (hs.total_overtime_hours || 0);
    });

    const byProject = Array.from(projectMap.values())
      .map(p => ({
        ...p,
        overtimeRate: p.totalHours > 0 ? ((p.overtimeHours / p.totalHours) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => b.overtimeHours - a.overtimeHours);

    // Aggregate by personnel
    const personnelMap = new Map();
    personnelHours.forEach(ph => {
      const personName = ph.person_name || 'Unknown';

      if (!personnelMap.has(personName)) {
        personnelMap.set(personName, {
          name: personName,
          regularHours: 0,
          overtimeHours: 0,
          totalHours: 0
        });
      }

      const person = personnelMap.get(personName);
      person.regularHours += ph.regular_hours || 0;
      person.overtimeHours += ph.overtime_hours || 0;
      person.totalHours += (ph.regular_hours || 0) + (ph.overtime_hours || 0);
    });

    const byPersonnel = Array.from(personnelMap.values())
      .map(p => ({
        ...p,
        overtimeRate: p.totalHours > 0 ? ((p.overtimeHours / p.totalHours) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => b.totalHours - a.totalHours);

    const report = {
      type: 'overtime',
      summary: {
        totalHours,
        regularHours: totalRegularHours,
        overtimeHours: totalOvertimeHours,
        overtimeRate
      },
      byProject,
      byPersonnel
    };

    console.log(`✅ Overtime report: ${totalHours.toFixed(1)} total hrs, ${totalOvertimeHours.toFixed(1)} OT (${overtimeRate}%)`);
    return { success: true, report };
  } catch (error) {
    console.error('❌ Error fetching overtime report:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Update constraint resolution
 */
async function updateConstraintResolution(constraintId, resolution, updatedBy) {
  try {
    console.log(`📝 Updating resolution for constraint ${constraintId}...`);

    // For now, store resolutions in a separate table
    // In production, you'd want to update the constraint within the report
    const timestamp = new Date().toISOString();

    const command = new PutItemCommand({
      TableName: 'sitelogix-constraint-updates',
      Item: marshall({
        constraint_id: constraintId,
        resolution,
        updated_by: updatedBy,
        updated_at: timestamp
      })
    });

    await dynamoClient.send(command);

    console.log(`✅ Updated resolution for constraint ${constraintId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating resolution:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Update constraint status
 */
async function updateConstraintStatus(constraintId, status, updatedBy) {
  try {
    console.log(`🔄 Updating status for constraint ${constraintId} to ${status}...`);

    const timestamp = new Date().toISOString();

    const command = new PutItemCommand({
      TableName: 'sitelogix-constraint-updates',
      Item: marshall({
        constraint_id: constraintId,
        status,
        updated_by: updatedBy,
        updated_at: timestamp
      })
    });

    await dynamoClient.send(command);

    console.log(`✅ Updated status for constraint ${constraintId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating status:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Save report to S3 and DynamoDB
 */
async function saveReport(reportData) {
  try {
    const {
      audioBase64,
      transcript,
      managerId,
      managerName,
      projectId,
      projectName,
      projectLocation,
      reportDate,
      conversationId,
    } = reportData;

    // Generate report ID
    const timestamp = new Date().getTime();
    const reportId = `rpt_${reportDate.replace(/-/g, '')}_${managerId}_${timestamp}`;

    console.log('💾 Saving report:', reportId);

    const BUCKET_NAME = 'sitelogix-prod';

    // Helper function to build S3 paths
    const buildS3Path = (type) => {
      const date = new Date(reportDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `SITELOGIX/projects/${projectId}/reports/${year}/${month}/${day}/${reportId}/${type}`;
    };

    // 1. Upload audio to S3 (if available)
    let audioPath = null;
    if (audioBase64) {
      audioPath = buildS3Path('audio.webm');
      const audioBuffer = Buffer.from(audioBase64, 'base64');

      const audioCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: audioPath,
        Body: audioBuffer,
        ContentType: 'audio/webm',
        Metadata: {
          projectId,
          managerId,
          reportDate,
          reportId,
          conversationId,
        },
      });

      await s3Client.send(audioCommand);
      console.log('✅ Audio uploaded to S3:', audioPath);
    } else {
      console.log('ℹ️  No audio provided, skipping audio upload');
    }

    // 2. Save transcript to S3
    const transcriptPath = buildS3Path('transcript.json');
    const transcriptCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: transcriptPath,
      Body: JSON.stringify(transcript, null, 2),
      ContentType: 'application/json',
      Metadata: {
        projectId,
        managerId,
        reportDate,
        reportId,
        conversationId,
      },
    });

    await s3Client.send(transcriptCommand);
    console.log('✅ Transcript uploaded to S3:', transcriptPath);

    // 3. Create DynamoDB entry
    const dynamoCommand = new PutItemCommand({
      TableName: 'sitelogix-reports',
      Item: marshall({
        PK: `PROJECT#${projectId}`,
        SK: `REPORT#${reportDate}#${reportId}`,
        report_id: reportId,
        project_id: projectId,
        project_name: projectName,
        manager_id: managerId,
        manager_name: managerName,
        report_date: reportDate,
        conversation_id: conversationId,
        audio_s3_path: audioPath ? `s3://${BUCKET_NAME}/${audioPath}` : null,
        transcript_s3_path: `s3://${BUCKET_NAME}/${transcriptPath}`,
        status: 'uploaded',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    await dynamoClient.send(dynamoCommand);
    console.log('✅ Report entry created in DynamoDB');

    return {
      success: true,
      reportId,
      audioPath,
      transcriptPath,
    };
  } catch (error) {
    console.error('❌ Error saving report:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// PERSONNEL CRUD Operations
// ============================================================================

/**
 * List all personnel with optional filtering
 */
async function listPersonnel(queryParams = {}) {
  try {
    console.log('👥 Fetching personnel...', queryParams);
    const { projectId, limit = 50, lastEvaluatedKey } = queryParams;

    let command;
    if (projectId) {
      command = new QueryCommand({
        TableName: 'sitelogix-personnel',
        IndexName: 'GSI2-ProjectIndex',
        KeyConditionExpression: 'project_id = :projectId',
        ExpressionAttributeValues: {
          ':projectId': { S: projectId }
        },
        Limit: parseInt(limit)
      });
    } else {
      command = new ScanCommand({
        TableName: 'sitelogix-personnel',
        Limit: parseInt(limit),
        ExclusiveStartKey: lastEvaluatedKey ? JSON.parse(lastEvaluatedKey) : undefined
      });
    }

    const result = await dynamoClient.send(command);
    const items = result.Items.map(item => unmarshall(item));

    return {
      success: true,
      personnel: items,
      lastEvaluatedKey: result.LastEvaluatedKey ? JSON.stringify(result.LastEvaluatedKey) : null,
      count: items.length
    };
  } catch (error) {
    console.error('❌ Error fetching personnel:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get single personnel by ID
 */
async function getPersonnelById(personnelId) {
  try {
    console.log(`👤 Fetching personnel ${personnelId}...`);

    const command = new GetItemCommand({
      TableName: 'sitelogix-personnel',
      Key: {
        PK: { S: `PERSONNEL#${personnelId}` },
        SK: { S: 'METADATA' }
      }
    });

    const result = await dynamoClient.send(command);

    if (!result.Item) {
      return { success: false, error: 'Personnel not found' };
    }

    return { success: true, personnel: unmarshall(result.Item) };
  } catch (error) {
    console.error('❌ Error fetching personnel:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create new personnel record
 */
async function createPersonnel(data) {
  try {
    console.log('➕ Creating new personnel...');

    const personnelId = uuidv4();
    const timestamp = new Date().toISOString();

    const item = {
      PK: `PERSONNEL#${personnelId}`,
      SK: 'METADATA',
      personnel_id: personnelId,
      full_name: data.full_name,
      project_id: data.project_id || null,
      role: data.role || '',
      hourly_rate: data.hourly_rate || 0,
      phone: data.phone || '',
      email: data.email || '',
      status: data.status || 'active',
      created_at: timestamp,
      updated_at: timestamp
    };

    const command = new PutItemCommand({
      TableName: 'sitelogix-personnel',
      Item: marshall(item)
    });

    await dynamoClient.send(command);

    console.log(`✅ Created personnel ${personnelId}`);
    return { success: true, personnel: item };
  } catch (error) {
    console.error('❌ Error creating personnel:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update existing personnel record
 */
async function updatePersonnel(personnelId, data) {
  try {
    console.log(`✏️  Updating personnel ${personnelId}...`);

    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    // Build update expression dynamically
    const fieldsToUpdate = ['full_name', 'project_id', 'role', 'hourly_rate', 'phone', 'email', 'status'];
    fieldsToUpdate.forEach(field => {
      if (data[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = marshall(data[field]).S || marshall(data[field]).N || marshall(data[field]).NULL;
      }
    });

    updateExpressions.push('#updated_at = :updated_at');
    expressionAttributeNames['#updated_at'] = 'updated_at';
    expressionAttributeValues[':updated_at'] = { S: new Date().toISOString() };

    const command = new UpdateItemCommand({
      TableName: 'sitelogix-personnel',
      Key: {
        PK: { S: `PERSONNEL#${personnelId}` },
        SK: { S: 'METADATA' }
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });

    const result = await dynamoClient.send(command);

    console.log(`✅ Updated personnel ${personnelId}`);
    return { success: true, personnel: unmarshall(result.Attributes) };
  } catch (error) {
    console.error('❌ Error updating personnel:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete personnel record
 */
async function deletePersonnel(personnelId) {
  try {
    console.log(`🗑️  Deleting personnel ${personnelId}...`);

    const command = new DeleteItemCommand({
      TableName: 'sitelogix-personnel',
      Key: {
        PK: { S: `PERSONNEL#${personnelId}` },
        SK: { S: 'METADATA' }
      }
    });

    await dynamoClient.send(command);

    console.log(`✅ Deleted personnel ${personnelId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting personnel:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// VENDOR CRUD Operations
// ============================================================================

/**
 * List all vendors
 */
async function listVendors(queryParams = {}) {
  try {
    console.log('🏢 Fetching vendors...');
    const { limit = 50, lastEvaluatedKey } = queryParams;

    const command = new ScanCommand({
      TableName: 'sitelogix-vendors',
      Limit: parseInt(limit),
      ExclusiveStartKey: lastEvaluatedKey ? JSON.parse(lastEvaluatedKey) : undefined
    });

    const result = await dynamoClient.send(command);
    const items = result.Items.map(item => unmarshall(item));

    return {
      success: true,
      vendors: items,
      lastEvaluatedKey: result.LastEvaluatedKey ? JSON.stringify(result.LastEvaluatedKey) : null,
      count: items.length
    };
  } catch (error) {
    console.error('❌ Error fetching vendors:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get single vendor by ID
 */
async function getVendorById(vendorId) {
  try {
    console.log(`🏢 Fetching vendor ${vendorId}...`);

    const command = new GetItemCommand({
      TableName: 'sitelogix-vendors',
      Key: {
        PK: { S: `VENDOR#${vendorId}` },
        SK: { S: 'METADATA' }
      }
    });

    const result = await dynamoClient.send(command);

    if (!result.Item) {
      return { success: false, error: 'Vendor not found' };
    }

    return { success: true, vendor: unmarshall(result.Item) };
  } catch (error) {
    console.error('❌ Error fetching vendor:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create new vendor record
 */
async function createVendor(data) {
  try {
    console.log('➕ Creating new vendor...');

    const vendorId = uuidv4();
    const timestamp = new Date().toISOString();

    const item = {
      PK: `VENDOR#${vendorId}`,
      SK: 'METADATA',
      vendor_id: vendorId,
      company_name: data.company_name,
      contact_name: data.contact_name || '',
      phone: data.phone || '',
      email: data.email || '',
      services: data.services || [],
      status: data.status || 'active',
      created_at: timestamp,
      updated_at: timestamp
    };

    const command = new PutItemCommand({
      TableName: 'sitelogix-vendors',
      Item: marshall(item)
    });

    await dynamoClient.send(command);

    console.log(`✅ Created vendor ${vendorId}`);
    return { success: true, vendor: item };
  } catch (error) {
    console.error('❌ Error creating vendor:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update existing vendor record
 */
async function updateVendor(vendorId, data) {
  try {
    console.log(`✏️  Updating vendor ${vendorId}...`);

    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    const fieldsToUpdate = ['company_name', 'contact_name', 'phone', 'email', 'services', 'status'];
    fieldsToUpdate.forEach(field => {
      if (data[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = marshall(data[field])[Object.keys(marshall(data[field]))[0]];
      }
    });

    updateExpressions.push('#updated_at = :updated_at');
    expressionAttributeNames['#updated_at'] = 'updated_at';
    expressionAttributeValues[':updated_at'] = { S: new Date().toISOString() };

    const command = new UpdateItemCommand({
      TableName: 'sitelogix-vendors',
      Key: {
        PK: { S: `VENDOR#${vendorId}` },
        SK: { S: 'METADATA' }
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });

    const result = await dynamoClient.send(command);

    console.log(`✅ Updated vendor ${vendorId}`);
    return { success: true, vendor: unmarshall(result.Attributes) };
  } catch (error) {
    console.error('❌ Error updating vendor:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete vendor record
 */
async function deleteVendor(vendorId) {
  try {
    console.log(`🗑️  Deleting vendor ${vendorId}...`);

    const command = new DeleteItemCommand({
      TableName: 'sitelogix-vendors',
      Key: {
        PK: { S: `VENDOR#${vendorId}` },
        SK: { S: 'METADATA' }
      }
    });

    await dynamoClient.send(command);

    console.log(`✅ Deleted vendor ${vendorId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting vendor:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DATA EXTRACTION Operations (Roxy AI)
// ============================================================================

/**
 * Extract structured data from transcript using Claude AI
 */
async function extractFromTranscript(transcriptText, filename = '') {
  try {
    console.log('🤖 Roxy extracting data from transcript...');

    // Get Anthropic API key from environment variables
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in environment variables');
    }

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    const ROXY_EXTRACTION_PROMPT = `You are Roxy, an AI agent specialized in extracting structured data from construction daily reports.

REQUIRED FIELDS:
1. report_date (YYYY-MM-DD format)
2. reporter_name (first + last if available)
3. project_name (full name, not abbreviation)
4. total_hours (decimal format)

OPTIONAL FIELDS:
5. additional_personnel[] - Array of {name, hours, role}
6. work_completed[] - Array of tasks
7. work_in_progress[] - Array of tasks
8. issues[] - Array of problems
9. vendors[] - Array of {company, delivery_type, time}
10. weather_notes

NORMALIZATION RULES (Projects):
- "CC" = "Cortex Commons"
- "MM" = "Mellow Mushroom" or "Monsanto" (if Scott is reporter)
- "Nash Twr 2" = "Nashville Yards Tower 2"
- "SLU Res" = "Saint Louis University Residence"
- "Sx Partners" = "Surgery Partners"
- "Meharry" = "Meharry Medical College"

NORMALIZATION RULES (Personnel):
- "Owen glass burner" = "Owen Glassburn"
- "Bryan" = "Brian"
- "Ken" = "Kenny"

EXTRACTION RULES:
1. Use context to expand abbreviations
2. Normalize similar names
3. If "I" or "myself" mentioned, attribute to reporter
4. Sum hours for same person
5. Flag ambiguous items with [UNCLEAR: ...]

OUTPUT FORMAT: Return ONLY valid JSON:
{
  "report_date": "YYYY-MM-DD",
  "reporter_name": "Name",
  "project_name": "Full Project Name",
  "total_hours": 8.0,
  "additional_personnel": [],
  "work_completed": [],
  "work_in_progress": [],
  "issues": [],
  "vendors": [],
  "weather_notes": "",
  "extraction_confidence": 0.85,
  "ambiguities": []
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `${ROXY_EXTRACTION_PROMPT}

FILENAME: ${filename}

TRANSCRIPT:
${transcriptText}

Extract structured data. Return ONLY valid JSON.`
        }
      ]
    });

    const responseText = message.content[0].text;
    let extractedData;

    try {
      extractedData = JSON.parse(responseText);
    } catch (parseError) {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Could not extract valid JSON from response');
      }
    }

    extractedData.extraction_timestamp = new Date().toISOString();
    extractedData.original_filename = filename;

    console.log(`   ✅ Extraction complete (confidence: ${extractedData.extraction_confidence || 'N/A'})`);

    return { success: true, data: extractedData };

  } catch (error) {
    console.error('❌ Extraction error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Parse date from training transcript filename
 * Examples: "7.1.22 Jim Sx Partners_transcript.txt" → "2022-07-01"
 */
function parseDateFromFilename(filename) {
  // Match patterns like "7.1.22", "7.15.22", "7.5.22"
  const dateMatch = filename.match(/(\d{1,2})\.(\d{1,2})\.(\d{2})/);

  if (dateMatch) {
    const [_, month, day, year] = dateMatch;
    const fullYear = `20${year}`; // Convert "22" to "2022"
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    return `${fullYear}-${paddedMonth}-${paddedDay}`;
  }

  return null;
}

/**
 * Store extracted report data in DynamoDB
 */
async function storeExtractedReport(normalizedData, s3Key, filename) {
  const reportId = s3Key.split('/').pop().replace('.txt', '');
  const timestamp = new Date().toISOString();

  // Try to parse date from filename first, fallback to extracted date
  const filenameDate = parseDateFromFilename(filename);
  const reportDate = filenameDate || normalizedData.report_date || timestamp.split('T')[0];

  const reportItem = {
    PK: `REPORT#${reportId}`,
    SK: 'METADATA',
    report_id: reportId,
    report_date: reportDate,
    project_id: normalizedData.project_id || 'proj_001',
    project_name: normalizedData.project_canonical_name || normalizedData.project_name || 'Unknown',
    reporter_personnel_id: normalizedData.reporter_personnel_id,
    reporter_name: normalizedData.reporter_canonical_name || normalizedData.reporter_name,
    total_hours: normalizedData.total_hours || 0,
    weather_notes: normalizedData.weather_notes || '',
    transcript_s3_key: s3Key,
    extraction_confidence: normalizedData.extraction_confidence || 0,
    extraction_timestamp: normalizedData.extraction_timestamp,
    normalization_timestamp: normalizedData.normalization_timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    status: 'processed',
    extracted_data: JSON.stringify({
      work_completed: normalizedData.work_completed || [],
      work_in_progress: normalizedData.work_in_progress || [],
      issues: normalizedData.issues || [],
      vendors: normalizedData.vendors || [],
      additional_personnel: normalizedData.additional_personnel || [],
      ambiguities: normalizedData.ambiguities || []
    })
  };

  const command = new PutItemCommand({
    TableName: 'sitelogix-reports',
    Item: marshall(reportItem, { removeUndefinedValues: true })
  });

  await dynamoClient.send(command);
  return reportItem;
}

/**
 * Seed master personnel to database
 */
async function seedMasterPersonnel() {
  console.log('👥 Seeding master personnel...');

  const masterPersonnel = getMasterPersonnel();
  let created = 0;

  for (const [personnelId, data] of Object.entries(masterPersonnel)) {
    // Check if exists
    const existsCheck = await dynamoClient.send(new GetItemCommand({
      TableName: 'sitelogix-personnel',
      Key: {
        PK: { S: `PERSONNEL#${personnelId}` },
        SK: { S: 'METADATA' }
      }
    }));

    if (!existsCheck.Item) {
      await createPersonnel({
        personnel_id: personnelId,
        full_name: data.canonical_name,
        role: data.role,
        status: 'active'
      });
      created++;
    }
  }

  console.log(`   ✅ Seeded ${created} personnel`);
  return { created };
}

/**
 * Process batch of transcripts from S3
 * For batches > 2, processes first 2 synchronously, queues rest async to avoid API timeout
 */
async function processBatchTranscripts(options = {}) {
  try {
    const { limit = 102, prefix = 'projects/proj_001/transcripts/raw/2025/11/', offset = 0, async = false } = options;

    const effectiveLimit = async ? limit : Math.min(limit, 2); // Max 2 for sync to avoid timeout
    console.log(`🚀 Starting batch extraction (limit: ${effectiveLimit}, offset: ${offset}, async: ${async})...`);

    // List ALL transcripts from S3 first
    const listCommand = new ListObjectsV2Command({
      Bucket: 'sitelogix-prod',
      Prefix: prefix
    });

    const listResult = await s3Client.send(listCommand);

    if (!listResult.Contents || listResult.Contents.length === 0) {
      return { success: false, error: 'No transcripts found' };
    }

    const allTranscripts = listResult.Contents.filter(item => item.Key.endsWith('.txt'));
    console.log(`   📋 Found ${allTranscripts.length} total transcripts`);

    // Apply offset and limit
    const transcriptsToProcess = allTranscripts.slice(offset, offset + effectiveLimit);
    console.log(`   📄 Processing ${transcriptsToProcess.length} transcripts (offset: ${offset})`);

    // Seed personnel first
    await seedMasterPersonnel();

    // Process each transcript
    const results = [];
    for (const item of transcriptsToProcess) {
      console.log(`\n   📄 Processing: ${item.Key}`);

      try {
        // Read transcript from S3
        const getCommand = new GetObjectCommand({
          Bucket: 'sitelogix-prod',
          Key: item.Key
        });
        const getResult = await s3Client.send(getCommand);
        const content = await getResult.Body.transformToString();

        // Extract data with Roxy
        const extraction = await extractFromTranscript(content, item.Key.split('/').pop());

        if (!extraction.success) {
          results.push({ filename: item.Key, success: false, error: extraction.error });
          continue;
        }

        // Normalize entities
        const normalized = normalizeExtractedData(extraction.data);

        // Store in DynamoDB
        const filename = item.Key.split('/').pop();
        await storeExtractedReport(normalized, item.Key, filename);

        results.push({
          filename: item.Key,
          success: true,
          confidence: normalized.extraction_confidence
        });

      } catch (error) {
        console.error(`   ❌ Error processing ${item.Key}:`, error.message);
        results.push({ filename: item.Key, success: false, error: error.message });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\n✅ Batch complete: ${succeeded} succeeded, ${failed} failed`);

    // If there are more transcripts to process and we're not in async mode, queue next batch
    const remaining = allTranscripts.length - (offset + effectiveLimit);
    let queuedJob = null;

    if (remaining > 0 && !async && limit > effectiveLimit) {
      const nextOffset = offset + effectiveLimit;
      const nextLimit = Math.min(limit - effectiveLimit, remaining);

      console.log(`\n🔄 Queuing ${nextLimit} more transcripts asynchronously (offset: ${nextOffset})...`);

      // Invoke Lambda asynchronously for next batch
      const invokeCommand = new InvokeCommand({
        FunctionName: 'sitelogix-api',
        InvocationType: 'Event', // Async invocation
        Payload: JSON.stringify({
          requestContext: {
            http: {
              method: 'POST',
              path: '/api/extract/batch'
            }
          },
          body: JSON.stringify({
            limit: nextLimit,
            offset: nextOffset,
            async: true // Mark as async to allow full batch processing
          })
        })
      });

      await lambdaClient.send(invokeCommand);
      queuedJob = {
        offset: nextOffset,
        limit: nextLimit,
        status: 'queued'
      };
    }

    return {
      success: true,
      total: results.length,
      succeeded,
      failed,
      results,
      totalTranscripts: allTranscripts.length,
      processed: offset + results.length,
      remaining,
      queuedJob
    };

  } catch (error) {
    console.error('❌ Batch processing error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Lambda handler - main entry point
 */
exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  // CORS headers - restrict to Amplify domain
  const headers = {
    'Access-Control-Allow-Origin': 'https://main.d2mp0300tkuah.amplifyapp.com',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const path = event.requestContext?.http?.path || event.path || '';
    const method = event.requestContext?.http?.method || event.httpMethod || 'GET';

    console.log(`Processing ${method} ${path}`);

    // Route handling
    if (path.endsWith('/managers') && method === 'GET') {
      const result = await getManagers();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    if (path.endsWith('/projects') && method === 'GET') {
      const result = await getProjects();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // GET /api/reports/:reportId/html
    if (path.match(/\/reports\/[^/]+\/html$/) && method === 'GET') {
      const reportId = path.split('/')[path.split('/').length - 2];
      const queryParams = event.queryStringParameters || {};
      const projectId = queryParams.projectId;
      const reportDate = queryParams.reportDate;

      if (!projectId || !reportDate) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing projectId or reportDate' })
        };
      }

      const result = await getReportHtml(reportId, projectId, reportDate);

      if (!result.success) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify(result)
        };
      }

      // Return HTML content directly
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'text/html'
        },
        body: result.html
      };
    }

    // GET /api/reports/:reportId/transcript - View raw transcript
    if (path.match(/\/reports\/[^/]+\/transcript$/) && method === 'GET') {
      const reportId = path.split('/')[path.split('/').length - 2];

      try {
        const getCommand = new GetItemCommand({
          TableName: 'sitelogix-reports',
          Key: {
            PK: { S: `REPORT#${reportId}` },
            SK: { S: 'METADATA' }
          }
        });

        const result = await dynamoClient.send(getCommand);

        if (!result.Item) {
          return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Report not found' }) };
        }

        const report = unmarshall(result.Item);

        if (!report.transcript_s3_key) {
          return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Transcript not found' }) };
        }

        const s3Command = new GetObjectCommand({
          Bucket: 'sitelogix-prod',
          Key: report.transcript_s3_key
        });

        const s3Result = await s3Client.send(s3Command);
        const transcriptText = await s3Result.Body.transformToString();

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transcript - ${report.report_date}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace; line-height: 1.8; max-width: 900px; margin: 0 auto; padding: 20px; background: #0f172a; color: #e2e8f0; }
    .header { background: linear-gradient(135deg, #d4af37 0%, #c4941f 100%); color: #0f172a; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { margin: 0 0 10px 0; font-size: 1.8em; }
    .transcript { background: rgba(255,255,255,0.05); padding: 30px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
    .nav { margin-top: 20px; }
    .btn { padding: 12px 24px; background: rgba(255,255,255,0.1); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📄 Original Transcript</h1>
    <p><strong>Report Date:</strong> ${report.report_date}</p>
    <p><strong>Project:</strong> ${report.project_name || 'Unknown'}</p>
    <p><strong>Reporter:</strong> ${report.reporter_name || 'Unknown'}</p>
  </div>
  <div class="transcript">${transcriptText}</div>
  <div class="nav">
    <button onclick="window.close(); window.history.back();" class="btn">← Back to Report</button>
  </div>
</body>
</html>`;

        return { statusCode: 200, headers: { ...headers, 'Content-Type': 'text/html' }, body: html };
      } catch (error) {
        console.error('Error fetching transcript:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
      }
    }

    // POST /api/reports - save a new report
    if (path.endsWith('/reports') && method === 'POST') {
      try {
        const body = JSON.parse(event.body || '{}');
        const result = await saveReport(body);

        if (!result.success) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify(result)
          };
        }

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(result)
        };
      } catch (error) {
        console.error('Error in POST /api/reports:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }
    }

    // GET /api/reports
    if (path.endsWith('/reports') && method === 'GET') {
      const queryParams = event.queryStringParameters || {};
      const result = await getReports(queryParams);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // GET /api/analytics/insights
    if (path.endsWith('/analytics/insights') && method === 'GET') {
      const result = await getAnalyticsInsights();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // POST /api/analytics/query
    if (path.endsWith('/analytics/query') && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await handleAnalyticsQuery(body.query);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // GET /api/analytics/reports/:reportType
    if (path.match(/\/analytics\/reports\/[^/]+$/) && method === 'GET') {
      const reportType = path.split('/').pop();
      let result;

      // Route to appropriate report handler
      if (reportType === 'deliveries') {
        result = await getDeliveryReport();
      } else if (reportType === 'overtime') {
        result = await getOvertimeReport();
      } else {
        // Default to constraint report for 'critical', 'constraints', etc.
        result = await getConstraintReport(reportType);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // POST /api/analytics/constraints/:constraintId/resolution
    if (path.match(/\/analytics\/constraints\/[^/]+\/resolution$/) && method === 'POST') {
      const constraintId = path.split('/')[path.split('/').length - 2];
      const body = JSON.parse(event.body || '{}');
      const result = await updateConstraintResolution(constraintId, body.resolution, body.updatedBy);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // POST /api/analytics/constraints/:constraintId/status
    if (path.match(/\/analytics\/constraints\/[^/]+\/status$/) && method === 'POST') {
      const constraintId = path.split('/')[path.split('/').length - 2];
      const body = JSON.parse(event.body || '{}');
      const result = await updateConstraintStatus(constraintId, body.status, body.updatedBy);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // POST /api/elevenlabs/conversation - Proxy for ElevenLabs conversation API
    if (path.endsWith('/elevenlabs/conversation') && method === 'POST') {
      try {
        const elevenLabsSecret = await getSecret('sitelogix/elevenlabs');
        const body = JSON.parse(event.body || '{}');

        // Forward the request to ElevenLabs with our API key
        const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/convai/conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': elevenLabsSecret.api_key
          },
          body: JSON.stringify(body)
        });

        const data = await elevenLabsResponse.json();

        return {
          statusCode: elevenLabsResponse.status,
          headers,
          body: JSON.stringify(data)
        };
      } catch (error) {
        console.error('Error proxying ElevenLabs request:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }
    }

    // GET /api/elevenlabs/agent-config - Get ElevenLabs agent ID
    if (path.endsWith('/elevenlabs/agent-config') && method === 'GET') {
      try {
        const elevenLabsSecret = await getSecret('sitelogix/elevenlabs');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            agentId: elevenLabsSecret.agent_id
          })
        };
      } catch (error) {
        console.error('Error fetching ElevenLabs config:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }
    }

    // =====================================================================
    // PERSONNEL CRUD Routes
    // =====================================================================

    // GET /api/personnel
    if (path.endsWith('/personnel') && method === 'GET') {
      const result = await listPersonnel(event.queryStringParameters || {});
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // POST /api/personnel
    if (path.endsWith('/personnel') && method === 'POST') {
      try {
        const body = JSON.parse(event.body || '{}');
        const result = await createPersonnel(body);
        return {
          statusCode: result.success ? 201 : 400,
          headers,
          body: JSON.stringify(result)
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }
    }

    // GET /api/personnel/:id
    if (path.match(/\/personnel\/[^/]+$/) && method === 'GET') {
      const personnelId = path.split('/').pop();
      const result = await getPersonnelById(personnelId);
      return {
        statusCode: result.success ? 200 : 404,
        headers,
        body: JSON.stringify(result)
      };
    }

    // PUT /api/personnel/:id
    if (path.match(/\/personnel\/[^/]+$/) && method === 'PUT') {
      try {
        const personnelId = path.split('/').pop();
        const body = JSON.parse(event.body || '{}');
        const result = await updatePersonnel(personnelId, body);
        return {
          statusCode: result.success ? 200 : 400,
          headers,
          body: JSON.stringify(result)
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }
    }

    // DELETE /api/personnel/:id
    if (path.match(/\/personnel\/[^/]+$/) && method === 'DELETE') {
      const personnelId = path.split('/').pop();
      const result = await deletePersonnel(personnelId);
      return {
        statusCode: result.success ? 200 : 400,
        headers,
        body: JSON.stringify(result)
      };
    }

    // =====================================================================
    // VENDOR CRUD Routes
    // =====================================================================

    // GET /api/vendors
    if (path.endsWith('/vendors') && method === 'GET') {
      const result = await listVendors(event.queryStringParameters || {});
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // POST /api/vendors
    if (path.endsWith('/vendors') && method === 'POST') {
      try {
        const body = JSON.parse(event.body || '{}');
        const result = await createVendor(body);
        return {
          statusCode: result.success ? 201 : 400,
          headers,
          body: JSON.stringify(result)
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }
    }

    // GET /api/vendors/:id
    if (path.match(/\/vendors\/[^/]+$/) && method === 'GET') {
      const vendorId = path.split('/').pop();
      const result = await getVendorById(vendorId);
      return {
        statusCode: result.success ? 200 : 404,
        headers,
        body: JSON.stringify(result)
      };
    }

    // PUT /api/vendors/:id
    if (path.match(/\/vendors\/[^/]+$/) && method === 'PUT') {
      try {
        const vendorId = path.split('/').pop();
        const body = JSON.parse(event.body || '{}');
        const result = await updateVendor(vendorId, body);
        return {
          statusCode: result.success ? 200 : 400,
          headers,
          body: JSON.stringify(result)
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }
    }

    // DELETE /api/vendors/:id
    if (path.match(/\/vendors\/[^/]+$/) && method === 'DELETE') {
      const vendorId = path.split('/').pop();
      const result = await deleteVendor(vendorId);
      return {
        statusCode: result.success ? 200 : 400,
        headers,
        body: JSON.stringify(result)
      };
    }

    // =====================================================================
    // EXTRACTION Routes (Roxy AI)
    // =====================================================================

    // POST /api/extract/batch - Process batch of transcripts
    if (path.endsWith('/extract/batch') && method === 'POST') {
      try {
        const body = JSON.parse(event.body || '{}');
        const result = await processBatchTranscripts(body);
        return {
          statusCode: result.success ? 200 : 500,
          headers,
          body: JSON.stringify(result)
        };
      } catch (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }
    }

    // POST /api/extract/personnel/seed - Seed master personnel
    if (path.endsWith('/extract/personnel/seed') && method === 'POST') {
      try {
        const result = await seedMasterPersonnel();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, result })
        };
      } catch (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }
    }

    // GET /api/extract/master-data - Get master personnel and projects
    if (path.endsWith('/extract/master-data') && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          personnel: getMasterPersonnel(),
          projects: getMasterProjects()
        })
      };
    }

    // =====================================================================
    // Business Intelligence (BI) Routes
    // =====================================================================

    // GET /api/bi/executive - Executive Dashboard (Portfolio Health, Financial Snapshot)
    if (path.endsWith('/bi/executive') && method === 'GET') {
      const result = await getExecutiveDashboard();
      return {
        statusCode: result.success ? 200 : 500,
        headers,
        body: JSON.stringify(result)
      };
    }

    // GET /api/bi/personnel - Personnel Intelligence (Labor Costs, OT Analysis)
    if (path.endsWith('/bi/personnel') && method === 'GET') {
      const result = await getPersonnelIntelligence(event.queryStringParameters || {});
      return {
        statusCode: result.success ? 200 : 500,
        headers,
        body: JSON.stringify(result)
      };
    }

    // GET /api/bi/vendors - Vendor Intelligence (Performance Grading, Chargebacks)
    if (path.endsWith('/bi/vendors') && method === 'GET') {
      const result = await getVendorIntelligence(event.queryStringParameters || {});
      return {
        statusCode: result.success ? 200 : 500,
        headers,
        body: JSON.stringify(result)
      };
    }

    // GET /api/bi/projects/:project_id/health - Project Health Deep-Dive
    if (path.match(/\/bi\/projects\/[^/]+\/health$/) && method === 'GET') {
      const pathParts = path.split('/');
      const projectId = pathParts[pathParts.length - 2];
      const result = await getProjectHealth(projectId);
      return {
        statusCode: result.success ? 200 : 500,
        headers,
        body: JSON.stringify(result)
      };
    }

    // GET /api/bi/constraints - Constraint Analytics (Cost Impacts, ROI Opportunities)
    if (path.endsWith('/bi/constraints') && method === 'GET') {
      const result = await getConstraintAnalytics(event.queryStringParameters || {});
      return {
        statusCode: result.success ? 200 : 500,
        headers,
        body: JSON.stringify(result)
      };
    }

    // GET /api/bi/recommendations - Strategic Insights (Cost Reduction, Risk Mitigation, Growth)
    if (path.endsWith('/bi/recommendations') && method === 'GET') {
      const result = await getStrategicInsights(event.queryStringParameters || {});
      return {
        statusCode: result.success ? 200 : 500,
        headers,
        body: JSON.stringify(result)
      };
    }

    // POST /api/bi/query - AI Natural Language Query
    if (path.endsWith('/bi/query') && method === 'POST') {
      try {
        const body = JSON.parse(event.body || '{}');
        const result = await queryWithAI(body.query || '');
        return {
          statusCode: result.success ? 200 : 500,
          headers,
          body: JSON.stringify(result)
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }
    }

    // =====================================================================
    // BI Report Endpoints
    // =====================================================================

    // GET /api/bi/reports/overtime - Overtime Analysis Report
    if (path.endsWith('/bi/reports/overtime') && method === 'GET') {
      const result = await getOvertimeReport();
      return {
        statusCode: result.success ? 200 : 500,
        headers,
        body: JSON.stringify(result)
      };
    }

    // GET /api/bi/reports/constraints - Constraints by Project Report
    if (path.endsWith('/bi/reports/constraints') && method === 'GET') {
      const result = await getConstraintsReport();
      return {
        statusCode: result.success ? 200 : 500,
        headers,
        body: JSON.stringify(result)
      };
    }

    // GET /api/bi/reports/savings - Cost Analysis & Savings Opportunities
    if (path.endsWith('/bi/reports/savings') && method === 'GET') {
      const result = await getCostAnalysisReport();
      return {
        statusCode: result.success ? 200 : 500,
        headers,
        body: JSON.stringify(result)
      };
    }

    // GET /api/bi/reports/deliveries - Delivery Performance Report
    if (path.endsWith('/bi/reports/deliveries') && method === 'GET') {
      const result = await getDeliveryPerformanceReport();
      return {
        statusCode: result.success ? 200 : 500,
        headers,
        body: JSON.stringify(result)
      };
    }

    // =====================================================================
    // Health Check Route
    // =====================================================================

    if (path.endsWith('/health') && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() })
      };
    }

    // Route not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ success: false, error: 'Not found' })
    };

  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
