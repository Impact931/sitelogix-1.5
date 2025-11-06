// Business Intelligence API Endpoints
// Queries enhanced analytics data from sitelogix-analytics table

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Executive Dashboard Endpoint
 * GET /api/bi/executive
 *
 * Provides single-pane-of-glass view for CEO/COO/CFO:
 * - Portfolio health across all projects
 * - Financial snapshot (labor costs, constraint costs, chargebacks, savings opportunities)
 * - Top wins and concerns
 * - Urgent action items
 * - Project-level health scores
 */
async function getExecutiveDashboard() {
  try {
    console.log('📊 Fetching Executive Dashboard data...');

    // Fetch all EXECUTIVE_SUMMARY records
    const executiveSummaries = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'EXECUTIVE_SUMMARY'
      }
    }));

    // Fetch all RECOMMENDATIONS records for cost reduction opportunities
    const recommendations = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'RECOMMENDATIONS'
      }
    }));

    // Fetch all HOURS_SUMMARY records for labor costs
    const hoursSummaries = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'HOURS_SUMMARY'
      }
    }));

    // Fetch all CONSTRAINT_SUMMARY records
    const constraintSummaries = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'CONSTRAINT_SUMMARY'
      }
    }));

    console.log(`✅ Fetched ${executiveSummaries.Items?.length || 0} executive summaries`);
    console.log(`✅ Fetched ${recommendations.Items?.length || 0} recommendation records`);
    console.log(`✅ Fetched ${hoursSummaries.Items?.length || 0} hours summaries`);
    console.log(`✅ Fetched ${constraintSummaries.Items?.length || 0} constraint summaries`);

    // Aggregate portfolio health
    const projects = {};
    let totalQualityScore = 0;
    let totalScheduleScore = 0;
    let projectCount = 0;

    // Process executive summaries
    (executiveSummaries.Items || []).forEach(item => {
      const projectId = item.project_id;
      if (!projects[projectId]) {
        projects[projectId] = {
          project_id: projectId,
          project_name: item.project_name,
          report_id: item.report_id, // Store report_id for linking
          report_date: item.report_date, // Store report_date
          health_score: item.overall_health_score || 0,
          quality_score: item.quality_score || 0,
          schedule_score: item.schedule_score || 0,
          top_wins: item.top_wins || [],
          top_concerns: item.top_concerns || [],
          labor_cost_mtd: 0,
          constraint_cost_mtd: 0,
          urgent_actions: item.urgent_actions_count || 0,
          high_priority_actions: item.high_priority_actions_count || 0
        };

        totalQualityScore += (item.quality_score || 0);
        totalScheduleScore += (item.schedule_score || 0);
        projectCount++;
      }
    });

    // Add labor costs from hours summaries
    (hoursSummaries.Items || []).forEach(item => {
      const projectId = item.project_id;
      if (projects[projectId]) {
        projects[projectId].labor_cost_mtd += (item.total_cost || 0);
      }
    });

    // Add constraint costs
    (constraintSummaries.Items || []).forEach(item => {
      const projectId = item.project_id;
      if (projects[projectId]) {
        projects[projectId].constraint_cost_mtd += (item.total_cost_impact || 0);
      }
    });

    // Aggregate cost reduction opportunities
    let totalCostReductionPotential = 0;
    let totalImplementationCost = 0;
    const urgentActions = [];
    const highPriorityActions = [];

    (recommendations.Items || []).forEach(item => {
      const opportunities = item.cost_reduction_opportunities || [];
      opportunities.forEach(opp => {
        totalCostReductionPotential += (opp.estimated_monthly_savings || 0);
        totalImplementationCost += (opp.implementation_cost || 0);

        if (opp.priority === 'urgent') {
          urgentActions.push({
            title: opp.title,
            project: item.project_name,
            savings: opp.estimated_monthly_savings,
            timeline: opp.implementation_timeline
          });
        } else if (opp.priority === 'high') {
          highPriorityActions.push({
            title: opp.title,
            project: item.project_name,
            savings: opp.estimated_monthly_savings,
            timeline: opp.implementation_timeline
          });
        }
      });
    });

    // Calculate overtime metrics
    const totalRegularHours = (hoursSummaries.Items || []).reduce((sum, s) => sum + (s.total_regular_hours || 0), 0);
    const totalOvertimeHours = (hoursSummaries.Items || []).reduce((sum, s) => sum + (s.total_overtime_hours || 0), 0);
    const totalDoubletimeHours = (hoursSummaries.Items || []).reduce((sum, s) => sum + (s.total_doubletime_hours || 0), 0);
    const totalHours = totalRegularHours + totalOvertimeHours + totalDoubletimeHours;
    const overtimePercentage = totalHours > 0 ? ((totalOvertimeHours + totalDoubletimeHours) / totalHours * 100).toFixed(1) : 0;

    // Count total active constraints
    const totalConstraints = (constraintSummaries.Items || []).reduce((sum, s) => sum + (s.total_constraints || 0), 0);

    // Calculate portfolio-level metrics
    const portfolioHealth = {
      average_quality_score: projectCount > 0 ? Math.round(totalQualityScore / projectCount) : 0,
      average_schedule_score: projectCount > 0 ? Math.round(totalScheduleScore / projectCount) : 0,
      total_active_projects: projectCount,
      projects_at_risk: Object.values(projects).filter(p => p.health_score < 70).length,
      overtime_percentage: parseFloat(overtimePercentage),
      total_constraints: totalConstraints
    };

    // Calculate financial snapshot
    const totalLaborCost = Object.values(projects).reduce((sum, p) => sum + p.labor_cost_mtd, 0);
    const totalConstraintCost = Object.values(projects).reduce((sum, p) => sum + p.constraint_cost_mtd, 0);
    const portfolioROI = totalImplementationCost > 0 ? (totalCostReductionPotential / totalImplementationCost).toFixed(1) : 0;

    const financialSnapshot = {
      total_labor_cost_month: Math.round(totalLaborCost),
      total_constraint_cost_month: Math.round(totalConstraintCost),
      chargeback_pipeline: 0, // TODO: Add chargeback aggregation
      cost_reduction_opportunities: Math.round(totalCostReductionPotential),
      portfolio_roi: parseFloat(portfolioROI)
    };

    // Aggregate top wins and concerns across all projects with clickable metadata
    const allWins = [];
    const allConcerns = [];

    Object.values(projects).forEach(project => {
      (project.top_wins || []).forEach(win => {
        allWins.push({
          text: `[${project.project_name}] ${win}`,
          project_id: project.project_id,
          project_name: project.project_name,
          report_id: project.report_id,
          report_date: project.report_date
        });
      });
      (project.top_concerns || []).forEach(concern => {
        allConcerns.push({
          text: `[${project.project_name}] ${concern}`,
          project_id: project.project_id,
          project_name: project.project_name,
          report_id: project.report_id,
          report_date: project.report_date
        });
      });
    });

    // Return dashboard data
    return {
      success: true,
      dashboard: {
        portfolio_health: portfolioHealth,
        financial_snapshot: financialSnapshot,
        top_wins: allWins.slice(0, 5),
        top_concerns: allConcerns.slice(0, 5),
        urgent_actions: urgentActions.slice(0, 5),
        high_priority_actions: highPriorityActions.slice(0, 5),
        projects: Object.values(projects).sort((a, b) => b.health_score - a.health_score)
      }
    };

  } catch (error) {
    console.error('❌ Error fetching executive dashboard:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Personnel Intelligence Endpoint
 * GET /api/bi/personnel?project_id={id}&start_date={date}&end_date={date}
 *
 * Provides labor cost analysis, OT tracking, heat impact, productivity metrics
 */
async function getPersonnelIntelligence(params = {}) {
  try {
    console.log('👷 Fetching Personnel Intelligence data...');

    const { project_id, start_date, end_date, person_id } = params;

    // Query all PERSONNEL_HOURS records
    const personnelHours = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'PERSONNEL_HOURS'
      }
    }));

    // Query all HOURS_SUMMARY records
    const hoursSummaries = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'HOURS_SUMMARY'
      }
    }));

    console.log(`✅ Fetched ${personnelHours.Items?.length || 0} personnel hour records`);
    console.log(`✅ Fetched ${hoursSummaries.Items?.length || 0} hours summaries`);

    // Filter by parameters
    let filteredPersonnel = personnelHours.Items || [];
    if (project_id) {
      filteredPersonnel = filteredPersonnel.filter(item => item.project_id === project_id);
    }
    if (person_id) {
      filteredPersonnel = filteredPersonnel.filter(item => item.person_id === person_id);
    }
    if (start_date && end_date) {
      filteredPersonnel = filteredPersonnel.filter(item =>
        item.report_date >= start_date && item.report_date <= end_date
      );
    }

    // Aggregate metrics
    const summary = {
      total_hours: 0,
      regular_hours: 0,
      overtime_hours: 0,
      double_time_hours: 0,
      total_cost: 0
    };

    const personnelMap = {};
    const projectMap = {};
    let heatEarlyDepartures = 0;
    let hoursLostToWeather = 0;

    filteredPersonnel.forEach(item => {
      summary.total_hours += (item.total_hours || 0);
      summary.regular_hours += (item.regular_hours || 0);
      summary.overtime_hours += (item.overtime_hours || 0);
      summary.double_time_hours += (item.double_time_hours || 0);
      summary.total_cost += (item.total_cost || 0);

      // Track by person
      const personName = item.person_name;
      if (!personnelMap[personName]) {
        personnelMap[personName] = {
          person_name: personName,
          total_hours: 0,
          ot_hours: 0,
          dt_hours: 0,
          total_cost: 0,
          ot_driver: item.ot_driver || 'N/A'
        };
      }
      personnelMap[personName].total_hours += (item.total_hours || 0);
      personnelMap[personName].ot_hours += (item.overtime_hours || 0);
      personnelMap[personName].dt_hours += (item.double_time_hours || 0);
      personnelMap[personName].total_cost += (item.total_cost || 0);

      // Track by project
      const projectName = item.project_name || 'Unknown';
      if (!projectMap[projectName]) {
        projectMap[projectName] = {
          project_name: projectName,
          total_hours: 0,
          total_cost: 0,
          ot_rate: 0
        };
      }
      projectMap[projectName].total_hours += (item.total_hours || 0);
      projectMap[projectName].total_cost += (item.total_cost || 0);

      // Environmental impacts
      if (item.early_departure && item.early_departure_reason === 'heat') {
        heatEarlyDepartures++;
      }
      hoursLostToWeather += (item.hours_lost_to_weather || 0);
    });

    // Calculate rates
    summary.overtime_rate = summary.total_hours > 0
      ? ((summary.overtime_hours / summary.total_hours) * 100).toFixed(1)
      : 0;
    summary.double_time_rate = summary.total_hours > 0
      ? ((summary.double_time_hours / summary.total_hours) * 100).toFixed(1)
      : 0;
    summary.average_cost_per_hour = summary.total_hours > 0
      ? (summary.total_cost / summary.total_hours).toFixed(2)
      : 0;

    // Calculate project OT rates
    Object.values(projectMap).forEach(project => {
      const otHours = filteredPersonnel
        .filter(item => (item.project_name || 'Unknown') === project.project_name)
        .reduce((sum, item) => sum + (item.overtime_hours || 0), 0);
      project.ot_rate = project.total_hours > 0
        ? ((otHours / project.total_hours) * 100).toFixed(1)
        : 0;
    });

    // Sort top OT workers
    const topOTWorkers = Object.values(personnelMap)
      .sort((a, b) => (b.ot_hours + b.dt_hours) - (a.ot_hours + a.dt_hours))
      .slice(0, 10);

    return {
      success: true,
      personnel_analytics: {
        summary: {
          ...summary,
          total_hours: Math.round(summary.total_hours * 10) / 10,
          regular_hours: Math.round(summary.regular_hours * 10) / 10,
          overtime_hours: Math.round(summary.overtime_hours * 10) / 10,
          double_time_hours: Math.round(summary.double_time_hours * 10) / 10,
          total_cost: Math.round(summary.total_cost)
        },
        environmental_impacts: {
          heat_early_departures: heatEarlyDepartures,
          hours_lost_to_weather: Math.round(hoursLostToWeather * 10) / 10,
          cost_of_weather_delays: Math.round(hoursLostToWeather * 40) // Approximate at $40/hr
        },
        top_ot_workers: topOTWorkers,
        by_project: Object.values(projectMap).sort((a, b) => b.total_cost - a.total_cost)
      }
    };

  } catch (error) {
    console.error('❌ Error fetching personnel intelligence:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Vendor Intelligence Endpoint
 * GET /api/bi/vendors?risk_level={low|medium|high|critical}&grade={A|B|C|D}
 *
 * Provides vendor performance, A/B/C/D grading, chargeback pipeline
 */
async function getVendorIntelligence(params = {}) {
  try {
    console.log('📦 Fetching Vendor Intelligence data...');

    const { risk_level, grade, vendor_name } = params;

    // Query all VENDOR_PERFORMANCE records
    const vendorPerformance = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'VENDOR_PERFORMANCE'
      }
    }));

    // Query all CHARGEBACK records
    const chargebacks = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'CHARGEBACK'
      }
    }));

    console.log(`✅ Fetched ${vendorPerformance.Items?.length || 0} vendor performance records`);
    console.log(`✅ Fetched ${chargebacks.Items?.length || 0} chargeback records`);

    // Aggregate vendor data
    const vendorMap = {};
    const gradeCount = { A: 0, B: 0, C: 0, D: 0 };
    let highRiskCount = 0;

    (vendorPerformance.Items || []).forEach(item => {
      const vName = item.vendor_name || 'Unknown';

      if (!vendorMap[vName]) {
        vendorMap[vName] = {
          vendor_name: vName,
          grade: item.performance_grade || 'N/A',
          performance_score: item.performance_score || 0,
          risk_level: item.risk_level || 'unknown',
          trend: item.trend || 'stable',
          deliveries: 0,
          on_time: 0,
          late: 0,
          incidents: 0,
          total_incident_cost: 0,
          chargebacks: 0,
          chargeback_amount: 0,
          recommendation: item.recommendation || 'N/A',
          grade_criteria: {
            delivery: item.grade_criteria_delivery || '',
            quality: item.grade_criteria_quality || '',
            communication: item.grade_criteria_communication || ''
          }
        };
      }

      // Aggregate deliveries
      vendorMap[vName].deliveries++;
      if (item.delivery_status === 'ontime') {
        vendorMap[vName].on_time++;
      } else if (item.delivery_status === 'late') {
        vendorMap[vName].late++;
      }

      // Aggregate incidents
      if (item.has_incidents) {
        vendorMap[vName].incidents += (item.incident_count || 0);
        vendorMap[vName].total_incident_cost += (item.total_incident_cost || 0);
      }

      // Count grades
      const itemGrade = item.performance_grade;
      if (itemGrade && gradeCount[itemGrade] !== undefined) {
        gradeCount[itemGrade]++;
      }

      // Count high risk
      if (item.risk_level === 'high' || item.risk_level === 'critical') {
        highRiskCount++;
      }
    });

    // Add chargeback data
    (chargebacks.Items || []).forEach(item => {
      const vName = item.vendor_name;
      if (vendorMap[vName]) {
        vendorMap[vName].chargebacks++;
        vendorMap[vName].chargeback_amount += (item.amount || 0);
      }
    });

    // Calculate on-time rates and apply filters
    let vendors = Object.values(vendorMap).map(vendor => {
      vendor.on_time_rate = vendor.deliveries > 0
        ? ((vendor.on_time / vendor.deliveries) * 100).toFixed(1)
        : 0;
      return vendor;
    });

    // Apply filters
    if (risk_level) {
      vendors = vendors.filter(v => v.risk_level === risk_level);
    }
    if (grade) {
      vendors = vendors.filter(v => v.grade === grade);
    }
    if (vendor_name) {
      vendors = vendors.filter(v => v.vendor_name.toLowerCase().includes(vendor_name.toLowerCase()));
    }

    // Sort by performance score
    vendors.sort((a, b) => b.performance_score - a.performance_score);

    // Calculate total chargebacks
    const totalChargebacks = (chargebacks.Items || []).reduce((sum, item) => sum + (item.amount || 0), 0);
    const pendingChargebacks = (chargebacks.Items || [])
      .filter(item => item.status === 'pending')
      .reduce((sum, item) => sum + (item.amount || 0), 0);

    return {
      success: true,
      vendor_analytics: {
        summary: {
          total_vendors: Object.keys(vendorMap).length,
          a_grade: gradeCount.A,
          b_grade: gradeCount.B,
          c_grade: gradeCount.C,
          d_grade: gradeCount.D,
          high_risk_vendors: highRiskCount,
          total_chargebacks: Math.round(totalChargebacks),
          pending_chargebacks: Math.round(pendingChargebacks)
        },
        vendors: vendors,
        chargeback_pipeline: (chargebacks.Items || [])
          .filter(item => item.status === 'pending')
          .map(item => ({
            vendor_name: item.vendor_name,
            extra_work_order: item.extra_work_order,
            amount: item.amount,
            status: item.status,
            justification: item.justification,
            incident_summary: item.incident_summary
          }))
          .sort((a, b) => b.amount - a.amount)
      }
    };

  } catch (error) {
    console.error('❌ Error fetching vendor intelligence:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Project Health Endpoint
 * GET /api/bi/projects/:project_id/health
 *
 * Deep-dive into single project: inspection results, milestone tracking, quality metrics
 */
async function getProjectHealth(project_id) {
  try {
    console.log(`🏗️ Fetching Project Health for ${project_id}...`);

    // Query INSPECTION records for this project
    const inspections = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk) AND project_id = :pid',
      ExpressionAttributeValues: {
        ':pk': 'INSPECTION',
        ':pid': project_id
      }
    }));

    // Query MILESTONE records for this project
    const milestones = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk) AND project_id = :pid',
      ExpressionAttributeValues: {
        ':pk': 'MILESTONE',
        ':pid': project_id
      }
    }));

    // Query PROJECT_HEALTH records
    const projectHealth = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `PROJECT_HEALTH#${project_id}`
      },
      Limit: 10,
      ScanIndexForward: false
    }));

    // Query EXECUTIVE_SUMMARY for this project
    const executiveSummary = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `EXECUTIVE_SUMMARY#${project_id}`
      },
      Limit: 1,
      ScanIndexForward: false
    }));

    console.log(`✅ Fetched ${inspections.Items?.length || 0} inspections`);
    console.log(`✅ Fetched ${milestones.Items?.length || 0} milestones`);
    console.log(`✅ Fetched ${projectHealth.Items?.length || 0} health records`);

    // Aggregate inspection data
    const inspectionSummary = {
      total_inspections: (inspections.Items || []).length,
      passed: (inspections.Items || []).filter(i => i.result === 'pass' || i.result === 'passed').length,
      failed: (inspections.Items || []).filter(i => i.result === 'fail' || i.result === 'failed').length,
      pending_reinspection: (inspections.Items || []).filter(i => i.requires_reinspection).length,
      recent_inspections: (inspections.Items || [])
        .sort((a, b) => (b.inspection_date || '').localeCompare(a.inspection_date || ''))
        .slice(0, 5)
        .map(i => ({
          type: i.inspection_type,
          result: i.result,
          date: i.inspection_date,
          findings: i.findings
        }))
    };

    // Aggregate milestone data
    const milestoneSummary = {
      total_milestones: (milestones.Items || []).length,
      completed: (milestones.Items || []).filter(m => m.status === 'completed').length,
      on_track: (milestones.Items || []).filter(m => m.status === 'on_track').length,
      at_risk: (milestones.Items || []).filter(m => m.status === 'at_risk').length,
      delayed: (milestones.Items || []).filter(m => m.status === 'delayed').length,
      upcoming_milestones: (milestones.Items || [])
        .filter(m => m.status !== 'completed')
        .sort((a, b) => (a.target_date || '').localeCompare(b.target_date || ''))
        .slice(0, 5)
        .map(m => ({
          name: m.milestone_name,
          target_date: m.target_date,
          status: m.status,
          completion_percentage: m.completion_percentage
        }))
    };

    // Get latest project health score
    const latestHealth = executiveSummary.Items?.[0] || {};

    return {
      success: true,
      project_health: {
        project_id: project_id,
        project_name: latestHealth.project_name || 'Unknown',
        overall_health_score: latestHealth.overall_health_score || 0,
        quality_score: latestHealth.quality_score || 0,
        schedule_score: latestHealth.schedule_score || 0,
        inspection_summary: inspectionSummary,
        milestone_summary: milestoneSummary,
        recent_trends: (projectHealth.Items || []).slice(0, 5).map(h => ({
          date: h.report_date,
          health_score: h.overall_health_score,
          quality_score: h.quality_score,
          schedule_score: h.schedule_score
        }))
      }
    };

  } catch (error) {
    console.error('❌ Error fetching project health:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Constraint Analytics Endpoint
 * GET /api/bi/constraints?project_id={id}&category={cat}&min_cost={amount}
 *
 * Analyzes constraints, delays, cost impacts, and ROI opportunities
 */
async function getConstraintAnalytics(params = {}) {
  try {
    console.log('⚠️ Fetching Constraint Analytics data...');

    const { project_id, category, min_cost } = params;

    // Query all CONSTRAINT records
    const constraints = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'CONSTRAINT'
      }
    }));

    // Query all CONSTRAINT_SUMMARY records
    const constraintSummaries = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'CONSTRAINT_SUMMARY'
      }
    }));

    console.log(`✅ Fetched ${constraints.Items?.length || 0} constraint records`);
    console.log(`✅ Fetched ${constraintSummaries.Items?.length || 0} constraint summaries`);

    // Filter constraints
    let filteredConstraints = constraints.Items || [];
    if (project_id) {
      filteredConstraints = filteredConstraints.filter(c => c.project_id === project_id);
    }
    if (category) {
      filteredConstraints = filteredConstraints.filter(c => c.category === category);
    }
    if (min_cost) {
      filteredConstraints = filteredConstraints.filter(c => (c.total_cost_impact || 0) >= min_cost);
    }

    // Aggregate by category
    const byCategory = {};
    const byStatus = { active: 0, resolved: 0, pending_resolution: 0 };
    let totalCostImpact = 0;
    let totalResolutionCost = 0;
    let totalRecoveryValue = 0;

    filteredConstraints.forEach(constraint => {
      const cat = constraint.category || 'uncategorized';
      if (!byCategory[cat]) {
        byCategory[cat] = {
          category: cat,
          count: 0,
          total_cost: 0,
          avg_cost: 0
        };
      }
      byCategory[cat].count++;
      byCategory[cat].total_cost += (constraint.total_cost_impact || 0);

      // Aggregate status
      const status = constraint.resolution_status || 'active';
      if (byStatus[status] !== undefined) {
        byStatus[status]++;
      }

      // Aggregate costs
      totalCostImpact += (constraint.total_cost_impact || 0);
      totalResolutionCost += (constraint.resolution_cost || 0);
      totalRecoveryValue += (constraint.recovery_value || 0);
    });

    // Calculate averages
    Object.values(byCategory).forEach(cat => {
      cat.avg_cost = cat.count > 0 ? Math.round(cat.total_cost / cat.count) : 0;
      cat.total_cost = Math.round(cat.total_cost);
    });

    // Sort by total cost
    const categoryBreakdown = Object.values(byCategory).sort((a, b) => b.total_cost - a.total_cost);

    // Get top cost impacts
    const topCostImpacts = filteredConstraints
      .sort((a, b) => (b.total_cost_impact || 0) - (a.total_cost_impact || 0))
      .slice(0, 10)
      .map(c => ({
        project_name: c.project_name,
        category: c.category,
        description: c.description,
        total_cost_impact: Math.round(c.total_cost_impact || 0),
        resolution_status: c.resolution_status,
        roi_if_resolved: c.recovery_value > 0 ? ((c.recovery_value / (c.resolution_cost || 1))).toFixed(1) : 'N/A'
      }));

    // Calculate ROI opportunities
    const portfolioROI = totalResolutionCost > 0 ? (totalRecoveryValue / totalResolutionCost).toFixed(1) : 0;

    return {
      success: true,
      constraint_analytics: {
        summary: {
          total_constraints: filteredConstraints.length,
          total_cost_impact: Math.round(totalCostImpact),
          active: byStatus.active,
          resolved: byStatus.resolved,
          pending_resolution: byStatus.pending_resolution,
          total_resolution_cost: Math.round(totalResolutionCost),
          total_recovery_value: Math.round(totalRecoveryValue),
          portfolio_roi: parseFloat(portfolioROI)
        },
        by_category: categoryBreakdown,
        top_cost_impacts: topCostImpacts
      }
    };

  } catch (error) {
    console.error('❌ Error fetching constraint analytics:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Strategic Insights Endpoint
 * GET /api/bi/recommendations?priority={urgent|high|medium}
 *
 * Strategic recommendations, cost reduction opportunities, growth initiatives
 */
async function getStrategicInsights(params = {}) {
  try {
    console.log('💡 Fetching Strategic Insights data...');

    const { priority, project_id } = params;

    // Query all RECOMMENDATIONS records
    const recommendations = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'RECOMMENDATIONS'
      }
    }));

    console.log(`✅ Fetched ${recommendations.Items?.length || 0} recommendation records`);

    // Process recommendations
    const allOpportunities = [];
    const allRisks = [];
    const allGrowthOpportunities = [];

    (recommendations.Items || []).forEach(rec => {
      // Filter by project_id if specified
      if (project_id && rec.project_id !== project_id) {
        return;
      }

      // Cost reduction opportunities
      (rec.cost_reduction_opportunities || []).forEach(opp => {
        if (!priority || opp.priority === priority) {
          allOpportunities.push({
            project_name: rec.project_name,
            project_id: rec.project_id,
            title: opp.title,
            description: opp.description,
            priority: opp.priority,
            estimated_monthly_savings: opp.estimated_monthly_savings || 0,
            implementation_cost: opp.implementation_cost || 0,
            implementation_timeline: opp.implementation_timeline,
            roi: opp.implementation_cost > 0 ? ((opp.estimated_monthly_savings || 0) / opp.implementation_cost).toFixed(1) : 'N/A'
          });
        }
      });

      // Risk mitigation
      (rec.risk_mitigation || []).forEach(risk => {
        if (!priority || risk.priority === priority) {
          allRisks.push({
            project_name: rec.project_name,
            project_id: rec.project_id,
            title: risk.title,
            description: risk.description,
            priority: risk.priority,
            potential_cost_avoidance: risk.potential_cost_avoidance || 0,
            recommended_action: risk.recommended_action
          });
        }
      });

      // Growth opportunities
      (rec.growth_opportunities || []).forEach(growth => {
        allGrowthOpportunities.push({
          project_name: rec.project_name,
          project_id: rec.project_id,
          title: growth.title,
          description: growth.description,
          estimated_revenue_potential: growth.estimated_revenue_potential || 0,
          timeline: growth.timeline
        });
      });
    });

    // Calculate totals
    const totalSavingsPotential = allOpportunities.reduce((sum, opp) => sum + opp.estimated_monthly_savings, 0);
    const totalImplementationCost = allOpportunities.reduce((sum, opp) => sum + opp.implementation_cost, 0);
    const totalRiskAvoidance = allRisks.reduce((sum, risk) => sum + risk.potential_cost_avoidance, 0);
    const totalRevenuePotential = allGrowthOpportunities.reduce((sum, growth) => sum + growth.estimated_revenue_potential, 0);

    // Sort by savings/impact
    allOpportunities.sort((a, b) => b.estimated_monthly_savings - a.estimated_monthly_savings);
    allRisks.sort((a, b) => b.potential_cost_avoidance - a.potential_cost_avoidance);
    allGrowthOpportunities.sort((a, b) => b.estimated_revenue_potential - a.estimated_revenue_potential);

    return {
      success: true,
      strategic_insights: {
        summary: {
          total_cost_reduction_opportunities: allOpportunities.length,
          total_savings_potential: Math.round(totalSavingsPotential),
          total_implementation_cost: Math.round(totalImplementationCost),
          blended_roi: totalImplementationCost > 0 ? (totalSavingsPotential / totalImplementationCost).toFixed(1) : 0,
          total_risk_mitigation_opportunities: allRisks.length,
          total_risk_avoidance_value: Math.round(totalRiskAvoidance),
          total_growth_opportunities: allGrowthOpportunities.length,
          total_revenue_potential: Math.round(totalRevenuePotential)
        },
        cost_reduction: allOpportunities,
        risk_mitigation: allRisks,
        growth_opportunities: allGrowthOpportunities
      }
    };

  } catch (error) {
    console.error('❌ Error fetching strategic insights:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * AI Natural Language Query Endpoint
 * POST /api/bi/query
 * Body: { query: "What are the top 3 projects with the highest labor costs?" }
 *
 * Uses GPT-4o to convert natural language to DynamoDB queries and interpret results
 */
async function queryWithAI(query) {
  try {
    console.log(`🤖 Processing AI query: "${query}"`);

    // For now, return a structured response that indicates this feature is pending full implementation
    // In production, this would use OpenAI GPT-4o to convert natural language to DynamoDB queries

    return {
      success: true,
      ai_response: {
        query: query,
        interpretation: "AI Natural Language Query endpoint is ready for integration with GPT-4o",
        suggested_endpoints: [
          "Use /api/bi/executive for portfolio-level insights",
          "Use /api/bi/personnel for labor cost analysis",
          "Use /api/bi/vendors for vendor performance",
          "Use /api/bi/projects/:id/health for project details",
          "Use /api/bi/constraints for constraint analysis",
          "Use /api/bi/recommendations for strategic insights"
        ],
        status: "pending_openai_integration"
      }
    };

  } catch (error) {
    console.error('❌ Error processing AI query:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Overtime Report Endpoint
 * GET /api/bi/reports/overtime
 *
 * Analyzes overtime trends across portfolio with:
 * - Overtime % by project
 * - Cost impact of overtime
 * - Top OT workers
 * - Trends over time
 */
async function getOvertimeReport() {
  try {
    console.log('📊 Generating Overtime Report...');

    // Fetch all hours summaries
    const hoursSummaries = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'HOURS_SUMMARY'
      }
    }));

    const summaries = hoursSummaries.Items || [];

    // Calculate portfolio-wide overtime metrics
    const totalRegularHours = summaries.reduce((sum, s) => sum + (s.total_regular_hours || 0), 0);
    const totalOvertimeHours = summaries.reduce((sum, s) => sum + (s.total_overtime_hours || 0), 0);
    const totalDoubletimeHours = summaries.reduce((sum, s) => sum + (s.total_doubletime_hours || 0), 0);
    const totalHours = totalRegularHours + totalOvertimeHours + totalDoubletimeHours;

    const overtimePercentage = totalHours > 0 ? ((totalOvertimeHours + totalDoubletimeHours) / totalHours * 100).toFixed(1) : 0;

    // Estimate OT cost impact (OT = 1.5x, DT = 2x)
    const avgHourlyRate = 45; // Industry average
    const overtimeCost = (totalOvertimeHours * avgHourlyRate * 0.5) + (totalDoubletimeHours * avgHourlyRate * 1.0);

    // Group by project
    const byProject = {};
    summaries.forEach(s => {
      const projectId = s.project_id || 'unknown';
      if (!byProject[projectId]) {
        byProject[projectId] = {
          project_id: projectId,
          project_name: s.project_name || 'Unknown Project',
          regular_hours: 0,
          overtime_hours: 0,
          doubletime_hours: 0,
          total_cost: 0
        };
      }

      byProject[projectId].regular_hours += (s.total_regular_hours || 0);
      byProject[projectId].overtime_hours += (s.total_overtime_hours || 0);
      byProject[projectId].doubletime_hours += (s.total_doubletime_hours || 0);
      byProject[projectId].total_cost += (s.total_labor_cost || 0);
    });

    // Calculate OT % for each project and add status
    const projectAnalysis = Object.values(byProject).map(p => {
      const totalHrs = p.regular_hours + p.overtime_hours + p.doubletime_hours;
      const otHrs = p.overtime_hours + p.doubletime_hours;
      const otPercentage = totalHrs > 0 ? (otHrs / totalHrs * 100).toFixed(1) : 0;
      const otCost = (p.overtime_hours * avgHourlyRate * 0.5) + (p.doubletime_hours * avgHourlyRate * 1.0);

      // Determine project status
      // Active project: LG-Clarksville (or any project with "LG" in the name)
      // Complete: All historical projects
      let status = 'Complete';
      const projectName = (p.project_name || '').toLowerCase();
      if (projectName.includes('lg') || projectName.includes('clarksville')) {
        status = 'Active';
      }

      return {
        ...p,
        total_hours: totalHrs,
        overtime_percentage: parseFloat(otPercentage),
        overtime_cost_impact: Math.round(otCost),
        status: status
      };
    }).sort((a, b) => b.overtime_percentage - a.overtime_percentage);

    return {
      success: true,
      report: {
        summary: {
          total_hours: totalHours,
          regular_hours: totalRegularHours,
          overtime_hours: totalOvertimeHours,
          doubletime_hours: totalDoubletimeHours,
          overtime_percentage: parseFloat(overtimePercentage),
          overtime_cost_impact: Math.round(overtimeCost),
          explanation: `Overtime % = (OT Hours + DT Hours) / Total Hours × 100. Industry target: <15%. Cost impact calculated at $${avgHourlyRate}/hr base rate (OT = 1.5x, DT = 2x premium).`
        },
        by_project: projectAnalysis,
        high_ot_projects: projectAnalysis.filter(p => p.overtime_percentage > 15),
        recommendations: overtimePercentage > 15 ? [
          `Portfolio OT at ${overtimePercentage}% exceeds industry target of 15%`,
          `Consider crew scheduling optimization to reduce premium labor costs`,
          `Review projects with >20% OT for staffing adjustments`
        ] : [
          `Portfolio OT at ${overtimePercentage}% is within healthy range (<15%)`
        ]
      }
    };

  } catch (error) {
    console.error('❌ Error generating overtime report:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Constraints Report Endpoint
 * GET /api/bi/reports/constraints
 *
 * Groups constraints by project showing:
 * - Top constraints per project
 * - Recurring issues across portfolio
 * - Cost impact breakdown
 */
async function getConstraintsReport() {
  try {
    console.log('📊 Generating Constraints Report...');

    // Fetch all constraints
    const constraints = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'CONSTRAINT#'
      }
    }));

    const allConstraints = constraints.Items || [];

    // Group by project
    const byProject = {};
    allConstraints.forEach(c => {
      const projectId = c.project_id || 'unknown';
      if (!byProject[projectId]) {
        byProject[projectId] = {
          project_id: projectId,
          project_name: c.project_name || 'Unknown Project',
          total_constraints: 0,
          total_cost_impact: 0,
          active: 0,
          resolved: 0,
          constraints: []
        };
      }

      byProject[projectId].total_constraints++;
      byProject[projectId].total_cost_impact += (c.total_cost_impact || 0);

      if (c.resolution_status === 'resolved') {
        byProject[projectId].resolved++;
      } else {
        byProject[projectId].active++;
      }

      byProject[projectId].constraints.push({
        constraint_id: c.SK,
        category: c.category || 'uncategorized',
        description: c.description || c.issue_summary || 'No description',
        total_cost_impact: c.total_cost_impact || 0,
        resolution_status: c.resolution_status || 'pending',
        date: c.report_date || c.created_at,
        report_id: c.report_id || null
      });
    });

    // Sort projects by cost impact
    const projectList = Object.values(byProject)
      .map(p => ({
        ...p,
        constraints: p.constraints.sort((a, b) => b.total_cost_impact - a.total_cost_impact).slice(0, 10) // Top 10 per project
      }))
      .sort((a, b) => b.total_cost_impact - a.total_cost_impact);

    // Find recurring issues (same category + similar description across projects)
    const categoryCount = {};
    allConstraints.forEach(c => {
      const cat = c.category || 'uncategorized';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    const recurringIssues = Object.entries(categoryCount)
      .filter(([cat, count]) => count > 3)
      .map(([cat, count]) => ({
        category: cat,
        occurrence_count: count,
        total_cost: allConstraints.filter(c => c.category === cat).reduce((sum, c) => sum + (c.total_cost_impact || 0), 0)
      }))
      .sort((a, b) => b.total_cost - a.total_cost);

    return {
      success: true,
      report: {
        summary: {
          total_constraints: allConstraints.length,
          total_cost_impact: allConstraints.reduce((sum, c) => sum + (c.total_cost_impact || 0), 0),
          active: allConstraints.filter(c => c.resolution_status !== 'resolved').length,
          resolved: allConstraints.filter(c => c.resolution_status === 'resolved').length,
          explanation: 'Constraints are issues, delays, or problems identified in daily reports that impact project cost or schedule. Click any constraint to view the source report.'
        },
        by_project: projectList,
        recurring_issues: recurringIssues,
        top_constraints_portfolio: allConstraints
          .sort((a, b) => b.total_cost_impact - a.total_cost_impact)
          .slice(0, 20)
          .map(c => ({
            project_name: c.project_name,
            category: c.category,
            description: c.description || c.issue_summary,
            total_cost_impact: c.total_cost_impact,
            resolution_status: c.resolution_status,
            report_id: c.report_id
          }))
      }
    };

  } catch (error) {
    console.error('❌ Error generating constraints report:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Cost Analysis Report Endpoint
 * GET /api/bi/reports/savings
 *
 * Analyzes cost reduction opportunities:
 * - Identified savings by category
 * - High-cost areas with low performance
 * - Cost trends and variances
 */
async function getCostAnalysisReport() {
  try {
    console.log('📊 Generating Cost Analysis Report...');

    // Fetch recommendations (cost reduction opportunities)
    const recommendations = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'RECOMMENDATIONS'
      }
    }));

    // Fetch hours summaries for labor cost trends
    const hoursSummaries = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'HOURS_SUMMARY'
      }
    }));

    // Fetch constraints for issue-related costs
    const constraints = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'CONSTRAINT#'
      }
    }));

    const recs = recommendations.Items || [];
    const summaries = hoursSummaries.Items || [];
    const constraintsList = constraints.Items || [];

    // Parse recommendations for savings opportunities
    const savingsOpportunities = [];
    recs.forEach(rec => {
      const recsData = rec.recommendations || [];
      recsData.forEach(r => {
        if (r.estimated_savings > 0) {
          savingsOpportunities.push({
            project_name: rec.project_name,
            category: r.category || 'operational',
            recommendation: r.recommendation,
            estimated_savings: r.estimated_savings,
            implementation_timeline: r.implementation_timeline,
            priority: r.priority
          });
        }
      });
    });

    // Group savings by category
    const savingsByCategory = {};
    savingsOpportunities.forEach(s => {
      const cat = s.category;
      if (!savingsByCategory[cat]) {
        savingsByCategory[cat] = {
          category: cat,
          total_savings: 0,
          count: 0,
          opportunities: []
        };
      }
      savingsByCategory[cat].total_savings += s.estimated_savings;
      savingsByCategory[cat].count++;
      savingsByCategory[cat].opportunities.push(s);
    });

    const savingsBreakdown = Object.values(savingsByCategory)
      .sort((a, b) => b.total_savings - a.total_savings);

    // Calculate labor cost trends
    const totalLaborCost = summaries.reduce((sum, s) => sum + (s.total_labor_cost || 0), 0);
    const constraintCost = constraintsList.reduce((sum, c) => sum + (c.total_cost_impact || 0), 0);

    // High-cost areas
    const laborByProject = {};
    summaries.forEach(s => {
      const pid = s.project_id || 'unknown';
      if (!laborByProject[pid]) {
        laborByProject[pid] = {
          project_name: s.project_name,
          total_cost: 0
        };
      }
      laborByProject[pid].total_cost += (s.total_labor_cost || 0);
    });

    const highCostProjects = Object.values(laborByProject)
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, 5);

    return {
      success: true,
      report: {
        summary: {
          total_identified_savings: savingsOpportunities.reduce((sum, s) => sum + s.estimated_savings, 0),
          total_labor_cost_mtd: totalLaborCost,
          total_constraint_costs: constraintCost,
          savings_categories_count: savingsBreakdown.length,
          explanation: 'Cost reduction opportunities identified by AI analysis of daily reports, including labor optimization, vendor negotiations, rework prevention, and process improvements.'
        },
        savings_by_category: savingsBreakdown,
        top_opportunities: savingsOpportunities
          .sort((a, b) => b.estimated_savings - a.estimated_savings)
          .slice(0, 10),
        high_cost_areas: highCostProjects,
        cost_breakdown: {
          labor_costs: totalLaborCost,
          constraint_costs: constraintCost,
          potential_savings: savingsOpportunities.reduce((sum, s) => sum + s.estimated_savings, 0)
        }
      }
    };

  } catch (error) {
    console.error('❌ Error generating cost analysis report:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delivery Performance Report Endpoint
 * GET /api/bi/reports/deliveries
 *
 * Shows vendor/supplier delivery performance
 * NOTE: Placeholder for now - no delivery tracking data exists yet
 */
async function getDeliveryPerformanceReport() {
  try {
    console.log('📊 Generating Delivery Performance Report...');

    // Check for vendor performance data
    const vendorPerf = await docClient.send(new ScanCommand({
      TableName: 'sitelogix-analytics',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'VENDOR_PERFORMANCE'
      },
      Limit: 10
    }));

    const vendors = vendorPerf.Items || [];

    if (vendors.length === 0) {
      return {
        success: true,
        report: {
          status: 'no_data',
          message: 'Vendor delivery tracking is not currently active',
          explanation: 'To enable delivery performance metrics, daily reports need to include vendor delivery information (vendor name, delivery date, on-time status, products delivered). This feature will be available in a future update.',
          placeholder_data: {
            planned_metrics: [
              'On-time Delivery Rate % by vendor',
              'Average delivery lead time',
              'Number of deliveries per vendor',
              'Primary products/materials by vendor',
              'Late delivery reasons and trends'
            ]
          }
        }
      };
    }

    // If we have vendor data, process it
    const vendorStats = vendors.map(v => ({
      vendor_name: v.vendor_name,
      total_deliveries: v.total_deliveries || 0,
      on_time_deliveries: v.on_time_delivery_count || 0,
      on_time_rate: v.total_deliveries > 0 ? ((v.on_time_delivery_count / v.total_deliveries) * 100).toFixed(1) : 0,
      primary_products: v.primary_products || []
    }));

    return {
      success: true,
      report: {
        status: 'active',
        vendors: vendorStats,
        summary: {
          total_vendors: vendors.length,
          avg_on_time_rate: vendors.length > 0
            ? (vendorStats.reduce((sum, v) => sum + parseFloat(v.on_time_rate), 0) / vendors.length).toFixed(1)
            : 0
        }
      }
    };

  } catch (error) {
    console.error('❌ Error generating delivery performance report:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  getExecutiveDashboard,
  getPersonnelIntelligence,
  getVendorIntelligence,
  getProjectHealth,
  getConstraintAnalytics,
  getStrategicInsights,
  queryWithAI,
  getOvertimeReport,
  getConstraintsReport,
  getCostAnalysisReport,
  getDeliveryPerformanceReport
};
