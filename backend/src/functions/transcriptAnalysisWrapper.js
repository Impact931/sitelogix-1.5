/**
 * Wrapper for TranscriptAnalysisService
 * Provides a simple interface for api-handler.js to call the full transcript analysis
 */

const { initializeTranscriptAnalysisService } = require('../../dist/services/transcriptAnalysisService');
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

const dynamoClient = new DynamoDBClient({});

/**
 * Process transcript and extract all analytics data
 * @param {Object} transcript - The transcript object from ElevenLabs
 * @param {Object} context - Context information
 * @param {string} context.reportId - Report ID
 * @param {string} context.projectId - Project ID
 * @param {string} context.projectName - Project name
 * @param {string} context.projectLocation - Project location
 * @param {string} context.managerName - Manager name
 * @param {string} context.reportDate - Report date
 */
async function processTranscriptAnalytics(transcript, context) {
  try {
    console.log('📊 Starting full transcript analytics extraction...');

    const { reportId, projectId, projectName, projectLocation, managerName, reportDate } = context;

    // Initialize the transcript analysis service
    const analysisService = initializeTranscriptAnalysisService({
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      preferredModel: 'claude'
    });

    // Analyze the transcript
    const extractedData = await analysisService.analyzeTranscript(transcript, {
      projectName,
      projectLocation,
      managerName,
      reportDate
    });

    console.log('✅ Transcript analysis complete:');
    console.log(`   - Personnel: ${extractedData.personnel.length}`);
    console.log(`   - Work Logs: ${extractedData.workLogs.length}`);
    console.log(`   - Constraints: ${extractedData.constraints.length}`);
    console.log(`   - Vendors: ${extractedData.vendors.length}`);

    // Update the report in DynamoDB with extracted data
    const updateCommand = new UpdateItemCommand({
      TableName: 'sitelogix-reports',
      Key: marshall({
        PK: `PROJECT#${projectId}`,
        SK: `REPORT#${reportDate}#${reportId}`
      }),
      UpdateExpression: `
        SET extracted_data = :extractedData,
            analytics_processed_at = :processedAt,
            analytics_status = :status
      `,
      ExpressionAttributeValues: marshall({
        ':extractedData': extractedData,
        ':processedAt': new Date().toISOString(),
        ':status': 'completed'
      })
    });

    await dynamoClient.send(updateCommand);
    console.log('✅ Extracted analytics data saved to DynamoDB');

    return {
      success: true,
      extractedData
    };
  } catch (error) {
    console.error('❌ Transcript analytics extraction failed:', error);

    // Try to update report status to indicate analytics failed (non-fatal)
    try {
      const updateCommand = new UpdateItemCommand({
        TableName: 'sitelogix-reports',
        Key: marshall({
          PK: `PROJECT#${context.projectId}`,
          SK: `REPORT#${context.reportDate}#${context.reportId}`
        }),
        UpdateExpression: `
          SET analytics_status = :status,
              analytics_error = :error
        `,
        ExpressionAttributeValues: marshall({
          ':status': 'failed',
          ':error': error.message
        })
      });

      await dynamoClient.send(updateCommand);
    } catch (updateError) {
      console.error('❌ Failed to update report status:', updateError);
    }

    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  processTranscriptAnalytics
};
