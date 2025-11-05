# SiteLogix Business Intelligence Dashboard Architecture

## Executive Summary

Complete rework of Analytics Dashboard to leverage enhanced AI analytics agents and provide real-time business intelligence with drill-down capabilities.

## Problem Statement

**Current State:**
- API endpoints query for old data patterns that no longer exist
- 148 reports processed with enhanced analytics are NOT being displayed
- Dashboard shows empty/no functionality despite rich data in DynamoDB

**Root Cause:**
- API looks for `HOURS_SUMMARY`, `PERSONNEL_HOURS` records
- Enhanced agents store `PERSONNEL_HOURS#{person_id}`, `VENDOR_PERFORMANCE#{vendor_name}`, etc.
- Schema mismatch = empty dashboard

## Solution Architecture

### 1. New API Endpoints (7 Intelligent Query Endpoints)

#### Endpoint 1: Executive Dashboard (`GET /api/bi/executive`)
**Purpose:** Single-pane-of-glass for CEO/COO/CFO

**DynamoDB Queries:**
```javascript
// Query all EXECUTIVE_SUMMARY records
GSI1: GSI1PK = "DATE#{today}" (all projects for date)

// Query all RECOMMENDATIONS records for cost reduction
PK = "RECOMMENDATIONS#{project_id}" for each project

// Query HOURS_SUMMARY for labor costs
PK = "HOURS_SUMMARY#{project_id}"

// Query CONSTRAINT_SUMMARY for constraint costs
PK = "CONSTRAINT_SUMMARY#{project_id}"
```

**Response:**
```json
{
  "success": true,
  "dashboard": {
    "portfolio_health": {
      "average_quality_score": 85,
      "average_schedule_score": 78,
      "total_active_projects": 5,
      "projects_at_risk": 2
    },
    "financial_snapshot": {
      "total_labor_cost_month": 450000,
      "total_constraint_cost_month": 12500,
      "chargeback_pipeline": 8900,
      "cost_reduction_opportunities": 15000,
      "portfolio_roi": 3.2
    },
    "top_wins": [
      "Underground piping installation 2 days ahead of schedule",
      "Zero safety incidents across all projects"
    ],
    "top_concerns": [
      "Heat-related productivity loss: $8,500/month across 3 projects",
      "Vendor X: 3 late deliveries this week"
    ],
    "urgent_actions": [
      {
        "priority": "urgent",
        "title": "Implement heat mitigation policy",
        "estimated_savings": 8500,
        "timeline": "immediate"
      }
    ],
    "projects": [
      {
        "project_id": "cortex-commons",
        "project_name": "Cortex Commons",
        "health_score": 85,
        "quality_score": 90,
        "schedule_score": 75,
        "labor_cost_mtd": 120000,
        "constraint_cost_mtd": 3200,
        "top_concern": "Heat delays"
      }
    ]
  }
}
```

---

#### Endpoint 2: Personnel Intelligence (`GET /api/bi/personnel`)
**Purpose:** Labor cost analysis, OT tracking, heat impact, productivity

**Query Parameters:**
- `?project_id={id}` - Filter by project
- `?start_date={date}&end_date={date}` - Date range
- `?person_id={id}` - Individual worker analysis

**DynamoDB Queries:**
```javascript
// Get all personnel hours for date range
GSI1: GSI1PK = "PROJECT#{project_id}", GSI1SK between DATE#{start} and DATE#{end}

// Or query specific person
PK = "PERSONNEL_HOURS#{person_id}", SK between DATE#{start} and DATE#{end}
```

**Response:**
```json
{
  "success": true,
  "personnel_analytics": {
    "summary": {
      "total_hours": 2400,
      "regular_hours": 1920,
      "overtime_hours": 360,
      "double_time_hours": 120,
      "overtime_rate": 15.0,
      "double_time_rate": 5.0,
      "total_cost": 96000,
      "average_cost_per_hour": 40
    },
    "environmental_impacts": {
      "heat_early_departures": 15,
      "hours_lost_to_weather": 42,
      "cost_of_weather_delays": 2100
    },
    "top_ot_workers": [
      {
        "person_name": "John Smith",
        "total_hours": 120,
        "ot_hours": 32,
        "dt_hours": 8,
        "total_cost": 5600,
        "ot_driver": "Inspection deadline"
      }
    ],
    "by_project": [
      {
        "project_name": "Cortex Commons",
        "total_hours": 1200,
        "total_cost": 48000,
        "ot_rate": 12.5
      }
    ],
    "trends": {
      "weekly_ot_trend": [10.2, 12.5, 15.0, 14.8],
      "cost_trend": [38000, 42000, 48000, 45000]
    }
  }
}
```

---

#### Endpoint 3: Vendor Intelligence (`GET /api/bi/vendors`)
**Purpose:** Vendor performance, chargeback pipeline, A/B/C/D grading

**Query Parameters:**
- `?vendor_name={name}` - Specific vendor
- `?risk_level={low|medium|high|critical}` - Filter by risk
- `?grade={A|B|C|D}` - Filter by grade
- `?project_id={id}` - Project filter

**DynamoDB Queries:**
```javascript
// Get all vendors by risk level
GSI2: GSI2PK = "RISK#{risk_level}", sorted by performance_score

// Get vendors by grade
GSI3: GSI3PK = "GRADE#{grade}"

// Get chargebacks by status
GSI2: GSI2PK = "STATUS#{pending|approved}", sorted by amount DESC
```

**Response:**
```json
{
  "success": true,
  "vendor_analytics": {
    "summary": {
      "total_vendors": 25,
      "a_grade": 8,
      "b_grade": 12,
      "c_grade": 4,
      "d_grade": 1,
      "high_risk_vendors": 3,
      "total_chargebacks": 12500,
      "pending_chargebacks": 8900
    },
    "vendors": [
      {
        "vendor_name": "ABC Supply",
        "grade": "A",
        "performance_score": 95,
        "risk_level": "low",
        "trend": "improving",
        "deliveries": 24,
        "on_time_rate": 95.8,
        "incidents": 0,
        "chargebacks": 0,
        "recommendation": "highly_recommend",
        "grade_reasoning": {
          "delivery": "Consistently early deliveries",
          "quality": "Zero material issues",
          "communication": "Proactive updates"
        }
      },
      {
        "vendor_name": "Problem Vendor Inc",
        "grade": "D",
        "performance_score": 45,
        "risk_level": "critical",
        "trend": "declining",
        "deliveries": 8,
        "on_time_rate": 37.5,
        "incidents": 3,
        "total_incident_cost": 4500,
        "chargebacks": 2,
        "chargeback_amount": 3200,
        "chargeback_status": "pending",
        "recommendation": "replace",
        "grade_reasoning": {
          "delivery": "5 late deliveries in 2 weeks",
          "quality": "Damaged materials, incorrect quantities",
          "incidents": "3 incidents requiring rework"
        }
      }
    ],
    "chargeback_pipeline": [
      {
        "vendor_name": "Problem Vendor Inc",
        "extra_work_order": "EWO-2024-0045",
        "amount": 3200,
        "status": "pending",
        "justification": "Damaged materials required emergency replacement",
        "incident_summary": "3 incidents totaling $4,500 in rework"
      }
    ]
  }
}
```

---

#### Endpoint 4: Project Health (`GET /api/bi/projects/{project_id}/health`)
**Purpose:** Milestones, inspections, quality scores, schedule performance

**DynamoDB Queries:**
```javascript
// Get project health summary
PK = "PROJECT_HEALTH#{project_id}", SK = "DATE#{today}"

// Get all inspections
PK = "INSPECTION#{project_id}", SK begins_with "DATE#"

// Get all milestones
PK = "MILESTONE#{project_id}", SK begins_with "DATE#"

// Get quality metrics
PK = "QUALITY_METRICS#{project_id}", SK = "DATE#{today}"
```

**Response:**
```json
{
  "success": true,
  "project_health": {
    "summary": {
      "overall_quality_score": 85,
      "schedule_performance_score": 78,
      "health_trend": "stable",
      "quality_reasoning": "Inspection pass rate improving from 75% to 85%",
      "schedule_reasoning": "Level 2C pour delayed 2 days due to rain"
    },
    "inspections": {
      "total_inspections": 12,
      "passed": 10,
      "failed": 2,
      "pass_rate": 83.3,
      "first_attempt_pass_rate": 75.0,
      "average_cycle_time_days": 3.5,
      "recent_inspections": [
        {
          "inspection_type": "Level 2C pour prep",
          "status": "passed",
          "inspection_date": "2024-07-20",
          "first_attempt_pass": true,
          "cycle_time_days": 2
        },
        {
          "inspection_type": "Rough-in electrical",
          "status": "failed",
          "inspection_date": "2024-07-18",
          "deficiencies": [
            "Box height incorrect - 1/4 inch too low",
            "Missing ground wire in junction box"
          ],
          "root_cause": "measurement_error",
          "re_inspection_date": "2024-07-22",
          "rework_cost_estimate": 800
        }
      ]
    },
    "milestones": {
      "total_milestones": 8,
      "completed": 5,
      "on_track": 2,
      "at_risk": 1,
      "delayed": 0,
      "recent_milestones": [
        {
          "milestone_name": "Level 2C pour ready",
          "status": "completed",
          "completion_date": "2024-07-20",
          "target_date": "2024-07-22",
          "schedule_performance": "early",
          "schedule_variance_days": -2
        },
        {
          "milestone_name": "Electrical rough-in Level 3",
          "status": "at_risk",
          "completion_percentage": 65,
          "target_date": "2024-07-25",
          "remaining_blockers": [
            "Pending re-inspection approval",
            "Waiting for light fixture delivery"
          ]
        }
      ]
    },
    "risks": {
      "top_quality_risks": [
        "Electrical rough-in failure rate 25% - measurement accuracy issue",
        "Concrete pour delays due to weather"
      ],
      "top_schedule_risks": [
        "Level 3 electrical dependent on vendor delivery",
        "Rain forecast for next 3 days"
      ]
    }
  }
}
```

---

#### Endpoint 5: Constraint Analytics (`GET /api/bi/constraints`)
**Purpose:** Cost impact analysis, prevention opportunities, ROI tracking

**Query Parameters:**
- `?project_id={id}` - Project filter
- `?category={environmental|coordination|vendor|...}` - Category filter
- `?start_date={date}&end_date={date}` - Date range

**DynamoDB Queries:**
```javascript
// Get constraint summary
PK = "CONSTRAINT_SUMMARY#{project_id}", SK between DATE#{start} and DATE#{end}

// Get constraints by category
GSI1: GSI1PK = "CATEGORY#{category}", sorted by cost DESC

// Get constraints for project
PK = "CONSTRAINT#{project_id}", SK between DATE#{start} and DATE#{end}
```

**Response:**
```json
{
  "success": true,
  "constraint_analytics": {
    "summary": {
      "total_constraints": 45,
      "total_hours_lost": 128,
      "total_cost_impact": 17775,
      "cost_breakdown": {
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
    "recurring_issues": [
      {
        "issue": "Heat-related early departures",
        "frequency": 11,
        "total_cost": 8500,
        "trend": "increasing",
        "priority": "urgent",
        "prevention_opportunity": {
          "opportunity": "Implement heat mitigation policy with early starts",
          "estimated_savings_per_month": 8500,
          "implementation_cost": 500,
          "roi": 17.0,
          "action_steps": [
            "Start work at 6 AM instead of 7 AM during summer",
            "Provide cooling stations",
            "Implement mandatory water breaks"
          ]
        }
      },
      {
        "issue": "Trade coordination delays",
        "frequency": 5,
        "total_cost": 4200,
        "trend": "stable",
        "priority": "high",
        "prevention_opportunity": {
          "opportunity": "Daily trade coordination meetings",
          "estimated_savings_per_month": 4200,
          "implementation_cost": 200,
          "roi": 21.0
        }
      }
    ],
    "constraints_by_cost": [
      {
        "description": "Heat index exceeded 95°F causing early crew departure",
        "category": "environmental",
        "sub_category": "heat",
        "date": "2024-07-21",
        "hours_lost": 12,
        "crew_size": 8,
        "total_cost_impact": 4800,
        "preventable": "partially",
        "prevention_opportunity": "Early start times during summer"
      }
    ],
    "prevention_roi_summary": {
      "total_potential_savings": 12700,
      "total_implementation_cost": 700,
      "portfolio_roi": 18.1,
      "payback_period_days": 2
    }
  }
}
```

---

#### Endpoint 6: Strategic Insights (`GET /api/bi/recommendations`)
**Purpose:** AI-generated strategic recommendations, cross-functional patterns

**Query Parameters:**
- `?project_id={id}` - Project filter
- `?priority={urgent|high|medium|low}` - Filter by priority

**DynamoDB Queries:**
```javascript
// Get all recommendations
PK = "RECOMMENDATIONS#{project_id}", SK = "DATE#{today}"

// Get executive summaries
PK = "EXECUTIVE_SUMMARY#{project_id}", SK = "DATE#{today}"
```

**Response:**
```json
{
  "success": true,
  "strategic_insights": {
    "executive_summary": {
      "overall_health_score": 82,
      "health_reasoning": "Projects performing well with identified cost reduction opportunities",
      "top_wins": [
        "Inspection pass rate improved 10% this month",
        "Zero critical safety incidents"
      ],
      "top_concerns": [
        "Heat impacts costing $8,500/month",
        "Vendor coordination issues increasing"
      ],
      "financial_snapshot": {
        "labor_cost_variance": -2.3,
        "constraint_cost": 17775,
        "chargeback_pipeline": 12500,
        "potential_monthly_savings": 15000
      }
    },
    "cost_reduction_opportunities": [
      {
        "priority": "urgent",
        "category": "environmental",
        "title": "Implement Heat Mitigation Policy",
        "problem": "Heat-related early departures costing $8,500/month",
        "solution": "Start work at 6 AM, provide cooling stations, mandatory breaks",
        "expected_outcome": "Eliminate 90% of heat-related productivity loss",
        "roi": 17.0,
        "monthly_savings": 7650,
        "implementation_cost": 500,
        "timeline": "immediate",
        "success_metrics": [
          "Reduce early departures from 11/month to <2/month",
          "Maintain full crew until 3 PM during heat waves"
        ]
      }
    ],
    "risk_escalations": [
      {
        "severity": "high",
        "risk_type": "vendor_performance",
        "title": "Vendor X Performance Declining",
        "description": "3 late deliveries this week, D grade, 37.5% on-time rate",
        "impact": "$3,075 in delays, schedule risk for upcoming milestones",
        "recommended_action": "Replace vendor or implement penalty clauses",
        "timeline": "7 days"
      }
    ],
    "cross_functional_patterns": [
      {
        "pattern": "Heat + Vendor Delays = Compounding Schedule Impact",
        "description": "When heat causes early departures AND vendor is late, recovery is impossible",
        "agents_involved": ["personnel", "vendors", "constraints"],
        "cost_impact": 11500,
        "insight": "Prioritize vendor reliability during summer months"
      }
    ],
    "key_metrics": {
      "total_cost_reduction_potential": 15000,
      "total_implementation_cost": 1200,
      "portfolio_roi": 12.5,
      "urgent_actions": 2,
      "high_priority_actions": 3
    }
  }
}
```

---

#### Endpoint 7: AI Natural Language Query (`POST /api/bi/query`)
**Purpose:** Natural language to DynamoDB queries with GPT-4o

**Request:**
```json
{
  "query": "Which vendors are underperforming and costing us the most money?"
}
```

**Processing:**
1. Parse query with GPT-4o to identify intent and entities
2. Determine which DynamoDB tables/indexes to query
3. Execute queries
4. Synthesize results with GPT-4o
5. Return natural language answer + supporting data

**Response:**
```json
{
  "success": true,
  "analysis": {
    "bluf": "Problem Vendor Inc is your highest-cost underperformer with $7,700 in total impact (D grade, 37.5% on-time rate, 3 incidents, $3,200 in pending chargebacks). Recommendation: Replace immediately.",
    "insights": [
      {
        "vendor_name": "Problem Vendor Inc",
        "performance_grade": "D",
        "performance_score": 45,
        "on_time_rate": 37.5,
        "total_cost_impact": 7700,
        "breakdown": {
          "delay_costs": 3075,
          "incident_costs": 4500,
          "chargebacks_pending": 3200
        },
        "recommendation": "Replace vendor - consistent failures across delivery, quality, and communication"
      }
    ],
    "supporting_data": {
      "total_vendors_analyzed": 25,
      "underperforming_vendors": 5,
      "total_cost_of_underperformance": 12500
    }
  }
}
```

---

### 2. Frontend Dashboard Architecture

#### Component Hierarchy
```
AnalyticsDashboard/
├── ExecutiveDashboard/
│   ├── PortfolioHealthCard
│   ├── FinancialSnapshotCard
│   ├── TopWinsCard
│   ├── TopConcernsCard
│   ├── UrgentActionsCard
│   └── ProjectHealthGrid
├── PersonnelIntelligence/
│   ├── LaborCostSummary
│   ├── OvertimeTrendsChart
│   ├── EnvironmentalImpactCard
│   ├── TopOTWorkersTable
│   └── ProjectBreakdownChart
├── VendorIntelligence/
│   ├── VendorGradeDistribution
│   ├── RiskLevelBreakdown
│   ├── VendorPerformanceTable (sortable, filterable)
│   ├── ChargebackPipeline
│   └── VendorDetailModal
├── ProjectHealth/
│   ├── HealthScoreGauge
│   ├── InspectionPassRateChart
│   ├── MilestoneTimeline
│   ├── QualityRisksCard
│   └── ScheduleRisksCard
├── ConstraintAnalytics/
│   ├── CostImpactSummary
│   ├── CategoryBreakdown (pie chart)
│   ├── RecurringIssuesTable
│   ├── PreventionOpportunitiesCard
│   └── ROICalculator
├── StrategicInsights/
│   ├── ExecutiveSummary
│   ├── CostReductionOpportunities
│   ├── RiskEscalations
│   ├── CrossFunctionalPatterns
│   └── ActionItemTracker
└── AIQueryInterface/
    ├── NaturalLanguageInput
    ├── QuickQueryButtons
    ├── AnalysisResultDisplay
    └── DataVisualizationPanel
```

---

### 3. Data Flow Architecture

```
User Request
    ↓
Frontend Component
    ↓
API Call (GET /api/bi/{endpoint})
    ↓
Lambda Handler (api-handler.js)
    ↓
DynamoDB Query (using PK/SK patterns + GSI)
    ↓
Data Aggregation & Business Logic
    ↓
Response Formatting
    ↓
Frontend Visualization
    ↓
User Interaction (drill-down, filters)
```

---

### 4. Real-Time Analytics Strategy

**Batch Processing:**
- Enhanced analytics agents run on ALL new reports (automatic)
- Data written to DynamoDB immediately
- No caching - always query live data

**Query Optimization:**
- Use GSI indexes for efficient filtered queries
- Paginate large result sets
- Aggregate data in API layer, not client
- Cache expensive calculations (5 minute TTL)

**Incremental Updates:**
- WebSocket connections for real-time updates (future enhancement)
- Polling every 30 seconds for critical KPIs
- Manual refresh button for on-demand updates

---

### 5. Visualization Framework

**Charts Library:** Recharts (React)
- Line charts for trends
- Bar charts for comparisons
- Pie charts for distributions
- Gauge charts for scores
- Area charts for cumulative data

**Interactive Features:**
- Click to drill down
- Hover for details
- Filter by date range, project, category
- Export to CSV/PDF
- Share via link

---

### 6. Mobile Responsiveness

- All charts responsive with breakpoints
- Touch-optimized interactions
- Simplified mobile views (hide secondary data)
- Pull-to-refresh on mobile

---

### 7. Implementation Phases

**Phase 1: Core BI Endpoints (Week 1)**
- Executive Dashboard endpoint
- Personnel Intelligence endpoint
- Vendor Intelligence endpoint
- Update frontend to use new endpoints

**Phase 2: Advanced Analytics (Week 2)**
- Project Health endpoint
- Constraint Analytics endpoint
- Strategic Insights endpoint
- Build visualization components

**Phase 3: AI Query & Polish (Week 3)**
- AI Natural Language Query endpoint
- Interactive visualizations
- Mobile optimization
- Performance tuning

---

### 8. Success Metrics

**Technical:**
- API response time < 500ms for all endpoints
- Dashboard load time < 2 seconds
- 100% data accuracy vs DynamoDB source

**Business:**
- CFO can identify top 3 cost reduction opportunities in < 30 seconds
- CEO can assess portfolio health at a glance
- Project managers can drill into specific issues in 2 clicks
- ROI tracking shows measurable cost savings

---

## Next Steps

1. **Immediate:** Create new BI API endpoints in `api-handler.js`
2. **Update:** Frontend to call new endpoints
3. **Build:** Interactive visualization components
4. **Test:** With real data from 148 processed reports
5. **Deploy:** To production
6. **Monitor:** Usage and performance metrics
