/**
 * Full Analytics Extraction (Standalone JavaScript)
 * Extracts: personnel, hours/overtime, vendors, deliveries, constraints, delays, injuries
 */

const Anthropic = require('@anthropic-ai/sdk');
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

const dynamoClient = new DynamoDBClient({});

/**
 * Convert transcript to plain text
 */
function transcriptToText(transcript) {
  if (!transcript || !transcript.transcript) return '';

  return transcript.transcript
    .map(msg => {
      const role = msg.role === 'user' ? 'Manager' : 'Roxy';
      return `${role}: ${msg.message}`;
    })
    .join('\n\n');
}

/**
 * Build extraction prompt for Claude
 */
function buildExtractionPrompt(rawTranscript, context) {
  return `You are an AI assistant specialized in extracting structured construction data from daily report conversations.

CONTEXT:
- Project: ${context.projectName}
- Location: ${context.projectLocation}
- Manager: ${context.managerName}
- Date: ${context.reportDate}

TRANSCRIPT:
${rawTranscript}

TASK:
Extract ALL of the following information in JSON format:

1. PERSONNEL:
For each person mentioned, extract:
- fullName: Full name (best guess)
- goByName: Nickname or "go by" name
- position: Position (Project Manager, Foreman, Journeyman, Apprentice)
- teamAssignment: Team (Project Manager, Team 1, Team 2, etc.)
- hoursWorked: Hours worked (number)
- overtimeHours: Overtime hours (number, default 0)
- healthStatus: Health status (Healthy, N/A, or specific limitation)
- activitiesPerformed: Brief description
- extractedFromText: Exact quote

2. WORK ACTIVITIES (workLogs):
For each team/group:
- teamId: Team identifier
- level: Building level or area
- personnelAssigned: Array of full names
- personnelCount: Number of personnel
- taskDescription: What they worked on
- hoursWorked: Total team hours
- overtimeHours: Total team overtime
- materialsUsed: Array of materials (optional)
- equipmentUsed: Array of equipment (optional)
- extractedFromText: Exact quote

3. CONSTRAINTS/ISSUES (constraints):
For each issue:
- category: delay, safety, material, weather, labor, coordination, other
- level: Building level
- severity: low, medium, high, critical
- title: Short title (1-5 words)
- description: Full description
- status: open, in_progress, resolved
- extractedFromText: Exact quote

4. VENDORS/DELIVERIES (vendors):
For each delivery:
- companyName: Company name
- vendorType: supplier, subcontractor, rental, other
- materialsDelivered: Description
- deliveryTime: Time if mentioned
- receivedBy: Person who received
- deliveryNotes: Issues or special notes
- extractedFromText: Exact quote

5. TIME SUMMARY (timeSummary):
- totalPersonnelCount: Total unique personnel
- totalRegularHours: Sum of regular hours
- totalOvertimeHours: Sum of overtime
- arrivalTime: Site arrival time
- departureTime: Site departure time

RULES:
- Include extractedFromText with direct quotes
- Use null for missing data
- Be conservative - only extract clearly stated info
- Use consistent naming
- For injuries, include in constraints with category "safety"

Return ONLY valid JSON:
{
  "personnel": [...],
  "workLogs": [...],
  "constraints": [...],
  "vendors": [...],
  "timeSummary": {...}
}`;
}

/**
 * Process transcript and extract all analytics data
 */
async function processTranscriptAnalytics(transcript, context) {
  try {
    console.log('📊 Starting full transcript analytics extraction...');

    const { reportId, projectId, projectName, projectLocation, managerName, reportDate } = context;

    // Convert transcript to text
    const rawTranscript = transcriptToText(transcript);

    if (!rawTranscript || rawTranscript.trim().length === 0) {
      throw new Error('Empty transcript');
    }

    // Build prompt
    const prompt = buildExtractionPrompt(rawTranscript, {
      projectName,
      projectLocation,
      managerName,
      reportDate
    });

    // Analyze with Claude
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    console.log('🤖 Analyzing transcript with Claude 3.5 Sonnet...');

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from response
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n/, '').replace(/\n```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n/, '').replace(/\n```$/, '');
    }

    const extractedData = JSON.parse(jsonText);

    console.log('✅ Transcript analysis complete:');
    console.log(`   - Personnel: ${extractedData.personnel?.length || 0}`);
    console.log(`   - Work Logs: ${extractedData.workLogs?.length || 0}`);
    console.log(`   - Constraints: ${extractedData.constraints?.length || 0}`);
    console.log(`   - Vendors: ${extractedData.vendors?.length || 0}`);

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
