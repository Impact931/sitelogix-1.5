/**
 * Generate HTML Reports for Existing Transcripts
 *
 * This script scans DynamoDB for reports that don't have HTML versions
 * and generates them from their transcript JSON files.
 */

require('dotenv').config();
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, ScanCommand, UpdateCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { generateHTMLReport } = require('./generate-html-report');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BUCKET = 'sitelogix-prod';
const REPORTS_TABLE = 'sitelogix-reports';

async function getReportsWithoutHTML() {
  console.log('🔍 Scanning DynamoDB for reports without HTML...');

  const command = new ScanCommand({
    TableName: REPORTS_TABLE
  });

  const result = await dynamoClient.send(command);
  const reports = result.Items.map(item => {
    const unmarshalled = {};
    for (const [key, value] of Object.entries(item)) {
      unmarshalled[key] = value.S || value.N || value.BOOL || value;
    }
    return unmarshalled;
  });

  // Filter for reports that don't have status "Generated" (meaning no HTML)
  const reportsNeedingHTML = reports.filter(r => r.status?.S !== 'Generated');

  console.log(`Found ${reportsNeedingHTML.length} reports needing HTML generation`);
  return reportsNeedingHTML;
}

async function fetchTranscriptFromS3(s3Path) {
  try {
    // Extract bucket and key from S3 path
    let bucket, key;

    if (s3Path.startsWith('s3://')) {
      const parts = s3Path.replace('s3://', '').split('/');
      bucket = parts[0];
      key = parts.slice(1).join('/');
    } else if (s3Path.startsWith('https://')) {
      // Parse URL format
      const url = new URL(s3Path);
      bucket = url.hostname.split('.')[0];
      key = url.pathname.substring(1);
    } else {
      throw new Error('Invalid S3 path format');
    }

    console.log(`  📥 Fetching transcript from s3://${bucket}/${key}`);

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(command);
    const transcriptText = await response.Body.transformToString();
    return JSON.parse(transcriptText);
  } catch (error) {
    console.error(`  ❌ Failed to fetch transcript:`, error.message);
    return null;
  }
}

async function processTranscript(transcriptData) {
  // Extract structured data from transcript
  // This is a simplified version - in production, use Claude to extract data
  const extracted = {
    personnel: [],
    workLogs: [],
    deliveries: [],
    constraints: [],
    timeSummary: {
      totalPersonnelCount: 0,
      totalRegularHours: 0,
      totalOvertimeHours: 0
    }
  };

  // Try to parse the transcript conversation
  if (transcriptData.analysis) {
    // Use existing analysis if available
    const analysis = transcriptData.analysis;

    extracted.personnel = analysis.personnel || [];
    extracted.workLogs = analysis.work_logs || analysis.workLogs || [];
    extracted.deliveries = analysis.deliveries || [];
    extracted.constraints = analysis.constraints || analysis.issues || [];

    extracted.timeSummary = {
      totalPersonnelCount: extracted.personnel.length,
      totalRegularHours: extracted.personnel.reduce((sum, p) => sum + (parseFloat(p.hoursWorked) || 0), 0),
      totalOvertimeHours: extracted.personnel.reduce((sum, p) => sum + (parseFloat(p.overtimeHours) || 0), 0)
    };
  }

  return extracted;
}

async function generateAndUploadHTML(report) {
  try {
    const reportId = report.report_id?.S || report.report_id;
    const projectId = report.project_id?.S || report.project_id;
    const reportDate = report.report_date?.S || report.report_date;
    const managerId = report.manager_id?.S || report.manager_id;
    const managerName = report.manager_name?.S || report.manager_name || 'Unknown Manager';
    const transcriptPath = report.transcript_s3_path?.S || report.transcript_s3_path;

    console.log(`\n📄 Processing: ${reportId}`);
    console.log(`  Project: ${projectId}`);
    console.log(`  Date: ${reportDate}`);

    if (!transcriptPath) {
      console.log(`  ⚠️  No transcript path found, skipping`);
      return false;
    }

    // Fetch transcript
    const transcriptData = await fetchTranscriptFromS3(transcriptPath);
    if (!transcriptData) {
      return false;
    }

    // Process transcript to extract data
    const extracted = await processTranscript(transcriptData);

    // Generate HTML
    console.log(`  🎨 Generating HTML report...`);
    const context = {
      reportId,
      reportDate,
      projectId,
      projectName: projectId, // Use ID as name for now
      managerName,
      managerId
    };

    const htmlContent = generateHTMLReport(extracted, context);

    // Upload to S3
    const [year, month, day] = reportDate.split('-');
    const s3Key = `SITELOGIX/projects/${projectId}/reports/${year}/${month}/${day}/${reportId}/report.html`;

    console.log(`  ☁️  Uploading to S3: ${s3Key}`);
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: htmlContent,
      ContentType: 'text/html',
      CacheControl: 'no-cache'
    }));

    const htmlUrl = `https://${BUCKET}.s3.amazonaws.com/${s3Key}`;

    // Update DynamoDB
    console.log(`  💾 Updating DynamoDB status...`);
    await docClient.send(new UpdateCommand({
      TableName: REPORTS_TABLE,
      Key: {
        PK: report.PK,
        SK: report.SK
      },
      UpdateExpression: 'SET #status = :status, report_html_url = :url, total_personnel = :personnel, total_regular_hours = :regular, total_overtime_hours = :overtime, updated_at = :updated',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'Generated',
        ':url': htmlUrl,
        ':personnel': extracted.timeSummary.totalPersonnelCount,
        ':regular': extracted.timeSummary.totalRegularHours,
        ':overtime': extracted.timeSummary.totalOvertimeHours,
        ':updated': new Date().toISOString()
      }
    }));

    console.log(`  ✅ Successfully generated HTML report`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error processing report:`, error.message);
    return false;
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('🏗️  Generate HTML Reports for Existing Transcripts');
  console.log('='.repeat(80));
  console.log('');

  try {
    const reports = await getReportsWithoutHTML();

    if (reports.length === 0) {
      console.log('✅ All reports already have HTML versions!');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const report of reports) {
      const success = await generateAndUploadHTML(report);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('📊 Summary');
    console.log('='.repeat(80));
    console.log(`✅ Successfully generated: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📝 Total processed: ${reports.length}`);
    console.log('');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
