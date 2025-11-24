/**
 * Payroll Extraction Service
 * Extracts employee hours data from daily report transcripts using GPT-4
 */

const fetch = require('node-fetch');
const { handleMatchOrCreateEmployee } = require('../functions/personnel-endpoints');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Extract payroll data from transcript using GPT-4
 * @param {string} transcript - The conversation transcript
 * @param {Object} context - Report context (reportId, projectId, reportDate, etc.)
 * @returns {Promise<Object>} Extracted payroll data
 */
async function extractPayrollFromTranscript(transcript, context) {
  if (!OPENAI_API_KEY) {
    console.warn('⚠️ OPENAI_API_KEY not configured, skipping payroll extraction');
    return { employees: [], success: false, error: 'OpenAI API key not configured' };
  }

  const extractionPrompt = `
You are analyzing a daily construction report transcript to extract payroll information.

Extract the following information for each employee mentioned:
1. Employee name (full name or first name)
2. Arrival time (if mentioned)
3. Departure time (if mentioned)
4. Total hours worked
5. Overtime hours (if any)
6. Double time hours (if any)
7. Activities/work performed
8. Any employee-specific issues or notes

Guidelines:
- If crew hours are mentioned collectively (e.g., "the crew worked 8 hours"), assume uniform distribution
- If only arrival/departure times given, calculate hours: regular time up to 8 hours, overtime 8-12 hours, double time >12 hours
- If someone says "got here at 8am", that's the arrival time
- Regular hours = min(total_hours, 8)
- Overtime hours = max(0, min(total_hours - 8, 4))
- Double time hours = max(0, total_hours - 12)
- If no specific hours mentioned but presence confirmed, assume 8 regular hours
- Extract multiple projects separately if mentioned

Return a JSON array of employee payroll entries in this exact format:
{
  "employees": [
    {
      "name": "John Smith",
      "arrival_time": "08:00",
      "departure_time": "17:00",
      "total_hours": 9,
      "regular_hours": 8,
      "overtime_hours": 1,
      "double_time_hours": 0,
      "activities": "Framing second floor, installed HVAC ductwork",
      "issues": "Delayed delivery of materials",
      "project_specific": false
    }
  ]
}

TRANSCRIPT:
${transcript}

Extract payroll data as JSON:`;

  try {
    console.log('🤖 Extracting payroll data with GPT-4...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a payroll data extraction assistant. Always respond with valid JSON only, no additional text.'
          },
          {
            role: 'user',
            content: extractionPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return { employees: [], success: false, error: `OpenAI API error: ${response.statusText}` };
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // Parse JSON response
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from GPT response:', content);
      return { employees: [], success: false, error: 'Failed to parse GPT response' };
    }

    const extracted = JSON.parse(jsonMatch[0]);
    console.log(`✅ Extracted ${extracted.employees?.length || 0} employee records`);

    return {
      employees: extracted.employees || [],
      success: true
    };

  } catch (error) {
    console.error('Error extracting payroll data:', error);
    return { employees: [], success: false, error: error.message };
  }
}

/**
 * Match employee name to existing employee in database
 * @param {string} name - Employee name from transcript
 * @param {string} projectId - Project ID for context
 * @returns {Promise<Object>} Matched employee info
 */
async function matchEmployee(name, projectId) {
  try {
    // Call the personnel handler directly (internal Lambda call, not HTTP)
    const result = await handleMatchOrCreateEmployee({
      body: JSON.stringify({ name, projectId })
    });

    // handleMatchOrCreateEmployee returns {statusCode, body: {success, data}}
    const data = result.body;

    if (data.success) {
      return {
        success: true,
        employeeId: data.data.employeeId,
        employeeNumber: data.data.employeeNumber,
        fullName: data.data.fullName,
        confidence: data.data.confidence,
        needsReview: data.data.needsReview || false
      };
    } else {
      console.warn(`Failed to match employee "${name}":`, data.error);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error(`Error matching employee "${name}":`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Create bulk payroll entries
 * @param {Array} entries - Array of payroll entry objects
 * @returns {Promise<Object>} Creation result
 */
async function createBulkPayrollEntries(entries) {
  try {
    const response = await fetch(`${API_BASE_URL}/payroll/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries })
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Created ${data.data.created} payroll entries`);
      if (data.data.failed > 0) {
        console.warn(`⚠️ ${data.data.failed} entries failed to create`);
      }
      return { success: true, ...data.data };
    } else {
      console.error('Failed to create payroll entries:', data.error);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error creating payroll entries:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Process transcript and create payroll entries
 * Main workflow: Extract -> Match -> Create
 * @param {string} transcript - Daily report transcript
 * @param {Object} reportContext - Report metadata
 * @returns {Promise<Object>} Processing result
 */
async function processTranscriptForPayroll(transcript, reportContext) {
  const {
    reportId,
    projectId,
    projectName,
    reportDate,
    managerId
  } = reportContext;

  console.log('');
  console.log('='.repeat(80));
  console.log('💼 PAYROLL EXTRACTION WORKFLOW');
  console.log('='.repeat(80));
  console.log(`Report ID: ${reportId}`);
  console.log(`Project: ${projectName} (${projectId})`);
  console.log(`Date: ${reportDate}`);
  console.log('');

  // Step 1: Extract payroll data from transcript
  console.log('📋 Step 1: Extracting payroll data from transcript...');
  const extraction = await extractPayrollFromTranscript(transcript, reportContext);

  if (!extraction.success || extraction.employees.length === 0) {
    console.log('⚠️ No payroll data extracted from transcript');
    return {
      success: true,
      message: 'No payroll data found in transcript',
      employeesProcessed: 0,
      entriesCreated: 0
    };
  }

  console.log(`Found ${extraction.employees.length} employees in transcript`);
  console.log('');

  // Step 2: Match employees and prepare entries
  console.log('👥 Step 2: Matching employees...');
  const payrollEntries = [];
  const matchResults = [];

  for (const emp of extraction.employees) {
    console.log(`  Matching: ${emp.name}...`);

    const match = await matchEmployee(emp.name, projectId);
    matchResults.push({ name: emp.name, ...match });

    if (match.success) {
      console.log(`    ✓ Matched to: ${match.fullName} (${match.employeeNumber}) [${match.confidence}]`);

      // Create payroll entry
      payrollEntries.push({
        reportId,
        employeeId: match.employeeId,
        employeeNumber: match.employeeNumber,
        employeeName: match.fullName,
        projectId,
        projectName,
        reportDate,
        regularHours: emp.regular_hours || 0,
        overtimeHours: emp.overtime_hours || 0,
        doubleTimeHours: emp.double_time_hours || 0,
        arrivalTime: emp.arrival_time,
        departureTime: emp.departure_time,
        activities: emp.activities,
        employeeSpecificIssues: emp.issues,
        needsReview: match.needsReview || match.confidence !== 'exact'
      });
    } else {
      console.log(`    ✗ Failed to match: ${match.error}`);
    }
  }

  console.log('');

  // Step 3: Create payroll entries in bulk
  if (payrollEntries.length === 0) {
    console.log('⚠️ No valid payroll entries to create');
    return {
      success: true,
      message: 'No employees could be matched',
      employeesProcessed: extraction.employees.length,
      employeesMatched: 0,
      entriesCreated: 0,
      matchResults
    };
  }

  console.log(`💾 Step 3: Creating ${payrollEntries.length} payroll entries...`);
  const createResult = await createBulkPayrollEntries(payrollEntries);

  console.log('');
  console.log('='.repeat(80));
  console.log('✅ PAYROLL EXTRACTION COMPLETE');
  console.log('='.repeat(80));
  console.log(`Employees in transcript: ${extraction.employees.length}`);
  console.log(`Employees matched: ${payrollEntries.length}`);
  console.log(`Entries created: ${createResult.created || 0}`);
  console.log(`Entries failed: ${createResult.failed || 0}`);
  console.log(`Entries needing review: ${payrollEntries.filter(e => e.needsReview).length}`);
  console.log('='.repeat(80));
  console.log('');

  return {
    success: createResult.success,
    employeesProcessed: extraction.employees.length,
    employeesMatched: payrollEntries.length,
    entriesCreated: createResult.created || 0,
    entriesFailed: createResult.failed || 0,
    needsReview: payrollEntries.filter(e => e.needsReview).length,
    matchResults,
    createResult
  };
}

module.exports = {
  extractPayrollFromTranscript,
  matchEmployee,
  createBulkPayrollEntries,
  processTranscriptForPayroll
};
