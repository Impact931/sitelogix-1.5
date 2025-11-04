#!/usr/bin/env node

/**
 * Extraction Service - Roxy AI Agent
 *
 * Extracts structured data from unstructured construction daily reports
 * using Claude AI with specialized prompts for entity recognition and normalization.
 *
 * Key Features:
 * - Entity extraction (personnel, projects, hours, activities, vendors, issues)
 * - Fuzzy matching and normalization
 * - Confidence scoring
 * - Abbreviation mapping
 */

const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Roxy v1.0 Extraction Prompt
 *
 * Specialized prompt for extracting construction report data with normalization rules
 */
const ROXY_EXTRACTION_PROMPT = `You are Roxy, an AI agent specialized in extracting structured data from construction daily reports.

Your task is to extract structured information from unstructured, conversational transcripts submitted by construction workers and foremen. These transcripts often contain:
- Voice-to-text errors and misspellings
- Inconsistent abbreviations
- Multiple projects mentioned in one report
- Embedded personnel mentions without clear structure
- Missing punctuation

REQUIRED FIELDS:
1. report_date (YYYY-MM-DD format) - Extract from filename or content
2. reporter_name (first + last if available, first name only is acceptable)
3. project_name (full name, not abbreviation)
4. total_hours (reporter's hours for the day, decimal format)

OPTIONAL FIELDS:
5. additional_personnel[] - Array of {name, hours, role}
6. work_completed[] - Array of completed tasks/activities
7. work_in_progress[] - Array of ongoing tasks
8. issues[] - Array of problems, delays, or constraints
9. vendors[] - Array of {company, delivery_type, time}
10. weather_notes (if mentioned)

NORMALIZATION RULES (Project Names):
- "CC" = "Cortex Commons"
- "MM" = "Mellow Mushroom" (default) or "Monsanto" (if Scott is reporter)
- "Nash Twr 2" or "Nash Tower 2" = "Nashville Yards Tower 2"
- "SLU Res" = "Saint Louis University Residence"
- "Sx Partners" or "Six Partners" = "Surgery Partners"
- "Meharry" = "Meharry Medical College"
- "Bommarito" = "Bommarito Automotive"

NORMALIZATION RULES (Personnel Names):
- "Owen glass burner" = "Owen Glassburn"
- "Scott Russell" = "Scott Russell" (plumber)
- "Bryan" = "Brian"
- "Ken" = "Kenny"
- If only first name given, keep as-is

EXTRACTION RULES:
1. Use context clues to expand abbreviations
2. Normalize similar names using fuzzy matching
3. If hours mentioned for "I" or "myself", attribute to reporter
4. Sum hours across multiple mentions of same person
5. Flag ambiguous project names with [UNCLEAR: ...]
6. If multi-day report, extract date range and create separate entries
7. Extract all personnel mentioned, even if hours not specified
8. Separate completed work from in-progress work
9. Identify issues/constraints clearly (weather delays, missing materials, etc.)
10. Extract vendor deliveries with times if mentioned

CONFIDENCE SCORING:
Provide a confidence score (0.0-1.0) for the overall extraction quality:
- 0.9-1.0: High confidence, all required fields clear
- 0.7-0.9: Medium confidence, some ambiguity
- 0.5-0.7: Low confidence, significant ambiguity or missing data
- <0.5: Very low confidence, recommend manual review

OUTPUT FORMAT:
Return ONLY valid JSON with no additional text or explanations. Use this exact structure:

{
  "report_date": "YYYY-MM-DD",
  "reporter_name": "First Last",
  "project_name": "Full Project Name",
  "total_hours": 8.0,
  "additional_personnel": [
    {"name": "Person Name", "hours": 8.0, "role": "role_if_known"}
  ],
  "work_completed": ["Task 1", "Task 2"],
  "work_in_progress": ["Task 3"],
  "issues": ["Issue 1", "Issue 2"],
  "vendors": [
    {"company": "Vendor Name", "delivery_type": "material", "time": "10:00 AM"}
  ],
  "weather_notes": "weather details if mentioned",
  "extraction_confidence": 0.85,
  "ambiguities": ["list any unclear items for manual review"]
}`;

/**
 * Extract structured data from a transcript using Claude AI
 *
 * @param {string} transcriptText - Raw transcript text
 * @param {string} filename - Original filename (for date extraction)
 * @returns {Promise<Object>} Extracted structured data
 */
async function extractFromTranscript(transcriptText, filename = '') {
  try {
    console.log('🤖 Roxy extracting data from transcript...');
    console.log(`   📄 Filename: ${filename}`);
    console.log(`   📝 Content length: ${transcriptText.length} characters`);

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

Extract structured data following the rules above. Return ONLY valid JSON.`
        }
      ]
    });

    // Extract JSON from response
    const responseText = message.content[0].text;

    // Try to parse JSON from response
    let extractedData;
    try {
      extractedData = JSON.parse(responseText);
    } catch (parseError) {
      // If direct parse fails, try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Could not extract valid JSON from response');
      }
    }

    // Add metadata
    extractedData.extraction_timestamp = new Date().toISOString();
    extractedData.original_filename = filename;

    console.log(`   ✅ Extraction complete (confidence: ${extractedData.extraction_confidence || 'unknown'})`);

    return {
      success: true,
      data: extractedData
    };

  } catch (error) {
    console.error('❌ Extraction error:', error.message);
    return {
      success: false,
      error: error.message,
      raw_transcript: transcriptText
    };
  }
}

/**
 * Batch extract data from multiple transcripts
 *
 * @param {Array<{text: string, filename: string}>} transcripts - Array of transcript objects
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Batch processing results
 */
async function batchExtract(transcripts, options = {}) {
  const {
    delayMs = 1000, // Delay between API calls to avoid rate limiting
    onProgress = null // Progress callback function
  } = options;

  console.log(`\n🚀 Starting batch extraction for ${transcripts.length} transcripts...`);

  const results = {
    total: transcripts.length,
    succeeded: 0,
    failed: 0,
    extractions: []
  };

  for (let i = 0; i < transcripts.length; i++) {
    const transcript = transcripts[i];

    console.log(`\n[${i + 1}/${transcripts.length}] Processing: ${transcript.filename}`);

    const result = await extractFromTranscript(transcript.text, transcript.filename);

    if (result.success) {
      results.succeeded++;
      results.extractions.push({
        filename: transcript.filename,
        data: result.data
      });
    } else {
      results.failed++;
      results.extractions.push({
        filename: transcript.filename,
        error: result.error
      });
    }

    // Progress callback
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: transcripts.length,
        succeeded: results.succeeded,
        failed: results.failed
      });
    }

    // Delay between requests
    if (i < transcripts.length - 1) {
      console.log(`   ⏳ Waiting ${delayMs}ms before next transcript...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log('\n================================================');
  console.log('📊 Batch Extraction Complete');
  console.log('================================================');
  console.log(`Total:     ${results.total}`);
  console.log(`✅ Success: ${results.succeeded}`);
  console.log(`❌ Failed:  ${results.failed}`);
  console.log(`Success Rate: ${((results.succeeded / results.total) * 100).toFixed(1)}%`);

  return results;
}

module.exports = {
  extractFromTranscript,
  batchExtract,
  ROXY_EXTRACTION_PROMPT
};
