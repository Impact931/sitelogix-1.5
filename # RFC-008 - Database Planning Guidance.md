# RFC-008 - Database Planning Guidance

# SiteLogix Database Architecture & Analytics Platform
## Development Planning Guidance Document

**Version:** 1.0  
**Date:** November 4, 2025  
**Author:** Jayson Rivas - Impact Consulting 
**Target Audience:** Development Team, Database Architects, Data Scientists

---

## Executive Summary

SiteLogix is an AI-powered construction management platform that transforms voice-based daily reports into actionable business intelligence. The system must support both operational reporting (what happened today) and strategic analytics (trends, patterns, risk indicators) while maintaining forensic-grade audit trails for legal, insurance, and compliance requirements.

**Core Philosophy:** Voice-first data capture → AI-driven extraction → Immutable storage → Multi-dimensional analytics

---

## I. Design Principles

### 1.1 Immutability First
Every voice recording, transcript, and extracted data point is a legal record. Once created, data must be preserved in its original form with complete provenance tracking.

**Requirements:**
- All audio files and transcripts must be immutable after submission
- Every record must include: WHO (user), WHAT (action), WHEN (timestamp), WHERE (GPS location)
- File integrity must be cryptographically verifiable
- Complete audit trail of all access and modifications
- 7-year retention minimum for compliance

### 1.2 Dual Storage Strategy
Operational data lives in DynamoDB for fast access. Historical data migrates to S3 for cost-effective long-term storage and analytics.

**Requirements:**
- Hot operational data: Last 90 days in DynamoDB
- Warm historical data: 90 days - 7 years in S3 with Athena access
- Raw unstructured data: Always in S3 (transcripts, audio)
- Structured extractions: DynamoDB with S3 backup via streams

### 1.3 AI-Friendly Architecture
Store both raw text and structured extractions to enable future AI model improvements and human review.

**Requirements:**
- Preserve original transcript text for re-analysis
- Store AI extraction confidence scores
- Tag AI model version used for extraction
- Enable bulk reprocessing when models improve

### 1.4 Deduplication by Design
Personnel, vendors, and subcontractors appear across multiple reports. The system must intelligently resolve duplicates without creating noise.

**Requirements:**
- Fuzzy matching for name variations (Aaron, A-Rod, A)
- Admin approval workflow for new entities
- Historical tracking of entity appearances across reports
- Merge capabilities with audit trail preservation

---

## II. Core Data Entities

### 2.1 Reports (Primary Entity)
The atomic unit of the system. Everything originates from a daily report.

**Required Attributes:**
- Unique identifier (timestamp-based)
- Project and manager references
- Report date and submission timestamp
- Weather conditions (simple categorical)
- Aggregate personnel metrics (count, regular hours, OT hours)
- Raw transcript storage (S3 path)
- Audio file storage (S3 path)
- Processing status workflow
- GPS coordinates and accuracy
- Device fingerprint data
- File checksums (SHA-256)

**AI-Extracted Data:**
- Structured task descriptions
- Issue/constraint identification with categorization
- Vendor/subcontractor mentions
- Material deliveries
- Equipment checkouts

**Access Patterns:**
- Query by report ID (direct lookup)
- Query by project + date range
- Query by manager + date range
- Query by status (pending review, approved, archived)
- Search by content (full-text on transcript)

### 2.2 Personnel (Admin-Managed Registry)
Master employee database with deduplication and history tracking.

**Required Attributes:**
- Canonical name and nickname variations
- Team assignments (can belong to multiple)
- Role/position and skill certifications
- Employment status
- Aggregate metrics (total hours worked, report appearances)
- First seen / last seen dates

**Historical Tracking:**
- Per-report appearance records
- Position/team changes over time
- Hours worked per project
- Tasks performed (from transcript excerpts)

**Access Patterns:**
- Lookup by ID
- Fuzzy search by name
- Query by team assignment
- Query by project history
- Analyze productivity trends

### 2.3 Teams (Admin-Managed)
Organizational units that personnel belong to.

**Required Attributes:**
- Team name and type
- Project assignments
- Lead/foreman assignment
- Personnel roster
- Equipment assigned to team

**Use Case:** AI hears "Team 1 worked on framing, 8 people, 64 hours" → Maps to Team 1 roster

### 2.4 Subcontractors (Dynamic with Approval)
Companies working on site that aren't direct employees.

**Required Attributes:**
- Company name and variations
- Contact information
- Subcontractor type (electrical, plumbing, HVAC, etc.)
- Approval status (pending, active, inactive)
- Project history
- Performance tracking (on-time, issues mentioned)

**Workflow:**
- AI extracts mention → Fuzzy matches existing records
- If new → Create "Pending" record → Admin approves/merges
- If match → Reference existing entity

### 2.5 Vendors (Dynamic with Approval)
Material suppliers and delivery companies.

**Required Attributes:**
- Company name and variations
- Delivery history
- Materials typically supplied
- Performance metrics (on-time delivery, damaged materials, shortages)

**Similar workflow to Subcontractors**

### 2.6 Equipment (Admin-Managed Registry)
Tools and machinery tracked through checkout/return.

**Required Attributes:**
- Equipment name/type
- Asset tag or serial number
- Current status (available, checked out, in repair)
- Current project assignment
- Checkout history

**Access Patterns:**
- Available equipment for project
- Equipment utilization rates
- Maintenance scheduling
- Cost analysis (rental vs. owned via external accounting)

### 2.7 Issues/Constraints (AI-Extracted)
This is where operational intelligence lives.

**Required Attributes:**
- Parent report reference
- AI-assigned category (Material, Labor, Safety, Coordination, Weather, Equipment, Other)
- Severity level (Low, Medium, High, Critical) - AI-inferred from language
- Description (raw transcript excerpt)
- Status workflow (Open → Acknowledged → Resolved)
- Resolution tracking
- Related entity references (vendor causing delay, person injured, equipment broken)

**Critical Use Cases:**
- Safety incidents trigger separate incident report workflow
- Critical issues auto-escalate to project manager
- Pattern recognition across projects (recurring vendor issues, equipment failures)

### 2.8 Work Logs (AI-Extracted)
Detailed breakdown of work performed by team/location.

**Required Attributes:**
- Report reference
- Team identifier
- Building level/area
- Personnel assigned
- Task description
- Hours worked (team aggregate)
- Materials and equipment used
- Progress estimation
- Raw transcript excerpt

**Use Case:** "Team 2 on Level 3, installed 240 linear feet of conduit, 6 people, 48 hours"

---

## III. Database Architecture Guidance

### 3.1 DynamoDB Table Design

**Decision Point:** Single-table design vs. purpose-built tables

**Recommendation for Dev Team:**
Evaluate based on Amplify integration requirements. Consider:

**Single-Table Approach:**
- More complex initially, highly scalable
- Better for high-velocity queries across entity types
- Requires sophisticated key design
- Use composite sort keys for relationship traversal

**Multi-Table Approach:**
- Simpler GraphQL schema generation with Amplify
- Easier to reason about for team
- DynamoDB Streams handle denormalization
- More straightforward IAM policy management

**Required Access Patterns (Must Support):**
1. Direct report lookup by ID (< 10ms)
2. Project timeline queries (all reports for project, date range)
3. Manager performance queries (all reports by manager, date range)
4. Issue tracking (all open issues, filtered by severity/category)
5. Personnel history (all appearances across projects)
6. Vendor performance (all mentions, filtered by issue involvement)
7. Equipment utilization (checkout history, availability status)

**Index Strategy:**
- Primary Key: Entity-specific unique identifier
- GSI1: Project + Date (for timeline queries)
- GSI2: Manager + Date (for manager tracking)
- GSI3: Status + Timestamp (for workflow management)
- Consider sparse indexes for filtering (e.g., "pending_approval" status)

### 3.2 Data Lifecycle Management

**Hot Tier (DynamoDB):**
- Current operational data (last 90 days)
- Active projects
- Open issues
- Pending approvals

**Warm Tier (S3 + Athena):**
- Completed reports older than 90 days
- Archived projects
- Historical analysis data
- Always: Raw transcripts and audio files

**Cold Tier (S3 Glacier):**
- Reports older than 1 year
- Still queryable via Athena (with restore time)
- Cost-optimized long-term retention

**Migration Pipeline:**
```
DynamoDB → DynamoDB Streams → Lambda → S3 (Parquet) → Athena
```

### 3.3 S3 Folder Structure

**Root:** `SiteLogix/`

**Audio Files:**
```
SiteLogix/projects/{projectId}/audio/{YYYY}/{MM}/{DD}/{reportId}.{format}
```

**Transcripts:**
```
SiteLogix/projects/{projectId}/transcripts/{YYYY}/{MM}/{DD}/{reportId}.txt
```

**AI Analysis Results:**
```
SiteLogix/projects/{projectId}/ai-analysis/{analysisType}/{YYYY}/{MM}/{DD}/{reportId}-{type}.json
```

**Parsed Structured Data:**
```
SiteLogix/projects/{projectId}/parsed-data/{YYYY}/{MM}/{DD}/{reportId}-parsed.json
```

**Attachments (Photos, Delivery Slips):**
```
SiteLogix/projects/{projectId}/attachments/{YYYY}/{MM}/{DD}/{reportId}-{attachmentId}.{format}
```

---

## IV. Audit Trail Requirements

### 4.1 File-Level Metadata (Every File Must Include)

**Provenance:**
- User ID, name, role, phone number
- Project ID and location
- Recording start/end timestamps (with timezone)
- GPS coordinates (latitude, longitude, accuracy)
- Device identifier and model
- App version and IP address

**Storage:**
- S3 bucket and key (full path)
- File size and format
- Cryptographic checksum (SHA-256)
- S3 version ID (if versioning enabled)

**Integrity:**
- Deletion protection flag
- Lock status (after aging threshold)
- Retention expiry date
- Legal hold status (if applicable)

**Processing:**
- AI model version used for extraction
- Processing timestamp
- Confidence scores for extractions
- Status workflow history

### 4.2 Change Tracking

**Every modification must capture:**
- What changed (old value → new value)
- Who changed it (user ID)
- When it changed (timestamp)
- Why it changed (change type classification)
- From where (IP address, device)

**Implementation via DynamoDB Streams:**
- Stream every change to audit log table
- Separate Lambda writes to append-only audit trail
- Optional: Stream to S3 for long-term audit retention

### 4.3 Access Logging

**Requirement:** Log every access to audio/transcript files

**Implement via:**
- S3 Server Access Logging
- CloudTrail for API-level access
- Application-level access logs

**Use Cases:**
- Legal discovery (who accessed what evidence)
- Security audits (unauthorized access attempts)
- Compliance reporting (OSHA, legal retention)

---

## V. Data Integrity Requirements

### 5.1 Immutability Implementation

**S3 Object Lock:**
- Enable on audio and transcript buckets
- Governance mode (allows privileged override for legitimate corrections)
- 7-year retention period minimum
- Prevents accidental/malicious deletion

**S3 Versioning:**
- Maintain all versions of files
- Even if "deleted," file versions remain accessible
- Version IDs stored in DynamoDB for reference

**DynamoDB Point-in-Time Recovery:**
- Enable on all tables
- 35-day recovery window
- Protects against data corruption or accidental deletion

### 5.2 File Integrity Verification

**Checksum Storage:**
- Compute SHA-256 hash on upload
- Store in DynamoDB record
- Periodic verification jobs (monthly)
- Alert on mismatch (potential tampering)

**Optional - Digital Signatures:**
- For high-security environments (government contracts)
- Cryptographically sign report JSON
- Verify signature chain on retrieval
- Implement using AWS KMS or certificate-based signing

### 5.3 Deduplication Logic

**Personnel Matching:**
- Fuzzy string matching (Levenshtein distance)
- Phonetic matching (Soundex, Metaphone)
- Nickname database ("Mike" → "Michael")
- Admin review workflow for uncertain matches
- Merge with history preservation

**Vendor/Subcontractor Matching:**
- Normalize company names (remove "Inc", "LLC", "Co")
- Match on phone/email if available
- Track name variations in database
- Admin approval for new entities

---

## VI. AI Processing Architecture

### 6.1 Multi-Stage Extraction Pipeline

**Stage 1: Transcript Storage**
- ElevenLabs conversation → Raw transcript JSON → S3
- Store full unformatted text in DynamoDB Reports table
- Trigger AI processing Lambda

**Stage 2: Structured Data Extraction**
- AI prompt: Extract personnel count, hours, weather, equipment, deliveries
- Return structured JSON
- Store in DynamoDB with confidence scores

**Stage 3: Entity Resolution**
- Fuzzy match personnel names → Personnel table
- Fuzzy match subcontractors → Subcontractors table (flag new)
- Fuzzy match vendors → Vendors table (flag new)
- Match equipment mentions → Equipment table

**Stage 4: Issue Analysis**
- AI prompt: Identify problems, delays, safety concerns
- Categorize: Material | Labor | Safety | Coordination | Weather | Equipment
- Rate severity: Low | Medium | High | Critical
- Extract supporting quotes from transcript

**Stage 5: Entity Linking**
- Link issues to related vendors/subcontractors
- Link equipment checkouts to Equipment DB
- Update aggregate metrics across related tables

**Stage 6: Admin Review Workflow**
- New subcontractors → Notification queue
- Safety issues → Auto-escalate
- Critical issues → Project manager alert
- Anomaly detection → Flag for review

### 6.2 AI Model Versioning

**Requirements:**
- Tag every extraction with model version used
- Store extraction prompts in AI Analysis Cache
- Enable bulk reprocessing when models improve
- A/B testing capability for prompt optimization

**Analysis Cache Table:**
- Store raw AI responses
- Store structured extraction results
- Track token usage and cost
- Enable analytics on AI performance

### 6.3 Confidence Scoring

**Implementation Guidance:**
- AI returns confidence score (0-100) for each extraction
- Low confidence extractions flagged for human review
- Track confidence trends by extraction type
- Use for model performance tuning

---

## VII. Analytics & Reporting Requirements

### 7.1 Executive Dashboard Metrics

**Financial Intelligence:**
- Daily burn rate (labor + materials) vs. budget
- Overtime trending by project, manager, trade
- Cost variance alerts (actual vs. estimated)
- Forecast completion costs based on velocity

**Schedule Performance:**
- Days ahead/behind schedule by project
- Critical path status tracking
- Weather delay documentation
- Productivity rates (actual vs. estimated)

**Risk Indicators:**
- Recurring constraint patterns
- Safety incident rates by project/manager
- Material shortage frequency
- Vendor reliability scores

**Resource Optimization:**
- Personnel utilization rates
- Equipment ROI analysis
- Cross-project resource sharing opportunities
- Subcontractor performance scorecards

**Project Health Scoring:**
- Red/Yellow/Green status rollup
- Predictive delay warnings
- Cost overrun risk scoring
- Client satisfaction indicators

### 7.2 Query Patterns

**Real-Time Operational Queries (DynamoDB):**
- Current project status
- Today's reports
- Open issues requiring attention
- Pending approvals

**Historical Analysis (S3 + Athena):**
- Multi-project trend analysis
- Year-over-year comparisons
- Vendor performance over time
- Personnel productivity trends

**Predictive Analytics (ML Pipeline):**
- Delay prediction based on constraint patterns
- Cost overrun forecasting
- Safety incident risk scoring
- Material shortage warnings

### 7.3 Reporting Outputs

**Daily Summaries:**
- Auto-generated PDF reports from voice transcripts
- Google Sheets integration for PM tracking
- Email digests to project stakeholders

**Executive Dashboards:**
- QuickSight or custom React dashboards
- Real-time project health scores
- Drill-down capability to individual reports
- Export capabilities for board presentations

**Compliance Reports:**
- OSHA recordkeeping
- Certified payroll (if applicable)
- Audit trail exports for legal discovery
- Retention compliance status

---

## VIII. Security & Access Control

### 8.1 IAM Policy Guidance

**Principle of Least Privilege:**

**Foremen/Managers:**
- Write-only to S3 audio buckets
- Cannot delete files
- Can view own reports
- Cannot access other managers' reports (unless explicitly shared)

**Project Managers:**
- Read access to project-specific reports
- Approve/reject subcontractor additions
- Resolve issues assigned to them

**Administrators:**
- Full read access to all reports
- Approval workflows (new entities, report edits)
- Cannot delete archived files without special permission

**Executives:**
- Read-only dashboard access
- Export capabilities
- Cannot modify operational data

**Legal/Compliance Team:**
- Read-only access including deleted versions
- Audit log access
- Special retrieval permissions for archived data

### 8.2 Data Privacy Considerations

**PII Protection:**
- Personnel phone numbers, emails → Encrypt at rest
- GPS coordinates → Considered PII, protect accordingly
- Access logs → Restricted access, long-term retention

**Field-Level Encryption:**
- Use AWS KMS for sensitive fields
- Separate keys per data classification
- Key rotation policy

---

## IX. Integration Requirements

### 9.1 External Systems

**Accounting Integration:**
- Export labor hours for payroll processing
- Material costs for P&L reporting
- Equipment rental invoices

**Scheduling Software:**
- Optionally sync with P6, MS Project
- Update completion percentages
- Flag delays

**Document Management:**
- Link delivery slips to payment applications
- Store photos with parent report references

**CRM (If Applicable):**
- Track client interactions mentioned in reports
- Site visit notes
- Issue resolution communication

### 9.2 API Design

**RESTful API Endpoints:**
- CRUD operations for all entities
- Search/filter capabilities
- Bulk export endpoints
- Webhook support for integrations

**GraphQL API (If Using Amplify):**
- Auto-generated from DynamoDB schema
- Real-time subscriptions for status changes
- Optimistic UI updates

---

## X. Development Phases

### Phase 1: MVP (Core Reporting)
**Goal:** Prove voice → report workflow

**Deliverables:**
- Voice recording → Transcript → S3 storage
- Basic AI extraction (personnel, hours, tasks)
- DynamoDB reports table with essential fields
- Admin dashboard with project list and report viewing
- Simple issue logging

**Success Criteria:**
- Foreman can submit report in < 5 minutes
- Transcript accuracy > 95%
- Report viewable by PM within 1 minute of submission

### Phase 2: Intelligence Layer
**Goal:** Add entity resolution and analytics

**Deliverables:**
- Personnel/vendor/subcontractor fuzzy matching
- Admin approval workflows
- Issue categorization and severity scoring
- Equipment checkout tracking
- Basic executive dashboard (project status, hours, issues)

**Success Criteria:**
- < 10% false positive entity matches
- Critical issues auto-escalated within 30 seconds
- Dashboard loads in < 2 seconds

### Phase 3: Predictive Analytics
**Goal:** Turn data into actionable insights

**Deliverables:**
- Delay prediction models
- Cost overrun warnings
- Safety risk scoring
- Resource optimization recommendations
- Historical trend analysis

**Success Criteria:**
- Predict delays 7 days in advance with 70%+ accuracy
- Reduce cost overruns by 15% through early detection
- Improve resource utilization by 20%

---

## XI. Success Metrics

### 11.1 System Performance
- Report submission time: < 5 minutes (target: 3 minutes)
- AI processing time: < 2 minutes per report
- Query response time: < 500ms (hot data), < 5s (historical)
- System uptime: 99.9%

### 11.2 Data Quality
- Transcript accuracy: > 95%
- Entity matching precision: > 90%
- False positive rate: < 10%
- Data completeness: > 98% of required fields

### 11.3 Business Impact
- Reduce report preparation time by 80% (vs. manual entry)
- Identify issues 5x faster than traditional reporting
- Improve cost visibility with real-time burn rate tracking
- Enable data-driven decision making with historical analytics

### 11.4 Compliance
- 100% audit trail completeness
- Zero data loss incidents
- < 1 hour retrieval time for archived reports
- Pass external audit on first attempt

---

## XII. Technical Debt Avoidance

### 12.1 Don't Over-Engineer Early
- Start with multi-table DynamoDB design (simpler)
- Migrate to single-table if scale demands it
- Use managed services (less operational burden)
- Build analytics incrementally (don't boil the ocean)

### 12.2 Plan for Scale
- Design keys to avoid hot partitions
- Use date-based partitioning for S3
- Implement pagination from day one
- Consider read replicas for analytics queries

### 12.3 Observability from Day One
- CloudWatch metrics for all Lambdas
- Structured logging (JSON format)
- Error tracking and alerting
- Cost monitoring per feature

---

## XIII. Open Questions for Dev Team

1. **Single-table vs. Multi-table DynamoDB?**
   - Evaluate based on Amplify GraphQL generation complexity
   - Consider team familiarity with single-table design patterns

2. **AI Model Selection:**
   - OpenAI GPT-4 vs. Anthropic Claude vs. AWS Bedrock?
   - Cost vs. accuracy trade-offs
   - Prompt engineering complexity

3. **Real-time vs. Batch Processing:**
   - Process reports immediately or queue for batch?
   - Consider cost (on-demand Lambdas vs. scheduled)
   - User expectations for report availability

4. **Frontend Framework:**
   - React with Amplify UI?
   - Custom components vs. pre-built?
   - Mobile-first design considerations

5. **Testing Strategy:**
   - How to test fuzzy matching logic?
   - AI prompt regression testing approach
   - Load testing for concurrent report submissions

---

## XIV. Deliverables to Request from Dev Team

1. **Technical Design Document:**
   - Detailed DynamoDB schema with key design
   - S3 bucket configuration (lifecycle, versioning, locking)
   - Lambda function architecture diagram
   - API endpoint specifications

2. **Data Flow Diagrams:**
   - Report submission flow (frontend → backend → storage)
   - AI processing pipeline (stages, error handling)
   - Analytics query paths (DynamoDB vs. Athena)

3. **Security Implementation Plan:**
   - IAM roles and policies
   - Encryption strategy (at rest, in transit)
   - Compliance checklist (OSHA, retention, audit)

4. **Testing Plan:**
   - Unit test coverage targets
   - Integration test scenarios
   - Load testing methodology
   - AI accuracy validation approach

5. **Monitoring & Alerting:**
   - CloudWatch dashboards
   - Critical error alerts
   - Cost anomaly detection
   - Performance degradation alerts

6. **Documentation:**
   - API documentation (Swagger/OpenAPI)
   - Database schema reference
   - AI prompt library
   - Runbook for common operations

---

## XV. Final Notes

This guidance document is intentionally **principle-driven, not prescriptive**. The dev team and their AI agents have the expertise to make implementation decisions. The focus here is on:

✅ **Why** we need these capabilities (business value)  
✅ **What** the system must achieve (requirements)  
✅ **What** the constraints are (compliance, audit, scale)  

The dev team determines:
- **How** to implement (code, frameworks, services)
- **When** to use specific AWS features
- **Where** to optimize vs. over-engineer

**Core Mandate:** Build a system that transforms field observations into executive intelligence while maintaining forensic-grade record keeping. Voice-first, AI-powered, legally defensible.

---

**Next Step:** Dev team produces Technical Design Document addressing open questions and proposing specific implementation approach for review.

---

**Document Control:**
- **Version:** 1.0
- **Status:** Draft for Review
- **Distribution:** Dev Team, Database Architects, Data Scientists
- **Feedback Deadline:** [Date]
- **Approver:** Jayson Hunter, Founder & CEO