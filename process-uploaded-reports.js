/**
 * Process Uploaded Reports to Generate HTML
 *
 * Processes ElevenLabs transcripts that were uploaded but never analyzed by Claude
 */

require('dotenv').config();
const { spawnSync } = require('child_process');
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function getUploadedReports() {
  console.log('🔍 Scanning for uploaded reports...\n');

  const command = new ScanCommand({
    TableName: 'sitelogix-reports',
    FilterExpression: '#status = :status',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': { S: 'uploaded' } }
  });

  const result = await dynamoClient.send(command);
  return result.Items.map(item => unmarshall(item));
}

async function processReport(report) {
  const { report_id, project_id, manager_id, report_date, transcript_s3_path } = report;

  console.log('━'.repeat(80));
  console.log(`📄 Processing: ${report_id}`);
  console.log('━'.repeat(80));
  console.log(`  Project: ${project_id}`);
  console.log(`  Manager: ${manager_id}`);
  console.log(`  Date: ${report_date}`);
  console.log(`  Transcript: ${transcript_s3_path}`);
  console.log('');

  // Extract S3 bucket and key from path
  let bucket, key;
  if (transcript_s3_path.startsWith('s3://')) {
    const parts = transcript_s3_path.replace('s3://', '').split('/');
    bucket = parts[0];
    key = parts.slice(1).join('/');
  } else {
    console.log('  ⚠️  Invalid S3 path format, skipping\n');
    return false;
  }

  // Download transcript to temp file
  const tempFile = `/tmp/${report_id}.json`;
  console.log('  📥 Downloading transcript...');

  const downloadResult = spawnSync('aws', [
    's3', 'cp',
    `s3://${bucket}/${key}`,
    tempFile
  ], { encoding: 'utf-8' });

  if (downloadResult.error || downloadResult.status !== 0) {
    console.log('  ❌ Failed to download transcript');
    console.log(downloadResult.stderr);
    return false;
  }

  console.log('  ✅ Downloaded successfully');
  console.log('  🤖 Processing with Claude AI...\n');

  // Process through the CRM workflow
  const processResult = spawnSync('node', [
    'process-report-to-crm.js',
    report_id,
    project_id,
    manager_id,
    report_date,
    tempFile
  ], {
    encoding: 'utf-8',
    stdio: 'inherit',
    cwd: process.cwd()
  });

  if (processResult.error || processResult.status !== 0) {
    console.log('\n  ❌ Processing failed');
    return false;
  }

  console.log('\n  ✅ Successfully processed!\n');
  return true;
}

async function main() {
  console.log('='.repeat(80));
  console.log('🏗️  Process Uploaded Reports');
  console.log('='.repeat(80));
  console.log('');

  try {
    const reports = await getUploadedReports();

    if (reports.length === 0) {
      console.log('✅ No reports need processing!\n');
      return;
    }

    console.log(`Found ${reports.length} reports to process\n`);

    let successCount = 0;
    let failCount = 0;

    for (const report of reports) {
      const success = await processReport(report);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log('='.repeat(80));
    console.log('📊 Summary');
    console.log('='.repeat(80));
    console.log(`✅ Successfully processed: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📝 Total: ${reports.length}`);
    console.log('');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
