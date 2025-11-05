#!/usr/bin/env node

/**
 * Process Training Data - Batch Extraction Pipeline
 *
 * Processes all 102 training transcripts from S3:
 * 1. Read transcripts from S3
 * 2. Extract structured data using Roxy AI
 * 3. Normalize entities (personnel, projects)
 * 4. Store in DynamoDB
 *
 * Usage:
 *   node process-training-data.js [--limit=10] [--dry-run]
 */

const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, PutItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
const { extractFromTranscript } = require('./backend/src/services/extractionService');
const { normalizeExtractedData, getMasterPersonnel, getMasterProjects } = require('./backend/src/services/entityNormalizationService');
const fs = require('fs').promises;
const path = require('path');

// Initialize AWS clients
const s3Client = new S3Client({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });

// Configuration
const CONFIG = {
  s3Bucket: 'sitelogix-prod',
  s3Prefix: 'projects/proj_001/transcripts/raw/2025/11/',
  reportsTable: 'sitelogix-reports',
  personnelTable: 'sitelogix-personnel',
  vendorsTable: 'sitelogix-vendors',
  constraintsTable: 'sitelogix-constraints',
  delayMs: 2000, // Delay between API calls to avoid rate limiting
  outputDir: './extraction-results'
};

// Parse command line arguments
const args = process.argv.slice(2);
const limit = args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || null;
const dryRun = args.includes('--dry-run');

console.log('================================================');
console.log('🚀 Training Data Extraction Pipeline');
console.log('================================================');
console.log(`S3 Bucket: ${CONFIG.s3Bucket}`);
console.log(`S3 Prefix: ${CONFIG.s3Prefix}`);
console.log(`Limit: ${limit || 'none (process all)'}`);
console.log(`Dry Run: ${dryRun ? 'YES' : 'NO'}`);
console.log('================================================\n');

/**
 * List all transcript files in S3
 */
async function listTranscripts() {
  console.log('📋 Listing transcripts from S3...');

  const command = new ListObjectsV2Command({
    Bucket: CONFIG.s3Bucket,
    Prefix: CONFIG.s3Prefix
  });

  const response = await s3Client.send(command);

  if (!response.Contents || response.Contents.length === 0) {
    throw new Error('No transcripts found in S3');
  }

  const transcripts = response.Contents
    .filter(item => item.Key.endsWith('.txt'))
    .map(item => ({
      key: item.Key,
      filename: path.basename(item.Key),
      size: item.Size,
      lastModified: item.LastModified
    }));

  console.log(`   ✅ Found ${transcripts.length} transcript files\n`);

  return transcripts;
}

/**
 * Read transcript content from S3
 */
async function readTranscript(key) {
  const command = new GetObjectCommand({
    Bucket: CONFIG.s3Bucket,
    Key: key
  });

  const response = await s3Client.send(command);
  const content = await response.Body.transformToString();

  return content;
}

/**
 * Store extracted report data in DynamoDB
 */
async function storeReport(normalizedData, s3Key) {
  const reportId = path.basename(s3Key, '.txt');
  const timestamp = new Date().toISOString();

  // Build report item
  const reportItem = {
    PK: `REPORT#${reportId}`,
    SK: 'METADATA',
    report_id: reportId,
    report_date: normalizedData.report_date || timestamp.split('T')[0],
    project_id: normalizedData.project_id || 'proj_001',
    project_name: normalizedData.project_canonical_name || normalizedData.project_name || 'Unknown',
    reporter_personnel_id: normalizedData.reporter_personnel_id,
    reporter_name: normalizedData.reporter_canonical_name || normalizedData.reporter_name,
    total_hours: normalizedData.total_hours || 0,
    weather_notes: normalizedData.weather_notes || '',
    transcript_s3_key: s3Key,
    extraction_confidence: normalizedData.extraction_confidence || 0,
    extraction_timestamp: normalizedData.extraction_timestamp,
    normalization_timestamp: normalizedData.normalization_timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    status: 'processed',
    // Store full extracted data as JSON
    extracted_data: JSON.stringify({
      work_completed: normalizedData.work_completed || [],
      work_in_progress: normalizedData.work_in_progress || [],
      issues: normalizedData.issues || [],
      vendors: normalizedData.vendors || [],
      additional_personnel: normalizedData.additional_personnel || [],
      ambiguities: normalizedData.ambiguities || []
    })
  };

  const command = new PutItemCommand({
    TableName: CONFIG.reportsTable,
    Item: marshall(reportItem, { removeUndefinedValues: true })
  });

  await dynamoClient.send(command);

  return reportItem;
}

/**
 * Check if personnel already exists in database
 */
async function personnelExists(personnelId) {
  const command = new QueryCommand({
    TableName: CONFIG.personnelTable,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': { S: `PERSONNEL#${personnelId}` }
    },
    Limit: 1
  });

  const result = await dynamoClient.send(command);
  return result.Items && result.Items.length > 0;
}

/**
 * Store personnel data in DynamoDB
 */
async function storePersonnel(personnelId, personnelData) {
  // Check if already exists
  const exists = await personnelExists(personnelId);
  if (exists) {
    console.log(`   ⏭️  Personnel ${personnelId} already exists, skipping`);
    return;
  }

  const timestamp = new Date().toISOString();

  const personnelItem = {
    PK: `PERSONNEL#${personnelId}`,
    SK: 'METADATA',
    personnel_id: personnelId,
    full_name: personnelData.canonical_name,
    role: personnelData.role || '',
    status: 'active',
    created_at: timestamp,
    updated_at: timestamp
  };

  const command = new PutItemCommand({
    TableName: CONFIG.personnelTable,
    Item: marshall(personnelItem, { removeUndefinedValues: true })
  });

  await dynamoClient.send(command);

  console.log(`   ✅ Created personnel: ${personnelId} (${personnelData.canonical_name})`);
}

/**
 * Seed master personnel list to database
 */
async function seedMasterPersonnel() {
  console.log('\n👥 Seeding master personnel list...');

  const masterPersonnel = getMasterPersonnel();
  let created = 0;
  let skipped = 0;

  for (const [personnelId, data] of Object.entries(masterPersonnel)) {
    const exists = await personnelExists(personnelId);

    if (exists) {
      skipped++;
    } else {
      await storePersonnel(personnelId, data);
      created++;
    }
  }

  console.log(`   ✅ Personnel seeded: ${created} created, ${skipped} skipped\n`);
}

/**
 * Process a single transcript
 */
async function processTranscript(transcript, index, total) {
  console.log(`\n[${index + 1}/${total}] 📄 ${transcript.filename}`);
  console.log(`   📍 S3 Key: ${transcript.key}`);

  try {
    // Step 1: Read transcript from S3
    console.log('   📖 Reading transcript from S3...');
    const content = await readTranscript(transcript.key);
    console.log(`   ✅ Read ${content.length} characters`);

    // Step 2: Extract structured data using Roxy
    console.log('   🤖 Extracting data with Roxy...');
    const extractionResult = await extractFromTranscript(content, transcript.filename);

    if (!extractionResult.success) {
      console.error(`   ❌ Extraction failed: ${extractionResult.error}`);
      return {
        success: false,
        filename: transcript.filename,
        error: extractionResult.error
      };
    }

    const extractedData = extractionResult.data;
    console.log(`   ✅ Extracted (confidence: ${extractedData.extraction_confidence || 'N/A'})`);

    // Step 3: Normalize entities
    console.log('   🔄 Normalizing entities...');
    const normalizedData = normalizeExtractedData(extractedData);
    console.log(`   ✅ Normalized:`);
    console.log(`      • Reporter: ${normalizedData.reporter_canonical_name} (${normalizedData.reporter_personnel_id || 'NEW'})`);
    console.log(`      • Project: ${normalizedData.project_canonical_name} (${normalizedData.project_id || 'NEW'})`);
    console.log(`      • Additional Personnel: ${normalizedData.additional_personnel?.length || 0}`);

    // Step 4: Store in DynamoDB (unless dry-run)
    if (!dryRun) {
      console.log('   💾 Storing in DynamoDB...');
      const storedReport = await storeReport(normalizedData, transcript.key);
      console.log(`   ✅ Stored report: ${storedReport.report_id}`);
    } else {
      console.log('   ⏭️  Skipping storage (dry-run mode)');
    }

    return {
      success: true,
      filename: transcript.filename,
      data: normalizedData
    };

  } catch (error) {
    console.error(`   ❌ Processing error: ${error.message}`);
    return {
      success: false,
      filename: transcript.filename,
      error: error.message
    };
  }
}

/**
 * Main processing function
 */
async function main() {
  try {
    // Create output directory
    await fs.mkdir(CONFIG.outputDir, { recursive: true });

    // Seed master personnel first
    if (!dryRun) {
      await seedMasterPersonnel();
    }

    // List transcripts
    const transcripts = await listTranscripts();

    // Apply limit if specified
    const transcriptsToProcess = limit
      ? transcripts.slice(0, parseInt(limit))
      : transcripts;

    console.log(`🚀 Processing ${transcriptsToProcess.length} transcripts...\n`);

    // Track results
    const results = {
      total: transcriptsToProcess.length,
      succeeded: 0,
      failed: 0,
      details: []
    };

    // Process each transcript
    for (let i = 0; i < transcriptsToProcess.length; i++) {
      const transcript = transcriptsToProcess[i];

      const result = await processTranscript(transcript, i, transcriptsToProcess.length);

      if (result.success) {
        results.succeeded++;
      } else {
        results.failed++;
      }

      results.details.push(result);

      // Delay between transcripts to avoid rate limiting
      if (i < transcriptsToProcess.length - 1) {
        console.log(`   ⏳ Waiting ${CONFIG.delayMs}ms before next transcript...`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.delayMs));
      }
    }

    // Save results to file
    const resultsFile = path.join(CONFIG.outputDir, `extraction-results-${Date.now()}.json`);
    await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));

    // Print summary
    console.log('\n================================================');
    console.log('📊 Processing Summary');
    console.log('================================================');
    console.log(`Total Transcripts: ${results.total}`);
    console.log(`✅ Succeeded:       ${results.succeeded}`);
    console.log(`❌ Failed:          ${results.failed}`);
    console.log(`Success Rate:      ${((results.succeeded / results.total) * 100).toFixed(1)}%`);
    console.log(`\n📄 Results saved to: ${resultsFile}`);
    console.log('================================================\n');

    // Show failed extractions
    if (results.failed > 0) {
      console.log('❌ Failed Extractions:');
      results.details
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   • ${r.filename}: ${r.error}`);
        });
      console.log('');
    }

    // Show low-confidence extractions
    const lowConfidence = results.details
      .filter(r => r.success && r.data.extraction_confidence < 0.7)
      .sort((a, b) => a.data.extraction_confidence - b.data.extraction_confidence);

    if (lowConfidence.length > 0) {
      console.log('⚠️  Low Confidence Extractions (<0.7):');
      lowConfidence.forEach(r => {
        console.log(`   • ${r.filename}: ${r.data.extraction_confidence.toFixed(2)}`);
      });
      console.log('');
    }

    console.log('✅ Pipeline Complete!');

  } catch (error) {
    console.error('\n❌ Pipeline failed:', error);
    process.exit(1);
  }
}

// Run main function
main();
