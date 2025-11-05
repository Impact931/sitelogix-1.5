# Analytics Dashboard Redesign Plan

## Issues Identified

### Broken Functionality
1. ✗ **Overtime Trends** button - no endpoint
2. ✗ **Delivery Performance** button - no endpoint
3. ✗ **Top Constraints** button - no endpoint
4. ✗ **Cost Savings** button - no endpoint

### Unclear/Questionable Metrics
1. **Portfolio Quality Score (81)** - User doesn't understand what this means
2. **Schedule Score (79)** - No explanation of calculation
3. **Project Health Rating** - Not valuable without context
4. **12.4x ROI** - Against what? Calculation unclear
5. **Projects at Risk (2)** - Risk of what? Vague metric
6. **Cost Reduction Opportunities ($490k)** - How calculated?

### Missing Features
1. Top issues not clickable (can't drill down to source reports)
2. No metric explanations or tooltips
3. No graphical representations
4. Metrics may be made-up vs. based on real data

## Available Real Data

From test run:
- **61 executive summaries** - project health assessments
- **78 recommendation records** - strategic recommendations with savings
- **85 hours summaries** - labor costs, OT data
- **43 constraint summaries** - cost impacts, issues
- **164 total constraints** - $64k total cost impact
- **9 personnel** - active workers

## Industry-Standard Construction KPIs to Implement

### Schedule Performance
- **Schedule Performance Index (SPI)** = Earned Value / Planned Value
  - SPI > 1.0 = ahead of schedule
  - SPI = 1.0 = on schedule
  - SPI < 1.0 = behind schedule
- **On-time Delivery Rate** = (On-time deliveries / Total deliveries) × 100%
- **Critical Path Status** - Days ahead/behind

### Cost Performance
- **Cost Performance Index (CPI)** = Earned Value / Actual Cost
  - CPI > 1.0 = under budget
  - CPI = 1.0 = on budget
  - CPI < 1.0 = over budget
- **Budget Variance** = Planned Cost - Actual Cost
- **Cost Variance %** = ((Planned - Actual) / Planned) × 100%

### Productivity
- **Labor Productivity** = Output / Labor Hours
- **Overtime %** = (OT Hours / Total Hours) × 100%
- **Labor Cost per Unit** = Total Labor Cost / Units Produced

### Quality
- **Defect Rate** = (Defects / Total Inspections) × 100%
- **Rework Cost** = Cost of fixing defects/errors
- **Inspection Pass Rate** = (Passed / Total) × 100%

### Safety
- **Incident Rate** = (Incidents / Total Hours) × 200,000
- **Days Since Last Incident**
- **Safety Compliance %**

## Redesigned Dashboard Structure

### Section 1: Portfolio Overview (Top KPIs)
```
┌─────────────────────────────────────────────────────────────────┐
│ Schedule Performance Index (SPI)          Cost Performance Index │
│ 0.95 (5% Behind)                         1.08 (8% Under Budget)  │
│ [Explanation: Ratio of work completed vs planned. <1.0 = behind] │
│                                                                    │
│ Active Projects      Labor Cost (MTD)        Overtime %          │
│ 9                    $109,580                 15.3%               │
└─────────────────────────────────────────────────────────────────┘
```

### Section 2: Financial Performance
```
┌─────────────────────────────────────────────────────────────────┐
│ Cost Tracking                                                     │
│ • Labor Costs (MTD): $109,580                                    │
│ • Constraint/Issue Costs: $64,108                                │
│ • Identified Cost Reduction Opportunities: $490,030              │
│   [Breakdown: See detailed recommendations]                      │
│                                                                    │
│ Budget Performance by Project                                     │
│ [BAR CHART: Budget vs Actual by project]                         │
└─────────────────────────────────────────────────────────────────┘
```

### Section 3: Actionable Intelligence (Clickable)
```
┌─────────────────────────────────────────────────────────────────┐
│ Top Cost Constraints (Click for details)                         │
│ 1. [Cortex Commons] Design flaw in sleeves - $4,200  [→ Reports] │
│ 2. [Nashville Yards] Coord delays - $2,300           [→ Reports] │
│ 3. [Cortex Commons] Equipment delays - $2,200        [→ Reports] │
│                                                                    │
│ High Overtime Projects                                            │
│ 1. [Project A] 23% OT rate - $12k additional cost   [→ Details]  │
│ 2. [Project B] 18% OT rate - $8k additional cost    [→ Details]  │
└─────────────────────────────────────────────────────────────────┘
```

### Section 4: Report Buttons (Working)
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Overtime     │ Constraints  │ Vendor       │ Cost         │
│ Analysis     │ Report       │ Performance  │ Breakdown    │
│ [GRAPH]      │ [BY PROJECT] │ [DELIVERIES] │ [TRENDS]     │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

## Implementation Plan

### Phase 1: Fix Broken Reports (HIGH PRIORITY)
1. Create `/api/bi/reports/overtime` endpoint
   - Aggregate OT hours by project, person, date
   - Calculate OT %, costs, trends
   - Return graph data (time series)

2. Create `/api/bi/reports/constraints` endpoint
   - Group constraints by project
   - Show top constraints, recurring issues
   - Include resolution status, cost impacts

3. Create `/api/bi/reports/deliveries` endpoint
   - IF vendor delivery data exists, show performance
   - ELSE show "No vendor delivery data available"
   - Track on-time %, late deliveries, vendor scores

4. Create `/api/bi/reports/savings` endpoint
   - Aggregate cost reduction opportunities
   - Group by category (labor, material, rework, etc)
   - Show ROI if recommendations implemented

### Phase 2: Replace Vague Metrics (HIGH PRIORITY)
1. **Remove "Portfolio Quality" and "Schedule Score"**
   - Replace with **SPI** and **CPI**
   - Add calculation explanations

2. **Remove "Project Health Rating"**
   - Replace with specific metrics:
     - Days ahead/behind schedule
     - % over/under budget
     - Active constraints count

3. **Remove "Projects at Risk"**
   - Replace with:
     - "Projects Behind Schedule" (SPI < 0.95)
     - "Projects Over Budget" (CPI < 0.95)
     - "Projects with High Constraint Costs" (>$5k)

4. **Clarify "12.4x ROI"**
   - Remove or explain clearly:
     - "Potential savings ($490k) vs resolution cost (calculate)"
   - OR just show savings opportunities without ROI

### Phase 3: Add Metric Explanations (MEDIUM PRIORITY)
1. Add tooltip components for each metric
2. Include:
   - What it measures
   - How it's calculated
   - What values are good/bad
   - Source data

### Phase 4: Make Issues Clickable (MEDIUM PRIORITY)
1. Add `report_id` to constraint/issue data
2. Make top concerns/wins clickable
3. Link to source report detail view

### Phase 5: Add Graphs (LOWER PRIORITY)
1. Overtime trend line chart (by date)
2. Budget vs actual bar chart (by project)
3. Constraint costs by category pie chart
4. Labor cost breakdown by project

## Data Requirements

### What We Have
✓ Hours summaries (85 records) - labor costs, OT
✓ Constraints (164 records) - issues, cost impacts
✓ Recommendations (78 records) - savings opportunities
✓ Executive summaries (61 records) - project assessments

### What We DON'T Have (Gaps)
✗ Earned Value (EV) data - needed for SPI/CPI
✗ Planned Value (PV) data - needed for SPI
✗ Vendor delivery tracking - needed for delivery performance
✗ Budget baselines - needed for variance calculations

### Workaround for Missing Data
- For now, focus on metrics we CAN calculate:
  - Actual labor costs (we have)
  - Constraint costs (we have)
  - Overtime % (we have)
  - Cost reduction opportunities (we have)
- Add placeholders for SPI/CPI:
  - "SPI: Not Available - Requires project schedule baseline"
  - "CPI: Not Available - Requires budget baseline"
- Explain to user: "To enable SPI/CPI tracking, we need to capture planned values and earned value metrics in future reports"

## Next Steps

1. Build 4 report endpoints (overtime, constraints, deliveries, savings)
2. Update Executive Dashboard with clear metrics
3. Add metric explanations
4. Make issues clickable
5. Test with user
6. Get feedback on whether to invest in EV/PV tracking for SPI/CPI
