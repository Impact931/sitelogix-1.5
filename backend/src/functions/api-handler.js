/**
 * Lambda handler for SiteLogix API endpoints
 * Provides /managers and /projects endpoints for frontend
 */

const { google } = require('googleapis');
const { DynamoDBClient, ScanCommand, QueryCommand, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall, marshall } = require('@aws-sdk/util-dynamodb');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { v4: uuidv4 } = require('uuid');

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

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

    // Use correct DynamoDB key schema
    const command = new GetItemCommand({
      TableName: 'sitelogix-reports',
      Key: {
        PK: { S: `PROJECT#${projectId}` },
        SK: { S: `REPORT#${reportDate}#${reportId}` }
      }
    });

    const result = await dynamoClient.send(command);

    if (!result.Item) {
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

    return { success: false, error: 'Report HTML not found' };
  } catch (error) {
    console.error('❌ Error fetching report HTML:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get analytics insights from all reports
 */
async function getAnalyticsInsights() {
  try {
    console.log('📊 Calculating analytics insights...');

    // Fetch all reports
    const command = new ScanCommand({
      TableName: 'sitelogix-reports'
    });

    const result = await dynamoClient.send(command);
    const reports = result.Items.map(item => unmarshall(item));

    // Calculate summary statistics
    const totalReports = reports.length;
    const totalLaborHours = reports.reduce((sum, r) => sum + (r.total_regular_hours || 0), 0);
    const overtimeHours = reports.reduce((sum, r) => sum + (r.total_overtime_hours || 0), 0);
    const overtimeRate = totalLaborHours > 0 ? ((overtimeHours / totalLaborHours) * 100).toFixed(1) : 0;

    // Calculate delivery metrics (from report data)
    const deliveryData = reports.map(r => r.material_deliveries || []).flat();
    const totalDeliveries = deliveryData.length;
    const lateDeliveries = deliveryData.filter(d => d.status === 'Late').length;
    const onTimeDeliveryRate = totalDeliveries > 0 ? (((totalDeliveries - lateDeliveries) / totalDeliveries) * 100).toFixed(1) : 100;

    // Get constraint data
    const allConstraints = reports.map(r => r.constraints || []).flat();
    const openConstraints = allConstraints.filter(c => c.status !== 'Resolved').length;
    const criticalConstraints = allConstraints.filter(c => c.severity === 'High' && c.status !== 'Resolved').length;

    // Group deliveries by vendor
    const vendorMap = new Map();
    deliveryData.forEach(delivery => {
      const vendor = delivery.vendor || 'Unknown';
      if (!vendorMap.has(vendor)) {
        vendorMap.set(vendor, { deliveries: 0, lateDeliveries: 0 });
      }
      const stats = vendorMap.get(vendor);
      stats.deliveries++;
      if (delivery.status === 'Late') stats.lateDeliveries++;
    });

    const vendors = Array.from(vendorMap.entries()).map(([name, stats]) => ({
      name,
      deliveries: stats.deliveries,
      lateDeliveries: stats.lateDeliveries,
      onTimeRate: ((stats.deliveries - stats.lateDeliveries) / stats.deliveries * 100).toFixed(1) + '%'
    })).sort((a, b) => b.deliveries - a.deliveries).slice(0, 5);

    // Generate alerts
    const alerts = [];
    if (criticalConstraints > 0) {
      alerts.push({
        type: 'critical',
        category: 'Constraints',
        message: `${criticalConstraints} critical constraints require immediate attention`,
        impact: 'High'
      });
    }
    if (parseFloat(overtimeRate) > 20) {
      alerts.push({
        type: 'warning',
        category: 'Labor',
        message: `Overtime rate at ${overtimeRate}% exceeds recommended threshold`,
        impact: 'Medium'
      });
    }
    if (parseFloat(onTimeDeliveryRate) < 90) {
      alerts.push({
        type: 'warning',
        category: 'Deliveries',
        message: `On-time delivery rate at ${onTimeDeliveryRate}% below target`,
        impact: 'Medium'
      });
    }

    const insights = {
      summary: {
        totalDeliveries,
        lateDeliveries,
        onTimeDeliveryRate: parseFloat(onTimeDeliveryRate),
        totalLaborHours,
        overtimeHours,
        overtimeRate: parseFloat(overtimeRate),
        openConstraints,
        criticalConstraints,
        totalReports
      },
      vendors,
      alerts
    };

    console.log(`✅ Calculated insights from ${totalReports} reports`);
    return { success: true, insights };
  } catch (error) {
    console.error('❌ Error calculating insights:', error.message);
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
      const result = await getConstraintReport(reportType);
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
