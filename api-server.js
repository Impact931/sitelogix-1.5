/**
 * SiteLogix Local API Server
 *
 * Provides API endpoints for the frontend to fetch managers and projects
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

// Initialize Google Sheets API
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

// Initialize S3
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = 'sitelogix-prod';

/**
 * GET /api/managers
 * Fetches all project managers from Employee Roster sheet
 */
app.get('/api/managers', async (req, res) => {
  try {
    console.log('📋 Fetching managers from Employee Roster...');

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
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
    res.json({ success: true, managers });
  } catch (error) {
    console.error('❌ Error fetching managers:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/projects
 * Fetches all projects from DynamoDB
 *
 * Note: In production, this would query a projects table.
 * For now, we'll extract unique projects from reports.
 */
app.get('/api/projects', async (req, res) => {
  try {
    console.log('🏗️  Fetching projects from DynamoDB...');

    // Scan the reports table to get unique project IDs
    const command = new ScanCommand({
      TableName: 'sitelogix-reports',
      ProjectionExpression: 'project_id, manager_id'
    });

    const result = await dynamoClient.send(command);
    const items = result.Items.map(item => unmarshall(item));

    // Get unique projects
    const projectMap = new Map();
    items.forEach(item => {
      if (item.project_id && !projectMap.has(item.project_id)) {
        projectMap.set(item.project_id, {
          id: item.project_id,
          name: getProjectName(item.project_id), // Helper to get friendly name
          location: 'TBD', // Would come from a projects table in production
          managerId: item.manager_id || ''
        });
      }
    });

    const projects = Array.from(projectMap.values());

    console.log(`✅ Found ${projects.length} projects`);
    res.json({ success: true, projects });
  } catch (error) {
    console.error('❌ Error fetching projects:', error.message);

    // Return mock data for development if DynamoDB fails
    const mockProjects = [
      { id: 'proj_001', name: 'Parkway Plaza Development', location: 'Downtown', managerId: 'EMP001' },
      { id: 'proj_002', name: 'Sunset Ridge Construction', location: 'West Side', managerId: 'EMP002' }
    ];

    console.log('⚠️  Using mock project data');
    res.json({ success: true, projects: mockProjects, mock: true });
  }
});

/**
 * Helper function to convert project ID to friendly name
 */
function getProjectName(projectId) {
  const projectNames = {
    'proj_001': 'Parkway Plaza Development',
    'proj_002': 'Sunset Ridge Construction',
    'PRJ001': 'Parkway Plaza Development',
    'PRJ002': 'Sunset Ridge Construction'
  };

  return projectNames[projectId] || projectId;
}

/**
 * Helper function to fetch manager name from Employee Roster
 */
async function getManagerName(managerId) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Employee Roster!A2:J100',
    });

    const rows = response.data.values || [];
    const managerRow = rows.find(row => row[0] === managerId);

    if (managerRow) {
      return managerRow[1] || managerId; // Return full name (column B) or ID if not found
    }

    return managerId;
  } catch (error) {
    console.error(`⚠️  Error fetching manager name for ${managerId}:`, error.message);
    return managerId;
  }
}

/**
 * GET /api/reports
 * Fetches all reports from DynamoDB with optional filtering
 */
app.get('/api/reports', async (req, res) => {
  try {
    console.log('📋 Fetching reports from DynamoDB...');

    const { projectId, managerId } = req.query;

    const command = new ScanCommand({
      TableName: 'sitelogix-reports'
    });

    const result = await dynamoClient.send(command);
    let reports = result.Items.map(item => unmarshall(item));

    // Apply filters if provided
    if (projectId) {
      reports = reports.filter(r => r.project_id === projectId);
    }
    if (managerId) {
      reports = reports.filter(r => r.manager_id === managerId);
    }

    // Enrich reports with friendly names and construct HTML URLs
    const enrichedReports = await Promise.all(reports.map(async (report) => {
      // Construct HTML URL if missing
      if (!report.report_html_url && report.report_date && report.report_id) {
        const [year, month, day] = report.report_date.split('-');
        report.report_html_url = `https://sitelogix-prod.s3.amazonaws.com/SITELOGIX/projects/${report.project_id}/reports/${year}/${month}/${day}/${report.report_id}/report.html`;
      }

      // Add project name if missing
      if (!report.project_name) {
        report.project_name = getProjectName(report.project_id);
      }

      // Add manager name if missing
      if (!report.manager_name && report.manager_id) {
        report.manager_name = await getManagerName(report.manager_id);
      }

      return report;
    }));

    console.log(`✅ Found ${enrichedReports.length} reports`);
    res.json({ success: true, reports: enrichedReports });
  } catch (error) {
    console.error('❌ Error fetching reports:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/reports/:reportId/html
 * Fetches and serves the HTML report directly
 */
app.get('/api/reports/:reportId/html', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { projectId, reportDate } = req.query;

    if (!projectId || !reportDate) {
      return res.status(400).json({
        success: false,
        error: 'projectId and reportDate query parameters are required'
      });
    }

    console.log(`📄 Fetching HTML report: ${reportId}`);

    const [year, month, day] = reportDate.split('-');
    const s3Key = `SITELOGIX/projects/${projectId}/reports/${year}/${month}/${day}/${reportId}/report.html`;

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    const htmlContent = await response.Body.transformToString();

    console.log(`✅ Fetched HTML report (${htmlContent.length} bytes)`);

    // Serve the HTML directly
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(htmlContent);
  } catch (error) {
    console.error('❌ Error fetching HTML report:', error.message);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Report Not Found</title></head>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1 style="color: #ef4444;">Report Not Found</h1>
          <p>${error.message}</p>
        </body>
      </html>
    `);
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function start() {
  try {
    await initGoogleSheets();
    console.log('✅ Google Sheets API initialized');

    app.listen(PORT, () => {
      console.log('');
      console.log('='.repeat(60));
      console.log('🚀 SiteLogix API Server Running');
      console.log('='.repeat(60));
      console.log(`📡 Server: http://localhost:${PORT}`);
      console.log('');
      console.log('Available Endpoints:');
      console.log(`  GET  /api/managers     - Fetch project managers`);
      console.log(`  GET  /api/projects     - Fetch projects`);
      console.log(`  GET  /api/health       - Health check`);
      console.log('='.repeat(60));
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
