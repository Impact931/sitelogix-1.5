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

  // Parse extracted_data if it's a JSON string
  const extractedData = typeof report.extracted_data === 'string'
    ? JSON.parse(report.extracted_data)
    : (report.extracted_data || {});

  const personnel = extractedData.additional_personnel || [];

  if (personnel.length === 0) {
    console.log('⚠️ No personnel found in report');
    return { personnel_hours: [], summary: { total_regular: 0, total_overtime: 0, total_cost: 0 } };
  }

  // Build enhanced prompt for OpenAI
  const prompt = `You are analyzing a construction daily report to extract comprehensive personnel intelligence for CEO/CFO-level business analytics.

Report Date: ${report.report_date}
Project: ${report.project_name || report.project_id}

Full Transcript:
${report.transcript || 'No transcript available'}

Personnel Mentioned:
${JSON.stringify(personnel, null, 2)}

For EACH person in the personnel list, extract the following COMPREHENSIVE intelligence:

1. **Hours Worked** - Categorize precisely:
   - **Regular Hours** (0-8 hours at standard rate)
   - **Overtime Hours** (8-12 hours at 1.5x rate)
   - **Double-Time Hours** (hours beyond 12 OR weekend/holiday hours at 2x rate)
   - **Weekend Work**: Was this a Saturday/Sunday? (affects pay multiplier)
   - **Early Departures**: Did they leave early? If so, why? (heat, weather, safety)

2. **Time Context**:
   - Start time (if mentioned)
   - End time (if mentioned)
   - Breaks/lunch mentioned?
   - Worked through lunch? (affects OT calculation)

3. **Specific Activities & Tasks**: List everything they did

4. **Performance & Productivity Notes**:
   - High performer? Multiple complex tasks completed?
   - Productivity issues? Downtime mentioned?
   - Leadership role? ("supervised", "coordinated", "led crew")
   - Training/mentoring others?

5. **Environmental Impact**:
   - Heat stress mentioned? (>95°F = early departure risk)
   - Weather delays affecting their hours?
   - Safety stand-downs?

6. **OT Drivers** - WHY did they work OT/DT?:
   - "schedule catch-up", "inspection deadline", "emergency repair"
   - "weather recovery", "client request", "coordination delay"
   - Was OT approved or pre-planned?

7. **Confidence Score** (0.0-1.0):
   - 1.0 = Explicit time stated
   - 0.8 = Strong inference from activities
   - 0.5 = Mentioned but duration unclear
   - 0.3 = Only peripheral mention

**CRITICAL BUSINESS INTELLIGENCE**:
- Track NAMED individuals (e.g., "Bryan Nash", "Caleb Barnett") - spell names correctly
- Identify supervisors/superintendents (usually mentioned as "reporting" or "leading")
- Note if weekend work (Saturday/Sunday) which is always premium pay
- Flag heat-related early departures with SPECIFIC DATES and hours lost
- Identify top OT workers (>10 hrs = monitor for burnout)

Return a JSON object with this ENHANCED structure:
{
  "personnel_hours": [
    {
      "person_id": "person_001",
      "canonical_name": "Bryan Nash",
      "role": "Superintendent",
      "regular_hours": 8.0,
      "overtime_hours": 2.0,
      "double_time_hours": 0.0,
      "total_hours": 10.0,
      "start_time": "7:00 AM",
      "end_time": "5:30 PM",
      "is_weekend": false,
      "early_departure": false,
      "early_departure_reason": null,
      "hours_lost_to_weather": 0.0,
      "activities": ["Level 2C pour prep", "Coordinated with electrical trade", "Inspection coordination"],
      "performance_notes": "Primary superintendent, high documentation quality, coordinated multiple trades",
      "ot_driver": "Inspection deadline preparation",
      "ot_approved": true,
      "confidence": 0.90,
      "reasoning": "Explicitly mentioned as site superintendent coordinating multiple tasks. Multiple activity references throughout day."
    }
  ],
  "summary": {
    "total_personnel": 8,
    "total_regular_hours": 64.0,
    "total_overtime_hours": 16.0,
    "total_double_time_hours": 0.0,
    "average_hours_per_person": 10.0,
    "weekend_crew_count": 0,
    "heat_early_departures": 0,
    "total_hours_lost_weather": 0.0,
    "top_ot_workers": ["Bryan Nash: 2.0 hrs", "Caleb Barnett: 1.5 hrs"],
    "ot_drivers": ["Inspection deadline", "Schedule catch-up"],
    "notes": "Full crew present, productive day, OT for inspection preparation"
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
    const DOUBLE_TIME_RATE = 80; // $80/hour double-time rate (2x)

    const enrichedHours = analysis.personnel_hours.map(ph => ({
      ...ph,
      regular_cost: (ph.regular_hours || 0) * REGULAR_RATE,
      overtime_cost: (ph.overtime_hours || 0) * OVERTIME_RATE,
      double_time_cost: (ph.double_time_hours || 0) * DOUBLE_TIME_RATE,
      total_cost: (
        ((ph.regular_hours || 0) * REGULAR_RATE) +
        ((ph.overtime_hours || 0) * OVERTIME_RATE) +
        ((ph.double_time_hours || 0) * DOUBLE_TIME_RATE)
      )
    }));

    const totalCost = enrichedHours.reduce((sum, ph) => sum + ph.total_cost, 0);
    const totalDoubleTime = enrichedHours.reduce((sum, ph) => sum + (ph.double_time_hours || 0), 0);

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

      // Core identification
      report_id: report.report_id,
      person_id: ph.person_id,
      person_name: ph.canonical_name,
      role: ph.role || 'Worker',
      project_id: report.project_id,
      project_name: report.project_name,
      report_date: report.report_date,

      // Hours breakdown
      regular_hours: ph.regular_hours || 0,
      overtime_hours: ph.overtime_hours || 0,
      double_time_hours: ph.double_time_hours || 0,
      total_hours: ph.total_hours || 0,

      // Time details
      start_time: ph.start_time,
      end_time: ph.end_time,
      is_weekend: ph.is_weekend || false,
      early_departure: ph.early_departure || false,
      early_departure_reason: ph.early_departure_reason,
      hours_lost_to_weather: ph.hours_lost_to_weather || 0,

      // Costs
      regular_cost: ph.regular_cost || 0,
      overtime_cost: ph.overtime_cost || 0,
      double_time_cost: ph.double_time_cost || 0,
      total_cost: ph.total_cost || 0,

      // Work details
      activities: ph.activities || [],
      performance_notes: ph.performance_notes,
      ot_driver: ph.ot_driver,
      ot_approved: ph.ot_approved,

      // Quality metrics
      confidence: ph.confidence || 0,
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

  // Store daily summary with enhanced metrics
  const summaryItem = {
    PK: `HOURS_SUMMARY#${report.project_id}`,
    SK: `DATE#${report.report_date}`,
    GSI1PK: `DATE#${report.report_date}`,
    GSI1SK: timestamp,

    report_id: report.report_id,
    project_id: report.project_id,
    project_name: report.project_name,
    report_date: report.report_date,

    // Personnel counts
    total_personnel: personnelHours.length,
    weekend_crew_count: personnelHours.filter(ph => ph.is_weekend).length,

    // Hours breakdown
    total_regular_hours: personnelHours.reduce((sum, ph) => sum + (ph.regular_hours || 0), 0),
    total_overtime_hours: personnelHours.reduce((sum, ph) => sum + (ph.overtime_hours || 0), 0),
    total_double_time_hours: personnelHours.reduce((sum, ph) => sum + (ph.double_time_hours || 0), 0),
    total_hours: personnelHours.reduce((sum, ph) => sum + (ph.total_hours || 0), 0),

    // Environmental impacts
    heat_early_departures: personnelHours.filter(ph => ph.early_departure && ph.early_departure_reason?.includes('heat')).length,
    total_hours_lost_weather: personnelHours.reduce((sum, ph) => sum + (ph.hours_lost_to_weather || 0), 0),

    // Costs
    total_cost: totalCost,

    // Business intelligence
    average_hours_per_person: personnelHours.length > 0 ? (personnelHours.reduce((sum, ph) => sum + (ph.total_hours || 0), 0) / personnelHours.length).toFixed(1) : 0,
    top_ot_workers: personnelHours
      .filter(ph => (ph.overtime_hours || 0) > 0)
      .sort((a, b) => (b.overtime_hours || 0) - (a.overtime_hours || 0))
      .slice(0, 3)
      .map(ph => `${ph.canonical_name}: ${ph.overtime_hours} hrs`),

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
