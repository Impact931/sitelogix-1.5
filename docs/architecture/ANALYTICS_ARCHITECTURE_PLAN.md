# SiteLogix Analytics Architecture Plan
## AI-Powered Construction Intelligence System

**Version:** 1.0
**Date:** November 4, 2025
**Status:** Architecture Planning Phase

---

## Executive Summary

This document outlines the comprehensive architecture for SiteLogix's AI-powered analytics system. The system will leverage OpenAI GPT-4 and AWS AI/ML services to transform raw voice report transcripts into actionable business intelligence, automatically detecting patterns, risks, and opportunities across construction projects.

**Core Capabilities:**
- Personnel hours tracking with overtime analysis
- Vendor/supplier performance monitoring and anomaly detection
- Issue and delay tracking with impact assessment
- Automated flagging of critical events (injuries, major delays, equipment failures)
- Historical pattern recognition and predictive analytics
- Financial impact modeling and cost overrun predictions

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Voice Report Input                          │
│              (Roxy - Transcript & Extraction)                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Entity Normalization & Storage                      │
│   • Personnel Master Data    • Projects Master Data             │
│   • Vendors Master Data      • Report Metadata                  │
│                     (DynamoDB)                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Analytics Processing Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐         │
│  │   OpenAI     │  │ AWS Bedrock  │  │  AWS Comprehend│        │
│  │  GPT-4 Turbo │  │  Claude 3.5  │  │   Sentiment    │        │
│  │              │  │              │  │   NER/NLP      │        │
│  └──────────────┘  └──────────────┘  └───────────────┘         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Specialized Analytics Agents                     │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌──────────┐│
│  │   Hours     │ │  Vendor     │ │   Issues &   │ │Financial ││
│  │ Calculator  │ │ Performance │ │  Constraints │ │ Impact   ││
│  └─────────────┘ └─────────────┘ └──────────────┘ └──────────┘│
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌──────────┐│
│  │  Pattern    │ │   Critical  │ │  Predictive  │ │Sentiment ││
│  │ Recognition │ │   Event     │ │  Analytics   │ │ Analysis ││
│  │             │ │   Flagging  │ │              │ │          ││
│  └─────────────┘ └─────────────┘ └──────────────┘ └──────────┘│
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Analytics Storage & Caching Layer                   │
│  • Time-series metrics (DynamoDB)                               │
│  • Aggregated insights (ElastiCache Redis)                      │
│  • Historical patterns (S3 + Athena)                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Analytics Dashboard (Frontend)                  │
│  • Real-time KPIs    • Trend Visualizations                     │
│  • Alert Feed        • Predictive Insights                      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

**AI/ML Services:**
- **OpenAI GPT-4 Turbo**: Complex reasoning, multi-entity analysis, impact assessment
- **AWS Bedrock (Claude 3.5)**: High-volume batch processing, pattern recognition
- **AWS Comprehend**: NER (Named Entity Recognition), sentiment analysis, key phrases
- **AWS SageMaker**: Custom ML models for predictions (optional Phase 2)

**Backend Infrastructure:**
- **AWS Lambda**: Serverless analytics processing
- **AWS Step Functions**: Orchestrate multi-step analytics workflows
- **DynamoDB**: Real-time analytics storage, time-series metrics
- **S3 + Athena**: Historical data warehouse for complex queries
- **ElastiCache (Redis)**: Cache aggregated insights, reduce API calls

**Frontend:**
- **React + TypeScript**: Analytics dashboard UI
- **Recharts/D3.js**: Interactive data visualizations
- **WebSockets (AWS AppSync)**: Real-time alert streaming

---

## 2. Core Analytics Agents

### 2.1 Hours Calculator Agent

**Purpose:** Track personnel hours per person per job with overtime calculations

**Inputs:**
- `extracted_data.additional_personnel[]` - Personnel list from reports
- `extracted_data.work_completed[]` - Work activities
- Report date and project ID

**Processing Logic:**
```typescript
interface PersonnelHours {
  person_id: string;
  canonical_name: string;
  date: string;
  project_id: string;
  regular_hours: number;
  overtime_hours: number;
  overtime_percentage: number;
  role: string;
  activities: string[];
}

// Calculation rules:
// - 0-8 hours: Regular time
// - 8-10 hours: 1.5x overtime
// - 10+ hours: 2.0x overtime
// - Weekly total > 40 hours: Additional OT calculation
```

**AI Prompts (OpenAI GPT-4):**
```
Given this construction report transcript:
{transcript}

And these extracted personnel mentions:
{personnel_list}

For each person:
1. Infer their approximate hours worked based on:
   - Activities mentioned
   - Time references in transcript ("started at 7am", "worked until 6pm")
   - Typical construction shift patterns
   - Weather or site conditions affecting hours

2. Categorize as regular vs overtime hours
3. Identify specific activities each person performed
4. Flag any unusual hour patterns (excessive OT, very short shifts)

Return structured JSON with confidence scores.
```

**Outputs:**
- Daily hours by person stored in `sitelogix-analytics` DynamoDB table
- Weekly/monthly aggregations cached in Redis
- Overtime trend alerts for supervisors
- Cost impact calculations

---

### 2.2 Vendor Performance Agent

**Purpose:** Track supplier/vendor performance over time, detect patterns

**Inputs:**
- `extracted_data.vendors[]` - Vendor deliveries from reports
- Historical vendor data from previous reports
- Expected delivery schedules (if available)

**Tracked Metrics:**
```typescript
interface VendorPerformance {
  vendor_id: string;
  canonical_name: string;
  total_deliveries: number;
  on_time_deliveries: number;
  late_deliveries: number;
  missed_deliveries: number;
  average_delay_hours: number;
  quality_issues: number;
  performance_score: number; // 0-100
  trend: 'improving' | 'declining' | 'stable';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}
```

**AI Analysis (AWS Bedrock Claude 3.5):**
```
Analyze this vendor's delivery history across {N} reports:

Deliveries: {vendor_deliveries_json}

For vendor "{vendor_name}":
1. Identify delivery patterns (day of week, time of day)
2. Detect quality issues mentioned in transcripts
3. Compare to other vendors for similar materials
4. Assess impact of late/missed deliveries on project timeline
5. Predict likelihood of future delays based on patterns
6. Calculate performance score (0-100)

Return analysis with specific examples from transcripts.
```

**Cross-Reference Analysis:**
- Link vendor mentions to activities: "concrete delivery from Ferguson delayed the foundation pour"
- Track cascade effects: "late rebar delivery caused 2-day delay in framing"
- Calculate financial impact: "delay cost = crew idle time + equipment rental + schedule impact"

**Alert Triggers:**
- 2+ consecutive late deliveries → Warning
- 3+ late deliveries in 30 days → Critical
- Quality issue mentioned → Immediate flag
- Missed delivery → Urgent notification

---

### 2.3 Issues & Constraints Agent

**Purpose:** Track problems, broken items, damage, delays with impact assessment

**Inputs:**
- `extracted_data.issues[]` - Extracted issues from report
- `extracted_data.constraints[]` - Blocking factors
- Transcript full text for context

**Issue Classification:**
```typescript
interface Issue {
  issue_id: string;
  category: 'damage' | 'breakage' | 'delay' | 'safety' | 'quality' | 'other';
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  description: string;
  affected_activities: string[];
  affected_personnel: string[];
  affected_vendors: string[];
  estimated_delay_hours: number;
  estimated_cost_impact: number;
  resolution_status: 'open' | 'in_progress' | 'resolved';
  resolution_date?: string;
  root_cause?: string;
  preventable: boolean;
}
```

**AI Sentiment & Impact Analysis (AWS Comprehend + OpenAI):**

**Step 1: AWS Comprehend**
- Sentiment analysis of issue description
- Key phrase extraction
- Entity recognition (equipment, materials, people)

**Step 2: OpenAI GPT-4 Impact Assessment**
```
Analyze this construction issue:

Issue: "{issue_description}"
Context from transcript: "{surrounding_context}"

Provide:
1. Severity classification (minor/moderate/major/critical)
2. Estimated delay impact in hours/days
3. Estimated cost impact with breakdown
4. Root cause analysis
5. Whether this was preventable
6. Recommended corrective actions
7. Similar historical issues for pattern detection

Format as structured JSON with confidence scores.
```

**Pattern Recognition:**
- Recurring equipment failures
- Common vendor-related delays
- Weather impact patterns
- Specific subcontractor quality issues

---

### 2.4 Critical Event Flagging Agent

**Purpose:** Automatically detect and escalate critical events

**Monitored Event Types:**
```typescript
type CriticalEvent =
  | 'injury'           // Any mention of injury, accident, hospital
  | 'major_damage'     // Structural damage, equipment failure > $10k
  | 'major_delay'      // Delay > 1 day or affecting critical path
  | 'safety_violation' // OSHA violations, unsafe conditions
  | 'stop_work_order'  // Work stoppage, regulatory issues
  | 'weather_emergency'// Hurricane, flooding, severe storms
  | 'quality_failure'; // Failed inspection, rework required
```

**Real-Time Detection Pipeline:**

**Step 1: Keyword Detection (Fast Screening)**
```typescript
const criticalKeywords = {
  injury: ['injury', 'injured', 'accident', 'ambulance', 'hospital', 'ER', 'hurt', 'medical'],
  safety: ['unsafe', 'OSHA', 'violation', 'hazard', 'danger', 'risk'],
  damage: ['collapse', 'structural damage', 'failed', 'broken', 'destroyed'],
  // ... more categories
};
```

**Step 2: AI Confirmation (OpenAI GPT-4)**
```
URGENT: Analyze this transcript segment for critical events:

"{transcript_segment}"

Detected keywords: {keywords_found}

Confirm if this is a TRUE critical event requiring immediate supervisor notification:
1. What exactly happened?
2. Who was involved?
3. Immediate actions taken?
4. Severity level (1-10)?
5. Requires executive notification? (Yes/No)
6. Recommended next steps?

Be conservative - false positives are better than missed critical events.
```

**Notification Routing:**
```typescript
interface AlertRouting {
  event_type: CriticalEvent;
  severity: 1-10;
  immediate_notify: string[]; // Email/SMS to supervisors
  escalate_to: string[];      // Executives if severity > 7
  slack_channel: string;
  create_incident_ticket: boolean;
}

// Example routing rules:
const routingRules = {
  injury: {
    severity: >= 8,
    immediate_notify: ['safety_manager', 'project_manager', 'site_supervisor'],
    escalate_to: ['vp_operations', 'ceo'],
    create_incident_ticket: true
  },
  major_delay: {
    severity: >= 6,
    immediate_notify: ['project_manager', 'scheduler'],
    escalate_to: severity >= 8 ? ['vp_operations'] : []
  }
};
```

---

### 2.5 Historical Pattern Recognition Agent

**Purpose:** Identify trends, recurring issues, and predictive insights

**Analysis Types:**

**A. Temporal Patterns**
```sql
-- Example queries for pattern detection

-- Weekly productivity trends
SELECT
  DATE_TRUNC('week', report_date) as week,
  AVG(total_regular_hours) as avg_hours,
  AVG(total_overtime_hours) as avg_ot,
  COUNT(DISTINCT personnel_id) as crew_size,
  SUM(CASE WHEN issues.severity = 'critical' THEN 1 ELSE 0 END) as critical_issues
FROM sitelogix_reports
GROUP BY week
ORDER BY week DESC;

-- Vendor delay patterns by day of week
SELECT
  EXTRACT(DOW FROM delivery_date) as day_of_week,
  vendor_id,
  AVG(delay_hours) as avg_delay,
  COUNT(*) as delivery_count
FROM vendor_deliveries
WHERE delay_hours > 0
GROUP BY day_of_week, vendor_id;
```

**B. Correlation Analysis (AI-Powered)**

**OpenAI GPT-4 Prompt:**
```
Analyze these 30 days of construction reports to find correlations:

Reports summary: {aggregated_data}

Identify:
1. Weather impact on productivity (hours worked vs weather conditions)
2. Vendor delivery patterns affecting schedule adherence
3. Personnel combinations that have higher/lower productivity
4. Common sequences of events leading to delays
5. Early warning signals that predict future issues

For each correlation found:
- Strength of correlation (weak/moderate/strong)
- Statistical confidence
- Business impact
- Actionable recommendations
```

**C. Predictive Models**

**Delay Prediction Model:**
```python
# Train on historical data
features = [
  'weather_forecast',
  'vendor_reliability_score',
  'crew_size',
  'project_phase',
  'recent_issue_count',
  'day_of_week'
]

# Predict probability of delay tomorrow
delay_probability = model.predict(tomorrow_features)

if delay_probability > 0.7:
    send_alert("High risk of delay tomorrow", details)
```

**Cost Overrun Prediction:**
```typescript
interface CostPrediction {
  project_id: string;
  current_budget_used_pct: number;
  predicted_final_cost: number;
  predicted_overrun_pct: number;
  confidence: number;
  contributing_factors: {
    factor: string;
    impact_pct: number;
  }[];
  recommendations: string[];
}
```

---

### 2.6 Financial Impact Agent

**Purpose:** Calculate cost implications of issues, delays, and inefficiencies

**Cost Categories:**
```typescript
interface FinancialImpact {
  // Direct costs
  labor_cost: {
    regular_hours_cost: number;
    overtime_premium: number;
    idle_time_cost: number;
  };

  // Material costs
  material_costs: {
    wasted_materials: number;
    emergency_materials_premium: number;
    storage_costs: number;
  };

  // Equipment costs
  equipment_costs: {
    rental_overruns: number;
    idle_equipment: number;
    damage_repairs: number;
  };

  // Delay penalties
  delay_impacts: {
    liquidated_damages: number;
    schedule_compression_costs: number;
    customer_relationship_impact: number; // qualitative
  };

  // Opportunity costs
  opportunity_costs: {
    lost_bids_due_to_resource_allocation: number;
    reputation_impact: number; // qualitative
  };
}
```

**AI Cost Estimation (OpenAI GPT-4):**
```
Given this construction issue:

Issue: "{issue_description}"
Project type: {project_type}
Location: {location}
Crew size: {crew_size}

Estimate financial impact in these categories:
1. Direct labor costs (idle crew time, OT to recover)
2. Material costs (waste, emergency procurement)
3. Equipment costs (rental overrun, damage)
4. Schedule delay penalties (if critical path affected)
5. Indirect costs (supervision, rework quality checks)

Provide:
- Conservative estimate (low)
- Most likely estimate (mid)
- Worst case estimate (high)
- Confidence interval

Use industry standards for construction cost rates.
```

---

## 3. Technical Implementation

### 3.1 Analytics Processing Pipeline

**Lambda Function: `analytics-processor`**

```typescript
// backend/src/functions/analytics-processor.ts

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import OpenAI from 'openai';

export const handler = async (event) => {
  const { report_id, trigger_type } = event;

  // Fetch report data
  const report = await getReport(report_id);

  // Run analytics agents in parallel
  const results = await Promise.all([
    runHoursCalculator(report),
    runVendorPerformanceAnalysis(report),
    runIssuesAnalysis(report),
    runCriticalEventDetection(report),
    runFinancialImpactAnalysis(report)
  ]);

  // Store results
  await storeAnalytics(report_id, results);

  // Check for alerts
  await processAlerts(results);

  return { success: true, analytics: results };
};

async function runHoursCalculator(report: Report) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const prompt = `
Analyze personnel hours from this construction report:

Date: ${report.report_date}
Project: ${report.project_name}

Transcript:
${report.transcript}

Personnel mentioned:
${JSON.stringify(report.extracted_data.additional_personnel, null, 2)}

For each person, estimate:
1. Hours worked (regular vs overtime)
2. Specific activities performed
3. Confidence level (0-1)

Return JSON array of PersonnelHours objects.
  `;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: 'You are a construction workforce analytics expert.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3
  });

  const hoursData = JSON.parse(completion.choices[0].message.content);

  // Store in DynamoDB
  await storePersonnelHours(report.report_id, hoursData);

  return hoursData;
}

async function runVendorPerformanceAnalysis(report: Report) {
  // Use AWS Bedrock Claude for batch processing
  const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });

  for (const vendor of report.extracted_data.vendors) {
    // Get historical data
    const history = await getVendorHistory(vendor.canonical_name);

    const prompt = `
Analyze vendor performance:

Vendor: ${vendor.canonical_name}
Current delivery: ${JSON.stringify(vendor)}
Historical deliveries (last 30 days): ${JSON.stringify(history)}

Provide:
1. Performance score (0-100)
2. Reliability trend (improving/declining/stable)
3. Risk assessment (low/medium/high/critical)
4. Specific issues from transcripts
5. Recommendations

Return as JSON.
    `;

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Store vendor performance metrics
    await storeVendorPerformance(vendor.vendor_id, responseBody);
  }
}

async function runCriticalEventDetection(report: Report) {
  // Fast keyword screening
  const keywords = detectCriticalKeywords(report.transcript);

  if (keywords.length === 0) {
    return { critical_events: [] };
  }

  // AI confirmation for potential critical events
  const openai = new OpenAI();

  const prompt = `
URGENT: Analyze for critical safety/operational events:

Transcript segment:
${report.transcript}

Detected keywords: ${keywords.join(', ')}

Is this a critical event requiring immediate supervisor notification?
If yes, provide:
- Event type (injury/damage/delay/safety/other)
- Severity (1-10)
- Who involved
- What happened
- Immediate actions taken
- Recommended next steps

Return as JSON with is_critical boolean.
  `;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: 'You are a construction safety analyst. Be conservative - report potential critical events.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' }
  });

  const analysis = JSON.parse(completion.choices[0].message.content);

  if (analysis.is_critical) {
    // Send immediate alerts
    await sendCriticalAlert(report, analysis);
  }

  return analysis;
}
```

### 3.2 Batch Historical Analysis

**Step Function Workflow: `historical-pattern-analysis`**

```yaml
# Step function definition
StartAt: FetchHistoricalReports
States:
  FetchHistoricalReports:
    Type: Task
    Resource: arn:aws:lambda:function:fetch-reports
    Parameters:
      days_back: 90
    Next: AnalyzePatterns

  AnalyzePatterns:
    Type: Parallel
    Branches:
      - StartAt: ProductivityTrends
        States:
          ProductivityTrends:
            Type: Task
            Resource: arn:aws:lambda:function:analyze-productivity
            End: true

      - StartAt: VendorPatterns
        States:
          VendorPatterns:
            Type: Task
            Resource: arn:aws:lambda:function:analyze-vendor-patterns
            End: true

      - StartAt: IssueCorrelations
        States:
          IssueCorrelations:
            Type: Task
            Resource: arn:aws:lambda:function:analyze-issue-correlations
            End: true
    Next: GenerateInsights

  GenerateInsights:
    Type: Task
    Resource: arn:aws:lambda:function:generate-insights
    Parameters:
      analysis_results.$: $
    Next: CacheResults

  CacheResults:
    Type: Task
    Resource: arn:aws:lambda:function:cache-insights
    End: true
```

### 3.3 Data Storage Schema

**DynamoDB Table: `sitelogix-analytics`**

```typescript
// PK/SK patterns for analytics data

// Personnel hours (daily)
{
  PK: 'PERSONNEL_HOURS#person_001',
  SK: 'DATE#2025-11-04',
  person_id: 'person_001',
  person_name: 'Scott Russell',
  project_id: 'project_001',
  regular_hours: 8.5,
  overtime_hours: 2.0,
  activities: ['framing', 'cleanup'],
  confidence: 0.89
}

// Vendor performance (aggregated)
{
  PK: 'VENDOR_PERFORMANCE#vendor_005',
  SK: 'MONTH#2025-11',
  vendor_id: 'vendor_005',
  vendor_name: 'Ferguson Supply',
  deliveries_total: 12,
  deliveries_on_time: 8,
  deliveries_late: 4,
  avg_delay_hours: 3.2,
  performance_score: 72,
  trend: 'declining',
  risk_level: 'medium'
}

// Critical events
{
  PK: 'CRITICAL_EVENT#event_123',
  SK: 'TIMESTAMP#2025-11-04T14:30:00Z',
  event_type: 'injury',
  severity: 8,
  report_id: 'report_456',
  description: 'Worker fell from scaffold',
  affected_personnel: ['person_003'],
  actions_taken: 'Called ambulance, secured area',
  notification_sent: true,
  status: 'open'
}

// Pattern insights (cached)
{
  PK: 'INSIGHT#productivity_trend',
  SK: 'PROJECT#project_001',
  insight_type: 'productivity_trend',
  time_period: '90_days',
  finding: 'Productivity drops 23% on Mondays vs Tuesday-Thursday',
  confidence: 0.94,
  impact: 'high',
  recommendation: 'Schedule less critical work on Mondays',
  generated_at: '2025-11-04T10:00:00Z',
  ttl: 1699545600  // Expire after 7 days
}
```

**S3 Data Lake Structure**

```
s3://sitelogix-analytics/
  /raw-transcripts/
    /year=2025/
      /month=11/
        /day=04/
          report_abc123.txt

  /processed-analytics/
    /year=2025/
      /month=11/
        /personnel-hours/
          daily_hours_2025-11-04.parquet
        /vendor-performance/
          vendor_metrics_2025-11-04.parquet
        /issues/
          issues_2025-11-04.parquet

  /historical-patterns/
    /productivity-trends/
      quarterly_analysis_2025_Q4.json
    /vendor-trends/
      vendor_rankings_2025_Q4.json
```

---

## 4. API Endpoints

### 4.1 Analytics API Routes

**GET `/api/analytics/personnel-hours`**
```typescript
// Query parameters
{
  person_id?: string;
  project_id?: string;
  start_date: string;
  end_date: string;
  include_overtime: boolean;
}

// Response
{
  success: true,
  data: {
    total_regular_hours: 320,
    total_overtime_hours: 48,
    overtime_percentage: 15,
    daily_breakdown: [
      {
        date: '2025-11-04',
        personnel: [
          {
            person_id: 'person_001',
            name: 'Scott Russell',
            regular_hours: 8,
            overtime_hours: 2,
            activities: ['framing', 'cleanup']
          }
        ]
      }
    ],
    cost_summary: {
      regular_hours_cost: 12800,  // $40/hr * 320 hrs
      overtime_premium: 2880,      // $60/hr * 48 hrs
      total: 15680
    }
  }
}
```

**GET `/api/analytics/vendor-performance`**
```typescript
// Query parameters
{
  vendor_id?: string;
  time_period: '7d' | '30d' | '90d' | 'ytd';
  sort_by: 'performance_score' | 'delivery_count' | 'delay_average';
}

// Response
{
  success: true,
  data: {
    vendors: [
      {
        vendor_id: 'vendor_005',
        vendor_name: 'Ferguson Supply',
        performance_score: 72,
        deliveries: {
          total: 45,
          on_time: 32,
          late: 11,
          missed: 2
        },
        avg_delay_hours: 3.2,
        trend: 'declining',
        risk_level: 'medium',
        recent_issues: [
          'Late delivery of rebar on 11/02',
          'Incomplete order on 10/28'
        ],
        impact_summary: 'Caused 8 hours of crew idle time in past 30 days'
      }
    ]
  }
}
```

**GET `/api/analytics/critical-events`**
```typescript
// Response
{
  success: true,
  data: {
    active_events: [
      {
        event_id: 'event_123',
        event_type: 'injury',
        severity: 8,
        date: '2025-11-04',
        description: 'Worker fell from scaffold',
        status: 'open',
        assigned_to: 'safety_manager_001',
        actions_taken: ['Called ambulance', 'Secured area', 'OSHA notification filed']
      }
    ],
    recent_events: [...],
    event_counts: {
      last_7_days: 2,
      last_30_days: 5,
      last_90_days: 12
    }
  }
}
```

**GET `/api/analytics/insights`**
```typescript
// Get AI-generated insights
{
  success: true,
  insights: [
    {
      insight_id: 'insight_001',
      type: 'productivity_pattern',
      title: 'Monday Productivity Drop',
      finding: 'Average productivity is 23% lower on Mondays compared to Tuesday-Thursday',
      confidence: 0.94,
      impact: 'high',
      data_points: 90,
      time_period: 'Last 90 days',
      recommendation: 'Schedule less critical path work on Mondays. Consider team meetings or safety training.',
      estimated_value: '$4,200/month in productivity gains'
    },
    {
      insight_id: 'insight_002',
      type: 'vendor_risk',
      title: 'Ferguson Supply Declining Reliability',
      finding: 'Delivery delays increased from 10% to 35% over past 60 days',
      confidence: 0.91,
      impact: 'high',
      recommendation: 'Meet with Ferguson to address issues or identify backup supplier',
      estimated_risk: '$8,500 in potential delay costs'
    }
  ]
}
```

**POST `/api/analytics/predict-delays`**
```typescript
// Request
{
  project_id: 'project_001',
  forecast_days: 7
}

// Response
{
  success: true,
  predictions: [
    {
      date: '2025-11-05',
      delay_probability: 0.72,
      risk_level: 'high',
      contributing_factors: [
        { factor: 'Weather forecast shows rain', weight: 0.4 },
        { factor: 'Ferguson delivery scheduled (reliability: 65%)', weight: 0.3 },
        { factor: 'Reduced crew size (2 personnel out)', weight: 0.3 }
      ],
      recommendations: [
        'Order backup materials from alternate supplier',
        'Plan indoor work alternatives',
        'Brief crew on contingency plan'
      ]
    }
  ]
}
```

---

## 5. Frontend Analytics Dashboard

### 5.1 Dashboard Layout

**Analytics Page Structure:**

```
┌─────────────────────────────────────────────────────────────┐
│  Analytics Dashboard                        [Last Updated]  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Total      │  │  Active     │  │  Cost       │         │
│  │  Hours      │  │  Issues     │  │  Variance   │         │
│  │  1,240      │  │     8       │  │  -$12.5k    │         │
│  │  ↑ 12%      │  │  ⚠️ 3 High  │  │  ⚠️ -8.2%   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  🔥 Critical Alerts                                  │    │
│  │  • Injury reported at Site A - Requires action       │    │
│  │  • Ferguson Supply: 3rd late delivery this week      │    │
│  │  • High delay risk tomorrow (72% probability)        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────────────┐         │
│  │  Hours by        │  │  Vendor Performance       │         │
│  │  Project         │  │                           │         │
│  │  [Bar Chart]     │  │  [Performance Matrix]     │         │
│  └──────────────────┘  └──────────────────────────┘         │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  💡 AI Insights                                      │    │
│  │                                                       │    │
│  │  Monday Productivity Pattern                         │    │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━ 94% confidence          │    │
│  │  "Productivity drops 23% on Mondays..."              │    │
│  │  💰 Potential savings: $4,200/month                  │    │
│  │  [View Details]  [Implement Recommendation]          │    │
│  │                                                       │    │
│  │  Ferguson Supply Risk Alert                          │    │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━ 91% confidence          │    │
│  │  "Delivery reliability declined 35% over 60 days..." │    │
│  │  ⚠️ Estimated risk: $8,500                           │    │
│  │  [Contact Vendor]  [Find Alternative]                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  [View Historical Patterns]  [Run Custom Analysis]          │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 React Component Structure

```typescript
// frontend/src/components/AnalyticsDashboard.tsx

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  ScatterChart, Scatter, PieChart, Pie,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface AnalyticsDashboardProps {
  manager: Manager;
  project: Project;
}

export function AnalyticsDashboard({ manager, project }: AnalyticsDashboardProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [criticalEvents, setCriticalEvents] = useState<CriticalEvent[]>([]);
  const [personnelHours, setPersonnelHours] = useState<HoursData[]>([]);
  const [vendorPerformance, setVendorPerformance] = useState<VendorMetrics[]>([]);

  useEffect(() => {
    loadAnalytics();

    // WebSocket for real-time alerts
    const ws = new WebSocket(import.meta.env.VITE_WS_URL);
    ws.onmessage = (event) => {
      const alert = JSON.parse(event.data);
      if (alert.type === 'CRITICAL_EVENT') {
        showCriticalAlert(alert);
      }
    };

    return () => ws.close();
  }, [project.id]);

  const loadAnalytics = async () => {
    const [insightsRes, eventsRes, hoursRes, vendorsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/analytics/insights?project_id=${project.id}`),
      fetch(`${API_BASE_URL}/analytics/critical-events?project_id=${project.id}`),
      fetch(`${API_BASE_URL}/analytics/personnel-hours?project_id=${project.id}&time_period=30d`),
      fetch(`${API_BASE_URL}/analytics/vendor-performance?project_id=${project.id}&time_period=30d`)
    ]);

    setInsights(await insightsRes.json());
    setCriticalEvents(await eventsRes.json());
    setPersonnelHours(await hoursRes.json());
    setVendorPerformance(await vendorsRes.json());
  };

  return (
    <div className="analytics-dashboard">
      {/* KPI Cards */}
      <KPICards data={{ personnelHours, criticalEvents, vendorPerformance }} />

      {/* Critical Alerts Banner */}
      <CriticalAlertsBanner events={criticalEvents.filter(e => e.status === 'open')} />

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-6">
        <HoursByProjectChart data={personnelHours} />
        <VendorPerformanceMatrix data={vendorPerformance} />
        <IssuesTrendChart project_id={project.id} />
        <CostVarianceChart project_id={project.id} />
      </div>

      {/* AI Insights Panel */}
      <AIInsightsPanel insights={insights} />
    </div>
  );
}
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up OpenAI API integration
- [ ] Configure AWS Bedrock access
- [ ] Create analytics DynamoDB tables
- [ ] Build Hours Calculator agent
- [ ] Build basic Vendor Performance tracking
- [ ] Implement Critical Event detection
- [ ] Create initial analytics API endpoints
- [ ] Build basic dashboard with KPIs

**Deliverables:**
- Working hours tracking per person/job
- Vendor delivery tracking
- Critical event alerting
- Basic analytics dashboard

### Phase 2: Advanced Analytics (Weeks 3-4)
- [ ] Implement Financial Impact agent
- [ ] Build Historical Pattern Recognition
- [ ] Add AWS Comprehend for NER/sentiment
- [ ] Create cross-reference analysis (vendor→activity links)
- [ ] Implement prediction models
- [ ] Add advanced visualizations
- [ ] Build AI insights generator

**Deliverables:**
- Cost impact calculations
- Pattern detection and insights
- Predictive delay alerts
- Advanced analytics dashboard

### Phase 3: Optimization & Scale (Weeks 5-6)
- [ ] Add ElastiCache for caching
- [ ] Implement Step Functions for batch analysis
- [ ] Set up S3 data lake + Athena queries
- [ ] Build custom ML models (optional)
- [ ] Add real-time WebSocket alerts
- [ ] Performance optimization
- [ ] Documentation and training

**Deliverables:**
- Production-ready analytics system
- Historical data warehouse
- Real-time alerting
- Complete documentation

---

## 7. Cost Estimates

### Monthly Operating Costs (Estimated)

**AI/ML Services:**
- OpenAI API (GPT-4 Turbo): ~$200-400/month
  - ~10-20 reports/day × $0.01-0.03/report × 30 days
- AWS Bedrock (Claude 3.5): ~$100-200/month
  - Batch processing, pattern analysis
- AWS Comprehend: ~$50-100/month
  - NER, sentiment on transcripts

**Infrastructure:**
- Lambda invocations: ~$20/month
  - ~100,000 invocations at $0.20/million
- DynamoDB: ~$30-50/month
  - On-demand pricing for analytics data
- S3 + Athena: ~$20/month
  - Historical data storage and queries
- ElastiCache: ~$50/month
  - Small Redis cluster for caching

**Total Estimated Monthly Cost: $470-820**

**Cost Savings Potential:**
- Early delay detection: $5,000-15,000/month
- Vendor optimization: $2,000-8,000/month
- Overtime reduction: $3,000-10,000/month
- Issue prevention: $5,000-20,000/month

**Estimated ROI: 10-50x**

---

## 8. Success Metrics

### Key Performance Indicators

**Accuracy Metrics:**
- Hours calculation accuracy: > 90%
- Critical event detection recall: > 95% (no missed injuries/major issues)
- Vendor performance prediction accuracy: > 80%
- Delay prediction accuracy: > 75%

**Business Impact Metrics:**
- Time to detect critical events: < 2 hours from report submission
- Reduction in unplanned overtime: 15-25%
- Improvement in vendor on-time delivery: 10-20%
- Cost overrun early warning lead time: 2-4 weeks

**User Adoption Metrics:**
- Daily active users (supervisors): > 80%
- Insights acted upon: > 60%
- User satisfaction score: > 4.0/5.0

---

## 9. Next Steps

### Immediate Actions

1. **Week 1: Setup & POC**
   - Get OpenAI API keys
   - Configure AWS Bedrock access in us-east-1
   - Create DynamoDB analytics tables
   - Build simple Hours Calculator agent
   - Test on 5 existing reports

2. **Week 2: Core Agents**
   - Implement Vendor Performance agent
   - Build Critical Event detection
   - Create basic API endpoints
   - Build minimal analytics dashboard

3. **Week 3-4: Iteration**
   - Gather feedback from field testing
   - Refine AI prompts based on accuracy
   - Add Financial Impact calculations
   - Implement pattern recognition

### Decision Points

**OpenAI vs AWS Bedrock:**
- Use OpenAI GPT-4 for: Complex reasoning, financial impact, critical event analysis
- Use AWS Bedrock Claude for: High-volume batch processing, pattern recognition
- Use AWS Comprehend for: Basic NER, sentiment, key phrases

**Storage Strategy:**
- DynamoDB: Real-time analytics, current metrics
- S3 + Athena: Historical data warehouse, complex queries
- ElastiCache: Cached insights, aggregated metrics

---

## Appendix A: Sample AI Prompts

### Hours Calculation Prompt
```
You are analyzing a construction daily report to extract personnel hours.

Report Date: {date}
Project: {project_name}
Transcript:
{full_transcript}

Personnel mentioned:
{personnel_list}

For EACH person in the personnel list:
1. Estimate their hours worked based on:
   - Direct time mentions ("worked 8am to 5pm", "stayed late until 7")
   - Activity implications (if they performed multiple major tasks, likely full day)
   - Weather/site closures (if site closed early, reduce hours)
   - Role and typical hours (operators typically 8-10hrs, laborers 8hrs)

2. Classify hours:
   - Regular: 0-8 hours
   - Overtime: 8+ hours

3. List specific activities they performed

4. Assign confidence score (0.0-1.0):
   - 1.0 = Explicit "John worked 8 hours"
   - 0.8 = Strong inference from activities
   - 0.5 = Mentioned but unclear duration
   - 0.3 = Only peripheral mention

Return JSON:
{
  "personnel_hours": [
    {
      "person_id": "person_001",
      "canonical_name": "Scott Russell",
      "regular_hours": 8.0,
      "overtime_hours": 2.0,
      "activities": ["framing second floor", "cleanup"],
      "confidence": 0.85,
      "reasoning": "Mentioned working morning and staying late for cleanup"
    }
  ]
}
```

### Vendor Performance Prompt
```
You are a procurement analyst evaluating construction vendor performance.

Vendor: {vendor_name}

Recent Deliveries (last 30 days):
{delivery_history_json}

Current Delivery:
{current_delivery}

Transcript Context:
{transcript_segment}

Analyze:
1. Performance Score (0-100):
   - On-time delivery rate (40 points)
   - Quality issues (30 points)
   - Communication/responsiveness (20 points)
   - Competitive pricing (10 points)

2. Trend Analysis:
   - Is performance improving, declining, or stable?
   - Any recent pattern changes?

3. Risk Assessment:
   - Low: Consistent reliable delivery
   - Medium: Occasional delays but usually reliable
   - High: Frequent delays or quality issues
   - Critical: Multiple recent failures

4. Impact on Project:
   - How did delays affect crew productivity?
   - Any cascade effects on schedule?

5. Recommendations:
   - Continue as primary vendor?
   - Request performance improvement plan?
   - Identify backup supplier?

Return JSON with scores, analysis, and specific examples.
```

### Critical Event Detection Prompt
```
URGENT SAFETY ANALYSIS

Transcript segment:
"{transcript}"

Detected keywords: {keywords}

TASK: Determine if this describes a CRITICAL event requiring immediate supervisor notification.

Critical events include:
- ANY injury (no matter how minor it seems)
- Structural damage or collapse
- Equipment failure causing safety hazard
- OSHA violations or unsafe conditions
- Work stoppage or major delays (> 4 hours)
- Property damage > $5,000

For each potential event:
1. Is this ACTUALLY critical? (Yes/No)
2. Event type
3. Severity (1-10 scale)
4. Who was involved?
5. What exactly happened?
6. What immediate actions were taken?
7. Does this require executive escalation? (Yes if severity > 7)
8. Recommended next steps

IMPORTANT: Be conservative. False positive is better than missing a critical event.

Return JSON with is_critical boolean and full analysis.
```

---

## Appendix B: Database Indexes

**DynamoDB Global Secondary Indexes:**

```typescript
// GSI-1: Query personnel hours by project
{
  IndexName: 'project-date-index',
  KeySchema: [
    { AttributeName: 'project_id', KeyType: 'HASH' },
    { AttributeName: 'date', KeyType: 'RANGE' }
  ]
}

// GSI-2: Query critical events by severity
{
  IndexName: 'event-severity-index',
  KeySchema: [
    { AttributeName: 'event_type', KeyType: 'HASH' },
    { AttributeName: 'severity', KeyType: 'RANGE' }
  ]
}

// GSI-3: Query vendor performance by score
{
  IndexName: 'vendor-performance-index',
  KeySchema: [
    { AttributeName: 'performance_category', KeyType: 'HASH' },  // 'high'/'medium'/'low'
    { AttributeName: 'performance_score', KeyType: 'RANGE' }
  ]
}
```

---

## Questions for Discussion

1. **OpenAI vs Bedrock Split**: What's your preference for the primary AI provider? OpenAI has stronger reasoning, Bedrock has better AWS integration.

2. **Real-time vs Batch**: Should analytics run immediately after each report (real-time alerts) or in scheduled batches (lower cost)?

3. **Historical Data**: How many months of historical data should we analyze for patterns? (30/60/90 days?)

4. **Alert Thresholds**: What severity level should trigger SMS/email vs just dashboard notifications?

5. **Cost Management**: Set a monthly AI API budget ceiling? ($500? $1000?)

---

**END OF ARCHITECTURE PLAN**

Ready for your feedback and approval to begin implementation.
