/**
 * Force Re-process November 2025 Reports
 * Updates summary fields from extracted_data
 */

require('dotenv').config();

const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { processTranscriptAnalytics } = require('./backend/src/functions/transcriptAnalysisWrapper');

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });

async function reprocessNovemberReports() {
  try {
    console.log('🔍 Scanning for November 2025 reports...');

    const scanCommand = new ScanCommand({
      TableName: 'sitelogix-reports',
      FilterExpression: 'begins_with(report_date, :date)',
      ExpressionAttributeValues: {
        ':date': { S: '2025-11' }
      }
    });

    const response = await dynamoClient.send(scanCommand);
    const reports = response.Items?.map(item => unmarshall(item)) || [];

    console.log(`📋 Found ${reports.length} reports from November 2025`);

    if (reports.length === 0) {
      console.log('✅ No reports to process');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const report of reports) {
      try {
        console.log(`\n📊 Processing report: ${report.report_id}`);
        console.log(`   Project: ${report.project_name}`);
        console.log(`   Manager: ${report.manager_name}`);
        console.log(`   Date: ${report.report_date}`);

        // Extract transcript from transcript_data
        let transcript = null;
        if (report.transcript_data?.transcript) {
          transcript = { transcript: report.transcript_data.transcript };
        } else if (report.transcript_data?.analysis?.transcript) {
          transcript = { transcript: report.transcript_data.analysis.transcript };
        } else {
          console.log(`   ⚠️  No transcript found, skipping`);
          continue;
        }

        // Build context
        const context = {
          reportId: report.report_id,
          projectId: report.PK.replace('PROJECT#', ''),
          projectName: report.project_name || 'Unknown Project',
          projectLocation: report.project_location || 'Unknown Location',
          managerName: report.manager_name || 'Unknown Manager',
          reportDate: report.report_date
        };

        // Process analytics
        const result = await processTranscriptAnalytics(transcript, context);

        if (result.success) {
          const totalPersonnel = result.extractedData.timeSummary?.totalPersonnelCount || 0;
          const totalRegularHours = result.extractedData.timeSummary?.totalRegularHours || 0;
          const totalOvertimeHours = result.extractedData.timeSummary?.totalOvertimeHours || 0;

          console.log(`   ✅ Analytics extraction successful`);
          console.log(`      - Personnel: ${result.extractedData.personnel?.length || 0} (${totalPersonnel} total)`);
          console.log(`      - Regular Hours: ${totalRegularHours}, OT Hours: ${totalOvertimeHours}`);
          successCount++;
        } else {
          console.log(`   ❌ Analytics extraction failed: ${result.error}`);
          failCount++;
        }

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`   ❌ Error processing report ${report.report_id}:`, error.message);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Re-processing Complete');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📋 Total: ${reports.length}`);

  } catch (error) {
    console.error('❌ Fatal error during re-processing:', error);
    process.exit(1);
  }
}

// Run the script
reprocessNovemberReports()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
