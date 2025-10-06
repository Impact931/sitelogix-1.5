# SiteLogix AI Processing Architecture

## Overview

This document outlines the AI-powered data processing pipeline that extracts structured information from voice conversation transcripts and populates both the database and formatted reports.

---

## Architecture Components

### 1. **Data Collection Layer**
```
Voice Conversation (ElevenLabs "Roxy")
         ↓
  Audio Recording (WebM)
         ↓
  Transcript JSON
         ↓
  S3 Storage (SITELOGIX/projects/{projectId}/reports/{YYYY}/{MM}/{DD}/{reportId}/)
         ↓
  DynamoDB Reports Table
  - Raw transcript stored in `rawTranscriptText` field
  - Status: "pending_analysis"
```

### 2. **AI Analysis Engine**
```
Transcript Extraction Service
         ↓
  AI Agent (Claude 3 Opus / GPT-4)
         ↓
  Structured Data Extraction:
  - Personnel identification & deduplication
  - Vendor/supplier mentions
  - Work activities by team/level
  - Constraints & issues
  - Time tracking
         ↓
  DynamoDB Updates:
  - Personnel table (with history)
  - Vendors table (with deliveries)
  - Work logs table
  - Constraints table
  - AI Analysis Cache
         ↓
  Report Status: "analyzed"
```

### 3. **Report Generation Layer**
```
Structured Data (from DynamoDB)
         ↓
  Report Builder Service
         ↓
  ┌──────────┴──────────┐
  ↓                     ↓
PDF Generator     Google Sheets API
  ↓                     ↓
PDF Report        Daily Report Sheet
(S3 Storage)      (Parkway format)
```

---

## AI Agent: Transcript Analysis

### Purpose
Extract all relevant construction report data from natural conversation transcripts.

### Model Recommendation
**Primary**: Claude 3 Opus (best for complex extraction, high accuracy)
**Fallback**: GPT-4 Turbo (faster, lower cost, good accuracy)

### Analysis Tasks

#### Task 1: Personnel Extraction
```typescript
{
  "task": "personnel_extraction",
  "input": "Full conversation transcript",
  "output": {
    "personnel": [
      {
        "fullName": "Aaron Trask",
        "goByName": "Aaron",
        "position": "Project Manager",
        "teamAssignment": "Project Manager",
        "hoursWorked": 8,
        "overtimeHours": 0,
        "healthStatus": "N/A",
        "extractedFromText": "Aaron arrived at 7am and worked a full 8 hour day..."
      },
      {
        "fullName": "Roger Brake",
        "goByName": "Roger",
        "position": "Foreman",
        "teamAssignment": "Team 1",
        "hoursWorked": 8,
        "overtimeHours": 0,
        "healthStatus": "Healthy",
        "extractedFromText": "Roger led Team 1 on Level 1 punch list items..."
      }
      // ... more personnel
    ],
    "totalHeadcount": 14,
    "totalHours": 106
  }
}
```

#### Task 2: Work Activities Extraction
```typescript
{
  "task": "work_activities_extraction",
  "input": "Full conversation transcript",
  "output": {
    "workLogs": [
      {
        "teamId": "Project Manager",
        "level": "General",
        "personnelAssigned": ["Aaron Trask", "Corey Birchfield"],
        "personnelCount": 2,
        "taskDescription": "Attend Meetings",
        "hoursWorked": 8,
        "overtimeHours": 0,
        "extractedFromText": "The project managers attended coordination meetings..."
      },
      {
        "teamId": "Team 1",
        "level": "Level 1, Level 4, Level 5",
        "personnelAssigned": ["Roger Brake", "Jerimiah Brigham", "Dorian Reed", "Bryce Shanklin", "Kevin Zamarripa-Reyes"],
        "personnelCount": 5,
        "taskDescription": "Punch List items on LVL. 1, 4, 5; Install Elevator Sump Pumps",
        "hoursWorked": 40,
        "overtimeHours": 0,
        "extractedFromText": "Team 1 worked on punch list items across multiple levels..."
      }
      // ... more work logs
    ]
  }
}
```

#### Task 3: Constraints Extraction
```typescript
{
  "task": "constraints_extraction",
  "input": "Full conversation transcript",
  "output": {
    "constraints": [
      {
        "category": "delay",
        "level": "Level 1",
        "severity": "medium",
        "title": "SEQ 1 installation dependency",
        "description": "Need wall installed NE Corner SEQ 1 to install last risers",
        "status": "open",
        "extractedFromText": "We're waiting on the wall in the northeast corner..."
      }
      // ... more constraints
    ]
  }
}
```

#### Task 4: Vendor/Delivery Extraction
```typescript
{
  "task": "vendor_extraction",
  "input": "Full conversation transcript",
  "output": {
    "vendors": [
      {
        "companyName": "ABC Supply",
        "vendorType": "supplier",
        "materialsDelivered": "PVC pipes, fittings",
        "deliveryTime": "10:30 AM",
        "receivedBy": "Roger Brake",
        "deliveryNotes": "All materials accounted for, no issues",
        "extractedFromText": "ABC Supply delivered our PVC pipes around 10:30..."
      }
      // ... more deliveries
    ]
  }
}
```

---

## AI Prompts

### Master Extraction Prompt
```
You are an AI assistant specialized in extracting structured construction data from daily report conversations.

CONTEXT:
- Project: {projectName}
- Location: {projectLocation}
- Manager: {managerName}
- Date: {reportDate}

TRANSCRIPT:
{rawTranscriptText}

TASK:
Extract ALL of the following information in JSON format:

1. PERSONNEL:
For each person mentioned, extract:
- Full name (best guess at formal name)
- Nickname or "go by" name
- Position (Project Manager, Foreman, Journeyman, Apprentice)
- Team assignment (Project Manager, Team 1, Team 2, etc.)
- Hours worked
- Overtime hours
- Health/limitation status
- Quote the exact text where this information was mentioned

2. WORK ACTIVITIES:
For each team/group, extract:
- Team ID
- Building level or area worked
- List of personnel assigned
- Task description (what they worked on)
- Hours worked
- Materials used
- Equipment used
- Quote the exact text

3. CONSTRAINTS/ISSUES:
For each issue mentioned, extract:
- Category (delay, safety, material, weather, labor, coordination)
- Building level affected
- Severity (low, medium, high, critical)
- Description
- Status (open, in_progress, resolved)
- Quote the exact text

4. VENDORS/DELIVERIES:
For each delivery or vendor mention, extract:
- Company name
- Type (supplier, subcontractor, rental)
- Materials/services provided
- Delivery time (if mentioned)
- Received by whom
- Any issues or notes
- Quote the exact text

5. TIME SUMMARY:
- Total personnel count
- Total regular hours
- Total overtime hours
- Arrival time (if mentioned)
- Departure time (if mentioned)

IMPORTANT:
- Include "extractedFromText" field with direct quotes from transcript
- Use null for missing data
- Be conservative - don't guess if information isn't clear
- Preserve exact spellings of names as mentioned
- Use consistent team naming (Team 1, Team 2, etc.)

Return a valid JSON object with keys: personnel, workLogs, constraints, vendors, timeSummary
```

---

## Deduplication Logic

### Personnel Deduplication

```typescript
interface PersonnelDeduplicator {
  async findOrCreatePerson(extractedPerson: ExtractedPerson): Promise<PersonId> {
    // 1. Normalize name
    const normalizedName = normalizeName(extractedPerson.fullName);

    // 2. Search by exact name match
    let person = await queryByName(normalizedName);

    // 3. If not found, fuzzy match on nicknames
    if (!person) {
      person = await fuzzyMatchByNickname(extractedPerson.goByName);
    }

    // 4. If still not found, create new person
    if (!person) {
      person = await createPerson({
        personId: generateUUID(),
        fullName: normalizedName,
        nicknames: [extractedPerson.goByName, extractedPerson.fullName],
        goByName: extractedPerson.goByName,
        currentPosition: extractedPerson.position,
        dateFirstSeen: reportDate,
        dateLastSeen: reportDate,
        totalReportsCount: 1,
        totalHoursWorked: extractedPerson.hoursWorked,
        status: 'active'
      });
    } else {
      // 5. Update existing person
      await updatePerson(person.personId, {
        dateLastSeen: reportDate,
        totalReportsCount: person.totalReportsCount + 1,
        totalHoursWorked: person.totalHoursWorked + extractedPerson.hoursWorked,
        // Update position if changed
        currentPosition: extractedPerson.position !== person.currentPosition
          ? extractedPerson.position
          : person.currentPosition,
        // Add new nickname variations
        nicknames: [...new Set([...person.nicknames, extractedPerson.goByName])]
      });
    }

    // 6. Create history record
    await createPersonnelHistory({
      personId: person.personId,
      reportId,
      reportDate,
      projectId,
      position: extractedPerson.position,
      teamAssignment: extractedPerson.teamAssignment,
      hoursWorked: extractedPerson.hoursWorked,
      overtimeHours: extractedPerson.overtimeHours,
      healthStatus: extractedPerson.healthStatus,
      activitiesPerformed: extractedPerson.extractedFromText
    });

    return person.personId;
  }
}
```

### Vendor Deduplication

```typescript
interface VendorDeduplicator {
  async findOrCreateVendor(extractedVendor: ExtractedVendor): Promise<VendorId> {
    // 1. Normalize company name
    const normalizedName = normalizeCompanyName(extractedVendor.companyName);
    // Remove: Inc, LLC, Co, Corporation, etc.

    // 2. Search by exact match
    let vendor = await queryByCompanyName(normalizedName);

    // 3. If not found, fuzzy match on variations
    if (!vendor) {
      vendor = await fuzzyMatchCompanyName(normalizedName);
    }

    // 4. If still not found, create new vendor
    if (!vendor) {
      vendor = await createVendor({
        vendorId: generateUUID(),
        companyName: normalizedName,
        companyNameVariations: [extractedVendor.companyName],
        vendorType: extractedVendor.vendorType,
        dateFirstSeen: reportDate,
        dateLastSeen: reportDate,
        totalDeliveriesCount: 1,
        status: 'active'
      });
    } else {
      // 5. Update existing vendor
      await updateVendor(vendor.vendorId, {
        dateLastSeen: reportDate,
        totalDeliveriesCount: vendor.totalDeliveriesCount + 1,
        companyNameVariations: [...new Set([...vendor.companyNameVariations, extractedVendor.companyName])]
      });
    }

    // 6. Create delivery record
    await createVendorDelivery({
      vendorId: vendor.vendorId,
      reportId,
      reportDate,
      projectId,
      materialsDelivered: extractedVendor.materialsDelivered,
      deliveryTime: extractedVendor.deliveryTime,
      receivedBy: extractedVendor.receivedBy,
      deliveryNotes: extractedVendor.deliveryNotes,
      extractedFromText: extractedVendor.extractedFromText
    });

    return vendor.vendorId;
  }
}
```

---

## Report Generation

### PDF Report Structure
```
┌─────────────────────────────────────────┐
│  PARKWAY CONSTRUCTION SERVICES          │
│  Daily Report - {projectName}           │
│  Date: {reportDate}                     │
└─────────────────────────────────────────┘

PERSONNEL SUMMARY
┌──────────────┬────────┬──────────┬────────┬────────┬──────┬─────┐
│ Full Name    │ Go By  │ Position │ Team # │ Limits │ Hours│ O/T │
├──────────────┼────────┼──────────┼────────┼────────┼──────┼─────┤
│ Aaron Trask  │ Aaron  │ PM       │   PM   │  N/A   │   8  │  0  │
│ Roger Brake  │ Roger  │ Foreman  │ Team 1 │ Healthy│   8  │  0  │
└──────────────┴────────┴──────────┴────────┴────────┴──────┴─────┘
Total: 14 personnel | Regular: {regularHours} | Overtime: {overtimeHours}

TASKS BY TEAM
┌────────────────┬──────────────────────────────────────┐
│ Team           │ Task Description                      │
├────────────────┼──────────────────────────────────────┤
│ Project Manager│ Attend Meetings                       │
│ Team 1         │ Punch List LVL 1,4,5; Install Pumps  │
│ Team 2         │ Water Heater Review / Valve Install   │
└────────────────┴──────────────────────────────────────┘

CONSTRAINTS BY LEVEL
┌────────┬──────────────────────────────────────────┐
│ Level  │ Constraint                                │
├────────┼──────────────────────────────────────────┤
│ Level 1│ Need wall installed NE Corner SEQ 1...   │
└────────┴──────────────────────────────────────────┘
```

### Google Sheets Integration
```typescript
interface GoogleSheetsReportService {
  async createDailyReport(reportData: ReportData, sheetUrl: string): Promise<void> {
    const auth = await authorizeGoogleSheets();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Create or find sheet for this date
    const sheetName = reportData.reportDate;
    await createSheetIfNotExists(sheets, sheetUrl, sheetName);

    // 2. Write header data
    await sheets.spreadsheets.values.update({
      spreadsheetId: extractSpreadsheetId(sheetUrl),
      range: `${sheetName}!D3`,
      valueInputOption: 'RAW',
      resource: {
        values: [[reportData.projectName]]
      }
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: extractSpreadsheetId(sheetUrl),
      range: `${sheetName}!H3`,
      valueInputOption: 'RAW',
      resource: {
        values: [[`Date:${reportData.reportDate}`]]
      }
    });

    // 3. Write personnel rows
    const personnelRows = reportData.personnel.map(p => [
      p.fullName,
      p.goByName,
      p.position,
      p.teamAssignment,
      p.healthStatus,
      p.hoursWorked,
      p.overtimeHours
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: extractSpreadsheetId(sheetUrl),
      range: `${sheetName}!A7:G${6 + personnelRows.length}`,
      valueInputOption: 'RAW',
      resource: {
        values: personnelRows
      }
    });

    // 4. Write tasks
    const tasksRows = reportData.workLogs.map(w => [
      w.teamId,
      w.taskDescription
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: extractSpreadsheetId(sheetUrl),
      range: `${sheetName}!A30:B${29 + tasksRows.length}`,
      valueInputOption: 'RAW',
      resource: {
        values: tasksRows
      }
    });

    // 5. Write constraints
    const constraintsRows = reportData.constraints.map(c => [
      c.level,
      c.description
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: extractSpreadsheetId(sheetUrl),
      range: `${sheetName}!H30:I${29 + constraintsRows.length}`,
      valueInputOption: 'RAW',
      resource: {
        values: constraintsRows
      }
    });

    // 6. Apply formatting to match template
    await applyTemplateFormatting(sheets, sheetUrl, sheetName);
  }
}
```

---

## Implementation Plan

### Phase 1: Database Enhancement ✅
- [x] Design enhanced schema
- [x] Create DynamoDB schema files
- [ ] Run database migration scripts
- [ ] Test new schema with sample data

### Phase 2: AI Analysis Agent
- [ ] Create transcript analysis service
- [ ] Implement Claude/GPT-4 integration
- [ ] Build extraction prompts
- [ ] Test with sample transcripts
- [ ] Add AI analysis cache

### Phase 3: Deduplication Service
- [ ] Build personnel deduplication logic
- [ ] Build vendor deduplication logic
- [ ] Implement fuzzy matching (Levenshtein distance)
- [ ] Test with duplicate scenarios

### Phase 4: Report Generation
- [ ] Create PDF report generator
- [ ] Build Google Sheets integration
- [ ] Test with sample data
- [ ] Deploy to production

---

## Cost Estimation

### AI Processing Costs (per report)
**Claude 3 Opus**:
- Input: ~5,000 tokens (transcript)
- Output: ~2,000 tokens (structured data)
- Cost: ~$0.11 per report

**GPT-4 Turbo**:
- Input: ~5,000 tokens
- Output: ~2,000 tokens
- Cost: ~$0.07 per report

### Recommended Approach
- Use GPT-4 Turbo for initial extraction (faster, cheaper)
- Use Claude 3 Opus for complex or ambiguous transcripts
- Cache AI results to avoid re-processing

---

## Next Steps

1. Get Google Sheets workbook URL from user
2. Build AI transcript analysis agent
3. Create migration scripts for enhanced database
4. Test end-to-end pipeline with sample report
5. Deploy to production

