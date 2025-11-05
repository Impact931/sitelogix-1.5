// Analytics Agent: Vendor Performance Tracking
// Analyzes vendor deliveries and calculates performance scores

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const OpenAI = require('openai');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Analyze vendor performance from report
 */
async function analyzeVendorPerformance(report) {
  console.log(`📦 Analyzing vendor performance for report ${report.report_id}`);

  // Parse extracted_data if it's a JSON string
  const extractedData = typeof report.extracted_data === 'string'
    ? JSON.parse(report.extracted_data)
    : (report.extracted_data || {});

  const vendors = extractedData.vendors || [];

  if (vendors.length === 0) {
    console.log('⚠️ No vendor deliveries in report');
    return { vendors: [], analysis: null };
  }

  const results = [];

  for (const vendor of vendors) {
    // Get historical performance
    const history = await getVendorHistory(vendor.canonical_name, 30); // Last 30 days

    // Use OpenAI to analyze performance with ENHANCED intelligence
    const aiAnalysis = await analyzeVendorWithAI(vendor, history, report);

    // Calculate performance score (0-100)
    const performanceScore = calculatePerformanceScore(vendor, history, aiAnalysis);

    // Determine risk level
    const riskLevel = assessRiskLevel(performanceScore, history);

    const vendorAnalysis = {
      ...vendor,
      performance_score: performanceScore,
      risk_level: riskLevel,
      trend: aiAnalysis.trend,
      impact_summary: aiAnalysis.impact_summary,
      recommendations: aiAnalysis.recommendations,
      historical_deliveries: history.length,

      // CRITICAL: Include full AI analysis for storage
      ai_analysis: aiAnalysis
    };

    // Store in DynamoDB with enhanced fields
    await storeVendorPerformance(report, vendorAnalysis);

    results.push(vendorAnalysis);
  }

  return { vendors: results };
}

/**
 * Get vendor delivery history
 */
async function getVendorHistory(vendorName, days = 30) {
  // If no vendor name provided, return empty array
  if (!vendorName || vendorName === 'undefined') {
    return [];
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffString = cutoffDate.toISOString().split('T')[0];

  try {
    // Query by PK for vendor performance records
    const result = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `VENDOR_PERFORMANCE#${vendorName}`
      },
      Limit: 50,
      ScanIndexForward: false // Most recent first
    }));

    return result.Items || [];
  } catch (error) {
    console.error('Error fetching vendor history:', error);
    return [];
  }
}

/**
 * Use OpenAI to analyze vendor performance
 */
async function analyzeVendorWithAI(vendor, history, report) {
  const prompt = `You are analyzing a construction daily report to extract comprehensive VENDOR INTELLIGENCE for CEO/CFO-level business analytics and cost recovery tracking.

Report Date: ${report.report_date}
Project: ${report.project_name || report.project_id}

Full Transcript:
${report.transcript || 'No transcript available'}

Vendor: ${vendor.canonical_name}
Material/Service: ${vendor.materials?.[0] || 'Unknown'}

Current Delivery/Activity:
- Status: ${vendor.delivery_status || 'Unknown'}
- Time: ${vendor.delivery_time || 'Not specified'}
- Notes: ${vendor.notes || 'None'}

Historical Deliveries (last 30 days): ${history.length} deliveries
${history.length > 0 ? 'Recent performance summary: ' + JSON.stringify(history.slice(0, 5), null, 2) : 'No historical data available'}

For this vendor, extract the following COMPREHENSIVE INTELLIGENCE:

1. **Delivery Performance**:
   - On-time delivery? (yes/no)
   - Expected delivery time (if mentioned)
   - Actual delivery time (if mentioned)
   - Delivery time variance (minutes early/late)
   - Materials delivered correctly? (right quantity, right specs)

2. **Damage & Quality Incidents** - CRITICAL FOR CHARGE-BACKS:
   - Did this vendor cause ANY damage? (broken pipes, damaged materials, equipment damage)
   - Specific incident description (e.g., "broke 8\" storm line", "damaged waterproofing", "stuck drill bit")
   - Root cause of incident (e.g., "improper technique", "rushed work", "equipment failure", "coordination failure")
   - Materials/areas affected
   - Repair work required
   - Labor hours lost due to incident
   - Estimated material cost impact

3. **Financial Attribution** - REQUIRED FOR COST RECOVERY:
   - Purchase Order (PO) number mentioned? (format: "PO #123456" or "#223436")
   - Extra Work Order number? (format: "Extra #12345" or "#22935")
   - Charge-back amount mentioned or estimable? (e.g., "$2,500", "cost of re-excavation")
   - Charge-back status (pending, approved, recovered, discussed, not_applicable)
   - Insurance claim needed?

4. **Delivery Issues**:
   - Wrong materials delivered?
   - Quantity issues (short/over delivered)?
   - Damaged materials on arrival?
   - Communication problems?
   - Coordination delays ("waited 2 hrs for vendor")

5. **Performance Assessment**:
   - Quality of work/materials (excellent/good/acceptable/poor)
   - Professionalism & communication (excellent/good/acceptable/poor)
   - Responsiveness to issues (excellent/good/acceptable/poor)
   - Would you recommend this vendor? (highly_recommend/recommend/caution/replace)

6. **Root Cause Analysis**:
   - If issues occurred, why? (vendor_error, coordination_gap, external_factors, unclear_specs)
   - Was issue preventable? (yes/no)
   - Prevention opportunity identified?

7. **Historical Context**:
   - Is this a repeat issue for this vendor?
   - Pattern of problems (recurring_late, quality_issues, communication_problems, none)?

8. **A/B/C/D Performance Grade**:
   Based on ALL factors above, assign a letter grade:
   - **A (Excellent)**: No issues, on-time, quality work, professional, highly reliable
   - **B (Satisfactory)**: Minor issues, generally reliable, acceptable quality
   - **C (Below Target)**: Significant issues, late deliveries, quality concerns, needs improvement plan
   - **D (Unacceptable)**: Major incidents, damage events, charge-backs, consider replacement

**CRITICAL EXTRACTION RULES**:
- Look for vendor names spelled various ways (e.g., "Luth"/"Luthe", "Lamke"/"Lampke")
- Extract EXACT PO and Extra work order numbers when mentioned
- Calculate charge-back amounts from labor hours + materials if specific amount not stated
- Flag ALL damage incidents regardless of severity
- Note specific people's names associated with vendor work (e.g., "Luth crew", "Ferguson driver")
- Extract delivery times precisely (e.g., "7:00 AM", "2 hours late")

Return a JSON object with this ENHANCED structure:
{
  "delivery_performance": {
    "on_time": true/false,
    "expected_time": "8:00 AM",
    "actual_time": "7:00 AM",
    "variance_minutes": -60,
    "materials_correct": true/false,
    "delivery_notes": "Early delivery, all materials as specified"
  },
  "incidents": [
    {
      "incident_type": "damage" | "quality" | "delay" | "wrong_materials" | "communication",
      "description": "Broke 8\" storm line during excavation",
      "root_cause": "Improper excavation technique, failed to locate line properly",
      "materials_affected": ["8-inch storm drain pipe", "surrounding soil"],
      "repair_required": "Full re-excavation and pipe replacement",
      "labor_hours_lost": 12,
      "material_cost_impact": 1200,
      "total_cost_impact": 2500,
      "severity": "high" | "medium" | "low",
      "preventable": true/false,
      "prevention_opportunity": "Require ground-penetrating radar before excavation"
    }
  ],
  "financial_attribution": {
    "po_number": "223436",
    "extra_work_order": "22935",
    "chargeback_amount": 2500,
    "chargeback_status": "pending" | "approved" | "recovered" | "not_applicable",
    "chargeback_justification": "Vendor damage to existing infrastructure requiring full repair",
    "insurance_claim_needed": false
  },
  "delivery_issues": {
    "wrong_materials": false,
    "quantity_issues": false,
    "damaged_on_arrival": false,
    "communication_problems": false,
    "coordination_delays": false,
    "specific_issues": []
  },
  "performance_assessment": {
    "quality_rating": "excellent" | "good" | "acceptable" | "poor",
    "communication_rating": "excellent" | "good" | "acceptable" | "poor",
    "responsiveness_rating": "excellent" | "good" | "acceptable" | "poor",
    "recommendation": "highly_recommend" | "recommend" | "caution" | "replace",
    "recommendation_reasoning": "Explanation of recommendation"
  },
  "root_cause_analysis": {
    "primary_cause": "vendor_error" | "coordination_gap" | "external_factors" | "unclear_specs" | "none",
    "preventable": true/false,
    "prevention_opportunity": "Specific action to prevent recurrence",
    "pattern_identified": "recurring_late" | "quality_issues" | "communication_problems" | "damage_prone" | "none"
  },
  "performance_grade": "A" | "B" | "C" | "D",
  "grade_criteria": {
    "delivery_timeliness": "Always on time",
    "quality_standard": "Meets all specifications",
    "incident_record": "No damage or quality incidents",
    "communication": "Excellent coordination and responsiveness",
    "overall_assessment": "Highly reliable vendor, continue use"
  },
  "trend": "improving" | "declining" | "stable",
  "impact_summary": "Brief description of overall impact on project",
  "recommendations": [
    "Continue using vendor for similar work",
    "Request formal improvement plan",
    "Initiate charge-back process for Extra #22935",
    "Consider alternative vendors for critical work"
  ],
  "confidence": 0.90,
  "reasoning": "Why this grade and assessment were assigned"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert procurement analyst specializing in construction vendor performance evaluation.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 1000
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    console.error('Error analyzing vendor with AI:', error);
    return {
      trend: 'stable',
      impact_summary: 'Unable to analyze',
      specific_issues: [],
      recommendations: [],
      quality_concerns: false,
      confidence: 0.0
    };
  }
}

/**
 * Calculate vendor performance score (0-100)
 * Enhanced to incorporate AI analysis insights
 */
function calculatePerformanceScore(vendor, history, aiAnalysis) {
  let score = 100;

  // 1. A/B/C/D Grade from AI (primary factor)
  const grade = aiAnalysis?.performance_grade || 'B';
  const gradeScores = { 'A': 95, 'B': 80, 'C': 60, 'D': 30 };
  score = gradeScores[grade] || 80;

  // 2. Incident severity adjustments
  const incidents = aiAnalysis?.incidents || [];
  for (const incident of incidents) {
    if (incident.severity === 'high') {
      score -= 20;
    } else if (incident.severity === 'medium') {
      score -= 10;
    } else if (incident.severity === 'low') {
      score -= 5;
    }
  }

  // 3. Financial impact (charge-backs)
  const chargebackAmount = aiAnalysis?.financial_attribution?.chargeback_amount || 0;
  if (chargebackAmount > 5000) {
    score -= 25;
  } else if (chargebackAmount > 2000) {
    score -= 15;
  } else if (chargebackAmount > 0) {
    score -= 10;
  }

  // 4. Current delivery status
  if (vendor.delivery_status === 'late') {
    score -= 10;
  } else if (vendor.delivery_status === 'missed') {
    score -= 20;
  }

  // 5. Historical performance pattern
  if (history.length > 0) {
    const lateDeliveries = history.filter(h => h.delivery_status === 'late').length;
    const missedDeliveries = history.filter(h => h.delivery_status === 'missed').length;

    const lateRate = lateDeliveries / history.length;
    const missedRate = missedDeliveries / history.length;

    score -= (lateRate * 15);
    score -= (missedRate * 25);
  }

  // 6. Quality ratings from AI
  const perfAssessment = aiAnalysis?.performance_assessment || {};
  if (perfAssessment.quality_rating === 'poor') {
    score -= 15;
  } else if (perfAssessment.quality_rating === 'acceptable') {
    score -= 5;
  }

  if (perfAssessment.communication_rating === 'poor') {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Assess risk level based on performance
 */
function assessRiskLevel(performanceScore, history) {
  // Count recent issues (last 7 days)
  const recent = history.filter(h => {
    const daysDiff = (new Date() - new Date(h.report_date)) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  });

  const recentIssues = recent.filter(h =>
    h.delivery_status === 'late' || h.delivery_status === 'missed'
  ).length;

  if (performanceScore >= 85 && recentIssues === 0) {
    return 'low';
  } else if (performanceScore >= 70 && recentIssues <= 1) {
    return 'medium';
  } else if (performanceScore >= 50 && recentIssues <= 2) {
    return 'high';
  } else {
    return 'critical';
  }
}

/**
 * Store vendor performance in DynamoDB
 */
async function storeVendorPerformance(report, vendorAnalysis) {
  const timestamp = new Date().toISOString();

  // Extract enhanced data from AI analysis
  const aiAnalysis = vendorAnalysis.ai_analysis || {};
  const deliveryPerf = aiAnalysis.delivery_performance || {};
  const incidents = aiAnalysis.incidents || [];
  const financial = aiAnalysis.financial_attribution || {};
  const perfAssessment = aiAnalysis.performance_assessment || {};
  const rootCause = aiAnalysis.root_cause_analysis || {};
  const gradeCriteria = aiAnalysis.grade_criteria || {};

  // Calculate total incident cost
  const totalIncidentCost = incidents.reduce((sum, inc) => sum + (inc.total_cost_impact || 0), 0);
  const hasHighSeverityIncident = incidents.some(inc => inc.severity === 'high');

  const item = {
    PK: `VENDOR_PERFORMANCE#${vendorAnalysis.vendor_id || vendorAnalysis.canonical_name}`,
    SK: `DATE#${report.report_date}`,
    GSI1PK: `PROJECT#${report.project_id}`,
    GSI1SK: `DATE#${report.report_date}`,
    GSI2PK: `RISK#${vendorAnalysis.risk_level}`,
    GSI2SK: vendorAnalysis.performance_score,
    GSI3PK: `GRADE#${aiAnalysis.performance_grade || 'B'}`,
    GSI3SK: `DATE#${report.report_date}`,

    // Core vendor info
    vendor_id: vendorAnalysis.vendor_id,
    vendor_name: vendorAnalysis.canonical_name,
    report_id: report.report_id,
    project_id: report.project_id,
    project_name: report.project_name,
    report_date: report.report_date,

    // Performance metrics
    performance_score: vendorAnalysis.performance_score,
    performance_grade: aiAnalysis.performance_grade || 'B',
    risk_level: vendorAnalysis.risk_level,
    trend: vendorAnalysis.trend,

    // Grade criteria (WHY this grade)
    grade_criteria_delivery: gradeCriteria.delivery_timeliness,
    grade_criteria_quality: gradeCriteria.quality_standard,
    grade_criteria_incidents: gradeCriteria.incident_record,
    grade_criteria_communication: gradeCriteria.communication,
    grade_criteria_overall: gradeCriteria.overall_assessment,

    // Delivery performance details
    delivery_on_time: deliveryPerf.on_time,
    delivery_expected_time: deliveryPerf.expected_time,
    delivery_actual_time: deliveryPerf.actual_time,
    delivery_variance_minutes: deliveryPerf.variance_minutes,
    delivery_materials_correct: deliveryPerf.materials_correct,
    delivery_notes: deliveryPerf.delivery_notes,
    delivery_status: vendorAnalysis.delivery_status,
    delivery_time: vendorAnalysis.delivery_time,
    materials: vendorAnalysis.materials,

    // Incident tracking (CRITICAL for charge-backs)
    has_incidents: incidents.length > 0,
    incident_count: incidents.length,
    incidents: incidents.map(inc => ({
      type: inc.incident_type,
      description: inc.description,
      root_cause: inc.root_cause,
      materials_affected: inc.materials_affected,
      repair_required: inc.repair_required,
      labor_hours_lost: inc.labor_hours_lost || 0,
      material_cost: inc.material_cost_impact || 0,
      total_cost: inc.total_cost_impact || 0,
      severity: inc.severity,
      preventable: inc.preventable,
      prevention_opportunity: inc.prevention_opportunity
    })),
    total_incident_cost: totalIncidentCost,
    high_severity_incident: hasHighSeverityIncident,

    // Financial attribution (PO, Extra, Charge-backs)
    po_number: financial.po_number,
    extra_work_order: financial.extra_work_order,
    chargeback_amount: financial.chargeback_amount || 0,
    chargeback_status: financial.chargeback_status || 'not_applicable',
    chargeback_justification: financial.chargeback_justification,
    insurance_claim_needed: financial.insurance_claim_needed || false,

    // Performance assessment
    quality_rating: perfAssessment.quality_rating,
    communication_rating: perfAssessment.communication_rating,
    responsiveness_rating: perfAssessment.responsiveness_rating,
    recommendation: perfAssessment.recommendation,
    recommendation_reasoning: perfAssessment.recommendation_reasoning,

    // Root cause analysis
    primary_cause: rootCause.primary_cause,
    issue_preventable: rootCause.preventable,
    prevention_opportunity: rootCause.prevention_opportunity,
    pattern_identified: rootCause.pattern_identified,

    // Summary
    impact_summary: vendorAnalysis.impact_summary,
    recommendations: vendorAnalysis.recommendations,
    historical_deliveries: vendorAnalysis.historical_deliveries,
    notes: vendorAnalysis.notes,

    // Quality metrics
    confidence: aiAnalysis.confidence || 0,
    reasoning: aiAnalysis.reasoning,

    // Metadata
    analyzed_at: timestamp,
    ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
  };

  await docClient.send(new PutCommand({
    TableName: 'sitelogix-analytics',
    Item: item
  }));

  // If there's a chargeback, store it separately for CFO tracking
  if (financial.chargeback_amount && financial.chargeback_amount > 0) {
    const chargebackItem = {
      PK: `CHARGEBACK#${financial.extra_work_order || timestamp}`,
      SK: `VENDOR#${vendorAnalysis.canonical_name}`,
      GSI1PK: `PROJECT#${report.project_id}`,
      GSI1SK: `DATE#${report.report_date}`,
      GSI2PK: `STATUS#${financial.chargeback_status}`,
      GSI2SK: financial.chargeback_amount,

      // Chargeback details
      vendor_name: vendorAnalysis.canonical_name,
      project_id: report.project_id,
      project_name: report.project_name,
      report_date: report.report_date,
      report_id: report.report_id,

      po_number: financial.po_number,
      extra_work_order: financial.extra_work_order,
      amount: financial.chargeback_amount,
      status: financial.chargeback_status,
      justification: financial.chargeback_justification,

      incident_summary: incidents.map(inc => inc.description).join('; '),
      total_incident_cost: totalIncidentCost,

      created_at: timestamp,
      ttl: Math.floor(Date.now() / 1000) + (3 * 365 * 24 * 60 * 60) // 3 year retention for financial records
    };

    await docClient.send(new PutCommand({
      TableName: 'sitelogix-analytics',
      Item: chargebackItem
    }));

    console.log(`💰 Stored charge-back record: ${financial.extra_work_order} - $${financial.chargeback_amount}`);
  }

  console.log(`✅ Stored vendor performance for ${vendorAnalysis.canonical_name} (Grade: ${aiAnalysis.performance_grade || 'B'})`);
}

/**
 * Get vendor performance metrics
 */
async function getVendorPerformance(params) {
  const { vendor_id, vendor_name, time_period = 30, risk_level } = params;

  if (risk_level) {
    // Query by risk level using GSI2
    const result = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :risk',
      ExpressionAttributeValues: {
        ':risk': `RISK#${risk_level}`
      },
      ScanIndexForward: false // Highest scores first
    }));
    return result.Items || [];
  }

  if (vendor_id || vendor_name) {
    const key = `VENDOR_PERFORMANCE#${vendor_id || vendor_name}`;

    const result = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': key
      },
      ScanIndexForward: false, // Most recent first
      Limit: time_period
    }));

    return result.Items || [];
  }

  return [];
}

module.exports = {
  analyzeVendorPerformance,
  getVendorPerformance,
  getVendorHistory
};
