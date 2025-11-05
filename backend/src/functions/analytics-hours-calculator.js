// Analytics Agent: Personnel Hours Calculator
// Uses OpenAI GPT-4o to analyze transcripts and extract accurate personnel hours

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const OpenAI = require('openai');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Calculate personnel hours from report using OpenAI GPT-4o
 */
async function calculatePersonnelHours(report) {
  console.log(`📊 Calculating hours for report ${report.report_id}`);

  const personnel = report.extracted_data?.additional_personnel || [];

  if (personnel.length === 0) {
    console.log('⚠️ No personnel found in report');
    return { personnel_hours: [], summary: { total_regular: 0, total_overtime: 0, total_cost: 0 } };
  }

  // Build prompt for OpenAI
  const prompt = `You are analyzing a construction daily report to extract accurate personnel work hours.

Report Date: ${report.report_date}
Project: ${report.project_name || report.project_id}

Full Transcript:
${report.transcript || 'No transcript available'}

Personnel Mentioned:
${JSON.stringify(personnel, null, 2)}

For EACH person in the personnel list, carefully analyze the transcript to estimate:

1. **Hours Worked**: Based on:
   - Direct time mentions (e.g., "worked 8am to 5pm", "started at 7", "left at 6:30pm")
   - Activity descriptions (multiple major tasks = likely full day)
   - Weather/site conditions (early closure, rain delays affect hours)
   - Role-typical hours (operators usually 8-10hrs, laborers 8hrs)
   - Comparison to other crew members

2. **Regular vs Overtime Hours**:
   - Regular: 0-8 hours
   - Overtime: Hours beyond 8 (typically 1.5x pay rate)
   - Note: Some may work partial days (<8 hrs)

3. **Specific Activities**: List what each person did

4. **Confidence Score** (0.0-1.0):
   - 1.0 = Explicit time stated ("John worked 8 hours")
   - 0.8 = Strong inference from multiple activity mentions
   - 0.5 = Mentioned but duration unclear
   - 0.3 = Only peripheral mention

**IMPORTANT**:
- Be conservative with hour estimates
- If unclear, estimate lower (better to underestimate than overestimate)
- Use context clues (weather, project phase, other crew hours)
- Account for lunch breaks and downtime

Return a JSON object with this exact structure:
{
  "personnel_hours": [
    {
      "person_id": "person_001",
      "canonical_name": "Scott Russell",
      "regular_hours": 8.0,
      "overtime_hours": 1.5,
      "total_hours": 9.5,
      "activities": ["framing second floor", "cleanup", "material organization"],
      "confidence": 0.85,
      "reasoning": "Mentioned working morning shift, stayed late for cleanup. Multiple activities indicate full day."
    }
  ],
  "summary": {
    "total_personnel": 4,
    "total_regular_hours": 32.0,
    "total_overtime_hours": 6.0,
    "average_hours_per_person": 9.5,
    "notes": "Full crew present, weather was good, productive day"
  }
}`;

  try {
    console.log('🤖 Calling OpenAI GPT-4o...');
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert construction workforce analyst. You excel at accurately estimating work hours from daily reports and transcripts. Always be conservative with hour estimates - underestimate rather than overestimate.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Low temperature for more consistent, accurate estimates
      max_tokens: 2000
    });

    const duration = Date.now() - startTime;
    console.log(`✅ OpenAI response received in ${duration}ms`);

    const analysis = JSON.parse(completion.choices[0].message.content);

    // Calculate costs (using standard construction labor rates)
    const REGULAR_RATE = 40; // $40/hour base rate
    const OVERTIME_RATE = 60; // $60/hour overtime rate (1.5x)

    const enrichedHours = analysis.personnel_hours.map(ph => ({
      ...ph,
      regular_cost: ph.regular_hours * REGULAR_RATE,
      overtime_cost: ph.overtime_hours * OVERTIME_RATE,
      total_cost: (ph.regular_hours * REGULAR_RATE) + (ph.overtime_hours * OVERTIME_RATE)
    }));

    const totalCost = enrichedHours.reduce((sum, ph) => sum + ph.total_cost, 0);

    // Store in DynamoDB
    await storePersonnelHours(report, enrichedHours, totalCost);

    return {
      personnel_hours: enrichedHours,
      summary: {
        ...analysis.summary,
        total_cost: totalCost,
        average_cost_per_person: totalCost / enrichedHours.length
      },
      api_usage: {
        model: 'gpt-4o',
        duration_ms: duration,
        tokens_used: completion.usage.total_tokens,
        estimated_cost: (completion.usage.total_tokens / 1000) * 0.005 // Rough estimate
      }
    };

  } catch (error) {
    console.error('❌ Error calling OpenAI:', error);
    throw new Error(`Failed to calculate hours: ${error.message}`);
  }
}

/**
 * Store personnel hours in DynamoDB analytics table
 */
async function storePersonnelHours(report, personnelHours, totalCost) {
  const timestamp = new Date().toISOString();

  // Store individual personnel hours
  for (const ph of personnelHours) {
    const item = {
      PK: `PERSONNEL_HOURS#${ph.person_id}`,
      SK: `DATE#${report.report_date}`,
      GSI1PK: `PROJECT#${report.project_id}`,
      GSI1SK: `DATE#${report.report_date}`,

      // Data
      report_id: report.report_id,
      person_id: ph.person_id,
      person_name: ph.canonical_name,
      project_id: report.project_id,
      project_name: report.project_name,
      report_date: report.report_date,

      // Hours
      regular_hours: ph.regular_hours,
      overtime_hours: ph.overtime_hours,
      total_hours: ph.total_hours,

      // Costs
      regular_cost: ph.regular_cost,
      overtime_cost: ph.overtime_cost,
      total_cost: ph.total_cost,

      // Details
      activities: ph.activities,
      confidence: ph.confidence,
      reasoning: ph.reasoning,

      // Metadata
      calculated_at: timestamp,
      ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year retention
    };

    await docClient.send(new PutCommand({
      TableName: 'sitelogix-analytics',
      Item: item
    }));
  }

  // Store daily summary
  const summaryItem = {
    PK: `HOURS_SUMMARY#${report.project_id}`,
    SK: `DATE#${report.report_date}`,
    GSI1PK: `DATE#${report.report_date}`,
    GSI1SK: timestamp,

    report_id: report.report_id,
    project_id: report.project_id,
    project_name: report.project_name,
    report_date: report.report_date,

    total_personnel: personnelHours.length,
    total_regular_hours: personnelHours.reduce((sum, ph) => sum + ph.regular_hours, 0),
    total_overtime_hours: personnelHours.reduce((sum, ph) => sum + ph.overtime_hours, 0),
    total_hours: personnelHours.reduce((sum, ph) => sum + ph.total_hours, 0),
    total_cost: totalCost,

    calculated_at: timestamp,
    ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
  };

  await docClient.send(new PutCommand({
    TableName: 'sitelogix-analytics',
    Item: summaryItem
  }));

  console.log(`✅ Stored hours data for ${personnelHours.length} personnel`);
}

/**
 * Get personnel hours for a date range
 */
async function getPersonnelHours(params) {
  const { person_id, project_id, start_date, end_date } = params;

  let PK, SK;
  if (person_id) {
    PK = `PERSONNEL_HOURS#${person_id}`;
    SK = start_date ? `DATE#${start_date}` : undefined;
  } else if (project_id) {
    // Use GSI to query by project
    const result = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `PROJECT#${project_id}`
      }
    }));
    return result.Items || [];
  }

  const result = await docClient.send(new QueryCommand({
    TableName: 'sitelogix-analytics',
    KeyConditionExpression: PK ? 'PK = :pk' + (SK ? ' AND begins_with(SK, :sk)' : '') : undefined,
    ExpressionAttributeValues: {
      ':pk': PK,
      ...(SK && { ':sk': SK })
    }
  }));

  return result.Items || [];
}

module.exports = {
  calculatePersonnelHours,
  getPersonnelHours,
  storePersonnelHours
};
