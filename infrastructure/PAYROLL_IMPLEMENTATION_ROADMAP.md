# SiteLogix Payroll System - Implementation Roadmap

## Overview
This document provides a step-by-step implementation plan for the payroll tracking feature.

---

## Phase 1: Database Setup (1-2 days)

### Tasks

#### 1.1 Create DynamoDB Tables
```bash
cd infrastructure/scripts
./create-payroll-tables.sh --region us-east-1 --profile default
```

**Verification:**
- [ ] `sitelogix-personnel` table exists with 3 GSIs
- [ ] `sitelogix-payroll-entries` table exists with 4 GSIs
- [ ] `sitelogix-reports` table has new GSI3-PayrollStatusIndex
- [ ] All tables have DynamoDB Streams enabled

#### 1.2 Load Sample Data
```bash
./load-sample-payroll-data.sh --region us-east-1 --profile default
```

**Verification:**
- [ ] 3 employee profiles loaded (Bob, Mike, Sarah)
- [ ] Employee aliases created
- [ ] 3 payroll entries loaded for Jan 6, 2025

#### 1.3 Test Access Patterns
Run queries from `PAYROLL_ACCESS_PATTERNS.md` to verify:
- [ ] Can search employees by name
- [ ] Can search by alias ("Bob" finds "Robert Johnson")
- [ ] Can query payroll entries by date
- [ ] Can query payroll entries by employee

---

## Phase 2: Backend Services (3-5 days)

### 2.1 Personnel Service

**File:** `backend/src/services/personnelService.ts`

**Functions to Implement:**
```typescript
class PersonnelService {
  // CRUD operations
  async getEmployeeById(personId: string): Promise<Employee>
  async getEmployeeByNumber(employeeNumber: string): Promise<Employee>
  async searchEmployeeByName(name: string): Promise<Employee[]>
  async searchEmployeeByAlias(alias: string): Promise<Employee | null>
  async createEmployee(data: CreateEmployeeRequest): Promise<Employee>
  async updateEmployee(personId: string, updates: Partial<Employee>): Promise<Employee>
  async deleteEmployee(personId: string): Promise<void>

  // Deduplication logic
  async findOrCreateEmployee(name: string, projectId: string, reportId: string): Promise<Employee>
  async fuzzySearchEmployees(name: string, threshold: number = 0.3): Promise<Employee[]>
  async addEmployeeAlias(personId: string, alias: string): Promise<void>

  // Listing/filtering
  async listActiveEmployees(): Promise<Employee[]>
  async listEmployeesNeedingProfileCompletion(): Promise<Employee[]>
  async listEmployeesNotSeenSince(date: string): Promise<Employee[]>

  // Statistics
  async getEmployeeStatistics(personId: string): Promise<EmployeeStats>
}
```

**Dependencies:**
```json
{
  "dependencies": {
    "aws-sdk": "^2.1500.0",
    "uuid": "^9.0.0",
    "fuse.js": "^7.0.0",
    "string-similarity": "^4.0.4"
  }
}
```

**Test Coverage:**
- [ ] Unit tests for CRUD operations
- [ ] Unit tests for deduplication logic
- [ ] Integration tests with DynamoDB Local
- [ ] Test fuzzy matching accuracy

---

### 2.2 Payroll Service

**File:** `backend/src/services/payrollService.ts`

**Functions to Implement:**
```typescript
class PayrollService {
  // CRUD operations
  async getPayrollEntry(entryId: string): Promise<PayrollEntry>
  async getPayrollEntriesForReport(reportId: string): Promise<PayrollEntry[]>
  async createPayrollEntry(data: CreatePayrollEntryRequest): Promise<PayrollEntry>
  async updatePayrollEntry(entryId: string, updates: Partial<PayrollEntry>): Promise<PayrollEntry>
  async correctPayrollEntry(entryId: string, corrections: any, reason: string): Promise<PayrollEntry>

  // Querying
  async getEmployeePayrollForDateRange(employeeId: string, startDate: string, endDate: string): Promise<PayrollEntry[]>
  async getProjectPayrollForDateRange(projectId: string, startDate: string, endDate: string): Promise<PayrollEntry[]>
  async getDailyPayrollEntries(date: string): Promise<PayrollEntry[]>

  // Review queue
  async getEntriesNeedingReview(): Promise<PayrollEntry[]>
  async approvePayrollEntry(entryId: string, approvedBy: string): Promise<void>
  async flagForReview(entryId: string, reason: string): Promise<void>

  // Aggregation
  async calculateEmployeeWeeklyHours(employeeId: string, weekStartDate: string): Promise<WeeklyHours>
  async calculateProjectLaborCosts(projectId: string, startDate: string, endDate: string): Promise<LaborCost>

  // Export
  async generateDailyPayrollCSV(date: string): Promise<string>
  async generateWeeklyPayrollCSV(startDate: string, endDate: string): Promise<string>
  async generateMonthlyPayrollReport(month: string, year: string): Promise<PayrollReport>
}
```

**Test Coverage:**
- [ ] Unit tests for entry creation
- [ ] Unit tests for aggregation logic
- [ ] Unit tests for CSV generation
- [ ] Integration tests for date range queries

---

### 2.3 Payroll Extraction Service (AI Integration)

**File:** `backend/src/services/payrollExtractionService.ts`

**Functions to Implement:**
```typescript
class PayrollExtractionService {
  // Main extraction
  async extractPayrollFromReport(reportId: string): Promise<ExtractionResult>
  async extractPayrollFromTranscript(transcript: string, reportContext: ReportContext): Promise<PayrollData>

  // AI processing
  async analyzeTranscriptForEmployees(transcript: string): Promise<EmployeeDetection[]>
  async extractHoursAndActivities(transcript: string, employees: string[]): Promise<TimeEntry[]>
  async calculateConfidenceScore(extraction: any): Promise<number>

  // Matching and deduplication
  async matchEmployeesToExisting(detectedNames: string[], projectId: string): Promise<EmployeeMatch[]>
  async resolveAmbiguousMatches(matches: EmployeeMatch[]): Promise<EmployeeMatch[]>

  // Workflow
  async processReportPayroll(reportId: string): Promise<void>
  async retryFailedExtractions(): Promise<void>
}
```

**AI Prompt Template:**
```typescript
const PAYROLL_EXTRACTION_PROMPT = `
You are analyzing a construction daily report transcript to extract payroll information.

Extract the following for EACH employee mentioned:
1. Employee name (full name if mentioned, otherwise first name)
2. Arrival time (if mentioned)
3. Departure time (if mentioned)
4. Regular hours worked
5. Overtime hours (if any)
6. Activities performed
7. Any employee-specific issues or notes

Transcript:
{transcript}

Return JSON in this format:
{
  "employees": [
    {
      "name": "Robert Johnson",
      "aliases_mentioned": ["Bob", "Bobby"],
      "arrival_time": "07:00",
      "departure_time": "16:00",
      "regular_hours": 8.0,
      "overtime_hours": 1.0,
      "activities": ["Framing Level 2 walls", "Installing door frames"],
      "notes": null,
      "confidence": 0.95
    }
  ]
}
`;
```

**Test Coverage:**
- [ ] Test with real voice transcripts
- [ ] Test with ambiguous employee names
- [ ] Test with missing time information
- [ ] Test confidence scoring accuracy

---

### 2.4 API Endpoints

**File:** `backend/src/functions/api-handler.js`

**Endpoints to Add:**

#### Personnel Endpoints
```
GET    /api/personnel
GET    /api/personnel/:personId
GET    /api/personnel/search?q=name
GET    /api/personnel/number/:employeeNumber
POST   /api/personnel
PUT    /api/personnel/:personId
DELETE /api/personnel/:personId
GET    /api/personnel/:personId/statistics
POST   /api/personnel/:personId/aliases
```

#### Payroll Endpoints
```
GET    /api/payroll/entries
GET    /api/payroll/entries/:entryId
GET    /api/payroll/entries/report/:reportId
GET    /api/payroll/entries/employee/:employeeId?start_date=&end_date=
GET    /api/payroll/entries/project/:projectId?start_date=&end_date=
POST   /api/payroll/entries
PUT    /api/payroll/entries/:entryId
POST   /api/payroll/entries/:entryId/correct
GET    /api/payroll/review-queue
POST   /api/payroll/entries/:entryId/approve
```

#### Export Endpoints
```
GET    /api/payroll/export/csv/daily?date=YYYY-MM-DD
GET    /api/payroll/export/csv/weekly?start_date=&end_date=
GET    /api/payroll/export/csv/monthly?month=MM&year=YYYY
GET    /api/payroll/export/report/weekly?start_date=&end_date=
```

**API Response Format:**
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  };
}
```

---

## Phase 3: Frontend Integration (3-4 days)

### 3.1 Payroll Dashboard Component

**File:** `frontend/src/components/PayrollDashboard.tsx`

**Features:**
- [ ] Weekly/monthly view selector
- [ ] Employee hours summary table
- [ ] Project cost breakdown
- [ ] Export CSV button
- [ ] Filter by project, employee, date range

**Mockup:**
```
┌─────────────────────────────────────────────────────────┐
│  Payroll Dashboard                     Week of Jan 1-7   │
├─────────────────────────────────────────────────────────┤
│  [Export CSV]  [Filter: All Projects ▼]                 │
├─────────────────────────────────────────────────────────┤
│  Employee         | Reg Hours | OT | Total | Total Pay  │
├─────────────────────────────────────────────────────────┤
│  Robert Johnson   |   40.0    | 5  | 45.0  | $1,662.50  │
│  Michael Anderson |   40.0    | 2  | 42.0  | $1,376.00  │
│  Sarah Martinez   |   40.0    | 0  | 40.0  | $1,320.00  │
├─────────────────────────────────────────────────────────┤
│  Total            |  120.0    | 7  | 127.0 | $4,358.50  │
└─────────────────────────────────────────────────────────┘
```

---

### 3.2 Employee Management Component

**File:** `frontend/src/components/EmployeeManagement.tsx`

**Features:**
- [ ] Employee list with search
- [ ] Add/edit employee form
- [ ] Employee profile completion status
- [ ] Alias management
- [ ] Employment status toggle

**Form Fields:**
```typescript
interface EmployeeForm {
  employee_number: string;
  first_name: string;
  last_name: string;
  preferred_name?: string;
  email?: string;
  phone?: string;
  hire_date: string;
  job_title: string;
  default_hourly_rate: number;
  default_overtime_rate: number;
  known_aliases: string[];
  employment_status: 'active' | 'inactive' | 'terminated';
}
```

---

### 3.3 Payroll Review Queue Component

**File:** `frontend/src/components/PayrollReviewQueue.tsx`

**Features:**
- [ ] List of entries needing review
- [ ] Show extraction confidence score
- [ ] Show AI reasoning
- [ ] Approve/edit/reject buttons
- [ ] Bulk approve functionality

**Entry Card:**
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Tommy Rodriguez - Jan 6, 2025                    │
│                                    Confidence: 75%   │
├─────────────────────────────────────────────────────┤
│ Reason: New employee auto-created, missing rate     │
│ Hours: 8.0 regular, 0.0 overtime                    │
│ Activities: Material handling, Site cleanup         │
├─────────────────────────────────────────────────────┤
│ [View Transcript] [Edit Entry] [Approve] [Reject]   │
└─────────────────────────────────────────────────────┘
```

---

### 3.4 Update Voice Reporting Screen

**File:** `frontend/src/components/VoiceReportingScreen.tsx`

**Updates:**
- [ ] Show checklist completion percentage
- [ ] Display detected employees during recording
- [ ] Show payroll extraction status after submission
- [ ] Link to payroll review queue if entries need review

---

## Phase 4: AI Integration (2-3 days)

### 4.1 Update Roxy's Agent Prompt

**Add to ElevenLabs agent config:**

```
IMPORTANT: Extract detailed payroll information for each employee mentioned.

For each person, capture:
- Full name (and any nicknames or variations mentioned)
- Arrival and departure times (if mentioned)
- Hours worked (regular and overtime)
- Specific activities performed
- Any issues or notes specific to that employee

Example of what I need to extract:
"Bob arrived at 7am and left at 4pm with an hour of overtime. He worked on framing Level 2 walls and installing door frames. Mike came in at 7:30 and left at 3:30, working on electrical rough-in."

From this I need:
- Bob: 7am arrival, 4pm departure, 8 regular hours, 1 OT hour, activities: framing walls, installing door frames
- Mike: 7:30am arrival, 3:30pm departure, 8 regular hours, 0 OT, activities: electrical rough-in
```

---

### 4.2 Post-Conversation Processing Lambda

**File:** `backend/src/functions/process-conversation-payroll.ts`

**Trigger:** ElevenLabs webhook or S3 transcript upload

**Logic:**
1. Fetch conversation transcript from S3
2. Extract payroll data using Claude/GPT-4
3. Match employees to existing records
4. Create payroll entries in DynamoDB
5. Update report with payroll metadata
6. Send notification if entries need review

**Lambda Configuration:**
```json
{
  "timeout": 300,
  "memory": 1024,
  "environment": {
    "PERSONNEL_TABLE": "sitelogix-personnel",
    "PAYROLL_ENTRIES_TABLE": "sitelogix-payroll-entries",
    "REPORTS_TABLE": "sitelogix-reports",
    "CLAUDE_API_KEY": "{{ssm:/sitelogix/claude-api-key}}"
  }
}
```

---

### 4.3 Scheduled Payroll Export Lambda

**File:** `backend/src/functions/scheduled-payroll-export.ts`

**Trigger:** CloudWatch Events (daily at 11pm)

**Logic:**
1. Query all payroll entries for current day
2. Generate CSV
3. Upload to S3 bucket
4. Send email to accounting with download link
5. Log to CloudWatch metrics

**Configuration:**
```json
{
  "schedule": "cron(0 23 * * ? *)",
  "timezone": "America/New_York",
  "output_bucket": "sitelogix-payroll-exports",
  "notification_email": "accounting@example.com"
}
```

---

## Phase 5: Testing & Validation (2-3 days)

### 5.1 Unit Tests
- [ ] Personnel service tests (90%+ coverage)
- [ ] Payroll service tests (90%+ coverage)
- [ ] Extraction service tests (80%+ coverage)
- [ ] API endpoint tests (100% coverage)

### 5.2 Integration Tests
- [ ] End-to-end report submission with payroll extraction
- [ ] Employee deduplication accuracy
- [ ] CSV export with real data
- [ ] Review queue workflow

### 5.3 Load Testing
- [ ] 100 concurrent report submissions
- [ ] 1000 employees in database
- [ ] Daily CSV generation with 500 entries
- [ ] API response time < 500ms for 95% of requests

### 5.4 User Acceptance Testing
- [ ] Manager submits voice report with 5 employees
- [ ] Verify payroll entries created correctly
- [ ] Admin reviews and approves entries
- [ ] Export CSV and verify formatting
- [ ] Test with edge cases (ambiguous names, missing data)

---

## Phase 6: Deployment (1-2 days)

### 6.1 Production Database Setup
```bash
# Create production tables
./create-payroll-tables.sh --region us-east-1 --profile production

# Enable Point-in-Time Recovery
aws dynamodb update-continuous-backups \
  --table-name sitelogix-personnel \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

aws dynamodb update-continuous-backups \
  --table-name sitelogix-payroll-entries \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

### 6.2 Deploy Backend Services
```bash
# Deploy API Lambda
./deploy-api-lambda.sh

# Deploy processing Lambda
aws lambda update-function-code \
  --function-name sitelogix-process-conversation-payroll \
  --zip-file fileb://backend/dist/process-conversation-payroll.zip

# Deploy export Lambda
aws lambda update-function-code \
  --function-name sitelogix-scheduled-payroll-export \
  --zip-file fileb://backend/dist/scheduled-payroll-export.zip
```

### 6.3 Deploy Frontend
```bash
cd frontend
npm run build
aws s3 sync dist/ s3://sitelogix-frontend/ --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### 6.4 Monitoring Setup
```bash
# Create CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name SiteLogix-Payroll \
  --dashboard-body file://monitoring/payroll-dashboard.json

# Set up alarms
aws cloudwatch put-metric-alarm \
  --alarm-name payroll-high-review-queue \
  --alarm-description "More than 10 entries need review" \
  --metric-name PayrollEntriesNeedingReview \
  --namespace SiteLogix \
  --statistic Sum \
  --period 3600 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

---

## Phase 7: Training & Documentation (1-2 days)

### 7.1 User Training
- [ ] Create video tutorial for managers
- [ ] Create admin guide for employee management
- [ ] Document payroll review workflow
- [ ] Document CSV export process

### 7.2 Technical Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Database schema documentation (complete)
- [ ] Deployment runbook
- [ ] Troubleshooting guide

### 7.3 Operational Procedures
- [ ] Daily payroll export SOP
- [ ] Weekly reconciliation process
- [ ] Monthly closing checklist
- [ ] Incident response plan

---

## Post-Launch Monitoring (Ongoing)

### Week 1 Checklist
- [ ] Monitor extraction accuracy (aim for >90%)
- [ ] Track review queue size (should be <5% of entries)
- [ ] Verify CSV exports are accurate
- [ ] Gather user feedback
- [ ] Address any bugs immediately

### Week 2-4 Optimization
- [ ] Analyze deduplication accuracy
- [ ] Tune AI extraction prompts
- [ ] Optimize database queries
- [ ] Add requested features

### Month 2+ Enhancements
- [ ] Add payroll analytics dashboard
- [ ] Implement automated rate adjustments
- [ ] Add mobile app support
- [ ] Integrate with external payroll systems (ADP, Gusto, etc.)

---

## Success Metrics

### Functional Metrics
- **Extraction Accuracy:** >90% of payroll entries require no manual correction
- **Deduplication Rate:** <5% of employees are duplicated
- **Review Queue Size:** <10 entries awaiting review at any time
- **CSV Export Success:** 100% of daily exports generated on time

### Performance Metrics
- **API Response Time:** <500ms for 95th percentile
- **Report Processing Time:** <60 seconds from submission to payroll extraction
- **Database Query Time:** <100ms for all access patterns

### Business Metrics
- **Time Savings:** Reduce payroll data entry from 2 hours/week to 15 minutes/week
- **Error Reduction:** Reduce payroll errors by 80%
- **User Satisfaction:** >4.5/5 stars from managers
- **Adoption Rate:** 100% of reports include payroll data within 1 month

---

## Risk Mitigation

### Risk 1: AI Extraction Accuracy
**Mitigation:**
- Implement confidence scoring
- Flag low-confidence extractions for review
- Continuously tune prompts based on feedback
- Maintain human review workflow

### Risk 2: Employee Deduplication Failures
**Mitigation:**
- Use multi-layered matching (exact, alias, fuzzy)
- Implement manual merge tool for duplicates
- Regular audit of personnel database
- Train AI on company-specific name patterns

### Risk 3: Data Loss or Corruption
**Mitigation:**
- Enable DynamoDB Point-in-Time Recovery
- Daily backups to S3
- Comprehensive audit trail
- Test restore procedures quarterly

### Risk 4: Performance Degradation
**Mitigation:**
- Use DynamoDB on-demand billing for auto-scaling
- Implement caching for frequently accessed data
- Monitor query patterns and add indexes as needed
- Load test before major releases

---

## Budget Estimate

### AWS Services (Monthly)
- DynamoDB (3 tables, moderate load): $50-100
- Lambda (processing + API): $20-40
- S3 (transcripts + exports): $10-20
- CloudWatch (logs + metrics): $15-30
- **Total AWS:** ~$95-190/month

### Third-Party Services
- ElevenLabs API: $99-299/month (depending on volume)
- Claude API (payroll extraction): $50-150/month
- **Total Third-Party:** ~$149-449/month

### Development Cost (One-Time)
- Backend development: 40-60 hours
- Frontend development: 30-40 hours
- Testing & QA: 20-30 hours
- Deployment & documentation: 10-20 hours
- **Total Development:** ~100-150 hours

---

## Next Steps

1. **Review and approve this roadmap** with stakeholders
2. **Set up project tracking** (Jira, Linear, etc.)
3. **Assign developers** to each phase
4. **Start Phase 1** (Database Setup) immediately
5. **Schedule weekly check-ins** to track progress

For questions or clarifications, refer to:
- `PAYROLL_SCHEMA_DESIGN.md` - Complete database documentation
- `PAYROLL_ACCESS_PATTERNS.md` - Code examples and queries
- `sample-data-payroll.json` - Sample data structure

---

**Document Version:** 1.0
**Last Updated:** 2025-01-06
**Owner:** Database Architect / Technical Lead
