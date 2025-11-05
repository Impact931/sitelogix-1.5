#!/usr/bin/env node

/**
 * Batch Transcript Extraction
 * Processes all S3 transcripts through Roxy AI extraction
 * Stores structured data in DynamoDB
 */

require('dotenv').config();

const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const Anthropic = require('@anthropic-ai/sdk');
const { normalizeExtractedData, getMasterPersonnel } = require('./backend/src/functions/entityNormalizationService');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BUCKET = 'sitelogix-prod';
const PREFIX = 'projects/proj_001/transcripts/raw/2025/11/';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║      SiteLogix Roxy AI - Batch Extraction               ║');
  console.log('║      Processing All Transcripts                         ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Step 1: List all transcripts from S3
  console.log('📊 Step 1: Listing all transcripts from S3...');
  const transcripts = await listAllTranscripts();
  console.log(`✅ Found ${transcripts.length} transcripts to process`);
  console.log('');

  if (transcripts.length === 0) {
    console.log('⚠️  No transcripts found in S3.');
    return;
  }

  // Step 2: Seed master personnel
  console.log('👥 Step 2: Seeding master personnel...');
  await seedMasterPersonnel();
  console.log('✅ Master personnel seeded');
  console.log('');

  // Step 3: Process each transcript
  console.log('🤖 Step 3: Extracting data with Roxy AI...');
  console.log('');

  const results = {
    total: transcripts.length,
    succeeded: 0,
    failed: 0,
    lowConfidence: [],
    errors: []
  };

  const startTime = Date.now();

  for (let i = 0; i < transcripts.length; i++) {
    const transcript = transcripts[i];
    const filename = transcript.Key.split('/').pop();

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 Transcript ${i + 1}/${transcripts.length}: ${filename}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
      // Read transcript from S3
      console.log('📥 Reading from S3...');
      const content = await readTranscript(transcript.Key);
      console.log(`   ✓ Loaded ${content.length} characters`);

      // Extract with Roxy
      console.log('🤖 Extracting data with Roxy AI...');
      const extraction = await extractFromTranscript(content, filename);

      if (!extraction.success) {
        throw new Error(extraction.error);
      }

      console.log(`   ✓ Extraction complete (confidence: ${extraction.data.extraction_confidence})`);

      // Normalize entities
      console.log('🔄 Normalizing entities...');
      const normalized = normalizeExtractedData(extraction.data);
      console.log(`   ✓ Normalized: ${normalized.additional_personnel?.length || 0} personnel, ${normalized.vendors?.length || 0} vendors`);

      // Store in DynamoDB
      console.log('💾 Storing in DynamoDB...');
      await storeExtractedReport(normalized, transcript.Key, filename);
      console.log('   ✓ Stored successfully');

      // Track low confidence
      if (normalized.extraction_confidence < 0.7) {
        results.lowConfidence.push({
          filename,
          confidence: normalized.extraction_confidence
        });
      }

      results.succeeded++;

      // Rate limiting delay (1 second between requests)
      if (i < transcripts.length - 1) {
        console.log('⏳ Rate limiting delay (1s)...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`\n   ❌ Error: ${error.message}`);
      results.failed++;
      results.errors.push({
        filename,
        error: error.message
      });
    }
  }

  const processingTime = (Date.now() - startTime) / 1000;

  // Print summary
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║              EXTRACTION SUMMARY                          ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  console.log('📊 OVERALL RESULTS:');
  console.log(`   • Total Transcripts: ${results.total}`);
  console.log(`   • ✅ Succeeded: ${results.succeeded}`);
  console.log(`   • ❌ Failed: ${results.failed}`);
  console.log(`   • Success Rate: ${((results.succeeded / results.total) * 100).toFixed(1)}%`);
  console.log(`   • Processing Time: ${processingTime.toFixed(1)} seconds`);
  console.log(`   • Average Time/Transcript: ${(processingTime / results.total).toFixed(1)} seconds`);
  console.log('');

  if (results.lowConfidence.length > 0) {
    console.log('⚠️  LOW CONFIDENCE EXTRACTIONS (<0.7):');
    results.lowConfidence.forEach(item => {
      console.log(`   • ${item.filename}: ${item.confidence.toFixed(2)}`);
    });
    console.log('');
  }

  if (results.errors.length > 0) {
    console.log('❌ ERRORS:');
    results.errors.forEach(item => {
      console.log(`   • ${item.filename}: ${item.error}`);
    });
    console.log('');
  }

  console.log('✅ Batch extraction complete!');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('   1. Run analytics on extracted data: node batch-analyze-reports.js');
  console.log('   2. Review reports in the web app');
  console.log('   3. Check low confidence extractions for manual review');
  console.log('');
}

/**
 * List all transcripts from S3
 */
async function listAllTranscripts() {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: PREFIX
  });

  const result = await s3Client.send(command);

  if (!result.Contents) {
    return [];
  }

  return result.Contents.filter(item => item.Key.endsWith('.txt'));
}

/**
 * Read transcript from S3
 */
async function readTranscript(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key
  });

  const result = await s3Client.send(command);
  return await result.Body.transformToString();
}

/**
 * Extract structured data from transcript using Roxy AI
 */
async function extractFromTranscript(transcriptText, filename = '') {
  const ROXY_EXTRACTION_PROMPT = `You are Roxy, an AI agent specialized in extracting structured data from construction daily reports.

REQUIRED FIELDS:
1. report_date (YYYY-MM-DD format)
2. reporter_name (first + last if available)
3. project_name (full name, not abbreviation)
4. total_hours (decimal format)

OPTIONAL FIELDS:
5. additional_personnel[] - Array of {name, hours, role}
6. work_completed[] - Array of tasks
7. work_in_progress[] - Array of tasks
8. issues[] - Array of problems
9. vendors[] - Array of {company, delivery_type, time}
10. weather_notes

NORMALIZATION RULES (Projects):
- "CC" = "Cortex Commons"
- "MM" = "Mellow Mushroom" or "Monsanto" (if Scott is reporter)
- "Nash Twr 2" = "Nashville Yards Tower 2"
- "SLU Res" = "Saint Louis University Residence"
- "Sx Partners" = "Surgery Partners"
- "Meharry" = "Meharry Medical College"

NORMALIZATION RULES (Personnel):
- "Owen glass burner" = "Owen Glassburn"
- "Bryan" = "Brian"
- "Ken" = "Kenny"

EXTRACTION RULES:
1. Use context to expand abbreviations
2. Normalize similar names
3. If "I" or "myself" mentioned, attribute to reporter
4. Sum hours for same person
5. Flag ambiguous items with [UNCLEAR: ...]

OUTPUT FORMAT: Return ONLY valid JSON:
{
  "report_date": "YYYY-MM-DD",
  "reporter_name": "Name",
  "project_name": "Full Project Name",
  "total_hours": 8.0,
  "additional_personnel": [],
  "work_completed": [],
  "work_in_progress": [],
  "issues": [],
  "vendors": [],
  "weather_notes": "",
  "extraction_confidence": 0.85,
  "ambiguities": []
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `${ROXY_EXTRACTION_PROMPT}

FILENAME: ${filename}

TRANSCRIPT:
${transcriptText}

Extract structured data. Return ONLY valid JSON.`
        }
      ]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    const extractedData = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      data: {
        ...extractedData,
        extraction_timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Parse date from filename
 */
function parseDateFromFilename(filename) {
  const dateMatch = filename.match(/(\d{1,2})\.(\d{1,2})\.(\d{2})/);

  if (dateMatch) {
    const [_, month, day, year] = dateMatch;
    const fullYear = `20${year}`;
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    return `${fullYear}-${paddedMonth}-${paddedDay}`;
  }

  return null;
}

/**
 * Store extracted report in DynamoDB
 */
async function storeExtractedReport(normalizedData, s3Key, filename) {
  const reportId = s3Key.split('/').pop().replace('.txt', '');
  const timestamp = new Date().toISOString();

  const filenameDate = parseDateFromFilename(filename);
  const reportDate = filenameDate || normalizedData.report_date || timestamp.split('T')[0];

  const reportItem = {
    PK: `REPORT#${reportId}`,
    SK: 'METADATA',
    report_id: reportId,
    report_date: reportDate,
    project_id: normalizedData.project_id || 'proj_001',
    project_name: normalizedData.project_canonical_name || normalizedData.project_name || 'Unknown',
    reporter_personnel_id: normalizedData.reporter_personnel_id,
    reporter_name: normalizedData.reporter_canonical_name || normalizedData.reporter_name,
    total_hours: normalizedData.total_hours || 0,
    weather_notes: normalizedData.weather_notes || '',
    transcript_s3_key: s3Key,
    transcript_s3_path: `s3://${BUCKET}/${s3Key}`,
    extraction_confidence: normalizedData.extraction_confidence || 0,
    extraction_timestamp: normalizedData.extraction_timestamp,
    normalization_timestamp: normalizedData.normalization_timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    status: 'processed',
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
    TableName: 'sitelogix-reports',
    Item: marshall(reportItem, { removeUndefinedValues: true })
  });

  await dynamoClient.send(command);
  return reportItem;
}

/**
 * Seed master personnel
 */
async function seedMasterPersonnel() {
  const masterPersonnel = getMasterPersonnel();
  let created = 0;

  for (const [personnelId, data] of Object.entries(masterPersonnel)) {
    const existsCheck = await dynamoClient.send(new GetItemCommand({
      TableName: 'sitelogix-personnel',
      Key: {
        PK: { S: `PERSONNEL#${personnelId}` },
        SK: { S: 'METADATA' }
      }
    }));

    if (!existsCheck.Item) {
      const personnelItem = {
        PK: `PERSONNEL#${personnelId}`,
        SK: 'METADATA',
        personnel_id: personnelId,
        full_name: data.canonical_name,
        role: data.role,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await dynamoClient.send(new PutItemCommand({
        TableName: 'sitelogix-personnel',
        Item: marshall(personnelItem, { removeUndefinedValues: true })
      }));

      created++;
    }
  }

  console.log(`   ✓ Seeded ${created} new personnel`);
}

// Run the batch processor
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
