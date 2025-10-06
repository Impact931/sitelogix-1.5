/**
 * Process Existing Reports
 *
 * Finds all reports in S3 and processes them with AI
 */

require('dotenv').config();
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BUCKET = 'sitelogix-prod';
const REPORTS_TABLE = 'sitelogix-reports';

async function findAllReports() {
  console.log('='.repeat(80));
  console.log('🔍 Finding All Reports in S3 and DynamoDB');
  console.log('='.repeat(80));
  console.log('');

  // Find transcripts in S3
  console.log('📥 Scanning S3 for transcripts...');
  const listCommand = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: 'SITELOGIX/projects/'
  });

  const s3Response = await s3Client.send(listCommand);
  const transcripts = s3Response.Contents
    ?.filter(obj => obj.Key.endsWith('transcript.json'))
    .map(obj => {
      // Extract report ID from path
      const parts = obj.Key.split('/');
      const reportId = parts[parts.length - 2];
      return {
        reportId,
        s3Key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified
      };
    }) || [];

  console.log(`✅ Found ${transcripts.length} transcripts in S3`);
  transcripts.forEach(t => {
    console.log(`   - ${t.reportId} (${(t.size / 1024).toFixed(1)} KB)`);
  });
  console.log('');

  // Find reports in DynamoDB
  console.log('📊 Scanning DynamoDB for reports...');
  const scanCommand = new ScanCommand({
    TableName: REPORTS_TABLE,
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: {
      ':sk': 'METADATA'
    }
  });

  const dynamoResponse = await docClient.send(scanCommand);
  const reports = dynamoResponse.Items || [];

  console.log(`✅ Found ${reports.length} reports in DynamoDB`);
  reports.forEach(r => {
    console.log(`   - ${r.reportId} (Status: ${r.status || 'unknown'})`);
  });
  console.log('');

  // Match transcripts with reports
  console.log('🔗 Matching transcripts with reports...');
  const matched = [];
  const unmatched = [];

  for (const transcript of transcripts) {
    const report = reports.find(r => r.reportId === transcript.reportId);
    if (report) {
      matched.push({
        ...transcript,
        report
      });
    } else {
      unmatched.push(transcript);
    }
  }

  console.log(`✅ Matched: ${matched.length}`);
  console.log(`⚠️  Unmatched: ${unmatched.length}`);
  console.log('');

  return { matched, unmatched, allReports: reports };
}

async function getTranscriptPreview(s3Key) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: s3Key
    });
    const response = await s3Client.send(command);
    const body = await response.Body.transformToString();
    const data = JSON.parse(body);

    const messages = data.transcript || [];
    const preview = messages.slice(0, 3).map(m =>
      `${m.role === 'user' ? 'Manager' : 'Roxy'}: ${m.message.substring(0, 80)}...`
    ).join('\n');

    return {
      messageCount: messages.length,
      preview
    };
  } catch (error) {
    return {
      messageCount: 0,
      preview: 'Error loading transcript'
    };
  }
}

async function main() {
  try {
    const { matched, unmatched } = await findAllReports();

    if (matched.length === 0) {
      console.log('❌ No reports found to process');
      return;
    }

    console.log('='.repeat(80));
    console.log('📋 Report Details');
    console.log('='.repeat(80));
    console.log('');

    for (const item of matched) {
      const { report } = item;
      console.log(`Report: ${report.reportId}`);
      console.log(`  Project: ${report.projectName || 'Unknown'}`);
      console.log(`  Manager: ${report.managerName || 'Unknown'}`);
      console.log(`  Date: ${report.reportDate || 'Unknown'}`);
      console.log(`  Status: ${report.status || 'pending_analysis'}`);
      console.log(`  Conversation ID: ${report.conversationId || 'Unknown'}`);

      // Get transcript preview
      const transcriptInfo = await getTranscriptPreview(item.s3Key);
      console.log(`  Messages: ${transcriptInfo.messageCount}`);
      console.log(`  Preview:`);
      console.log(`    ${transcriptInfo.preview.split('\n').join('\n    ')}`);
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('🚀 Ready to Process');
    console.log('='.repeat(80));
    console.log('');
    console.log('Reports ready for AI processing:');
    matched.forEach((item, i) => {
      console.log(`${i + 1}. ${item.reportId} - ${item.report.projectName || 'Unknown Project'}`);
    });
    console.log('');
    console.log('To process these reports, run:');
    console.log('  node process-single-report.js <reportId>');
    console.log('');
    console.log('Or to process all:');
    console.log('  node process-all-reports.js');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
