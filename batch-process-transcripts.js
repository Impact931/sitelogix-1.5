#!/usr/bin/env node

/**
 * Batch Transcript Processor
 * Processes multiple transcript files through the SiteLogix API
 * for Roxy agent training and database population
 */

const fs = require('fs').promises;
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: 'us-east-1' });

// Configuration
const CONFIG = {
  transcriptsDir: process.argv[2] || './transcripts',
  apiEndpoint: 'https://6f10uv7ne0.execute-api.us-east-1.amazonaws.com/api',
  s3Bucket: 'sitelogix-prod', // UPDATED: Single bucket for all SiteLogix data
  delayBetweenFiles: 2000, // 2 seconds between files to avoid rate limiting
  projectId: 'proj_001', // Default project ID
  managerId: 'mgr_001' // Default manager ID
};

// Statistics
const stats = {
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  errors: []
};

/**
 * Upload transcript to S3 using clean folder structure
 * Path: projects/{project_id}/transcripts/raw/{YYYY}/{MM}/{report_id}.txt
 */
async function uploadToS3(filename, content, metadata) {
  const timestamp = new Date().toISOString();
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const reportId = `rpt_${Date.now()}_${metadata.managerId}_${Math.random().toString(36).substring(7)}`;

  // Clean structure: projects/{project_id}/transcripts/raw/{YYYY}/{MM}/{report_id}.txt
  const s3Key = `projects/${metadata.projectId}/transcripts/raw/${year}/${month}/${reportId}.txt`;

  const command = new PutObjectCommand({
    Bucket: CONFIG.s3Bucket,
    Key: s3Key,
    Body: content,
    ContentType: 'text/plain',
    Metadata: {
      'original-filename': filename,
      'project-id': metadata.projectId,
      'manager-id': metadata.managerId,
      'upload-timestamp': timestamp
    }
  });

  await s3Client.send(command);

  return {
    s3Bucket: CONFIG.s3Bucket,
    s3Key: s3Key,
    reportId: reportId
  };
}

/**
 * Process a single transcript file
 */
async function processTranscript(filePath) {
  const filename = path.basename(filePath);
  console.log(`\n📄 Processing: ${filename}`);

  try {
    // Read transcript content
    const content = await fs.readFile(filePath, 'utf-8');

    if (!content || content.trim().length === 0) {
      throw new Error('Empty transcript file');
    }

    console.log(`   📝 Content length: ${content.length} characters`);

    // Extract metadata from filename or use defaults
    const metadata = {
      projectId: CONFIG.projectId,
      managerId: CONFIG.managerId,
      filename: filename
    };

    // Upload to S3
    console.log(`   ⬆️  Uploading to S3...`);
    const s3Info = await uploadToS3(filename, content, metadata);
    console.log(`   ✅ Uploaded to: ${s3Info.s3Key}`);

    // For now, we'll upload to S3 and let the backend process it
    // In future, you could trigger Lambda processing here or use the API

    stats.succeeded++;
    return {
      success: true,
      filename: filename,
      s3Info: s3Info
    };

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.failed++;
    stats.errors.push({
      filename: filename,
      error: error.message
    });

    return {
      success: false,
      filename: filename,
      error: error.message
    };
  }
}

/**
 * Find all transcript files in directory
 */
async function findTranscriptFiles(directory) {
  const files = await fs.readdir(directory);

  return files
    .filter(file => file.endsWith('.txt') && !file.includes('README'))
    .map(file => path.join(directory, file));
}

/**
 * Main processing function
 */
async function main() {
  console.log('================================================');
  console.log('📚 SiteLogix Batch Transcript Processor');
  console.log('================================================');
  console.log(`\n📁 Transcript Directory: ${CONFIG.transcriptsDir}`);
  console.log(`🎯 API Endpoint: ${CONFIG.apiEndpoint}`);
  console.log(`📦 S3 Bucket: ${CONFIG.s3Bucket}`);
  console.log(`🔧 Project ID: ${CONFIG.projectId}`);
  console.log(`👤 Manager ID: ${CONFIG.managerId}`);
  console.log('');

  // Find all transcript files
  const transcriptFiles = await findTranscriptFiles(CONFIG.transcriptsDir);
  stats.total = transcriptFiles.length;

  if (stats.total === 0) {
    console.log('❌ No transcript files found!');
    console.log(`\nMake sure .txt files exist in: ${CONFIG.transcriptsDir}`);
    return;
  }

  console.log(`📊 Found ${stats.total} transcript file(s)\n`);
  console.log('🚀 Starting processing...\n');

  // Process each file
  for (let i = 0; i < transcriptFiles.length; i++) {
    const filePath = transcriptFiles[i];

    console.log(`[${i + 1}/${stats.total}]`);
    await processTranscript(filePath);
    stats.processed++;

    // Delay between files to avoid rate limiting
    if (i < transcriptFiles.length - 1) {
      console.log(`   ⏳ Waiting ${CONFIG.delayBetweenFiles / 1000}s before next file...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenFiles));
    }
  }

  // Print summary
  console.log('\n================================================');
  console.log('📊 Processing Summary');
  console.log('================================================');
  console.log(`Total Files:     ${stats.total}`);
  console.log(`Processed:       ${stats.processed}`);
  console.log(`✅ Succeeded:     ${stats.succeeded}`);
  console.log(`❌ Failed:        ${stats.failed}`);
  console.log(`Success Rate:    ${((stats.succeeded / stats.total) * 100).toFixed(1)}%`);

  if (stats.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    stats.errors.forEach(err => {
      console.log(`   - ${err.filename}: ${err.error}`);
    });
  }

  console.log('\n================================================');
  console.log('✅ Batch Processing Complete!');
  console.log('================================================\n');

  console.log('📝 Next Steps:');
  console.log('1. Check S3 bucket for uploaded transcripts');
  console.log('2. Process transcripts through Roxy agent for data extraction');
  console.log('3. Verify extracted data in DynamoDB tables');
  console.log('4. Review and correct any parsing errors\n');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal Error:', error);
  process.exit(1);
});
