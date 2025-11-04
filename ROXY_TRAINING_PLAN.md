# Roxy AI Agent Training Plan
## Construction Report Processing & Entity Extraction

**Date**: November 4, 2025
**Dataset**: 102 Historical Construction Reports (July 2022)
**Data Quality**: Low (unstructured, pre-instruction baseline)
**Goal**: Train Roxy to extract structured data from conversational transcripts

---

## Executive Summary

This training plan outlines a systematic approach to train the Roxy AI agent on 102 historical construction daily reports. These reports represent the **worst-case scenario** for data quality - they are conversational, unstructured, submitted before standardized reporting guidelines. Successfully processing this dataset will establish Roxy's ability to handle any future structured input.

**Key Challenge**: Employee and project name consistency across 99 days of reports from 7 different foremen.

---

## Dataset Analysis

### Overview
- **Total Files**: 102 .docx transcripts
- **Date Range**: July 1-30, 2022 (1 month)
- **Format**: Conversational voice-to-text transcripts
- **Structure**: Semi-structured with metadata header + free-form transcript

### Reporters (7 Foremen/Superintendents)

| Name | Reports | Projects | Notes |
|------|---------|----------|-------|
| Kenny | 26 | CC (Cortex Commons) | Most active, detailed technical reports |
| Kurt | 24 | Meharry | Consistent daily reporter |
| Wes | 22 | MM, SLU Res, Bommarito | Multi-site coverage |
| Mike | 16 | Nash Twr 2 | Focused on single large project |
| Brian | 4 | Multi-site (Nash, Carpenters Hall, Meharry) | Weekly summary reports |
| Jim | 4 | Sx Partners, Parkway North, Samantha's House | Various small projects |
| Scott | 3 | Monsanto, SLU Res | Limited coverage |

### Project Sites (12-15 Active Sites)

**Identified Projects**:
1. **CC** - Cortex Commons (Kenny's primary site)
2. **Meharry** - Meharry Medical College (Kurt's primary site)
3. **Nash Twr 2** - Nashville Yards Tower 2 (Mike/Brian's site)
4. **MM** - Mellow Mushroom restaurant
5. **SLU Res** - Saint Louis University Residence Hall
6. **Bommarito** - Bommarito Automotive dealership
7. **Sx Partners** - Six/Surgery Partners medical facility
8. **Carpenters Hall** - Carpenters Union training facility
9. **Monsanto** - Monsanto facility
10. **Parkway North** - Unknown facility
11. **Samantha's House** - Residential project
12. **Brentwood** - Location mentioned
13. **Triad** - Project mentioned with Bommarito

**Challenge**: Abbreviations and inconsistent naming (e.g., "MM" could be Mellow Mushroom OR Monsanto in different contexts)

---

## Data Structure Analysis

### Actual Report Format (As-Is)

```
Report Date: 2022-07-05
Report Name: 7.5.22 Kenny CC_transcript

Employee Name: Kenny

Transcript: Today's Tuesday, July 5th 2022 job report known as excitement myself.
I had six and a half hours Scott Russell six and a half and Owen glass burner six and a half...
[conversational voice-to-text continues]
```

### Key Characteristics

**Positive Patterns**:
- ✅ Consistent metadata header (Report Date, Report Name, Employee Name)
- ✅ Date mentioned in transcript (validates header)
- ✅ Project name in filename
- ✅ Reporter name in filename and metadata

**Challenges** (Why This Is "Worst Case"):
- ❌ No punctuation or proper sentence structure
- ❌ Voice-to-text transcription errors ("known as excitement" = "Cortex Commons Myself")
- ❌ Run-on sentences with multiple data points
- ❌ Inconsistent abbreviations
- ❌ Ambiguous pronouns ("I", "we" without clear antecedents)
- ❌ Mixed tenses and informal language
- ❌ Personnel names embedded in speech ("Scott Russell", "Owen glass burner" = Owen Glassburn)
- ❌ Multiple projects in single report
- ❌ Hours split across projects/days
- ❌ No standardized structure for deliveries, constraints, weather

---

## Entity Extraction Requirements

### Critical Entities (Must Extract)

#### 1. **Report Metadata**
- **Report Date** (from header + transcript validation)
- **Reporter Name** (from filename + metadata + transcript)
- **Project Name(s)** (from filename + transcript)
- **Report Type** (daily vs. weekly)

#### 2. **Personnel** (with Deduplication)
- Reporter (foreman/superintendent)
- Workers mentioned by name
- Hours worked per person per project
- **Normalization Rules**:
  - "Kenny" = "Kenny [Last Name TBD]"
  - "Scott Russell" = consistent ID
  - "Owen glass burner" = "Owen Glassburn" (spelling correction)
  - "Bryan" vs "Brian" = same person

#### 3. **Projects** (with Normalization)
- Project name/code
- Location (if mentioned)
- **Normalization Rules**:
  - "CC" = "Cortex Commons"
  - "MM" = context-dependent (Mellow Mushroom OR Monsanto)
  - "Nash Twr 2" = "Nashville Yards Tower 2"
  - "SLU Res" = "Saint Louis University Residence Hall"
  - "Meharry" = "Meharry Medical College"

#### 4. **Work Activities**
- Tasks completed
- Tasks in progress
- Tasks blocked/waiting
- Equipment used
- Areas/floors worked on

#### 5. **Time Tracking**
- Hours per person
- Hours per project (when multi-project reports)
- Date ranges (for weekly reports)

#### 6. **Vendors/Deliveries** (Optional but Valuable)
- Company names (Luthe, Gico, Lampe, BSI)
- Materials delivered
- Delivery times
- Vendors delayed/missing

#### 7. **Issues/Constraints**
- Weather delays
- Material shortages
- Waiting on other trades
- Equipment issues
- Personnel changes (layoffs, transfers)

---

## Deduplication & Normalization Strategy

### Phase 1: Entity Extraction (Fuzzy Matching)

**Challenge**: Same person/project mentioned differently across reports

**Solution**: Confidence-scored fuzzy matching

```
Report 1: "Kenny" at "CC"
Report 2: "Kenny" at "Cortex Commons"
Report 3: "Kenny" at "CC"

→ Fuzzy Match Confidence:
   - "Kenny" (100% match across all)
   - "CC" ↔ "Cortex Commons" (80% match via abbreviation)

→ Normalized Result:
   - Person: kenny_001 ("Kenny")
   - Project: proj_cortex_commons ("Cortex Commons / CC")
```

### Phase 2: Human-in-the-Loop Validation

**Approach**: Progressive refinement with manual review

1. **Batch 1** (10 reports): Extract, review, establish baseline rules
2. **Batch 2** (20 reports): Apply rules, identify edge cases
3. **Batch 3** (30 reports): Refine normalization, build lookup tables
4. **Batch 4-10** (42 reports): Automated with spot-checking

### Phase 3: Build Canonical Entity Database

**Personnel Master List**:
```
personnel_id | canonical_name | aliases | role
-------------|----------------|---------|------
per_001      | Kenny [LastName] | Kenny, Ken | Superintendent
per_002      | Kurt [LastName] | Kurt | Foreman
per_003      | Scott Russell | Scott R., Russell | Plumber
per_004      | Owen Glassburn | Owen, Owen glass burner | Laborer
...
```

**Project Master List**:
```
project_id    | canonical_name | abbrev | location
--------------|----------------|--------|----------
proj_001      | Cortex Commons | CC | St. Louis, MO
proj_002      | Meharry Medical College | Meharry | Nashville, TN
proj_003      | Nashville Yards Tower 2 | Nash Twr 2, Nash Tower 2 | Nashville, TN
proj_004      | Mellow Mushroom | MM | [Location TBD]
proj_005      | Saint Louis University Residence | SLU Res | St. Louis, MO
...
```

---

## Training Phases

### Phase 1: Manual Baseline (10 reports, ~2-3 hours)

**Goal**: Establish ground truth and extraction patterns

**Process**:
1. Select 10 diverse reports (different employees, projects, formats)
2. Manually extract all entities
3. Document extraction rules
4. Identify ambiguities
5. Create normalization lookups

**Reports for Phase 1**:
- 7.1.22 Jim Sx Partners (single project, simple)
- 7.5.22 Kenny CC (technical, multiple workers)
- 7.11.22-7.17.22 Brian Nash... (weekly, multi-project)
- 7.5.22 Wes MM & Bommarito (multi-site)
- 7.11.22 Kurt Meharry (typical daily)
- 7.18.22 Wes MM & SLU Res (issue tracking)
- 7.10.22 Kenny CC (deliveries)
- 7.5.22 Jim Samantha's House (small project)
- 7.25.22 Scott Monsanto (different reporter)
- 7.7.22 Brian Nash Twr 2 (single focus)

**Deliverables**:
- ✅ Ground truth JSON for 10 reports
- ✅ Entity normalization rules document
- ✅ Roxy prompt v1.0
- ✅ Known ambiguities list

### Phase 2: Automated with Review (30 reports, ~3-4 hours)

**Goal**: Scale extraction with Roxy, validate accuracy

**Process**:
1. Process next 30 reports through Roxy
2. Review all extracted entities
3. Calculate accuracy metrics (precision, recall)
4. Refine prompts based on errors
5. Update normalization rules

**Success Criteria**:
- 80%+ accuracy on personnel names
- 90%+ accuracy on project identification
- 75%+ accuracy on hours tracking
- Identified patterns for common errors

**Deliverables**:
- ✅ 40 reports processed (10+30)
- ✅ Accuracy report
- ✅ Roxy prompt v2.0
- ✅ Expanded entity lookups

### Phase 3: Batch Processing (62 reports, ~2-3 hours)

**Goal**: Complete dataset with spot-checking

**Process**:
1. Batch process remaining 62 reports
2. Spot-check 10-15 reports (15-20%)
3. Run data quality checks:
   - Missing required fields
   - Duplicate entity names
   - Outlier hours (>16 per day)
   - Orphaned references
4. Final cleanup and normalization

**Success Criteria**:
- 90%+ of reports have complete core data
- All personnel/projects have canonical IDs
- Zero duplicate entities in master lists
- All reports visible in app

**Deliverables**:
- ✅ 102 reports fully processed
- ✅ Complete personnel master list
- ✅ Complete project master list
- ✅ Roxy prompt v3.0 (production-ready)

---

## App Features Required

### Existing Features to Verify
- [ ] Report list view (by date)
- [ ] Report detail view (with transcript)
- [ ] Analytics dashboard (summary stats)
- [ ] Project filter
- [ ] Date range filter

### New Features Needed

#### 1. **Personnel Management** (HIGH PRIORITY)
- Personnel list view (all workers across reports)
- Personnel detail page:
  - Total hours worked
  - Projects worked on
  - Date range active
  - All reports submitted
- Personnel deduplication UI:
  - Flag potential duplicates
  - Merge functionality
  - Manual override

#### 2. **Project Management** (HIGH PRIORITY)
- Project list view
- Project detail page:
  - All reports for project
  - Personnel assigned
  - Total hours by person
  - Timeline view
  - Issue/constraint tracking
- Project alias management:
  - Map "CC" → "Cortex Commons"
  - Search by abbreviation or full name

#### 3. **Search & Filter** (MEDIUM PRIORITY)
- Global search across all reports
- Filter by:
  - Reporter name
  - Project name
  - Date range
  - Work type/activity
  - Personnel mentioned
  - Vendors mentioned
- Saved searches
- Export filtered results

#### 4. **Entity Resolution UI** (MEDIUM PRIORITY)
- Review extraction confidence scores
- Flag low-confidence extractions for review
- Bulk edit/normalize entities
- Training feedback loop:
  - Mark extractions as correct/incorrect
  - Improve Roxy accuracy over time

#### 5. **Analytics Enhancements** (LOW PRIORITY)
- Labor costs by project
- Hours trending by person/project
- Issue frequency analysis
- Vendor reliability tracking
- Weather impact analysis

#### 6. **Data Quality Dashboard** (LOW PRIORITY)
- Missing data report
- Duplicate detection
- Outlier detection (unusual hours, etc.)
- Extraction confidence scores
- Manual review queue

---

## Roxy Prompt Engineering

### V1.0 Prompt (Baseline)

```
You are Roxy, an AI agent specialized in extracting structured data from construction daily reports.

TASK: Extract the following entities from the provided transcript:

REQUIRED FIELDS:
1. report_date (YYYY-MM-DD)
2. reporter_name (first + last if available)
3. project_name (full name, not abbreviation)
4. total_hours (reporter's hours for the day)

OPTIONAL FIELDS:
5. additional_personnel[] (array of {name, hours})
6. work_completed[] (array of completed tasks)
7. work_in_progress[] (array of ongoing tasks)
8. issues[] (array of problems/delays)
9. vendors[] (array of {company, delivery_type, time})
10. weather_notes (if mentioned)

EXTRACTION RULES:
- Use context clues to expand abbreviations (CC = Cortex Commons)
- Normalize similar names (Bryan = Brian)
- If hours mentioned for "I" or "myself", attribute to reporter
- Sum hours across multiple mentions of same person
- Flag ambiguous project names with [UNCLEAR: ...]
- If multi-day report, extract date range

OUTPUT FORMAT: JSON only, no explanations
```

### V2.0 Prompt (After 30 Reports)

```
[Enhanced with learned patterns:]
- Known abbreviation mappings
- Common transcription errors
- Typical task categories
- Expected vendor names
- Personnel role inference
```

### V3.0 Prompt (Production)

```
[Final version with:]
- Confidence scoring per field
- Entity linking to master IDs
- Automatic deduplication
- Context-aware disambiguation
- Error recovery strategies
```

---

## Success Metrics

### Data Quality KPIs

| Metric | Target | Critical? |
|--------|--------|-----------|
| Reports with complete core data | 95%+ | ✅ |
| Personnel extraction accuracy | 90%+ | ✅ |
| Project extraction accuracy | 95%+ | ✅ |
| Hours tracking accuracy | 85%+ | ⚠️ |
| Duplicate entity rate | <5% | ⚠️ |
| Manual review required | <10% | ⚠️ |
| Processing time per report | <2 min | ⚠️ |

### App Functionality KPIs

| Feature | Must Have | Should Have | Nice to Have |
|---------|-----------|-------------|--------------|
| View all reports by date | ✅ | | |
| View report transcript | ✅ | | |
| Filter by project | ✅ | | |
| Filter by reporter | ✅ | | |
| Personnel directory | ✅ | | |
| Project directory | ✅ | | |
| Search reports | | ✅ | |
| Entity resolution UI | | ✅ | |
| Analytics dashboard | | | ✅ |
| Export data | | | ✅ |

---

## Risk Mitigation

### Risk 1: Poor Extraction Accuracy
**Mitigation**: Start with manual baseline, progressive refinement, human review checkpoints

### Risk 2: Entity Duplication Explosion
**Mitigation**: Build master lists early, strict normalization rules, dedup UI

### Risk 3: Ambiguous Project References
**Mitigation**: Context-based disambiguation, reporter-project associations, manual override

### Risk 4: Time Tracking Errors
**Mitigation**: Sanity checks (max 24 hours/day), cross-validation with project budgets

### Risk 5: App Performance with 102+ Reports
**Mitigation**: Pagination, indexing, caching, lazy loading

---

## Implementation Timeline

### Week 1: Foundation
- **Day 1**: Convert all .docx to .txt, upload to S3 ✅
- **Day 2**: Phase 1 manual extraction (10 reports)
- **Day 3**: Build personnel/project master lists
- **Day 4**: Create Roxy prompt v1.0
- **Day 5**: Build entity resolution UI

### Week 2: Scaling
- **Day 1-2**: Phase 2 processing (30 reports)
- **Day 3**: Refine prompts and rules (v2.0)
- **Day 4-5**: Phase 3 batch processing (62 reports)

### Week 3: Refinement
- **Day 1-2**: Data quality checks and cleanup
- **Day 3-4**: App feature enhancements
- **Day 5**: Testing and validation

### Week 4: Production
- **Day 1-2**: Roxy prompt v3.0 finalization
- **Day 3**: Deploy updated app
- **Day 4-5**: User acceptance testing

**Total Estimated Time**: 15-20 days (3-4 weeks)

---

## Next Steps (Immediate Actions)

1. ✅ **Convert .docx files to .txt** (batch conversion script)
2. ✅ **Upload all transcripts to S3** (using clean structure)
3. ⏳ **Select Phase 1 reports** (10 for manual extraction)
4. ⏳ **Create extraction template** (JSON schema)
5. ⏳ **Manually extract Phase 1 data** (ground truth)
6. ⏳ **Build personnel master list v1**
7. ⏳ **Build project master list v1**
8. ⏳ **Write Roxy prompt v1.0**
9. ⏳ **Test extraction on 3 sample reports**
10. ⏳ **Iterate until 80%+ accuracy**

---

## Appendix A: File Inventory

```
Total Files: 102 .docx
Date Range: July 1-30, 2022
Size Range: 6.7KB - 7.8KB each
Format: Microsoft Word (textutil compatible)

Employees:
- Kenny (26 reports)
- Kurt (24 reports)
- Wes (22 reports)
- Mike (16 reports)
- Brian (4 reports)
- Jim (4 reports)
- Scott (3 reports)
- Unknown (3 reports with parsing issues)

Projects:
- Cortex Commons (CC) - ~30 reports
- Meharry Medical - ~25 reports
- Nashville Yards Tower 2 - ~20 reports
- SLU Residence - ~10 reports
- Mellow Mushroom - ~8 reports
- Others - ~9 reports
```

---

## Appendix B: Sample Extraction

**Input** (`7.5.22 Kenny CC_transcript.docx`):
```
Report Date:  2022-07-05
Report Name: 7.5.22 Kenny CC_transcript
Employee Name: Kenny

Transcript: Today's Tuesday, July 5th 2022 job report... I had six and a half hours
Scott Russell six and a half and Owen glass burner six and a half...
```

**Expected Output** (JSON):
```json
{
  "report_date": "2022-07-05",
  "reporter": {
    "name": "Kenny",
    "canonical_id": "per_001",
    "hours": 6.5
  },
  "project": {
    "name": "Cortex Commons",
    "abbreviation": "CC",
    "canonical_id": "proj_001"
  },
  "personnel": [
    {"name": "Scott Russell", "hours": 6.5, "role": "plumber"},
    {"name": "Owen Glassburn", "hours": 6.5, "role": "laborer", "confidence": 0.85}
  ],
  "work_completed": [
    "6 inch hole cored in north wall",
    "4 inch vents tied together"
  ],
  "issues": [
    "Left early due to high temperatures",
    "Waiting on points from surveyor",
    "Cannot core hole until reshore is moved"
  ],
  "extraction_confidence": 0.92
}
```

---

**Status**: Ready to execute Phase 1
**Owner**: Claude Code + User Review
**Priority**: HIGH - Critical for app training and future data quality
