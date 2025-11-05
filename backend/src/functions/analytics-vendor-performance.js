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

    // Use OpenAI to analyze performance
    const analysis = await analyzeVendorWithAI(vendor, history, report);

    // Calculate performance score
    const performanceScore = calculatePerformanceScore(vendor, history);

    // Determine risk level
    const riskLevel = assessRiskLevel(performanceScore, history);

    const vendorAnalysis = {
      ...vendor,
      performance_score: performanceScore,
      risk_level: riskLevel,
      trend: analysis.trend,
      impact_summary: analysis.impact_summary,
      recommendations: analysis.recommendations,
      historical_deliveries: history.length
    };

    // Store in DynamoDB
    await storeVendorPerformance(report, vendorAnalysis);

    results.push(vendorAnalysis);
  }

  return { vendors: results };
}

/**
 * Get vendor delivery history
 */
async function getVendorHistory(vendorName, days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffString = cutoffDate.toISOString().split('T')[0];

  try {
    // Query by vendor name (you may need to adjust based on your data structure)
    const result = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'vendor_name = :name AND report_date >= :date',
      ExpressionAttributeValues: {
        ':name': vendorName,
        ':date': cutoffString
      },
      Limit: 50
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
  const prompt = `You are a procurement analyst evaluating construction vendor performance.

Vendor: ${vendor.canonical_name}
Material: ${vendor.materials?.[0] || 'Unknown'}

Current Delivery:
- Date: ${report.report_date}
- Status: ${vendor.delivery_status || 'Unknown'}
- Time: ${vendor.delivery_time || 'Not specified'}
- Notes: ${vendor.notes || 'None'}

Historical Deliveries (last 30 days): ${history.length} deliveries
${history.length > 0 ? 'Recent performance summary: ' + JSON.stringify(history.slice(0, 5), null, 2) : 'No historical data available'}

Transcript Context:
${report.transcript?.substring(0, 500)}...

Analyze:
1. **Performance Trend** (improving/declining/stable)
2. **Impact on Project**: How did this delivery (or delay) affect the project timeline or crew productivity?
3. **Specific Issues**: Any quality problems, communication issues, or delays mentioned?
4. **Recommendations**: Should we continue with this vendor, request performance improvement, or find alternatives?

Return JSON with this structure:
{
  "trend": "improving" | "declining" | "stable",
  "impact_summary": "Brief description of impact on project",
  "specific_issues": ["issue1", "issue2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "quality_concerns": true/false,
  "confidence": 0.85
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
 */
function calculatePerformanceScore(vendor, history) {
  let score = 100;

  // Current delivery status
  if (vendor.delivery_status === 'late') {
    score -= 15;
  } else if (vendor.delivery_status === 'missed') {
    score -= 30;
  }

  // Quality issues mentioned
  if (vendor.notes?.toLowerCase().includes('damage') ||
      vendor.notes?.toLowerCase().includes('defect') ||
      vendor.notes?.toLowerCase().includes('wrong')) {
    score -= 20;
  }

  // Historical performance
  if (history.length > 0) {
    const lateDeliveries = history.filter(h => h.delivery_status === 'late').length;
    const missedDeliveries = history.filter(h => h.delivery_status === 'missed').length;

    const lateRate = lateDeliveries / history.length;
    const missedRate = missedDeliveries / history.length;

    score -= (lateRate * 30);
    score -= (missedRate * 40);
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

  const item = {
    PK: `VENDOR_PERFORMANCE#${vendorAnalysis.vendor_id || vendorAnalysis.canonical_name}`,
    SK: `DATE#${report.report_date}`,
    GSI1PK: `PROJECT#${report.project_id}`,
    GSI1SK: `DATE#${report.report_date}`,
    GSI2PK: `RISK#${vendorAnalysis.risk_level}`,
    GSI2SK: vendorAnalysis.performance_score,

    // Vendor info
    vendor_id: vendorAnalysis.vendor_id,
    vendor_name: vendorAnalysis.canonical_name,
    report_id: report.report_id,
    project_id: report.project_id,
    report_date: report.report_date,

    // Performance metrics
    performance_score: vendorAnalysis.performance_score,
    risk_level: vendorAnalysis.risk_level,
    trend: vendorAnalysis.trend,

    // Delivery details
    delivery_status: vendorAnalysis.delivery_status,
    delivery_time: vendorAnalysis.delivery_time,
    materials: vendorAnalysis.materials,
    notes: vendorAnalysis.notes,

    // Analysis
    impact_summary: vendorAnalysis.impact_summary,
    recommendations: vendorAnalysis.recommendations,
    historical_deliveries: vendorAnalysis.historical_deliveries,

    // Metadata
    analyzed_at: timestamp,
    ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
  };

  await docClient.send(new PutCommand({
    TableName: 'sitelogix-analytics',
    Item: item
  }));

  console.log(`✅ Stored vendor performance for ${vendorAnalysis.canonical_name}`);
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
