/**
 * Lambda handler for SiteLogix API endpoints
 * Provides /managers and /projects endpoints for frontend
 */

const { google } = require('googleapis');
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

// Initialize DynamoDB
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Google Sheets configuration
const SPREADSHEET_ID = '1lb8nmFjvKdWmoqSLaowEKWEzGzNUPw7CuTTZ7k1FIg4';

/**
 * Initialize Google Sheets API client
 */
async function getGoogleSheetsClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3000');
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

/**
 * Fetch managers from Google Sheets
 */
async function getManagers() {
  try {
    console.log('📋 Fetching managers from Employee Roster...');
    const sheets = await getGoogleSheetsClient();

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
 * Lambda handler - main entry point
 */
exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
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
