// Analytics Agent: Project Milestones & Quality Inspection Tracking
// Tracks inspection pass rates, cycle times, milestone completion, and quality metrics

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const OpenAI = require('openai');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Analyze project milestones and inspection performance from report
 */
async function analyzeProjectMilestones(report) {
  console.log(`🏗️ Analyzing project milestones for report ${report.report_id}`);

  // Parse extracted_data if it's a JSON string
  const extractedData = typeof report.extracted_data === 'string'
    ? JSON.parse(report.extracted_data)
    : (report.extracted_data || {});

  const transcript = report.transcript || '';

  // Get historical inspection data for this project
  const history = await getProjectInspectionHistory(report.project_id, 90); // Last 90 days

  // Use OpenAI to extract comprehensive project intelligence
  const analysis = await analyzeWithAI(report, transcript, extractedData, history);

  // Store milestones and inspections
  await storeMilestones(report, analysis.milestones || []);
  await storeInspections(report, analysis.inspections || []);
  await storeQualityMetrics(report, analysis.quality_metrics || {});

  // Calculate and store project health summary
  const healthSummary = calculateProjectHealth(analysis, history);
  await storeProjectHealth(report, healthSummary);

  return {
    milestones: analysis.milestones || [],
    inspections: analysis.inspections || [],
    quality_metrics: analysis.quality_metrics || {},
    project_health: healthSummary
  };
}

/**
 * Use OpenAI to extract project milestone and inspection intelligence
 */
async function analyzeWithAI(report, transcript, extractedData, history) {
  const prompt = `You are analyzing a construction daily report to extract comprehensive PROJECT MILESTONE & QUALITY INSPECTION INTELLIGENCE for CEO/COO-level project management and quality analytics.

Report Date: ${report.report_date}
Project: ${report.project_name || report.project_id}

Full Transcript:
${transcript}

Extracted Data Context:
${JSON.stringify(extractedData, null, 2)}

Historical Inspection Data (last 90 days): ${history.length} inspections
${history.length > 0 ? 'Recent performance: ' + JSON.stringify(history.slice(0, 5), null, 2) : 'No historical data'}

Extract the following COMPREHENSIVE PROJECT INTELLIGENCE:

## 1. INSPECTIONS - CRITICAL FOR QUALITY METRICS

For EACH inspection mentioned (scheduled, completed, or failed):

**Inspection Details:**
- Inspection type (e.g., "Level 2C pour prep", "Rough-in electrical", "Plumbing pressure test", "Framing")
- Status: "scheduled" | "passed" | "failed" | "deferred" | "partial_pass" | "re_inspection"
- Inspection date (or scheduled date)
- Inspector name/company (if mentioned)
- Building level/area (e.g., "Level 2C", "Building 27")

**Pass/Fail Details:**
- Did it pass on first attempt?
- If failed, what were the specific deficiencies? (list each one)
- Root cause of failure: "measurement_error" | "installation_error" | "model_mismatch" | "material_issue" | "coordination_gap" | "documentation_issue"
- Remediation required (what needs to be fixed)
- Estimated time to fix (hours/days)
- Re-inspection scheduled date (if applicable)

**Cycle Time Tracking:**
- Inspection request date (if mentioned)
- Inspection completion date
- Cycle time in days (request to completion)
- Was inspection delayed? If yes, why?

**Quality Impact:**
- Severity of issues found: "critical" | "major" | "minor" | "none"
- Work stoppage required? (yes/no)
- Schedule impact (days delayed)
- Rework cost estimate (if significant)

## 2. MILESTONES - CRITICAL FOR SCHEDULE TRACKING

For EACH milestone achievement or progress toward milestone:

**Milestone Details:**
- Milestone name (e.g., "Level 2C pour ready", "Rough-in completion Level 27", "Utility tie-in complete")
- Achievement status: "completed" | "on_track" | "at_risk" | "delayed" | "in_progress"
- Completion date (if completed)
- Target completion date (if mentioned or implied)
- Completion percentage (if partial, e.g., "80% complete")

**Schedule Performance:**
- Was milestone met on time? (early/on_time/late/pending)
- Schedule variance (days early or late)
- What enabled completion? (if on time or early)
- What caused delay? (if late)

**Dependencies & Blockers:**
- Dependencies cleared? (yes/no/partial)
- Remaining blockers (list any obstacles)
- Coordination requirements (other trades, inspections, materials)

## 3. QUALITY ISSUES & REWORK

**Quality Problems Identified:**
- Description of quality issue
- Root cause (installation error, measurement error, material defect, design issue)
- Area/location affected
- Trades involved
- Rework hours required
- Schedule impact (days)
- Cost impact (estimated)
- Prevention opportunity (how to avoid in future)

## 4. COORDINATION & MODEL ISSUES

**BIM/Model Issues:**
- Model vs field mismatch? (yes/no)
- Specific discrepancy (e.g., "control points misalignment", "penetration location incorrect")
- Resolution action taken
- Time lost resolving (hours)

**Trade Coordination:**
- Coordination delays? (yes/no)
- Which trades involved?
- Reason for coordination issue
- Resolution and time impact

## 5. PRODUCTION METRICS

**Work Completed:**
- Specific quantities (e.g., "40 feet of pipe", "Level 2C deck 100% complete", "8 penetrations cored")
- Quality level (excellent/good/acceptable/needs_improvement)
- Productivity notes (ahead/on_schedule/behind)

## 6. PROJECT HEALTH INDICATORS

Based on ALL factors above, assess:

**Overall Quality Score (0-100):**
- 90-100: Exceptional quality, no issues
- 75-89: Good quality, minor issues only
- 60-74: Acceptable quality, some rework needed
- Below 60: Quality concerns, significant rework

**Schedule Performance Score (0-100):**
- 90-100: Ahead of schedule
- 75-89: On schedule
- 60-74: Minor delays, recoverable
- Below 60: Significant delays

**Inspection Pass Rate Trend:**
- Improving | stable | declining

**Top Quality Risks:**
- List 1-3 quality risks requiring attention

**Top Schedule Risks:**
- List 1-3 schedule risks requiring attention

**CRITICAL EXTRACTION RULES:**
- Extract EXACT inspection types and results
- Note SPECIFIC deficiencies for failed inspections
- Track cycle time from request to approval
- Identify patterns (recurring failures, typical cycle times)
- Flag model vs field mismatches explicitly
- Note any "re-work" or "re-do" mentions

Return a JSON object with this ENHANCED structure:
{
  "inspections": [
    {
      "inspection_type": "Level 2C pour prep",
      "status": "failed",
      "inspection_date": "2024-07-14",
      "inspector": "City Inspector",
      "building_level": "Level 2C",
      "first_attempt_pass": false,
      "deficiencies": [
        "Model vs control points misalignment",
        "3 penetrations not marked for waterproofing"
      ],
      "root_cause": "model_mismatch",
      "remediation_required": "Re-layout control points and model, mark penetrations",
      "estimated_fix_time_hours": 8,
      "re_inspection_date": "2024-07-15",
      "severity": "major",
      "work_stoppage_required": true,
      "schedule_impact_days": 1,
      "rework_cost_estimate": 800,
      "request_date": "2024-07-12",
      "completion_date": "2024-07-15",
      "cycle_time_days": 3,
      "delayed": true,
      "delay_reason": "Failed first attempt, required remediation",
      "confidence": 0.95
    }
  ],
  "milestones": [
    {
      "milestone_name": "Level 2C pour ready",
      "status": "completed",
      "completion_date": "2024-07-15",
      "target_date": "2024-07-15",
      "completion_percentage": 100,
      "schedule_performance": "on_time",
      "schedule_variance_days": 0,
      "enablers": ["Re-layout completed", "Re-inspection passed"],
      "delay_causes": [],
      "dependencies_cleared": true,
      "remaining_blockers": [],
      "coordination_requirements": ["Survey team verification", "GC sign-off"],
      "confidence": 0.90
    }
  ],
  "quality_issues": [
    {
      "description": "Model vs control points misalignment on 2C deck",
      "root_cause": "model_mismatch",
      "area_affected": "Level 2C deck",
      "trades_involved": ["Layout crew", "Survey team"],
      "rework_hours": 8,
      "schedule_impact_days": 1,
      "cost_impact": 800,
      "prevention_opportunity": "Add QC check: Compare model to survey before layout",
      "severity": "major"
    }
  ],
  "coordination_issues": [
    {
      "bim_model_issue": true,
      "discrepancy": "Control points misalignment",
      "resolution": "Re-laid out points/models",
      "time_lost_hours": 8,
      "trade_coordination_delay": false
    }
  ],
  "production_metrics": {
    "work_completed": [
      "Level 2C deck re-layout: 100%",
      "Penetration marking: 8 locations"
    ],
    "quality_level": "good",
    "productivity_assessment": "on_schedule"
  },
  "project_health": {
    "overall_quality_score": 75,
    "quality_reasoning": "Major issue identified and corrected, no recurring patterns",
    "schedule_performance_score": 80,
    "schedule_reasoning": "1 day delay recovered same week, back on track",
    "inspection_pass_rate_trend": "stable",
    "top_quality_risks": [
      "Model accuracy verification needs enhancement",
      "Waterproofing penetration marking process"
    ],
    "top_schedule_risks": [
      "Inspection cycle time variability",
      "Model coordination delays"
    ]
  },
  "confidence": 0.90,
  "reasoning": "Clear inspection failure and remediation documented with specific details"
}`;

  try {
    console.log('🤖 Calling OpenAI GPT-4o for milestone analysis...');
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert construction project manager and quality analyst. You excel at tracking inspection performance, milestone achievement, and identifying quality patterns. Be thorough and precise with dates, metrics, and root causes.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Low temperature for consistent, accurate analysis
      max_tokens: 3000
    });

    const duration = Date.now() - startTime;
    console.log(`✅ OpenAI response received in ${duration}ms`);

    return JSON.parse(completion.choices[0].message.content);

  } catch (error) {
    console.error('❌ Error calling OpenAI:', error);
    return {
      inspections: [],
      milestones: [],
      quality_issues: [],
      coordination_issues: [],
      production_metrics: {},
      project_health: {}
    };
  }
}

/**
 * Store inspections in DynamoDB
 */
async function storeInspections(report, inspections) {
  const timestamp = new Date().toISOString();

  for (const inspection of inspections) {
    const inspectionId = `inspection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const item = {
      PK: `INSPECTION#${report.project_id}`,
      SK: `DATE#${inspection.inspection_date || report.report_date}#${inspectionId}`,
      GSI1PK: `PROJECT#${report.project_id}`,
      GSI1SK: `TYPE#${inspection.inspection_type}`,
      GSI2PK: `STATUS#${inspection.status}`,
      GSI2SK: `DATE#${inspection.inspection_date || report.report_date}`,

      // Core identification
      inspection_id: inspectionId,
      report_id: report.report_id,
      project_id: report.project_id,
      project_name: report.project_name,
      report_date: report.report_date,

      // Inspection details
      inspection_type: inspection.inspection_type,
      status: inspection.status,
      inspection_date: inspection.inspection_date,
      inspector: inspection.inspector,
      building_level: inspection.building_level,

      // Pass/fail tracking
      first_attempt_pass: inspection.first_attempt_pass,
      deficiencies: inspection.deficiencies || [],
      root_cause: inspection.root_cause,
      remediation_required: inspection.remediation_required,
      estimated_fix_time_hours: inspection.estimated_fix_time_hours || 0,
      re_inspection_date: inspection.re_inspection_date,

      // Impact assessment
      severity: inspection.severity,
      work_stoppage_required: inspection.work_stoppage_required || false,
      schedule_impact_days: inspection.schedule_impact_days || 0,
      rework_cost_estimate: inspection.rework_cost_estimate || 0,

      // Cycle time metrics
      request_date: inspection.request_date,
      completion_date: inspection.completion_date,
      cycle_time_days: inspection.cycle_time_days || 0,
      delayed: inspection.delayed || false,
      delay_reason: inspection.delay_reason,

      // Quality
      confidence: inspection.confidence || 0,

      // Metadata
      created_at: timestamp,
      ttl: Math.floor(Date.now() / 1000) + (730 * 24 * 60 * 60) // 2 years retention
    };

    await docClient.send(new PutCommand({
      TableName: 'sitelogix-analytics',
      Item: item
    }));
  }

  if (inspections.length > 0) {
    console.log(`✅ Stored ${inspections.length} inspection records`);
  }
}

/**
 * Store milestones in DynamoDB
 */
async function storeMilestones(report, milestones) {
  const timestamp = new Date().toISOString();

  for (const milestone of milestones) {
    const milestoneId = `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const item = {
      PK: `MILESTONE#${report.project_id}`,
      SK: `DATE#${milestone.completion_date || report.report_date}#${milestoneId}`,
      GSI1PK: `PROJECT#${report.project_id}`,
      GSI1SK: `STATUS#${milestone.status}`,
      GSI2PK: `STATUS#${milestone.status}`,
      GSI2SK: `DATE#${milestone.completion_date || report.report_date}`,

      // Core identification
      milestone_id: milestoneId,
      report_id: report.report_id,
      project_id: report.project_id,
      project_name: report.project_name,
      report_date: report.report_date,

      // Milestone details
      milestone_name: milestone.milestone_name,
      status: milestone.status,
      completion_date: milestone.completion_date,
      target_date: milestone.target_date,
      completion_percentage: milestone.completion_percentage || 0,

      // Schedule performance
      schedule_performance: milestone.schedule_performance,
      schedule_variance_days: milestone.schedule_variance_days || 0,
      enablers: milestone.enablers || [],
      delay_causes: milestone.delay_causes || [],

      // Dependencies
      dependencies_cleared: milestone.dependencies_cleared,
      remaining_blockers: milestone.remaining_blockers || [],
      coordination_requirements: milestone.coordination_requirements || [],

      // Quality
      confidence: milestone.confidence || 0,

      // Metadata
      created_at: timestamp,
      ttl: Math.floor(Date.now() / 1000) + (730 * 24 * 60 * 60) // 2 years retention
    };

    await docClient.send(new PutCommand({
      TableName: 'sitelogix-analytics',
      Item: item
    }));
  }

  if (milestones.length > 0) {
    console.log(`✅ Stored ${milestones.length} milestone records`);
  }
}

/**
 * Store quality metrics summary
 */
async function storeQualityMetrics(report, qualityMetrics) {
  if (!qualityMetrics || Object.keys(qualityMetrics).length === 0) return;

  const timestamp = new Date().toISOString();

  const item = {
    PK: `QUALITY_METRICS#${report.project_id}`,
    SK: `DATE#${report.report_date}`,
    GSI1PK: `PROJECT#${report.project_id}`,
    GSI1SK: `DATE#${report.report_date}`,

    report_id: report.report_id,
    project_id: report.project_id,
    project_name: report.project_name,
    report_date: report.report_date,

    // Quality issues from AI analysis
    quality_issues: qualityMetrics.quality_issues || [],
    coordination_issues: qualityMetrics.coordination_issues || [],
    production_metrics: qualityMetrics.production_metrics || {},

    created_at: timestamp,
    ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year retention
  };

  await docClient.send(new PutCommand({
    TableName: 'sitelogix-analytics',
    Item: item
  }));

  console.log(`✅ Stored quality metrics`);
}

/**
 * Calculate project health summary
 */
function calculateProjectHealth(analysis, history) {
  const health = analysis.project_health || {};

  // Calculate inspection pass rate from history
  if (history.length > 0) {
    const passed = history.filter(h => h.status === 'passed').length;
    const total = history.length;
    health.historical_pass_rate = ((passed / total) * 100).toFixed(1);
  }

  // Calculate average cycle time
  const validCycleTimes = history.filter(h => h.cycle_time_days > 0);
  if (validCycleTimes.length > 0) {
    const avgCycleTime = validCycleTimes.reduce((sum, h) => sum + h.cycle_time_days, 0) / validCycleTimes.length;
    health.average_cycle_time_days = avgCycleTime.toFixed(1);
  }

  return health;
}

/**
 * Store project health summary
 */
async function storeProjectHealth(report, healthSummary) {
  const timestamp = new Date().toISOString();

  const item = {
    PK: `PROJECT_HEALTH#${report.project_id}`,
    SK: `DATE#${report.report_date}`,
    GSI1PK: `PROJECT#${report.project_id}`,
    GSI1SK: `DATE#${report.report_date}`,

    report_id: report.report_id,
    project_id: report.project_id,
    project_name: report.project_name,
    report_date: report.report_date,

    // Health scores
    overall_quality_score: healthSummary.overall_quality_score || 0,
    quality_reasoning: healthSummary.quality_reasoning,
    schedule_performance_score: healthSummary.schedule_performance_score || 0,
    schedule_reasoning: healthSummary.schedule_reasoning,

    // Trends
    inspection_pass_rate_trend: healthSummary.inspection_pass_rate_trend,
    historical_pass_rate: healthSummary.historical_pass_rate,
    average_cycle_time_days: healthSummary.average_cycle_time_days,

    // Risks
    top_quality_risks: healthSummary.top_quality_risks || [],
    top_schedule_risks: healthSummary.top_schedule_risks || [],

    created_at: timestamp,
    ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year retention
  };

  await docClient.send(new PutCommand({
    TableName: 'sitelogix-analytics',
    Item: item
  }));

  console.log(`✅ Stored project health summary`);
}

/**
 * Get project inspection history
 */
async function getProjectInspectionHistory(projectId, days = 90) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `INSPECTION#${projectId}`
      },
      ScanIndexForward: false, // Most recent first
      Limit: 50
    }));

    return result.Items || [];
  } catch (error) {
    console.error('Error fetching inspection history:', error);
    return [];
  }
}

/**
 * Get project milestones
 */
async function getProjectMilestones(projectId, status = null) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      KeyConditionExpression: 'PK = :pk',
      FilterExpression: status ? '#status = :status' : undefined,
      ExpressionAttributeNames: status ? { '#status': 'status' } : undefined,
      ExpressionAttributeValues: {
        ':pk': `MILESTONE#${projectId}`,
        ...(status && { ':status': status })
      },
      ScanIndexForward: false // Most recent first
    }));

    return result.Items || [];
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return [];
  }
}

/**
 * Get project health metrics
 */
async function getProjectHealth(projectId, days = 30) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `PROJECT_HEALTH#${projectId}`
      },
      ScanIndexForward: false, // Most recent first
      Limit: days
    }));

    return result.Items || [];
  } catch (error) {
    console.error('Error fetching project health:', error);
    return [];
  }
}

module.exports = {
  analyzeProjectMilestones,
  getProjectInspectionHistory,
  getProjectMilestones,
  getProjectHealth
};
