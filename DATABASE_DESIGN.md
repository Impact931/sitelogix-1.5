# SiteLogix Database Design - Enhanced AI-Powered Architecture

## Design Philosophy

This database is designed to support **AI-driven data extraction** from voice conversation transcripts while maintaining structured data integrity for reporting and analytics.

### Key Principles:

1. **Dual Storage Strategy**: Store both raw unstructured text AND extracted structured data
2. **Deduplication by Design**: Smart entity resolution prevents duplicate personnel/vendor records
3. **Time-Series Tracking**: Track changes over time without losing historical context
4. **AI-Friendly**: Include full text blocks for AI agent analysis and re-processing
5. **Relationship Integrity**: Proper foreign key relationships between all entities

---

## Database Tables Overview

### 1. **Reports Table** (Primary Source of Truth)
Stores daily construction reports with both raw transcript and structured data.

**Access Patterns**:
- Get report by ID
- Query reports by project + date range
- Query reports by manager + date range
- Find reports needing AI processing

**Table Design**:
```
PK: REPORT#{reportId}
SK: METADATA

Attributes:
- reportId (String) - Unique identifier (e.g., rpt_20251030_mgr_002_1730318400)
- conversationId (String) - ElevenLabs conversation ID
- projectId (String) - Foreign key to project
- projectName (String) - Denormalized for quick access
- projectLocation (String)
- managerId (String) - Foreign key to manager
- managerName (String) - Denormalized
- reportDate (String) - ISO date (YYYY-MM-DD)
- timestamp (String) - Full ISO timestamp
- status (String) - pending_analysis | analyzed | published | archived
- transcriptS3Path (String) - S3 location of full transcript JSON
- audioS3Path (String) - S3 location of audio file (optional)
- rawTranscriptText (String) - FULL unformatted transcript for AI analysis
- createdAt (String)
- updatedAt (String)
- aiProcessedAt (String) - Timestamp when AI analysis completed
- aiProcessingVersion (String) - Version of AI agent that processed (e.g., "v1.0.3")

GSI1 (ProjectIndex): project_id (HASH) + report_date (RANGE)
GSI2 (ManagerIndex): manager_id (HASH) + report_date (RANGE)
GSI3 (StatusIndex): status (HASH) + timestamp (RANGE)
```

---

### 2. **Personnel Table** (Master Employee Registry)
Central registry of all personnel with deduplication and history tracking.

**Access Patterns**:
- Lookup employee by ID
- Search by name (fuzzy matching)
- Get all personnel for a project
- Track employee history over time

**Table Design**:
```
PK: PERSON#{personId}
SK: PROFILE

Attributes:
- personId (String) - Unique identifier (auto-generated UUID)
- fullName (String) - Canonical full name
- nicknames (StringSet) - All known variations ["Aaron", "A-Rod", "A"]
- goByName (String) - Preferred name
- currentPosition (String) - Latest known position
- primaryPhone (String)
- primaryEmail (String)
- dateFirstSeen (String) - First appearance in system
- dateLastSeen (String) - Most recent report
- totalReportsCount (Number) - Count of appearances
- totalHoursWorked (Number) - Cumulative hours across all projects
- status (String) - active | inactive | archived
- createdAt (String)
- updatedAt (String)

GSI1 (NameIndex): full_name (HASH)
GSI2 (StatusIndex): status (HASH) + dateLastSeen (RANGE)

// History records (same PK, different SK)
PK: PERSON#{personId}
SK: HISTORY#{reportId}#{timestamp}

Attributes:
- reportId (String)
- reportDate (String)
- projectId (String)
- projectName (String)
- position (String) - Position on this date
- teamAssignment (String)
- hoursWorked (Number)
- overtimeHours (Number)
- healthStatus (String)
- activitiesPerformed (String) - Raw text from report
- constraints (String) - Any limitations mentioned
```

---

### 3. **Vendors Table** (Supplier/Subcontractor Registry)
Track all vendors, suppliers, and subcontractors with delivery and interaction history.

**Access Patterns**:
- Lookup vendor by ID
- Search by company name
- Track delivery history
- Analyze vendor performance

**Table Design**:
```
PK: VENDOR#{vendorId}
SK: PROFILE

Attributes:
- vendorId (String) - Unique identifier
- companyName (String) - Canonical company name
- companyNameVariations (StringSet) - Known variations ["ABC Supply", "ABC", "ABC Supply Co"]
- vendorType (String) - supplier | subcontractor | rental | other
- contactName (String)
- contactPhone (String)
- contactEmail (String)
- dateFirstSeen (String)
- dateLastSeen (String)
- totalDeliveriesCount (Number)
- status (String) - active | inactive | archived
- createdAt (String)
- updatedAt (String)

GSI1 (CompanyIndex): company_name (HASH)
GSI2 (TypeIndex): vendor_type (HASH) + dateLastSeen (RANGE)

// Delivery records (same PK, different SK)
PK: VENDOR#{vendorId}
SK: DELIVERY#{reportId}#{timestamp}

Attributes:
- reportId (String)
- reportDate (String)
- projectId (String)
- projectName (String)
- materialsDelivered (String) - Description of materials
- deliveryTime (String)
- receivedBy (String) - Personnel who received
- deliveryNotes (String) - Any issues or special notes
- extractedFromText (String) - Raw text snippet from transcript
```

---

### 4. **Project Constraints Table**
Track issues, delays, and constraints by project and building level.

**Access Patterns**:
- Get all constraints for a project
- Filter by category or status
- Track resolution over time
- Analyze constraint trends

**Table Design**:
```
PK: PROJECT#{projectId}
SK: CONSTRAINT#{constraintId}

Attributes:
- constraintId (String) - Unique identifier
- projectId (String)
- projectName (String)
- reportId (String) - Report where first mentioned
- reportDate (String)
- category (String) - delay | safety | material | weather | labor | coordination | other
- level (String) - Building level (Level 1, Level 2, etc.) or "General"
- severity (String) - low | medium | high | critical
- title (String) - Short description
- description (String) - Full description from transcript
- status (String) - open | in_progress | resolved | recurring
- dateIdentified (String)
- dateResolved (String)
- assignedTo (String) - Person responsible for resolution
- resolutionNotes (String)
- extractedFromText (String) - Raw text snippet from transcript
- createdAt (String)
- updatedAt (String)

GSI1 (CategoryIndex): category (HASH) + dateIdentified (RANGE)
GSI2 (StatusIndex): status (HASH) + severity (RANGE)
GSI3 (ProjectDateIndex): project_id (HASH) + reportDate (RANGE)
```

---

### 5. **Daily Work Logs Table**
Detailed breakdown of work performed by team/level with time tracking.

**Access Patterns**:
- Get all work for a specific report
- Track work by team over time
- Analyze productivity by level/area
- Generate progress reports

**Table Design**:
```
PK: REPORT#{reportId}
SK: WORKLOG#{teamId}#{level}

Attributes:
- reportId (String)
- reportDate (String)
- projectId (String)
- teamId (String) - Team 1, Team 2, etc. or "Project Manager"
- level (String) - Building level or area (Level 1, Level 2, Office, etc.)
- personnelAssigned (StringSet) - List of person IDs
- personnelCount (Number)
- taskDescription (String) - What was worked on
- hoursWorked (Number) - Total team hours
- overtimeHours (Number)
- materialsUsed (List) - Materials consumed
- equipmentUsed (List) - Equipment used
- progressPercentage (Number) - Estimated % complete
- extractedFromText (String) - Raw text snippet from transcript
- createdAt (String)

GSI1 (ProjectDateIndex): project_id (HASH) + reportDate (RANGE)
GSI2 (TeamIndex): teamId (HASH) + reportDate (RANGE)
```

---

### 6. **AI Analysis Cache Table**
Store AI-generated summaries and extractions for quick retrieval.

**Access Patterns**:
- Get AI analysis for a report
- Find reports needing re-analysis
- Track AI model performance

**Table Design**:
```
PK: REPORT#{reportId}
SK: AI_ANALYSIS#{analysisType}

Attributes:
- reportId (String)
- analysisType (String) - summary | personnel_extraction | vendor_extraction | constraints | tasks
- modelUsed (String) - AI model identifier (e.g., "gpt-4", "claude-3-opus")
- modelVersion (String)
- prompt (String) - Prompt template used
- rawResponse (String) - Full AI response
- structuredData (Map) - Extracted structured data
- confidence (Number) - Confidence score 0-100
- processingTime (Number) - Milliseconds
- tokenCount (Number)
- cost (Number) - Estimated cost in dollars
- createdAt (String)
- needsReanalysis (Boolean) - Flag for reprocessing

GSI1 (TypeIndex): analysisType (HASH) + createdAt (RANGE)
GSI2 (ModelIndex): modelUsed (HASH) + createdAt (RANGE)
```

---

## Key Design Features

### 1. **Raw Text Storage for AI Analysis**
Every table stores `extractedFromText` or `rawTranscriptText` fields containing the original unformatted text. This allows:
- AI agents to re-analyze data if extraction improves
- Human review of AI-extracted data
- Training data for future ML models
- Audit trail of source material

### 2. **Deduplication Strategy**

**Personnel Deduplication**:
- Use fuzzy name matching (Levenshtein distance)
- Track nickname variations in StringSet
- Query GSI1-NameIndex before creating new person
- Merge duplicates with history preservation

**Vendor Deduplication**:
- Normalize company names (remove Inc, LLC, Co, etc.)
- Track name variations
- Match on phone/email if available

### 3. **Time-Series Tracking**
- Personnel history: Track position changes, hours, projects over time
- Vendor deliveries: Complete delivery log per vendor
- Constraints: Track status changes and resolution timeline
- Work logs: Daily granular tracking

### 4. **Relationship Mapping**
```
Reports (1) ──> (N) Work Logs
Reports (1) ──> (N) Personnel History records
Reports (1) ──> (N) Vendor Deliveries
Reports (1) ──> (N) Constraints

Personnel (1) ──> (N) Personnel History records
Vendors (1) ──> (N) Vendor Deliveries
Projects (1) ──> (N) Reports
Projects (1) ──> (N) Constraints
```

---

## Data Flow Architecture

```
Voice Conversation (ElevenLabs)
         ↓
   Transcript JSON
         ↓
    S3 Storage + DynamoDB Reports Table
         ↓
  AI Analysis Agent (Claude/GPT-4)
         ↓
    ┌─────────┴─────────┐
    ↓                   ↓
Personnel Table    Vendor Table    Constraints Table    Work Logs Table
    ↓                   ↓                ↓                    ↓
         AI Analysis Cache Table
                   ↓
        Report Generation Service
                   ↓
            ┌──────┴──────┐
            ↓             ↓
      PDF Report    Google Sheets
```

---

## Next Steps

1. ✅ Define enhanced schema with raw text support
2. ⏳ Update `dynamodb-schemas.json` with new table definitions
3. ⏳ Create migration scripts to update existing tables
4. ⏳ Build AI transcript analysis agent
5. ⏳ Implement deduplication logic for personnel/vendors
6. ⏳ Create Google Sheets integration
7. ⏳ Build PDF report generator

