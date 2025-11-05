// Analytics Agent: Constraint Cost & Impact Analysis
// Quantifies financial impact of delays, categorizes root causes, identifies prevention opportunities

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const OpenAI = require('openai');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Standard labor rate for cost calculations
const BLENDED_LABOR_RATE = 50; // $50/hour blended rate for cost impact

/**
 * Analyze constraints and quantify their cost impact
 */
async function analyzeConstraintCosts(report) {
  console.log(`💰 Analyzing constraint costs for report ${report.report_id}`);

  // Parse extracted_data if it's a JSON string
  const extractedData = typeof report.extracted_data === 'string'
    ? JSON.parse(report.extracted_data)
    : (report.extracted_data || {});

  const transcript = report.transcript || '';
  const issues = extractedData.issues || [];
  const constraints = extractedData.constraints || [];

  if (issues.length === 0 && constraints.length === 0) {
    console.log('ℹ️ No constraints or issues to analyze');
    return { constraints: [], cost_summary: { total_cost_impact: 0 } };
  }

  // Get historical constraint data for pattern recognition
  const history = await getConstraintHistory(report.project_id, 90); // Last 90 days

  // Use OpenAI to analyze constraints with financial quantification
  const analysis = await analyzeWithAI(report, transcript, issues, constraints, history);

  // Store individual constraints
  const storedConstraints = [];
  for (const constraint of analysis.constraints || []) {
    await storeConstraint(report, constraint);
    storedConstraints.push(constraint);
  }

  // Calculate and store cost summary
  const costSummary = calculateCostSummary(analysis.constraints || []);
  await storeConstraintSummary(report, costSummary, analysis.patterns || {});

  return {
    constraints: storedConstraints,
    cost_summary: costSummary,
    patterns: analysis.patterns || {}
  };
}

/**
 * Use OpenAI to analyze constraints and quantify costs
 */
async function analyzeWithAI(report, transcript, issues, constraints, history) {
  const prompt = `You are analyzing a construction daily report to extract comprehensive CONSTRAINT & COST IMPACT INTELLIGENCE for CEO/COO-level business analytics and cost control.

Report Date: ${report.report_date}
Project: ${report.project_name || report.project_id}

Full Transcript:
${transcript}

Extracted Issues:
${JSON.stringify(issues, null, 2)}

Extracted Constraints:
${JSON.stringify(constraints, null, 2)}

Historical Constraints (last 90 days): ${history.length} events
${history.length > 0 ? 'Recent patterns: ' + JSON.stringify(history.slice(0, 5), null, 2) : 'No historical data'}

Extract COMPREHENSIVE CONSTRAINT & COST INTELLIGENCE:

## 1. CONSTRAINT IDENTIFICATION

For EACH constraint, delay, or productivity issue mentioned:

**Constraint Details:**
- Description (be specific, e.g., "Waited 2 hours for electrical trade to clear area")
- Category: "environmental" | "coordination" | "technical" | "vendor" | "material" | "inspection" | "safety" | "design"
- Sub-category (e.g., "heat", "rain", "trade_access", "equipment_failure", "material_shortage")

**Time Impact:**
- Hours lost (total crew downtime, be precise)
- Crew size affected (how many workers idle)
- Date of occurrence
- Duration (start time to end time if mentioned)

**Financial Impact:**
- Labor cost impact ($hours_lost × crew_size × $${BLENDED_LABOR_RATE}/hour)
- Material waste/damage cost (if applicable)
- Equipment rental waste cost (if applicable)
- Rework cost (if applicable)
- **Total cost impact** (sum of all above)

**Root Cause Analysis:**
- Primary cause (be specific: "heat index >95°F", "Lamke Electric delayed access", "concrete delivery 3 hrs late")
- Contributing factors (what made it worse)
- Responsible party (vendor name, trade, weather, design team, etc.)

**Preventability Assessment:**
- Was this preventable? (yes/no/partially)
- Prevention opportunity (specific action to prevent recurrence)
- Prevention cost estimate (cost to implement prevention)
- **Prevention ROI** (cost saved vs implementation cost)

**Schedule Impact:**
- Critical path affected? (yes/no)
- Schedule days delayed
- Milestone impact (which milestone affected)
- Recovery plan (how to make up time)

**Pattern Recognition:**
- Is this a recurring issue? (yes/no)
- Frequency (if recurring: "3rd occurrence this month")
- Trend (increasing/stable/decreasing)

## 2. ENVIRONMENTAL CONSTRAINTS (CRITICAL)

**Heat-Related:**
- Heat index mentioned? (temperature)
- Early departures due to heat?
- Crew members affected
- Hours lost per person
- Total heat-related cost

**Weather:**
- Rain/flooding delays?
- Lightning shutdowns?
- High wind stops?
- Hours lost and cost impact

**HVAC/Conditions:**
- Ventilation issues?
- Temperature control problems?
- Working condition impacts?

## 3. COORDINATION CONSTRAINTS

**Trade Delays:**
- Which trade caused delay?
- Access denied? Coordination failure?
- Hours waiting
- Cost impact

**Equipment Conflicts:**
- Equipment availability issues?
- Lift/crane scheduling conflicts?
- Shared resource conflicts?

**Communication Gaps:**
- Missing information?
- Unclear instructions?
- Notification failures?

## 4. VENDOR/MATERIAL CONSTRAINTS

**Late Deliveries:**
- Vendor name
- Material expected vs actual time
- Hours crew idle waiting
- Cost impact

**Wrong/Damaged Materials:**
- What was wrong?
- Return/replacement time
- Rework required?
- Cost impact

## 5. TECHNICAL CONSTRAINTS

**Equipment Failures:**
- Equipment type
- Failure description
- Downtime duration
- Repair cost + lost productivity

**Design Issues:**
- Model errors? Field conflicts?
- Drawing discrepancies?
- Resolution time and cost

## 6. INSPECTION CONSTRAINTS

**Waiting for Inspection:**
- Inspection type
- Wait time
- Crew idle cost

**Failed Inspection Rework:**
- Already captured in Agent 3, but note if cost impact mentioned

## 7. COST SUMMARY & PATTERNS

**Total Cost Impact by Category:**
- Environmental: $X
- Coordination: $Y
- Vendor: $Z
- (etc for all categories)

**Top 3 Cost Drivers This Report:**
- #1: Category - Description - $Cost
- #2: ...
- #3: ...

**Pattern Analysis:**
- Recurring issues (list with frequency)
- Emerging trends (new problems appearing)
- Improvement areas (problems being solved)

**Prevention Opportunities:**
- List top 3-5 opportunities with ROI

**CRITICAL COST CALCULATION RULES:**
- Always quantify hours lost precisely
- Apply crew size multiplier
- Use $${BLENDED_LABOR_RATE}/hour blended rate
- Include material/equipment costs if mentioned
- Calculate prevention ROI (savings vs implementation cost)
- Flag recurring issues (2+ occurrences = pattern)

Return a JSON object with this ENHANCED structure:
{
  "constraints": [
    {
      "description": "Crew waited 2 hours for Lamke Electric to clear work area",
      "category": "coordination",
      "sub_category": "trade_access",
      "date": "2024-07-12",
      "hours_lost": 2.0,
      "crew_size": 4,
      "duration": "10:00 AM - 12:00 PM",
      "labor_cost_impact": 400,
      "material_cost_impact": 0,
      "equipment_cost_impact": 0,
      "rework_cost": 0,
      "total_cost_impact": 400,
      "root_cause": "Lamke Electric delayed access to Level 2C work area",
      "contributing_factors": ["Late arrival", "Lack of advance coordination"],
      "responsible_party": "Lamke Electric",
      "preventable": true,
      "prevention_opportunity": "Implement daily coordination meeting with all trades",
      "prevention_cost_estimate": 200,
      "prevention_roi": 2.0,
      "critical_path_affected": false,
      "schedule_days_delayed": 0,
      "milestone_impact": null,
      "recovery_plan": "Worked overtime to make up lost time",
      "recurring": false,
      "frequency": null,
      "trend": "stable",
      "severity": "medium",
      "confidence": 0.90
    },
    {
      "description": "Heat index exceeded 95°F causing early crew departure",
      "category": "environmental",
      "sub_category": "heat",
      "date": "2024-07-21",
      "hours_lost": 1.5,
      "crew_size": 8,
      "duration": "3:00 PM - 4:30 PM",
      "labor_cost_impact": 600,
      "material_cost_impact": 0,
      "equipment_cost_impact": 0,
      "rework_cost": 0,
      "total_cost_impact": 600,
      "root_cause": "Heat index >95°F creating unsafe working conditions",
      "contributing_factors": ["Afternoon peak temperatures", "Outdoor work"],
      "responsible_party": "Weather/Environmental",
      "preventable": "partially",
      "prevention_opportunity": "Implement early start times (6 AM) during summer months",
      "prevention_cost_estimate": 500,
      "prevention_roi": 10.0,
      "critical_path_affected": false,
      "schedule_days_delayed": 0,
      "milestone_impact": null,
      "recovery_plan": "Extended hours on cooler days",
      "recurring": true,
      "frequency": "11 occurrences this month",
      "trend": "increasing",
      "severity": "high",
      "confidence": 0.95
    }
  ],
  "cost_summary": {
    "total_constraints": 15,
    "total_hours_lost": 45.5,
    "total_labor_cost": 11375,
    "total_material_cost": 2400,
    "total_equipment_cost": 800,
    "total_rework_cost": 3200,
    "total_cost_impact": 17775,
    "cost_by_category": {
      "environmental": 8500,
      "coordination": 4200,
      "vendor": 3075,
      "technical": 1500,
      "material": 500
    },
    "top_cost_drivers": [
      "Environmental (heat): $8,500",
      "Coordination delays: $4,200",
      "Vendor delays: $3,075"
    ]
  },
  "patterns": {
    "recurring_issues": [
      {
        "issue": "Heat-related early departures",
        "frequency": 11,
        "total_cost": 8500,
        "trend": "increasing",
        "priority": "urgent"
      },
      {
        "issue": "Trade coordination delays",
        "frequency": 5,
        "total_cost": 4200,
        "trend": "stable",
        "priority": "high"
      }
    ],
    "emerging_trends": [
      "Increased heat impact in July",
      "Recurring electrical trade coordination issues"
    ],
    "improvement_areas": [
      "Model accuracy improving (fewer conflicts)"
    ],
    "top_prevention_opportunities": [
      {
        "opportunity": "Implement heat mitigation policy with early starts",
        "estimated_savings_per_month": 8500,
        "implementation_cost": 500,
        "roi": 17.0,
        "priority": "urgent"
      },
      {
        "opportunity": "Daily trade coordination meetings",
        "estimated_savings_per_month": 4200,
        "implementation_cost": 200,
        "roi": 21.0,
        "priority": "high"
      }
    ]
  },
  "confidence": 0.90,
  "reasoning": "Clear constraint descriptions with specific time/crew impacts documented"
}`;

  try {
    console.log('🤖 Calling OpenAI GPT-4o for constraint cost analysis...');
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert construction cost analyst and operations manager. You excel at quantifying the financial impact of delays, identifying root causes, and calculating ROI for prevention opportunities. Be precise with numbers and conservative with cost estimates.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 4000
    });

    const duration = Date.now() - startTime;
    console.log(`✅ OpenAI response received in ${duration}ms`);

    return JSON.parse(completion.choices[0].message.content);

  } catch (error) {
    console.error('❌ Error calling OpenAI:', error);
    return {
      constraints: [],
      cost_summary: { total_cost_impact: 0 },
      patterns: {}
    };
  }
}

/**
 * Store constraint in DynamoDB
 */
async function storeConstraint(report, constraint) {
  const timestamp = new Date().toISOString();
  const constraintId = `constraint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const item = {
    PK: `CONSTRAINT#${report.project_id}`,
    SK: `DATE#${constraint.date || report.report_date}#${constraintId}`,
    GSI1PK: `CATEGORY#${constraint.category}`,
    GSI1SK: constraint.total_cost_impact,
    GSI2PK: `PROJECT#${report.project_id}`,
    GSI2SK: `COST#${constraint.total_cost_impact}`,

    // Core identification
    constraint_id: constraintId,
    report_id: report.report_id,
    project_id: report.project_id,
    project_name: report.project_name,
    report_date: report.report_date,

    // Constraint details
    description: constraint.description,
    category: constraint.category,
    sub_category: constraint.sub_category,
    date: constraint.date,
    duration: constraint.duration,

    // Time impact
    hours_lost: constraint.hours_lost || 0,
    crew_size: constraint.crew_size || 0,

    // Cost impact
    labor_cost_impact: constraint.labor_cost_impact || 0,
    material_cost_impact: constraint.material_cost_impact || 0,
    equipment_cost_impact: constraint.equipment_cost_impact || 0,
    rework_cost: constraint.rework_cost || 0,
    total_cost_impact: constraint.total_cost_impact || 0,

    // Root cause
    root_cause: constraint.root_cause,
    contributing_factors: constraint.contributing_factors || [],
    responsible_party: constraint.responsible_party,

    // Preventability
    preventable: constraint.preventable,
    prevention_opportunity: constraint.prevention_opportunity,
    prevention_cost_estimate: constraint.prevention_cost_estimate || 0,
    prevention_roi: constraint.prevention_roi || 0,

    // Schedule impact
    critical_path_affected: constraint.critical_path_affected || false,
    schedule_days_delayed: constraint.schedule_days_delayed || 0,
    milestone_impact: constraint.milestone_impact,
    recovery_plan: constraint.recovery_plan,

    // Pattern tracking
    recurring: constraint.recurring || false,
    frequency: constraint.frequency,
    trend: constraint.trend,

    // Severity
    severity: constraint.severity,
    confidence: constraint.confidence || 0,

    // Metadata
    created_at: timestamp,
    ttl: Math.floor(Date.now() / 1000) + (730 * 24 * 60 * 60) // 2 years retention
  };

  await docClient.send(new PutCommand({
    TableName: 'sitelogix-analytics',
    Item: item
  }));
}

/**
 * Calculate cost summary
 */
function calculateCostSummary(constraints) {
  const summary = {
    total_constraints: constraints.length,
    total_hours_lost: 0,
    total_labor_cost: 0,
    total_material_cost: 0,
    total_equipment_cost: 0,
    total_rework_cost: 0,
    total_cost_impact: 0,
    cost_by_category: {},
    top_cost_drivers: []
  };

  for (const constraint of constraints) {
    summary.total_hours_lost += constraint.hours_lost || 0;
    summary.total_labor_cost += constraint.labor_cost_impact || 0;
    summary.total_material_cost += constraint.material_cost_impact || 0;
    summary.total_equipment_cost += constraint.equipment_cost_impact || 0;
    summary.total_rework_cost += constraint.rework_cost || 0;
    summary.total_cost_impact += constraint.total_cost_impact || 0;

    // Aggregate by category
    const category = constraint.category;
    if (!summary.cost_by_category[category]) {
      summary.cost_by_category[category] = 0;
    }
    summary.cost_by_category[category] += constraint.total_cost_impact || 0;
  }

  // Calculate top cost drivers
  const categoryArray = Object.entries(summary.cost_by_category)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  summary.top_cost_drivers = categoryArray.map(([cat, cost]) =>
    `${cat}: $${cost.toFixed(0)}`
  );

  return summary;
}

/**
 * Store constraint summary
 */
async function storeConstraintSummary(report, costSummary, patterns) {
  const timestamp = new Date().toISOString();

  const item = {
    PK: `CONSTRAINT_SUMMARY#${report.project_id}`,
    SK: `DATE#${report.report_date}`,
    GSI1PK: `PROJECT#${report.project_id}`,
    GSI1SK: `DATE#${report.report_date}`,

    report_id: report.report_id,
    project_id: report.project_id,
    project_name: report.project_name,
    report_date: report.report_date,

    // Cost summary
    total_constraints: costSummary.total_constraints,
    total_hours_lost: costSummary.total_hours_lost,
    total_labor_cost: costSummary.total_labor_cost,
    total_material_cost: costSummary.total_material_cost,
    total_equipment_cost: costSummary.total_equipment_cost,
    total_rework_cost: costSummary.total_rework_cost,
    total_cost_impact: costSummary.total_cost_impact,
    cost_by_category: costSummary.cost_by_category,
    top_cost_drivers: costSummary.top_cost_drivers,

    // Patterns
    recurring_issues: patterns.recurring_issues || [],
    emerging_trends: patterns.emerging_trends || [],
    improvement_areas: patterns.improvement_areas || [],
    top_prevention_opportunities: patterns.top_prevention_opportunities || [],

    created_at: timestamp,
    ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year retention
  };

  await docClient.send(new PutCommand({
    TableName: 'sitelogix-analytics',
    Item: item
  }));

  console.log(`✅ Stored constraint summary with $${costSummary.total_cost_impact.toFixed(0)} total impact`);
}

/**
 * Get constraint history for pattern analysis
 */
async function getConstraintHistory(projectId, days = 90) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `CONSTRAINT#${projectId}`
      },
      ScanIndexForward: false, // Most recent first
      Limit: 100
    }));

    return result.Items || [];
  } catch (error) {
    console.error('Error fetching constraint history:', error);
    return [];
  }
}

/**
 * Get constraints by category for reporting
 */
async function getConstraintsByCategory(category, limit = 50) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :category',
      ExpressionAttributeValues: {
        ':category': `CATEGORY#${category}`
      },
      ScanIndexForward: false, // Highest cost first
      Limit: limit
    }));

    return result.Items || [];
  } catch (error) {
    console.error('Error fetching constraints by category:', error);
    return [];
  }
}

/**
 * Get constraint summaries for project
 */
async function getConstraintSummaries(projectId, days = 30) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `CONSTRAINT_SUMMARY#${projectId}`
      },
      ScanIndexForward: false, // Most recent first
      Limit: days
    }));

    return result.Items || [];
  } catch (error) {
    console.error('Error fetching constraint summaries:', error);
    return [];
  }
}

module.exports = {
  analyzeConstraintCosts,
  getConstraintHistory,
  getConstraintsByCategory,
  getConstraintSummaries,
  BLENDED_LABOR_RATE
};
