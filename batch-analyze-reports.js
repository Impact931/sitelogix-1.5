#!/usr/bin/env node

/**
 * Batch Analytics Processor
 * Analyzes all existing reports with OpenAI-powered analytics agents
 *
 * Runs:
 * - Hours Calculator
 * - Vendor Performance
 * - Critical Event Detection
 *
 * Then prints summary and agent recommendations
 */

require('dotenv').config();

const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { calculatePersonnelHours } = require('./backend/src/functions/analytics-hours-calculator');
const { analyzeVendorPerformance } = require('./backend/src/functions/analytics-vendor-performance');
const { detectCriticalEvents } = require('./backend/src/functions/analytics-critical-events');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║      SiteLogix Analytics Batch Processor                ║');
  console.log('║      Analyzing Existing Reports with AI                 ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Step 1: Fetch all reports from DynamoDB
  console.log('📊 Step 1: Fetching all reports from DynamoDB...');
  const reports = await fetchAllReports();
  console.log(`✅ Found ${reports.length} reports to analyze`);
  console.log('');

  if (reports.length === 0) {
    console.log('⚠️  No reports found. Please upload some reports first.');
    return;
  }

  // Step 2: Fetch transcripts from S3
  console.log('📄 Step 2: Loading transcripts from S3...');
  const reportsWithTranscripts = [];
  for (const report of reports) {
    try {
      const transcript = await fetchTranscript(report);
      reportsWithTranscripts.push({
        ...report,
        transcript
      });
      console.log(`   ✓ Loaded transcript for ${report.report_id}`);
    } catch (error) {
      console.error(`   ✗ Failed to load transcript for ${report.report_id}:`, error.message);
    }
  }
  console.log(`✅ Loaded ${reportsWithTranscripts.length} transcripts`);
  console.log('');

  // Step 3: Run analytics agents
  console.log('🤖 Step 3: Running AI analytics agents...');
  console.log('');

  const analyticsResults = {
    totalHours: 0,
    totalCost: 0,
    personnelTracked: new Set(),
    vendorsTracked: new Set(),
    criticalEvents: [],
    insights: [],
    processingTime: 0
  };

  const startTime = Date.now();

  for (let i = 0; i < reportsWithTranscripts.length; i++) {
    const report = reportsWithTranscripts[i];
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 Report ${i + 1}/${reportsWithTranscripts.length}: ${report.report_id}`);
    console.log(`   Date: ${report.report_date}`);
    console.log(`   Project: ${report.project_name || report.project_id}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
      // Agent 1: Hours Calculator
      console.log('\n⏱️  Running Hours Calculator Agent...');
      const hoursResult = await calculatePersonnelHours(report);

      if (hoursResult.personnel_hours.length > 0) {
        console.log(`   ✅ Calculated hours for ${hoursResult.personnel_hours.length} personnel`);
        console.log(`   💰 Total cost: $${hoursResult.summary.total_cost.toFixed(2)}`);
        console.log(`   ⏰ Total hours: ${hoursResult.summary.total_regular_hours} regular, ${hoursResult.summary.total_overtime_hours} OT`);

        analyticsResults.totalHours += hoursResult.summary.total_regular_hours + hoursResult.summary.total_overtime_hours;
        analyticsResults.totalCost += hoursResult.summary.total_cost;
        hoursResult.personnel_hours.forEach(ph => analyticsResults.personnelTracked.add(ph.canonical_name));

        // Print individual personnel
        hoursResult.personnel_hours.forEach(ph => {
          console.log(`      • ${ph.canonical_name}: ${ph.total_hours}hrs (${ph.regular_hours}reg + ${ph.overtime_hours}OT) = $${ph.total_cost.toFixed(2)}`);
        });
      } else {
        console.log('   ℹ️  No personnel hours to calculate');
      }

      // Agent 2: Vendor Performance
      console.log('\n📦 Running Vendor Performance Agent...');
      const vendorResult = await analyzeVendorPerformance(report);

      if (vendorResult.vendors.length > 0) {
        console.log(`   ✅ Analyzed ${vendorResult.vendors.length} vendor deliveries`);

        vendorResult.vendors.forEach(v => {
          analyticsResults.vendorsTracked.add(v.canonical_name);
          console.log(`      • ${v.canonical_name}:`);
          console.log(`        - Performance Score: ${v.performance_score}/100`);
          console.log(`        - Risk Level: ${v.risk_level.toUpperCase()}`);
          console.log(`        - Trend: ${v.trend}`);
          if (v.impact_summary) {
            console.log(`        - Impact: ${v.impact_summary}`);
          }
        });
      } else {
        console.log('   ℹ️  No vendor deliveries in this report');
      }

      // Agent 3: Critical Event Detection
      console.log('\n🚨 Running Critical Event Detection Agent...');
      const eventResult = await detectCriticalEvents(report);

      if (eventResult.critical_events.length > 0) {
        console.log(`   ⚠️  FOUND ${eventResult.critical_events.length} CRITICAL EVENT(S)!`);

        eventResult.critical_events.forEach(e => {
          analyticsResults.criticalEvents.push(e);
          console.log(`      🚨 ${e.event_type.toUpperCase()} - Severity ${e.severity}/10`);
          console.log(`         ${e.description}`);
          if (e.requires_executive_escalation) {
            console.log(`         ⚠️  REQUIRES EXECUTIVE ESCALATION`);
          }
        });
      } else {
        console.log('   ✅ No critical events detected');
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`\n   ❌ Error analyzing report: ${error.message}`);
    }
  }

  analyticsResults.processingTime = (Date.now() - startTime) / 1000;

  // Step 4: Print comprehensive summary
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║              ANALYTICS SUMMARY                           ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  console.log('📊 OVERALL METRICS:');
  console.log(`   • Reports Analyzed: ${reportsWithTranscripts.length}`);
  console.log(`   • Total Personnel Hours: ${analyticsResults.totalHours.toFixed(1)} hours`);
  console.log(`   • Total Labor Cost: $${analyticsResults.totalCost.toFixed(2)}`);
  console.log(`   • Unique Personnel Tracked: ${analyticsResults.personnelTracked.size}`);
  console.log(`   • Unique Vendors Tracked: ${analyticsResults.vendorsTracked.size}`);
  console.log(`   • Critical Events Found: ${analyticsResults.criticalEvents.length}`);
  console.log(`   • Processing Time: ${analyticsResults.processingTime.toFixed(1)} seconds`);
  console.log('');

  if (analyticsResults.criticalEvents.length > 0) {
    console.log('🚨 CRITICAL EVENTS SUMMARY:');
    const eventsByType = {};
    analyticsResults.criticalEvents.forEach(e => {
      eventsByType[e.event_type] = (eventsByType[e.event_type] || 0) + 1;
    });
    Object.entries(eventsByType).forEach(([type, count]) => {
      console.log(`   • ${type.toUpperCase()}: ${count}`);
    });
    console.log('');
  }

  console.log('👥 PERSONNEL TRACKED:');
  Array.from(analyticsResults.personnelTracked).forEach(name => {
    console.log(`   • ${name}`);
  });
  console.log('');

  console.log('📦 VENDORS TRACKED:');
  Array.from(analyticsResults.vendorsTracked).forEach(name => {
    console.log(`   • ${name}`);
  });
  console.log('');

  // Step 5: Agent Recommendations
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║           AI AGENT RECOMMENDATIONS                       ║');
  console.log('║        Additional Analytics to Implement                 ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  console.log('💡 RECOMMENDED ENHANCEMENTS:');
  console.log('');

  console.log('1️⃣  HOURS & PRODUCTIVITY ANALYTICS');
  console.log('   • Overtime trend analysis (identify excessive OT patterns)');
  console.log('   • Productivity metrics by day of week/time of day');
  console.log('   • Crew size optimization recommendations');
  console.log('   • Labor cost variance tracking vs budget');
  console.log('');

  console.log('2️⃣  VENDOR INTELLIGENCE');
  console.log('   • Automatic reordering suggestions based on usage patterns');
  console.log('   • Vendor reliability scoring with multi-factor analysis');
  console.log('   • Material waste tracking and cost impact');
  console.log('   • Delivery time prediction models');
  console.log('');

  console.log('3️⃣  RISK & SAFETY MONITORING');
  console.log('   • Near-miss incident tracking (proactive safety)');
  console.log('   • Weather impact correlation analysis');
  console.log('   • Equipment failure pattern detection');
  console.log('   • OSHA compliance automated reporting');
  console.log('');

  console.log('4️⃣  PREDICTIVE ANALYTICS');
  console.log('   • Project completion timeline predictions');
  console.log('   • Budget overrun early warning system');
  console.log('   • Resource bottleneck identification');
  console.log('   • Material shortage forecasting');
  console.log('');

  console.log('5️⃣  QUALITY & COMPLIANCE');
  console.log('   • Inspection failure pattern analysis');
  console.log('   • Rework cost tracking and trend analysis');
  console.log('   • Code compliance violation tracking');
  console.log('   • Quality score per subcontractor/crew');
  console.log('');

  console.log('6️⃣  FINANCIAL INSIGHTS');
  console.log('   • Daily burn rate vs budget analysis');
  console.log('   • Cost per square foot tracking');
  console.log('   • Change order impact quantification');
  console.log('   • Profit margin forecasting per project phase');
  console.log('');

  console.log('✅ Analysis complete! All data stored in DynamoDB analytics tables.');
  console.log('');
}

/**
 * Fetch all reports from DynamoDB
 */
async function fetchAllReports() {
  const command = new ScanCommand({
    TableName: 'sitelogix-reports'
  });

  const result = await dynamoClient.send(command);
  return result.Items.map(item => unmarshall(item));
}

/**
 * Fetch transcript from S3
 */
async function fetchTranscript(report) {
  if (!report.transcript_s3_path) {
    return '';
  }

  const s3Path = report.transcript_s3_path.replace('s3://', '');
  const [bucket, ...keyParts] = s3Path.split('/');
  const key = keyParts.join('/');

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });

  const result = await s3Client.send(command);
  const bodyString = await result.Body.transformToString();

  // Parse JSON if it's a JSON transcript
  try {
    const parsed = JSON.parse(bodyString);
    return parsed.transcript || parsed.text || bodyString;
  } catch {
    return bodyString;
  }
}

// Run the batch processor
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
