/**
 * Lambda Function: Process Report
 *
 * Triggered after a report is saved to process with AI and generate outputs
 */

import { Handler } from 'aws-lambda';
import { initializeTranscriptAnalysisService } from '../services/transcriptAnalysisService';
import { initializeGoogleSheetsService } from '../services/googleSheetsService';
import { getReportProcessingService } from '../services/reportProcessingService';

interface ProcessReportEvent {
  reportId: string;
  googleSheetsUrl?: string;
}

export const handler: Handler = async (event: ProcessReportEvent) => {
  console.log('Process Report Lambda triggered:', JSON.stringify(event, null, 2));

  try {
    const { reportId, googleSheetsUrl } = event;

    if (!reportId) {
      throw new Error('Missing reportId in event');
    }

    // Initialize services
    console.log('🔧 Initializing services...');

    // Initialize AI analysis service
    initializeTranscriptAnalysisService({
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      preferredModel: 'claude' // Use Claude 3.5 Sonnet by default
    });

    // Initialize Google Sheets service (if credentials available)
    if (googleSheetsUrl && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
      initializeGoogleSheetsService({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN
      });
    }

    // Process the report
    const processingService = getReportProcessingService();
    await processingService.processReport(reportId, googleSheetsUrl);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Report processed successfully',
        reportId
      })
    };
  } catch (error) {
    console.error('Error processing report:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Report processing failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
