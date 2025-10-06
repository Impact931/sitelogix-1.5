/**
 * Batch Process Local Transcript Files
 * Processes all .txt files in the transcripts folder
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import the main CRM processing module (we'll modify process-report-to-crm.js to be importable)
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const TRANSCRIPTS_DIR = path.join(__dirname, 'transcripts');
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = 'sitelogix-prod';

// Configuration for each transcript
const transcriptConfig = {
  'daily_report_sep18.txt': { project: 'proj_002', manager: '002', date: '2025-09-18' },
  'daily_report_sep19.txt': { project: 'proj_002', manager: '002', date: '2025-09-19' },
  'daily_report_sep24.txt': { project: 'proj_001', manager: '001', date: '2025-09-24' },
  'daily_report_sep26.txt': { project: 'proj_001', manager: '001', date: '2025-09-26' },
  'daily_report_sep30.txt': { project: 'proj_002', manager: '002', date: '2025-09-30' }
};

function convertNarrativeToTranscript(narrativeText) {
  // Convert narrative report to conversational format
  const paragraphs = narrativeText.split('\n\n').filter(p => p.trim());
  
  const messages = [
    {
      role: 'assistant',
      message: 'Good morning! I\'m Roxy, and I\'ll be helping you with your daily construction report today. Let\'s start with the personnel on site.'
    }
  ];

  // Create a simulated conversation from the narrative
  paragraphs.forEach((para, index) => {
    messages.push({
      role: 'user',
      message: para.trim()
    });
  });

  return {
    transcript: messages,
    conversationId: `local_batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    source: 'local_narrative_file'
  };
}

async function uploadTranscriptToS3(transcript, projectId, managerId, reportDate, fileName) {
  // Create S3 path matching the expected format
  const [year, month, day] = reportDate.split('-');
  const timestamp = Date.now();
  const reportId = `rpt_${reportDate.replace(/-/g, '')}_mgr_${managerId}_${timestamp}`;
  const s3Key = `SITELOGIX/projects/${projectId}/reports/${year}/${month}/${day}/${reportId}/transcript.json`;

  console.log(`   📤 Uploading to S3: ${s3Key}`);

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: JSON.stringify(transcript, null, 2),
    ContentType: 'application/json'
  });

  await s3Client.send(command);
  console.log(`   ✅ Uploaded successfully`);

  return s3Key;
}

async function main() {
  console.log('='.repeat(80));
  console.log('🚀 Batch Processing Local Transcripts');
  console.log('='.repeat(80));
  console.log('');

  // Get all .txt files
  const files = fs.readdirSync(TRANSCRIPTS_DIR)
    .filter(f => f.endsWith('.txt') && f !== 'README.md');

  console.log(`Found ${files.length} transcript files:`);
  files.forEach((f, i) => {
    const config = transcriptConfig[f] || { project: 'proj_001', manager: '001' };
    console.log(`  ${i + 1}. ${f} → Project: ${config.project}, Manager: ${config.manager}`);
  });
  console.log('');

  const results = [];

  for (const fileName of files) {
    try {
      console.log('─'.repeat(80));
      console.log(`📄 Processing: ${fileName}`);
      console.log('─'.repeat(80));

      const config = transcriptConfig[fileName] || { 
        project: 'proj_001', 
        manager: '001',
        date: new Date().toISOString().split('T')[0]
      };

      // Read file
      const filePath = path.join(TRANSCRIPTS_DIR, fileName);
      const content = fs.readFileSync(filePath, 'utf-8');
      console.log(`   📖 Read ${content.length} characters`);

      // Convert to transcript format
      const transcript = convertNarrativeToTranscript(content);
      console.log(`   ✅ Converted to ${transcript.transcript.length} messages`);

      // Upload to S3
      const s3Key = await uploadTranscriptToS3(
        transcript,
        config.project,
        config.manager,
        config.date,
        fileName
      );

      // Process with existing workflow
      console.log(`   🔄 Processing with CRM workflow...`);
      const scriptPath = path.join(__dirname, 'process-report-to-crm.js');
      
      try {
        execSync(`node "${scriptPath}" "${s3Key}"`, { 
          stdio: 'inherit',
          cwd: __dirname
        });
        
        results.push({ file: fileName, status: 'success', s3Key });
        console.log(`   ✅ ${fileName} processed successfully!`);
      } catch (error) {
        results.push({ file: fileName, status: 'failed', error: error.message, s3Key });
        console.log(`   ❌ ${fileName} failed: ${error.message}`);
      }

      console.log('');

    } catch (error) {
      console.error(`   ❌ Error processing ${fileName}:`, error.message);
      results.push({ file: fileName, status: 'error', error: error.message });
      console.log('');
    }
  }

  // Summary
  console.log('='.repeat(80));
  console.log('📊 Batch Processing Summary');
  console.log('='.repeat(80));
  console.log('');
  
  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status !== 'success').length;

  console.log(`Total: ${results.length} files`);
  console.log(`✅ Success: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');

  if (successful > 0) {
    console.log('Successfully processed:');
    results.filter(r => r.status === 'success').forEach(r => {
      console.log(`  ✓ ${r.file}`);
    });
  }

  if (failed > 0) {
    console.log('');
    console.log('Failed to process:');
    results.filter(r => r.status !== 'success').forEach(r => {
      console.log(`  ✗ ${r.file}: ${r.error}`);
    });
  }

  console.log('');
  console.log('📊 View Database: https://docs.google.com/spreadsheets/d/1lb8nmFjvKdWmoqSLaowEKWEzGzNUPw7CuTTZ7k1FIg4');
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
