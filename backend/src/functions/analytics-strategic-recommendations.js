// Analytics Agent: Strategic Recommendations Engine
// Synthesizes insights from all agents and generates executive-level recommendations

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const OpenAI = require('openai');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate strategic recommendations by analyzing patterns across all agents
 */
async function generateStrategicRecommendations(report, agentOutputs) {
  console.log(`🎯 Generating strategic recommendations for report ${report.report_id}`);

  // Gather analytics from all agents
  const personnelAnalysis = agentOutputs.personnel || {};
  const vendorAnalysis = agentOutputs.vendors || {};
  const milestoneAnalysis = agentOutputs.milestones || {};
  const constraintAnalysis = agentOutputs.constraints || {};

  // Get historical data for trend analysis
  const historical = await gatherHistoricalData(report.project_id, 90);

  // Use OpenAI to synthesize cross-agent insights
  const recommendations = await synthesizeWithAI(
    report,
    personnelAnalysis,
    vendorAnalysis,
    milestoneAnalysis,
    constraintAnalysis,
    historical
  );

  // Store recommendations
  await storeRecommendations(report, recommendations);

  // Store executive summary
  await storeExecutiveSummary(report, recommendations, agentOutputs);

  return recommendations;
}

/**
 * Use OpenAI to synthesize strategic recommendations
 */
async function synthesizeWithAI(report, personnel, vendors, milestones, constraints, historical) {
  const prompt = `You are a strategic construction business advisor analyzing data for CEO/COO/CFO-level STRATEGIC DECISION MAKING.

You have access to comprehensive analytics from multiple intelligence agents. Your job is to:
1. Identify cross-functional patterns and opportunities
2. Generate actionable executive recommendations
3. Quantify ROI for each recommendation
4. Prioritize by business impact

## PROJECT CONTEXT

**Report Date:** ${report.report_date}
**Project:** ${report.project_name || report.project_id}

## AGENT INTELLIGENCE SUMMARIES

### AGENT 1: Personnel Intelligence
${JSON.stringify(personnel.summary || {}, null, 2)}

Top Personnel Insights:
- Total OT Hours: ${personnel.summary?.total_overtime_hours || 0}
- Total DT Hours: ${personnel.summary?.total_double_time_hours || 0}
- Weekend Crew Count: ${personnel.summary?.weekend_crew_count || 0}
- Heat Early Departures: ${personnel.summary?.heat_early_departures || 0}
- Total Labor Cost: $${personnel.summary?.total_cost || 0}
- Top OT Workers: ${JSON.stringify(personnel.summary?.top_ot_workers || [])}

### AGENT 2: Vendor Performance
${JSON.stringify(vendors.vendors || [], null, 2)}

Vendor Summary:
- Total Vendors Active: ${vendors.vendors?.length || 0}
- Vendors with Incidents: ${vendors.vendors?.filter(v => v.ai_analysis?.incidents?.length > 0).length || 0}
- Total Chargeback Amount: $${vendors.vendors?.reduce((sum, v) => sum + (v.ai_analysis?.financial_attribution?.chargeback_amount || 0), 0) || 0}
- Vendors Grade C or Below: ${vendors.vendors?.filter(v => ['C', 'D'].includes(v.ai_analysis?.performance_grade)).length || 0}

### AGENT 3: Project Milestones & Quality
${JSON.stringify(milestones.project_health || {}, null, 2)}

Quality Summary:
- Inspections Performed: ${milestones.inspections?.length || 0}
- Inspections Passed: ${milestones.inspections?.filter(i => i.status === 'passed').length || 0}
- Inspections Failed: ${milestones.inspections?.filter(i => i.status === 'failed').length || 0}
- Milestones Completed: ${milestones.milestones?.filter(m => m.status === 'completed').length || 0}
- Milestones At Risk: ${milestones.milestones?.filter(m => m.status === 'at_risk').length || 0}
- Quality Score: ${milestones.project_health?.overall_quality_score || 0}/100
- Schedule Score: ${milestones.project_health?.schedule_performance_score || 0}/100

### AGENT 4: Constraint Costs
${JSON.stringify(constraints.cost_summary || {}, null, 2)}

Constraint Summary:
- Total Constraints: ${constraints.cost_summary?.total_constraints || 0}
- Total Hours Lost: ${constraints.cost_summary?.total_hours_lost || 0}
- Total Cost Impact: $${constraints.cost_summary?.total_cost_impact || 0}
- Top Cost Drivers: ${JSON.stringify(constraints.cost_summary?.top_cost_drivers || [])}
- Recurring Issues: ${JSON.stringify(constraints.patterns?.recurring_issues || [])}

### HISTORICAL TRENDS (Last 90 Days)
${JSON.stringify(historical.trends || {}, null, 2)}

## YOUR STRATEGIC ANALYSIS TASK

Analyze ALL agent data to identify:

### 1. CROSS-FUNCTIONAL PATTERNS

Look for connections across agents:
- Does vendor performance affect schedule (late deliveries → delays)?
- Do heat constraints drive OT costs (early outs → make-up OT)?
- Do quality issues correlate with specific vendors or personnel?
- Do coordination delays link to specific trades or patterns?

### 2. COST REDUCTION OPPORTUNITIES

Identify specific, actionable opportunities:
- Policy changes (e.g., "Implement early start times during summer")
- Process improvements (e.g., "Daily trade coordination meetings")
- Vendor management (e.g., "Replace Vendor X", "Negotiate better terms")
- Technology adoption (e.g., "Ground-penetrating radar for excavation")
- Training needs (e.g., "Quality control training for layout crew")

For EACH opportunity, calculate:
- Estimated monthly savings
- Implementation cost
- ROI (savings / cost)
- Implementation timeline
- Priority level (urgent/high/medium/low)

### 3. RISK ESCALATIONS

Identify risks requiring immediate executive attention:
- Vendor relationships at risk (Grade D vendors)
- Safety patterns requiring intervention
- Schedule risks to critical milestones
- Quality trends declining
- Cost overruns exceeding thresholds
- Recurring high-cost constraints

### 4. PERFORMANCE RECOGNITION

Identify positive patterns worth recognizing:
- High-performing personnel
- Excellent vendor relationships
- Quality improvements
- Cost reduction successes
- Schedule achievements

### 5. STRATEGIC RECOMMENDATIONS

Generate 5-10 prioritized recommendations:

**Priority Levels:**
- **URGENT**: Requires immediate action (safety, critical vendor, major cost driver)
- **HIGH**: Should be addressed this month (significant ROI, recurring issues)
- **MEDIUM**: Address within quarter (good ROI, process improvements)
- **LOW**: Long-term improvements (nice to have, low ROI)

**Recommendation Categories:**
- **Cost Control**: Labor, materials, equipment optimization
- **Vendor Management**: Performance, relationships, replacements
- **Quality Improvement**: Processes, training, prevention
- **Schedule Optimization**: Coordination, planning, resources
- **Safety & Compliance**: Policies, training, environment
- **Technology Adoption**: Tools, systems, automation

Return a JSON object with this ENHANCED structure:
{
  "executive_summary": {
    "overall_health_score": 75,
    "health_reasoning": "Project performing well with notable heat impact requiring policy intervention",
    "top_wins": [
      "Quality score improved 10 points this month",
      "Ferguson delivery performance: 100% on-time"
    ],
    "top_concerns": [
      "Heat-related costs: $8,500 this month",
      "Luth Plumbing: $2,500 chargeback pending"
    ],
    "financial_snapshot": {
      "labor_cost_variance": "+12.3%",
      "constraint_cost": 17775,
      "chargeback_pipeline": 2500,
      "potential_monthly_savings": 15000
    }
  },
  "cross_functional_patterns": [
    {
      "pattern": "Heat constraints drive OT costs",
      "description": "11 heat-related early departures (avg 1.5 hrs/person) are being compensated with OT on cooler days, driving OT from 10% target to 13.8%",
      "agents_involved": ["Personnel", "Constraints"],
      "cost_impact": 8500,
      "insight": "Environmental constraints directly increasing labor costs through OT recovery",
      "confidence": 0.95
    }
  ],
  "cost_reduction_opportunities": [
    {
      "opportunity": "Implement heat mitigation policy with early start times",
      "category": "cost_control",
      "description": "Start work at 6 AM during summer months (June-Aug) to complete 8 hours before peak heat. Eliminates early departures and OT recovery costs.",
      "estimated_monthly_savings": 8500,
      "implementation_cost": 500,
      "roi": 17.0,
      "implementation_timeline": "1-2 weeks",
      "priority": "urgent",
      "confidence": 0.90,
      "action_steps": [
        "Develop heat index policy",
        "Get crew buy-in for early starts",
        "Update project schedules",
        "Communicate to GC and trades"
      ],
      "success_metrics": [
        "Zero heat-related early departures",
        "OT reduced from 13.8% to 10% target",
        "Monthly savings of $8,500"
      ]
    },
    {
      "opportunity": "Pursue charge-back for Luth incident and reassess vendor relationship",
      "category": "vendor_management",
      "description": "Formal charge-back process for Extra #22935 ($2,500) and performance improvement plan. Consider alternative vendors for critical work.",
      "estimated_monthly_savings": 2500,
      "implementation_cost": 200,
      "roi": 12.5,
      "implementation_timeline": "2-4 weeks",
      "priority": "high",
      "confidence": 0.85,
      "action_steps": [
        "Submit formal charge-back documentation",
        "Schedule vendor performance meeting",
        "Establish 90-day improvement plan",
        "Identify alternative vendors for competitive bids"
      ],
      "success_metrics": [
        "$2,500 charge-back recovered",
        "Zero incidents in next 90 days",
        "Grade improvement to B or replacement"
      ]
    }
  ],
  "risk_escalations": [
    {
      "risk_type": "cost_overrun",
      "severity": "high",
      "title": "Labor cost 12.3% over target",
      "description": "Labor costs at $182k vs $165k target primarily driven by heat-related OT. Without intervention, projected to exceed budget by $50k annually.",
      "impact": "Budget variance, margin compression",
      "recommended_action": "Implement heat mitigation policy immediately",
      "owner": "COO / Project Manager",
      "timeline": "Immediate - within 1 week",
      "confidence": 0.90
    },
    {
      "risk_type": "vendor_performance",
      "severity": "medium",
      "title": "Luth Plumbing performance grade: C",
      "description": "Major damage incident with $2,500 cost impact. Vendor relationship at risk if performance doesn't improve.",
      "impact": "Potential future incidents, schedule delays, additional costs",
      "recommended_action": "Formal improvement plan or vendor replacement",
      "owner": "Procurement / Project Manager",
      "timeline": "30 days",
      "confidence": 0.85
    }
  ],
  "performance_recognition": [
    {
      "category": "vendor",
      "entity": "Ferguson Enterprises",
      "achievement": "100% on-time delivery, Grade A performance",
      "impact": "Zero delivery delays, reliable scheduling",
      "recommendation": "Preferred vendor status, consider expanded scope"
    },
    {
      "category": "personnel",
      "entity": "Bryan Nash (Superintendent)",
      "achievement": "Consistent high-quality reporting, effective trade coordination",
      "impact": "Excellent documentation quality enables analytics",
      "recommendation": "Recognition for documentation excellence"
    }
  ],
  "strategic_recommendations": [
    {
      "priority": "urgent",
      "category": "cost_control",
      "title": "Implement Summer Heat Mitigation Policy",
      "problem": "Heat-related early departures costing $8,500/month in lost productivity and OT recovery",
      "solution": "Early start times (6 AM) June-Aug, mandatory cool-down breaks",
      "expected_outcome": "Eliminate heat-related early departures, reduce OT to 10% target",
      "roi": 17.0,
      "investment_required": "$500 (policy development, communication)",
      "monthly_savings": "$8,500",
      "implementation_owner": "COO / Safety Manager",
      "timeline": "1-2 weeks",
      "success_metrics": [
        "Zero heat departures",
        "OT at or below 10%",
        "$8,500 monthly savings achieved"
      ]
    },
    {
      "priority": "high",
      "category": "vendor_management",
      "title": "Vendor Scorecard Implementation & Luth Improvement Plan",
      "problem": "No formal vendor performance management. Luth incident cost $2,500.",
      "solution": "Implement A/B/C/D vendor scorecard, monthly reviews, improvement plans for C/D vendors",
      "expected_outcome": "Better vendor accountability, early problem detection, cost recovery",
      "roi": 12.5,
      "investment_required": "$200 (process setup)",
      "monthly_savings": "$2,500+ (charge-backs + prevention)",
      "implementation_owner": "Procurement / COO",
      "timeline": "2-4 weeks",
      "success_metrics": [
        "All vendors graded monthly",
        "Improvement plans for C/D vendors",
        "Charge-back recovery process established"
      ]
    },
    {
      "priority": "high",
      "category": "schedule_optimization",
      "title": "Daily Trade Coordination Meeting",
      "problem": "Trade coordination delays costing $4,200/month",
      "solution": "15-minute daily coordination meeting with all active trades",
      "expected_outcome": "Eliminate coordination delays, improve resource allocation",
      "roi": 21.0,
      "investment_required": "$200 (meeting time)",
      "monthly_savings": "$4,200",
      "implementation_owner": "Project Manager / Superintendent",
      "timeline": "Immediate",
      "success_metrics": [
        "Zero trade coordination delays",
        "$4,200 monthly savings"
      ]
    }
  ],
  "key_metrics_summary": {
    "total_cost_reduction_potential": 15200,
    "total_implementation_cost": 900,
    "portfolio_roi": 16.9,
    "urgent_actions": 1,
    "high_priority_actions": 3,
    "medium_priority_actions": 2
  },
  "confidence": 0.90,
  "analysis_date": "${new Date().toISOString()}"
}`;

  try {
    console.log('🤖 Calling OpenAI GPT-4o for strategic synthesis...');
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a strategic construction business advisor with expertise in operations, finance, and project management. You excel at identifying patterns across multiple data sources, quantifying ROI for improvements, and generating actionable executive recommendations. Focus on insights that drive business outcomes: cost reduction, quality improvement, schedule optimization, and risk mitigation.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4, // Balanced for creative insights while maintaining accuracy
      max_tokens: 4000
    });

    const duration = Date.now() - startTime;
    console.log(`✅ OpenAI strategic synthesis completed in ${duration}ms`);

    return JSON.parse(completion.choices[0].message.content);

  } catch (error) {
    console.error('❌ Error generating strategic recommendations:', error);
    return {
      executive_summary: {},
      cross_functional_patterns: [],
      cost_reduction_opportunities: [],
      risk_escalations: [],
      performance_recognition: [],
      strategic_recommendations: [],
      key_metrics_summary: {}
    };
  }
}

/**
 * Gather historical data for trend analysis
 */
async function gatherHistoricalData(projectId, days = 90) {
  try {
    // This would gather aggregated data from all agents
    // For now, return basic structure
    return {
      trends: {
        labor_cost_trend: "increasing",
        quality_trend: "stable",
        vendor_performance_trend: "stable",
        constraint_frequency_trend: "increasing"
      }
    };
  } catch (error) {
    console.error('Error gathering historical data:', error);
    return { trends: {} };
  }
}

/**
 * Store strategic recommendations
 */
async function storeRecommendations(report, recommendations) {
  const timestamp = new Date().toISOString();

  const item = {
    PK: `RECOMMENDATIONS#${report.project_id}`,
    SK: `DATE#${report.report_date}`,
    GSI1PK: `PROJECT#${report.project_id}`,
    GSI1SK: `DATE#${report.report_date}`,

    report_id: report.report_id,
    project_id: report.project_id,
    project_name: report.project_name,
    report_date: report.report_date,

    // Strategic recommendations
    cross_functional_patterns: recommendations.cross_functional_patterns || [],
    cost_reduction_opportunities: recommendations.cost_reduction_opportunities || [],
    risk_escalations: recommendations.risk_escalations || [],
    performance_recognition: recommendations.performance_recognition || [],
    strategic_recommendations: recommendations.strategic_recommendations || [],

    // Metrics
    key_metrics_summary: recommendations.key_metrics_summary || {},
    confidence: recommendations.confidence || 0,

    created_at: timestamp,
    ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year retention
  };

  await docClient.send(new PutCommand({
    TableName: 'sitelogix-analytics',
    Item: item
  }));

  console.log(`✅ Stored ${recommendations.strategic_recommendations?.length || 0} strategic recommendations`);
}

/**
 * Store executive summary
 */
async function storeExecutiveSummary(report, recommendations, agentOutputs) {
  const timestamp = new Date().toISOString();

  const item = {
    PK: `EXECUTIVE_SUMMARY#${report.project_id}`,
    SK: `DATE#${report.report_date}`,
    GSI1PK: `DATE#${report.report_date}`,
    GSI1SK: timestamp,

    report_id: report.report_id,
    project_id: report.project_id,
    project_name: report.project_name,
    report_date: report.report_date,

    // Executive summary
    overall_health_score: recommendations.executive_summary?.overall_health_score || 0,
    health_reasoning: recommendations.executive_summary?.health_reasoning,
    top_wins: recommendations.executive_summary?.top_wins || [],
    top_concerns: recommendations.executive_summary?.top_concerns || [],
    financial_snapshot: recommendations.executive_summary?.financial_snapshot || {},

    // Quick stats
    urgent_actions_count: recommendations.strategic_recommendations?.filter(r => r.priority === 'urgent').length || 0,
    high_priority_actions_count: recommendations.strategic_recommendations?.filter(r => r.priority === 'high').length || 0,
    total_cost_reduction_potential: recommendations.key_metrics_summary?.total_cost_reduction_potential || 0,
    portfolio_roi: recommendations.key_metrics_summary?.portfolio_roi || 0,

    // Agent summaries for quick reference
    total_labor_cost: agentOutputs.personnel?.summary?.total_cost || 0,
    total_constraint_cost: agentOutputs.constraints?.cost_summary?.total_cost_impact || 0,
    chargeback_pipeline: agentOutputs.vendors?.vendors?.reduce((sum, v) => sum + (v.ai_analysis?.financial_attribution?.chargeback_amount || 0), 0) || 0,
    quality_score: agentOutputs.milestones?.project_health?.overall_quality_score || 0,
    schedule_score: agentOutputs.milestones?.project_health?.schedule_performance_score || 0,

    created_at: timestamp,
    ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year retention
  };

  await docClient.send(new PutCommand({
    TableName: 'sitelogix-analytics',
    Item: item
  }));

  console.log(`✅ Stored executive summary with health score: ${item.overall_health_score}/100`);
}

/**
 * Get strategic recommendations for project
 */
async function getStrategicRecommendations(projectId, days = 30) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `RECOMMENDATIONS#${projectId}`
      },
      ScanIndexForward: false, // Most recent first
      Limit: days
    }));

    return result.Items || [];
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return [];
  }
}

/**
 * Get executive summaries
 */
async function getExecutiveSummaries(projectId, days = 30) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `EXECUTIVE_SUMMARY#${projectId}`
      },
      ScanIndexForward: false, // Most recent first
      Limit: days
    }));

    return result.Items || [];
  } catch (error) {
    console.error('Error fetching executive summaries:', error);
    return [];
  }
}

module.exports = {
  generateStrategicRecommendations,
  getStrategicRecommendations,
  getExecutiveSummaries
};
