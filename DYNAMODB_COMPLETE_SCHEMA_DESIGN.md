# SiteLogix 1.5 - Complete DynamoDB Schema Design
## Database Architect Deliverable - RFC-008 Implementation

**Version:** 1.0
**Date:** November 4, 2025
**Author:** Database Architect
**Status:** Final Design for Implementation

---

## Executive Summary

This document provides the complete DynamoDB schema design for SiteLogix 1.5, addressing all requirements from RFC-008 Database Planning Guidance. The design implements a **multi-table approach** with immutability-first principles, comprehensive audit trails, and AI-friendly data structures.

**Key Decisions:**
- Multi-table design (6 tables) for clarity and maintainability
- Composite key patterns (PK/SK) enabling entity versioning and history tracking
- Strategic GSI placement supporting 7 core access patterns
- DynamoDB Streams enabled on all tables for audit trail and data lifecycle management
- Point-in-Time Recovery (PITR) enabled for compliance and data protection

**Current State Assessment:**
- 4 tables deployed: sitelogix-reports, sitelogix-personnel, sitelogix-vendors, sitelogix-constraints
- 2 tables missing: sitelogix-work-logs, sitelogix-ai-analysis-cache
- Schema mismatches identified: Personnel GSI2 and Vendors GSI2 (missing sort keys)

---

## I. Design Philosophy & Approach

### 1.1 Multi-Table vs Single-Table Decision

**DECISION: Multi-Table Design**

**Reasoning:**
1. **Team Familiarity:** Easier to understand and maintain
2. **GraphQL Integration:** Simpler Amplify schema generation
3. **IAM Policies:** More granular access control per entity type
4. **Development Velocity:** Faster initial implementation
5. **Query Clarity:** Access patterns are explicit and readable
6. **Future Flexibility:** Can migrate to single-table if scale demands it

**Trade-offs Accepted:**
- Slightly higher read costs for cross-entity queries
- Multiple table management overhead
- Cannot leverage single-table design patterns for complex relationships

### 1.2 Key Design Patterns

**Pattern 1: Composite Keys for Versioning**
```
PK: ENTITY#{entityId}
SK: VERSION#{timestamp} or METADATA (for current version)
```

**Pattern 2: History Tracking via Sort Key Overloading**
```
PK: PERSON#{personId}
SK: PROFILE (current state)
SK: HISTORY#{reportId}#{timestamp} (historical records)
```

**Pattern 3: Sparse GSI for Workflow States**
```
GSI3-StatusIndex: status (HASH) + timestamp (RANGE)
Only populated when status = pending_approval | pending_review | critical
```

---

## II. Complete Schema Definitions

### Table 1: sitelogix-reports (PRIMARY ENTITY)

**Purpose:** Atomic unit of the system. All data originates from a report.

**Current Status:** DEPLOYED (needs GSI3 addition)

**Primary Key Structure:**
```json
PK: "REPORT#{reportId}"
SK: "METADATA"
```

**Complete Schema:**
```json
{
  "TableName": "sitelogix-reports",
  "KeySchema": [
    {"AttributeName": "PK", "KeyType": "HASH"},
    {"AttributeName": "SK", "KeyType": "RANGE"}
  ],
  "AttributeDefinitions": [
    {"AttributeName": "PK", "AttributeType": "S"},
    {"AttributeName": "SK", "AttributeType": "S"},
    {"AttributeName": "project_id", "AttributeType": "S"},
    {"AttributeName": "manager_id", "AttributeType": "S"},
    {"AttributeName": "report_date", "AttributeType": "S"},
    {"AttributeName": "status", "AttributeType": "S"},
    {"AttributeName": "timestamp", "AttributeType": "S"}
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GSI1-ProjectIndex",
      "KeySchema": [
        {"AttributeName": "project_id", "KeyType": "HASH"},
        {"AttributeName": "report_date", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    },
    {
      "IndexName": "GSI2-ManagerIndex",
      "KeySchema": [
        {"AttributeName": "manager_id", "KeyType": "HASH"},
        {"AttributeName": "report_date", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    },
    {
      "IndexName": "GSI3-StatusIndex",
      "KeySchema": [
        {"AttributeName": "status", "KeyType": "HASH"},
        {"AttributeName": "timestamp", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    }
  ],
  "StreamSpecification": {
    "StreamEnabled": true,
    "StreamViewType": "NEW_AND_OLD_IMAGES"
  },
  "PointInTimeRecoverySpecification": {
    "PointInTimeRecoveryEnabled": true
  },
  "BillingMode": "PROVISIONED",
  "ProvisionedThroughput": {
    "ReadCapacityUnits": 10,
    "WriteCapacityUnits": 10
  },
  "SSESpecification": {
    "Enabled": true,
    "SSEType": "KMS"
  },
  "Tags": [
    {"Key": "Project", "Value": "SiteLogix"},
    {"Key": "Environment", "Value": "Production"},
    {"Key": "DataClassification", "Value": "Confidential"},
    {"Key": "RetentionPeriod", "Value": "7-years"}
  ]
}
```

**Required Attributes (Non-Key):**
```typescript
{
  // Identity
  reportId: string;              // e.g., "rpt_20251104_mgr_001_1730750400"
  conversationId: string;         // ElevenLabs conversation ID

  // Project Context
  projectId: string;              // FK to projects (external system)
  projectName: string;            // Denormalized for quick access
  projectLocation: string;        // City, State

  // Manager Context
  managerId: string;              // FK to users/managers
  managerName: string;            // Denormalized
  managerPhone: string;           // For audit trail

  // Temporal Data
  reportDate: string;             // ISO date: "2025-11-04"
  timestamp: string;              // Full ISO timestamp: "2025-11-04T14:30:00Z"
  recordingStartTime: string;     // When recording began
  recordingEndTime: string;       // When recording ended
  timezone: string;               // e.g., "America/Chicago"

  // Status Workflow
  status: string;                 // pending_analysis | analyzed | published | archived
  submittedAt: string;            // When foreman submitted
  processedAt: string;            // When AI analysis completed
  publishedAt: string;            // When made available to stakeholders

  // Storage References
  transcriptS3Path: string;       // s3://bucket/projects/{projectId}/transcripts/{YYYY}/{MM}/{DD}/{reportId}.txt
  audioS3Path: string;            // s3://bucket/projects/{projectId}/audio/{YYYY}/{MM}/{DD}/{reportId}.mp3
  audioFileSize: number;          // Bytes
  audioChecksum: string;          // SHA-256 hash
  transcriptChecksum: string;     // SHA-256 hash

  // Raw Data for AI
  rawTranscriptText: string;      // FULL unformatted transcript text (max 400KB)

  // AI Processing Metadata
  aiProcessedAt: string;          // Timestamp
  aiProcessingVersion: string;    // e.g., "v1.2.3"
  aiModelUsed: string;            // e.g., "claude-3-opus-20240229"
  aiConfidenceScore: number;      // 0-100

  // Aggregate Metrics (Extracted)
  totalPersonnelCount: number;    // Total people on site
  totalRegularHours: number;      // Regular hours worked
  totalOvertimeHours: number;     // OT hours
  weatherCondition: string;       // Clear | Rain | Snow | Wind | Extreme Heat | Extreme Cold
  weatherTemperature: number;     // Fahrenheit

  // GPS & Device Data
  gpsLatitude: number;            // Decimal degrees
  gpsLongitude: number;           // Decimal degrees
  gpsAccuracy: number;            // Meters
  deviceId: string;               // Device fingerprint
  deviceModel: string;            // e.g., "iPhone 15 Pro"
  appVersion: string;             // e.g., "1.5.0"
  ipAddress: string;              // For audit trail

  // Audit Trail
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
  createdBy: string;              // User ID
  lastModifiedBy: string;         // User ID
  version: number;                // Optimistic locking

  // Retention & Compliance
  retentionExpiryDate: string;    // 7 years from report_date
  legalHoldStatus: boolean;       // true if under litigation hold
  deletionProtected: boolean;     // true after 30 days
}
```

**Access Patterns Supported:**
1. **Direct Lookup:** `GetItem(PK="REPORT#{reportId}", SK="METADATA")` - < 10ms
2. **Project Timeline:** Query GSI1 `project_id = X AND report_date BETWEEN Y AND Z`
3. **Manager Performance:** Query GSI2 `manager_id = X AND report_date BETWEEN Y AND Z`
4. **Workflow Management:** Query GSI3 `status = "pending_review" AND timestamp > X`
5. **Full-Text Search:** Via OpenSearch integration (future enhancement)

**Why These GSIs:**
- **GSI1 (Project+Date):** Most common query pattern - "show me all reports for this project"
- **GSI2 (Manager+Date):** Manager performance tracking and accountability
- **GSI3 (Status+Timestamp):** Workflow queue processing (only recent statuses indexed)

---

### Table 2: sitelogix-personnel (MASTER REGISTRY)

**Purpose:** Central registry of all personnel with deduplication and complete work history.

**Current Status:** DEPLOYED (needs GSI2 update - missing sort key)

**Schema Mismatch Identified:**
- **Current GSI2:** `project_id (HASH)` only
- **Required GSI2:** `status (HASH) + dateLastSeen (RANGE)` for personnel status tracking

**Primary Key Structure:**
```json
PK: "PERSON#{personId}"
SK: "PROFILE" (current state) or "HISTORY#{reportId}#{timestamp}" (work history)
```

**Complete Schema:**
```json
{
  "TableName": "sitelogix-personnel",
  "KeySchema": [
    {"AttributeName": "PK", "KeyType": "HASH"},
    {"AttributeName": "SK", "KeyType": "RANGE"}
  ],
  "AttributeDefinitions": [
    {"AttributeName": "PK", "AttributeType": "S"},
    {"AttributeName": "SK", "AttributeType": "S"},
    {"AttributeName": "full_name", "AttributeType": "S"},
    {"AttributeName": "status", "AttributeType": "S"},
    {"AttributeName": "dateLastSeen", "AttributeType": "S"}
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GSI1-NameIndex",
      "KeySchema": [
        {"AttributeName": "full_name", "KeyType": "HASH"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    },
    {
      "IndexName": "GSI2-StatusIndex",
      "KeySchema": [
        {"AttributeName": "status", "KeyType": "HASH"},
        {"AttributeName": "dateLastSeen", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    }
  ],
  "StreamSpecification": {
    "StreamEnabled": true,
    "StreamViewType": "NEW_AND_OLD_IMAGES"
  },
  "PointInTimeRecoverySpecification": {
    "PointInTimeRecoveryEnabled": true
  },
  "BillingMode": "PROVISIONED",
  "ProvisionedThroughput": {
    "ReadCapacityUnits": 5,
    "WriteCapacityUnits": 5
  },
  "SSESpecification": {
    "Enabled": true,
    "SSEType": "KMS"
  },
  "Tags": [
    {"Key": "Project", "Value": "SiteLogix"},
    {"Key": "Environment", "Value": "Production"},
    {"Key": "DataClassification", "Value": "PII"},
    {"Key": "EncryptionRequired", "Value": "true"}
  ]
}
```

**PROFILE Record Attributes (SK="PROFILE"):**
```typescript
{
  // Identity
  personId: string;               // UUID (auto-generated)
  fullName: string;               // Canonical: "Aaron Rodriguez"
  nicknames: string[];            // ["Aaron", "A-Rod", "A", "Aaron R"]
  goByName: string;               // "Aaron"
  phoneticName: string;           // Soundex/Metaphone for fuzzy matching

  // Employment
  currentPosition: string;        // "Electrician Journeyman"
  employmentStatus: string;       // active | inactive | terminated | on_leave
  status: string;                 // For GSI2: active | inactive | archived
  hireDate: string;               // ISO date

  // Contact (PII - Encrypted)
  primaryPhone: string;           // Encrypted at rest
  primaryEmail: string;           // Encrypted at rest
  emergencyContact: string;       // Encrypted at rest

  // Aggregate Metrics
  totalReportsCount: number;      // Count of HISTORY records
  totalHoursWorked: number;       // Cumulative regular hours
  totalOvertimeHours: number;     // Cumulative OT hours
  dateFirstSeen: string;          // First report appearance
  dateLastSeen: string;           // Most recent report

  // Skills & Certifications
  skills: string[];               // ["Electrical", "Rough-In", "Panel Installation"]
  certifications: string[];       // ["OSHA 30", "Journeyman License"]

  // Deduplication Metadata
  fuzzyMatchScore: number;        // Confidence of last deduplication (0-100)
  mergedFrom: string[];           // Array of person IDs merged into this record
  isCanonical: boolean;           // true = primary record, false = duplicate/merged

  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string;              // Admin user who approved
  lastModifiedBy: string;
  version: number;
}
```

**HISTORY Record Attributes (SK="HISTORY#{reportId}#{timestamp}"):**
```typescript
{
  // Links
  personId: string;               // Parent person
  reportId: string;               // FK to reports table
  reportDate: string;             // ISO date
  projectId: string;              // Which project
  projectName: string;            // Denormalized

  // Work Details
  position: string;               // Position on this date (may differ from current)
  teamAssignment: string;         // "Team 1", "Team 2", "Project Manager"
  hoursWorked: number;            // Regular hours this report
  overtimeHours: number;          // OT hours this report

  // Health & Safety
  healthStatus: string;           // healthy | injured | sick | other
  safetyIncident: boolean;        // true if involved in incident

  // Activity
  activitiesPerformed: string;    // Raw text from transcript
  constraints: string;            // Any limitations mentioned
  equipmentUsed: string[];        // Equipment checked out

  // Extraction Metadata
  extractedFromText: string;      // Raw transcript excerpt
  aiConfidence: number;           // Confidence score for this extraction

  // Audit
  createdAt: string;              // When history record created
}
```

**Access Patterns Supported:**
1. **Direct Lookup:** `GetItem(PK="PERSON#{personId}", SK="PROFILE")`
2. **Fuzzy Name Search:** Query GSI1 `full_name = "Aaron Rodriguez"`
3. **Status Tracking:** Query GSI2 `status = "active" AND dateLastSeen < "2025-10-01"` (find inactive workers)
4. **Work History:** Query `PK="PERSON#{personId}" AND SK BEGINS_WITH "HISTORY#"`
5. **Project Personnel:** Query work logs and cross-reference (or denormalize in work-logs table)

**Why These GSIs:**
- **GSI1 (NameIndex):** Enable fuzzy name matching before creating duplicates
- **GSI2 (StatusIndex):** Find inactive personnel, track workforce changes, compliance reporting

**Migration Required:**
- Drop existing GSI2-ProjectIndex
- Create new GSI2-StatusIndex with status (HASH) + dateLastSeen (RANGE)
- Backfill status and dateLastSeen attributes on all existing records

---

### Table 3: sitelogix-vendors (SUPPLIER/SUBCONTRACTOR REGISTRY)

**Purpose:** Track all vendors, suppliers, and subcontractors with delivery and performance history.

**Current Status:** DEPLOYED (needs GSI2 addition)

**Schema Mismatch Identified:**
- **Current:** Only GSI1-CompanyIndex exists
- **Required:** Add GSI2-TypeIndex for vendor type filtering

**Primary Key Structure:**
```json
PK: "VENDOR#{vendorId}"
SK: "PROFILE" (current state) or "DELIVERY#{reportId}#{timestamp}" (delivery history)
```

**Complete Schema:**
```json
{
  "TableName": "sitelogix-vendors",
  "KeySchema": [
    {"AttributeName": "PK", "KeyType": "HASH"},
    {"AttributeName": "SK", "KeyType": "RANGE"}
  ],
  "AttributeDefinitions": [
    {"AttributeName": "PK", "AttributeType": "S"},
    {"AttributeName": "SK", "AttributeType": "S"},
    {"AttributeName": "company_name", "AttributeType": "S"},
    {"AttributeName": "vendor_type", "AttributeType": "S"},
    {"AttributeName": "dateLastSeen", "AttributeType": "S"}
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GSI1-CompanyIndex",
      "KeySchema": [
        {"AttributeName": "company_name", "KeyType": "HASH"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    },
    {
      "IndexName": "GSI2-TypeIndex",
      "KeySchema": [
        {"AttributeName": "vendor_type", "KeyType": "HASH"},
        {"AttributeName": "dateLastSeen", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    }
  ],
  "StreamSpecification": {
    "StreamEnabled": true,
    "StreamViewType": "NEW_AND_OLD_IMAGES"
  },
  "PointInTimeRecoverySpecification": {
    "PointInTimeRecoveryEnabled": true
  },
  "BillingMode": "PROVISIONED",
  "ProvisionedThroughput": {
    "ReadCapacityUnits": 5,
    "WriteCapacityUnits": 5
  },
  "SSESpecification": {
    "Enabled": true,
    "SSEType": "KMS"
  },
  "Tags": [
    {"Key": "Project", "Value": "SiteLogix"},
    {"Key": "Environment", "Value": "Production"}
  ]
}
```

**PROFILE Record Attributes (SK="PROFILE"):**
```typescript
{
  // Identity
  vendorId: string;               // UUID
  companyName: string;            // Canonical: "ABC Supply Company"
  companyNameVariations: string[]; // ["ABC Supply", "ABC", "ABC Supply Co"]
  normalizedName: string;         // "abc supply" (lowercase, no punctuation)

  // Classification
  vendorType: string;             // supplier | subcontractor | rental | service | other
  subcontractorTrade: string;     // If subcontractor: "Electrical", "Plumbing", "HVAC"

  // Contact
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  websiteUrl: string;

  // Status
  approvalStatus: string;         // pending | approved | active | inactive | blocked
  approvedBy: string;             // Admin user ID
  approvedAt: string;             // Timestamp

  // Aggregate Metrics
  totalDeliveriesCount: number;   // Count of DELIVERY records
  onTimeDeliveryRate: number;     // Percentage (0-100)
  issuesCount: number;            // Count of delivery issues
  dateFirstSeen: string;          // First mention in system
  dateLastSeen: string;           // Most recent delivery

  // Performance
  averageDeliveryRating: number;  // 1-5 stars
  hasInsurance: boolean;          // Insurance on file
  insuranceExpiryDate: string;    // For compliance tracking

  // Deduplication
  fuzzyMatchScore: number;
  mergedFrom: string[];           // Vendor IDs merged into this record
  isCanonical: boolean;

  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
  version: number;
}
```

**DELIVERY Record Attributes (SK="DELIVERY#{reportId}#{timestamp}"):**
```typescript
{
  // Links
  vendorId: string;               // Parent vendor
  reportId: string;               // FK to reports
  reportDate: string;             // ISO date
  projectId: string;
  projectName: string;

  // Delivery Details
  materialsDelivered: string;     // Description from transcript
  deliveryTime: string;           // Time mentioned in report
  expectedDeliveryTime: string;   // If scheduled
  isLateDelivery: boolean;        // true if late

  // Personnel
  deliveryDriverName: string;     // If mentioned
  receivedBy: string;             // Personnel who received (personId)
  receivedByName: string;         // Denormalized

  // Issues
  hasIssues: boolean;             // Damaged, wrong items, short delivery
  issueDescription: string;       // From transcript
  issueCategory: string;          // damaged | wrong_items | short_delivery | late | other
  issueResolved: boolean;

  // Rating
  deliveryRating: number;         // 1-5 stars (can be AI-inferred from sentiment)

  // Extraction Metadata
  extractedFromText: string;      // Raw transcript excerpt
  aiConfidence: number;

  // Audit
  createdAt: string;
}
```

**Access Patterns Supported:**
1. **Direct Lookup:** `GetItem(PK="VENDOR#{vendorId}", SK="PROFILE")`
2. **Fuzzy Company Search:** Query GSI1 `company_name = "ABC Supply"`
3. **Vendor Type Filtering:** Query GSI2 `vendor_type = "subcontractor" AND dateLastSeen > "2025-01-01"`
4. **Delivery History:** Query `PK="VENDOR#{vendorId}" AND SK BEGINS_WITH "DELIVERY#"`
5. **Performance Analysis:** Scan table filtering by onTimeDeliveryRate < 80

**Why These GSIs:**
- **GSI1 (CompanyIndex):** Prevent duplicate vendor creation through name matching
- **GSI2 (TypeIndex):** Filter vendors by type (subcontractors vs suppliers), find inactive vendors

**Migration Required:**
- Add vendor_type and dateLastSeen attributes to existing records
- Create GSI2-TypeIndex

---

### Table 4: sitelogix-constraints (ISSUES & DELAYS)

**Purpose:** Track all project constraints, delays, safety issues, and resolution status.

**Current Status:** DEPLOYED (needs GSI enhancement)

**Current Schema Issues:**
- GSI2 exists but missing optimal sort key for filtering
- Need GSI3 for project-date queries

**Primary Key Structure:**
```json
PK: "PROJECT#{projectId}"
SK: "CONSTRAINT#{constraintId}"
```

**Complete Schema:**
```json
{
  "TableName": "sitelogix-constraints",
  "KeySchema": [
    {"AttributeName": "PK", "KeyType": "HASH"},
    {"AttributeName": "SK", "KeyType": "RANGE"}
  ],
  "AttributeDefinitions": [
    {"AttributeName": "PK", "AttributeType": "S"},
    {"AttributeName": "SK", "AttributeType": "S"},
    {"AttributeName": "category", "AttributeType": "S"},
    {"AttributeName": "dateIdentified", "AttributeType": "S"},
    {"AttributeName": "status", "AttributeType": "S"},
    {"AttributeName": "severity", "AttributeType": "S"},
    {"AttributeName": "project_id", "AttributeType": "S"},
    {"AttributeName": "report_date", "AttributeType": "S"}
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GSI1-CategoryIndex",
      "KeySchema": [
        {"AttributeName": "category", "KeyType": "HASH"},
        {"AttributeName": "dateIdentified", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    },
    {
      "IndexName": "GSI2-StatusIndex",
      "KeySchema": [
        {"AttributeName": "status", "KeyType": "HASH"},
        {"AttributeName": "severity", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    },
    {
      "IndexName": "GSI3-ProjectDateIndex",
      "KeySchema": [
        {"AttributeName": "project_id", "KeyType": "HASH"},
        {"AttributeName": "report_date", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    }
  ],
  "StreamSpecification": {
    "StreamEnabled": true,
    "StreamViewType": "NEW_AND_OLD_IMAGES"
  },
  "PointInTimeRecoverySpecification": {
    "PointInTimeRecoveryEnabled": true
  },
  "BillingMode": "PROVISIONED",
  "ProvisionedThroughput": {
    "ReadCapacityUnits": 5,
    "WriteCapacityUnits": 5
  },
  "SSESpecification": {
    "Enabled": true,
    "SSEType": "KMS"
  },
  "Tags": [
    {"Key": "Project", "Value": "SiteLogix"},
    {"Key": "Environment", "Value": "Production"}
  ]
}
```

**Attributes:**
```typescript
{
  // Identity
  constraintId: string;           // UUID
  projectId: string;              // FK
  projectName: string;            // Denormalized
  project_id: string;             // For GSI3 (duplicate of projectId)

  // Source
  reportId: string;               // Report where first identified
  reportDate: string;             // Date identified
  report_date: string;            // For GSI3 (duplicate of reportDate)

  // Classification
  category: string;               // Material | Labor | Safety | Coordination | Weather | Equipment | Other
  subcategory: string;            // More specific classification
  severity: string;               // Low | Medium | High | Critical

  // Location
  buildingLevel: string;          // "Level 1", "Level 2", "Roof", "General"
  specificArea: string;           // More granular location

  // Description
  title: string;                  // Short summary (AI-generated)
  description: string;            // Full description from transcript
  extractedFromText: string;      // Raw transcript excerpt

  // Status Workflow
  status: string;                 // open | acknowledged | in_progress | resolved | recurring | cancelled
  dateIdentified: string;         // ISO date
  dateAcknowledged: string;       // When PM acknowledged
  dateResolved: string;           // When marked resolved
  daysOpen: number;               // Calculated field

  // Assignment
  assignedTo: string;             // PersonId or external user
  assignedToName: string;         // Denormalized
  assignedBy: string;             // Who assigned
  assignedAt: string;

  // Resolution
  resolutionNotes: string;        // How it was resolved
  resolutionMethod: string;       // workaround | fixed | cancelled | duplicate
  resolvedBy: string;             // PersonId

  // Related Entities
  relatedVendorId: string;        // If vendor-related issue
  relatedVendorName: string;      // Denormalized
  relatedPersonnelIds: string[];  // If personnel-related
  relatedEquipmentIds: string[];  // If equipment-related

  // Impact
  estimatedCostImpact: number;    // Dollars
  estimatedScheduleImpact: number; // Days
  safetyIncident: boolean;        // true if safety-related

  // AI Metadata
  aiConfidence: number;           // 0-100
  aiCategorization: string;       // How AI classified it
  needsHumanReview: boolean;      // Low confidence flag

  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
  version: number;
}
```

**Access Patterns Supported:**
1. **Project Constraints:** Query `PK="PROJECT#{projectId}" AND SK BEGINS_WITH "CONSTRAINT#"`
2. **Category Analysis:** Query GSI1 `category = "Material" AND dateIdentified BETWEEN X AND Y`
3. **Priority Queue:** Query GSI2 `status = "open" AND severity = "Critical"`
4. **Timeline View:** Query GSI3 `project_id = X AND report_date BETWEEN Y AND Z`
5. **Cross-Project Analysis:** Scan with filter on category and severity

**Why These GSIs:**
- **GSI1 (Category+Date):** Trend analysis across all projects by constraint type
- **GSI2 (Status+Severity):** Priority queue for PM dashboard (open critical issues first)
- **GSI3 (Project+Date):** Timeline view of constraints for a specific project

---

### Table 5: sitelogix-work-logs (DETAILED ACTIVITY TRACKING)

**Purpose:** Granular breakdown of work performed by team/location with time tracking.

**Current Status:** MISSING - NEEDS CREATION

**Primary Key Structure:**
```json
PK: "REPORT#{reportId}"
SK: "WORKLOG#{teamId}#{level}"
```

**Complete Schema:**
```json
{
  "TableName": "sitelogix-work-logs",
  "KeySchema": [
    {"AttributeName": "PK", "KeyType": "HASH"},
    {"AttributeName": "SK", "KeyType": "RANGE"}
  ],
  "AttributeDefinitions": [
    {"AttributeName": "PK", "AttributeType": "S"},
    {"AttributeName": "SK", "AttributeType": "S"},
    {"AttributeName": "project_id", "AttributeType": "S"},
    {"AttributeName": "report_date", "AttributeType": "S"},
    {"AttributeName": "team_id", "AttributeType": "S"}
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GSI1-ProjectDateIndex",
      "KeySchema": [
        {"AttributeName": "project_id", "KeyType": "HASH"},
        {"AttributeName": "report_date", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    },
    {
      "IndexName": "GSI2-TeamIndex",
      "KeySchema": [
        {"AttributeName": "team_id", "KeyType": "HASH"},
        {"AttributeName": "report_date", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    }
  ],
  "StreamSpecification": {
    "StreamEnabled": true,
    "StreamViewType": "NEW_AND_OLD_IMAGES"
  },
  "PointInTimeRecoverySpecification": {
    "PointInTimeRecoveryEnabled": true
  },
  "BillingMode": "PROVISIONED",
  "ProvisionedThroughput": {
    "ReadCapacityUnits": 5,
    "WriteCapacityUnits": 5
  },
  "SSESpecification": {
    "Enabled": true,
    "SSEType": "KMS"
  },
  "Tags": [
    {"Key": "Project", "Value": "SiteLogix"},
    {"Key": "Environment", "Value": "Production"}
  ]
}
```

**Attributes:**
```typescript
{
  // Links
  reportId: string;               // Parent report
  reportDate: string;             // ISO date
  report_date: string;            // For GSI1 (duplicate)
  projectId: string;
  projectName: string;
  project_id: string;             // For GSI1 (duplicate)

  // Team
  teamId: string;                 // "team_1", "team_2", "pm", "superintendent"
  teamName: string;               // "Team 1", "Project Manager"
  team_id: string;                // For GSI2 (duplicate)

  // Location
  buildingLevel: string;          // "Level 1", "Level 2", "Roof", "Site Work"
  specificArea: string;           // More granular (e.g., "North Wing", "Units 101-105")

  // Personnel
  personnelAssigned: string[];    // Array of personIds
  personnelNames: string[];       // Denormalized names
  personnelCount: number;         // Count for quick reference
  leadPerson: string;             // PersonId of foreman/lead
  leadPersonName: string;         // Denormalized

  // Work Description
  taskCategory: string;           // Framing | Electrical | Plumbing | Drywall | etc.
  taskDescription: string;        // AI-extracted description
  quantityCompleted: number;      // Units completed (e.g., 240 linear feet)
  quantityUnit: string;           // "linear feet", "square feet", "units", "each"

  // Time Tracking
  hoursWorked: number;            // Total team hours (not individual)
  regularHours: number;           // Regular time
  overtimeHours: number;          // Overtime
  startTime: string;              // If mentioned
  endTime: string;                // If mentioned

  // Resources
  materialsUsed: Array<{          // Materials consumed
    materialName: string;
    quantity: number;
    unit: string;
    vendorId?: string;            // If from specific delivery
  }>;
  equipmentUsed: Array<{          // Equipment utilized
    equipmentId: string;
    equipmentName: string;
    hoursUsed: number;
  }>;

  // Progress
  progressPercentage: number;     // Estimated % complete for this task
  milestoneCompleted: string;     // If milestone achieved

  // Issues
  delaysEncountered: boolean;     // true if delays mentioned
  delayReasons: string[];         // Categories of delays
  constraintIds: string[];        // Links to constraints table

  // Extraction Metadata
  extractedFromText: string;      // Raw transcript excerpt
  aiConfidence: number;
  needsReview: boolean;

  // Audit
  createdAt: string;
  createdBy: string;
}
```

**Access Patterns Supported:**
1. **Report Work Logs:** Query `PK="REPORT#{reportId}"`
2. **Project Timeline:** Query GSI1 `project_id = X AND report_date BETWEEN Y AND Z`
3. **Team Performance:** Query GSI2 `team_id = "team_1" AND report_date BETWEEN Y AND Z`
4. **Productivity Analysis:** Aggregate hoursWorked and quantityCompleted across date ranges
5. **Resource Utilization:** Filter by materialsUsed or equipmentUsed

**Why These GSIs:**
- **GSI1 (Project+Date):** Track project progress over time, generate progress reports
- **GSI2 (Team+Date):** Team performance metrics, utilization rates, productivity trends

---

### Table 6: sitelogix-ai-analysis-cache (AI PROCESSING METADATA)

**Purpose:** Store AI-generated summaries, extractions, and model performance data.

**Current Status:** MISSING - NEEDS CREATION

**Primary Key Structure:**
```json
PK: "REPORT#{reportId}" or "CACHE#{cacheKey}"
SK: "AI#{analysisType}#{modelVersion}"
```

**Complete Schema:**
```json
{
  "TableName": "sitelogix-ai-analysis-cache",
  "KeySchema": [
    {"AttributeName": "PK", "KeyType": "HASH"},
    {"AttributeName": "SK", "KeyType": "RANGE"}
  ],
  "AttributeDefinitions": [
    {"AttributeName": "PK", "AttributeType": "S"},
    {"AttributeName": "SK", "AttributeType": "S"},
    {"AttributeName": "analysisType", "AttributeType": "S"},
    {"AttributeName": "createdAt", "AttributeType": "S"},
    {"AttributeName": "modelUsed", "AttributeType": "S"}
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GSI1-TypeIndex",
      "KeySchema": [
        {"AttributeName": "analysisType", "KeyType": "HASH"},
        {"AttributeName": "createdAt", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    },
    {
      "IndexName": "GSI2-ModelIndex",
      "KeySchema": [
        {"AttributeName": "modelUsed", "KeyType": "HASH"},
        {"AttributeName": "createdAt", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    }
  ],
  "StreamSpecification": {
    "StreamEnabled": true,
    "StreamViewType": "NEW_AND_OLD_IMAGES"
  },
  "PointInTimeRecoverySpecification": {
    "PointInTimeRecoveryEnabled": true
  },
  "TimeToLiveSpecification": {
    "Enabled": true,
    "AttributeName": "ttl"
  },
  "BillingMode": "PROVISIONED",
  "ProvisionedThroughput": {
    "ReadCapacityUnits": 10,
    "WriteCapacityUnits": 10
  },
  "SSESpecification": {
    "Enabled": true,
    "SSEType": "KMS"
  },
  "Tags": [
    {"Key": "Project", "Value": "SiteLogix"},
    {"Key": "Environment", "Value": "Production"},
    {"Key": "CacheEnabled", "Value": "true"}
  ]
}
```

**Attributes:**
```typescript
{
  // Identity
  reportId: string;               // Parent report (if report-specific)
  cacheKey: string;               // Hash of input for deduplication
  analysisType: string;           // summary | personnel_extraction | vendor_extraction | constraints | work_logs | sentiment

  // AI Model
  modelUsed: string;              // "claude-3-opus-20240229"
  modelVersion: string;           // "v1.2.3"
  modelProvider: string;          // "anthropic" | "openai" | "bedrock"

  // Prompt
  promptTemplate: string;         // Template name/version
  promptContent: string;          // Actual prompt sent (for debugging)
  promptTokens: number;           // Input token count

  // Response
  rawResponse: string;            // Full AI response text
  structuredData: object;         // Parsed JSON if structured extraction
  completionTokens: number;       // Output token count
  totalTokens: number;            // Total

  // Quality Metrics
  confidence: number;             // AI-reported confidence (0-100)
  validationPassed: boolean;      // Schema validation result
  needsHumanReview: boolean;      // Flagged for review
  humanReviewed: boolean;         // Has been reviewed
  humanCorrected: boolean;        // Was corrected by human

  // Performance
  processingTime: number;         // Milliseconds
  retryCount: number;             // If retried
  errorMessage: string;           // If failed

  // Cost
  estimatedCost: number;          // USD

  // Lifecycle
  createdAt: string;              // ISO timestamp
  needsReanalysis: boolean;       // Mark for reprocessing
  reanalysisReason: string;       // Why reanalysis needed
  ttl: number;                    // Unix timestamp (for cache expiry)

  // Versioning
  supersededBy: string;           // If newer version exists
  version: number;
}
```

**Access Patterns Supported:**
1. **Get Cached Analysis:** `GetItem(PK="REPORT#{reportId}", SK="AI#{analysisType}#{modelVersion}")`
2. **Model Performance:** Query GSI2 `modelUsed = "claude-3-opus" AND createdAt BETWEEN X AND Y`
3. **Analysis Type Metrics:** Query GSI1 `analysisType = "personnel_extraction" AND createdAt BETWEEN X AND Y`
4. **Reanalysis Queue:** Scan filter `needsReanalysis = true`
5. **Cost Analysis:** Aggregate estimatedCost by modelUsed and analysisType

**Why These GSIs:**
- **GSI1 (Type+Date):** Track performance by analysis type, identify bottlenecks
- **GSI2 (Model+Date):** Compare model performance, cost analysis, A/B testing

**Special Features:**
- **TTL Enabled:** Automatically expire cache entries after 90 days (configurable)
- **Higher Throughput:** This table will have highest write volume (multiple AI calls per report)

---

## III. Cross-Cutting Concerns

### 3.1 DynamoDB Streams Configuration

**ALL tables must enable streams for:**
1. **Audit Trail:** Stream all changes to append-only audit log (S3 or separate audit table)
2. **Data Lifecycle:** Trigger archival to S3 when records age beyond 90 days
3. **Denormalization:** Update aggregate metrics across related tables
4. **Real-time Notifications:** Trigger webhooks for critical events

**Stream Configuration:**
```json
{
  "StreamSpecification": {
    "StreamEnabled": true,
    "StreamViewType": "NEW_AND_OLD_IMAGES"
  }
}
```

**Lambda Consumers:**
1. **Audit Logger:** Write all changes to `s3://sitelogix-audit-trail/{YYYY}/{MM}/{DD}/{table}/{recordId}.json`
2. **Archival Processor:** Move aged records to S3 Parquet files for Athena
3. **Metrics Aggregator:** Update aggregate counts (e.g., totalReportsCount on Personnel)
4. **Notification Service:** Send alerts for critical constraints, safety incidents

### 3.2 Point-in-Time Recovery (PITR)

**Requirement:** Enable on ALL tables for compliance and data protection.

**Configuration:**
```json
{
  "PointInTimeRecoverySpecification": {
    "PointInTimeRecoveryEnabled": true
  }
}
```

**Recovery Window:** 35 days (DynamoDB maximum)

**Use Cases:**
- Accidental data deletion or corruption
- Rollback after failed deployment
- Forensic analysis of data changes
- Compliance requirement (OSHA 7-year retention starts with PITR)

### 3.3 Encryption Strategy

**At Rest:**
- **Default:** AWS KMS encryption (SSEType: "KMS")
- **Key Management:** Customer-managed KMS key for production
- **Rotation:** Annual key rotation policy

**At Transit:**
- All API calls use HTTPS/TLS 1.2+
- VPC endpoints for internal traffic

**Field-Level Encryption (PII):**
- Personnel: primaryPhone, primaryEmail, emergencyContact
- Use AWS Encryption SDK or client-side encryption
- Store encrypted ciphertext in DynamoDB
- Decrypt only when needed by authorized users

### 3.4 Backup Strategy

**Automated Backups:**
- **PITR:** Enabled on all tables (35-day window)
- **On-Demand Snapshots:** Weekly full table snapshots
- **Retention:** 90 days for snapshots

**Long-Term Archival:**
- DynamoDB Streams → S3 (Parquet format)
- S3 Lifecycle: Standard (90 days) → Glacier Flexible Retrieval (7 years)
- Athena-queryable for historical analysis

**Backup Schedule:**
```
Daily: PITR (automatic)
Weekly: Full snapshot to S3
Monthly: Compliance verification job
Annually: Glacier Deep Archive migration for records > 1 year old
```

### 3.5 Data Lifecycle Management

**Hot Tier (DynamoDB):**
- Last 90 days of operational data
- Active projects
- Open constraints
- Current personnel roster

**Warm Tier (S3 Standard):**
- 90 days - 1 year
- Completed projects
- Resolved constraints
- Parquet format for Athena queries

**Cold Tier (S3 Glacier):**
- 1 year - 7 years
- Compliance retention
- Legal hold capable
- 12-hour retrieval time acceptable

**Archival Pipeline:**
```
DynamoDB Stream → Lambda (Filter aged records)
  → Convert to Parquet
  → Write to S3
  → Delete from DynamoDB (after verification)
  → Update audit log
```

---

## IV. Schema Mismatch Resolution Plan

### 4.1 sitelogix-personnel GSI2 Update

**Current State:**
```json
GSI2-ProjectIndex: project_id (HASH)
```

**Required State:**
```json
GSI2-StatusIndex: status (HASH) + dateLastSeen (RANGE)
```

**Migration Plan:**
1. Create new GSI2-StatusIndex (cannot modify existing GSI keys)
2. Backfill `status` and `dateLastSeen` attributes on all existing records
3. Once new GSI active, update application code to use GSI2-StatusIndex
4. Delete old GSI2-ProjectIndex (if project queries not critical)

**Alternative:** Keep both GSIs if project-based personnel queries are needed.

**Impact:** ~15 minutes downtime for GSI creation, no data loss.

### 4.2 sitelogix-vendors GSI2 Addition

**Current State:**
```json
Only GSI1-CompanyIndex exists
```

**Required State:**
```json
GSI2-TypeIndex: vendor_type (HASH) + dateLastSeen (RANGE)
```

**Migration Plan:**
1. Backfill `vendor_type` and `dateLastSeen` on all existing records
2. Create GSI2-TypeIndex
3. Update application code to use new index

**Impact:** ~10 minutes for GSI creation, no downtime.

### 4.3 sitelogix-reports GSI3 Addition

**Current State:**
```json
GSI1-ProjectIndex and GSI2-ManagerIndex exist
```

**Required State:**
```json
GSI3-StatusIndex: status (HASH) + timestamp (RANGE)
```

**Migration Plan:**
1. Backfill `status` and `timestamp` (should already exist)
2. Create GSI3-StatusIndex
3. Use for workflow queue queries

**Impact:** ~10 minutes for GSI creation.

### 4.4 sitelogix-constraints GSI3 Addition

**Migration Plan:**
1. Backfill `project_id` and `report_date` (denormalize from projectId/reportDate)
2. Create GSI3-ProjectDateIndex
3. Enable project-specific timeline queries

**Impact:** ~10 minutes.

---

## V. Missing Tables Creation Plan

### 5.1 sitelogix-work-logs Table

**Priority:** HIGH (critical for detailed activity tracking)

**Creation Steps:**
1. Deploy table schema (see section II.5)
2. Enable streams and PITR
3. Create GSI1 and GSI2
4. Deploy Lambda processor for AI extraction to work logs
5. Backfill from existing report rawTranscriptText (optional)

**Estimated Time:** 1 hour to deploy, 1 week to implement AI extraction logic.

### 5.2 sitelogix-ai-analysis-cache Table

**Priority:** MEDIUM (performance optimization)

**Creation Steps:**
1. Deploy table schema (see section II.6)
2. Enable streams, PITR, and TTL
3. Create GSI1 and GSI2
4. Update AI processing Lambda to write to cache
5. Update report processing to check cache first

**Estimated Time:** 1 hour to deploy, 3 days to implement caching logic.

---

## VI. Access Pattern → Index Mapping

### RFC-008 Required Access Patterns:

| Access Pattern | Table | Index Used | Query Type |
|---------------|-------|------------|-----------|
| 1. Direct report lookup by ID | Reports | PK/SK | GetItem |
| 2. Project timeline queries | Reports | GSI1-ProjectIndex | Query |
| 3. Manager performance queries | Reports | GSI2-ManagerIndex | Query |
| 4. Issue tracking (open, severity) | Constraints | GSI2-StatusIndex | Query |
| 5. Personnel history | Personnel | PK/SK (HISTORY#) | Query |
| 6. Vendor performance | Vendors | PK/SK (DELIVERY#) | Query |
| 7. Equipment utilization | Work Logs | GSI1-ProjectDateIndex | Query + Filter |

### Additional Access Patterns Supported:

| Access Pattern | Table | Index Used | Query Type |
|---------------|-------|------------|-----------|
| Fuzzy name matching (deduplication) | Personnel | GSI1-NameIndex | Query |
| Inactive personnel detection | Personnel | GSI2-StatusIndex | Query |
| Vendor type filtering | Vendors | GSI2-TypeIndex | Query |
| Constraint category analysis | Constraints | GSI1-CategoryIndex | Query |
| Team performance tracking | Work Logs | GSI2-TeamIndex | Query |
| AI model performance analysis | AI Cache | GSI2-ModelIndex | Query |
| Workflow queue processing | Reports | GSI3-StatusIndex | Query |

---

## VII. Implementation Roadmap

### Phase 1: Fix Existing Tables (Week 1)
- [ ] Update sitelogix-personnel GSI2 (status + dateLastSeen)
- [ ] Add sitelogix-vendors GSI2 (vendor_type + dateLastSeen)
- [ ] Add sitelogix-reports GSI3 (status + timestamp)
- [ ] Add sitelogix-constraints GSI3 (project_id + report_date)
- [ ] Enable DynamoDB Streams on all tables
- [ ] Enable PITR on all tables
- [ ] Backfill missing attributes

### Phase 2: Create Missing Tables (Week 2)
- [ ] Deploy sitelogix-work-logs table
- [ ] Deploy sitelogix-ai-analysis-cache table
- [ ] Test table access patterns
- [ ] Verify GSI query performance

### Phase 3: Stream Processing (Week 3)
- [ ] Deploy audit trail Lambda (streams → S3)
- [ ] Deploy metrics aggregation Lambda
- [ ] Deploy archival Lambda (aged data → S3)
- [ ] Configure CloudWatch alarms

### Phase 4: Application Integration (Week 4)
- [ ] Update report processing to use new work-logs table
- [ ] Implement AI cache read/write logic
- [ ] Update personnel deduplication to use GSI1
- [ ] Update vendor deduplication to use GSI1
- [ ] Implement constraint priority queue (GSI2)

### Phase 5: Data Migration (Week 5)
- [ ] Backfill work logs from existing reports (optional)
- [ ] Migrate historical data to S3 (aged > 90 days)
- [ ] Verify Athena queries on archived data
- [ ] Archive old AI analysis cache entries

---

## VIII. Cost Estimation

### Current Monthly Costs (4 Tables):
- **Provisioned Capacity:** ~$50/month (based on current throughput)
- **Storage:** ~$0.25/GB/month (minimal for 90-day retention)
- **PITR:** +25% (~$12.50/month)
- **Streams:** ~$0.02 per 100K reads (~$10/month)
- **Total Current:** ~$72.50/month

### Projected Monthly Costs (6 Tables + Enhancements):
- **Provisioned Capacity:** ~$80/month (2 additional tables)
- **Storage:** ~$0.30/GB/month (more data)
- **PITR:** +25% (~$20/month)
- **Streams:** ~$20/month (all tables)
- **GSI Costs:** ~$30/month (additional indexes)
- **Total Projected:** ~$150/month

### Cost Optimization Strategies:
1. **On-Demand Billing:** Consider for low-traffic tables (personnel, vendors)
2. **Sparse GSIs:** Only populate GSI3 for recent reports (status-based filtering)
3. **TTL on AI Cache:** Auto-expire old cache entries
4. **Archival to S3:** Move aged data to save DynamoDB storage costs
5. **Reserved Capacity:** Pre-purchase for production tables (save 30-50%)

**Expected Savings:** 25-40% after optimizations (~$110/month steady state)

---

## IX. Security & Compliance Checklist

### Data Protection:
- [x] Encryption at rest (KMS)
- [x] Encryption in transit (TLS 1.2+)
- [ ] Field-level encryption for PII (implement in application layer)
- [x] PITR enabled (35-day recovery)
- [x] Automated backups (weekly snapshots)

### Access Control:
- [ ] IAM policies: Least privilege per role
- [ ] VPC endpoints for private access
- [ ] CloudTrail logging enabled
- [ ] Resource-based policies (prevent accidental deletion)

### Audit Trail:
- [x] DynamoDB Streams enabled
- [ ] Stream consumer: Audit logger to S3
- [ ] S3 access logging enabled
- [ ] Immutable audit log (S3 Object Lock)

### Compliance:
- [x] 7-year retention design (S3 Glacier)
- [ ] Legal hold capability (S3 Object Lock)
- [ ] Tamper-proof checksums (SHA-256)
- [x] Deletion protection on tables
- [ ] OSHA recordkeeping compliance mapping

---

## X. Monitoring & Alerting

### Key Metrics to Monitor:

**Performance:**
- DynamoDB throttled requests (target: 0)
- Read/write capacity utilization (target: < 80%)
- Query latency (target: < 100ms for hot data)
- GSI replication lag (target: < 1 second)

**Costs:**
- Daily spend per table
- Anomaly detection (sudden spike in writes)
- Provisioned vs consumed capacity

**Data Quality:**
- AI confidence scores (average, min)
- Failed extractions count
- Deduplication match rate

**Compliance:**
- Audit log completeness (stream processing lag)
- Backup success rate
- PITR verification tests

### CloudWatch Alarms:

```json
{
  "AlarmName": "DynamoDB-Reports-Throttling",
  "MetricName": "ThrottledRequests",
  "Threshold": 10,
  "EvaluationPeriods": 2,
  "ComparisonOperator": "GreaterThanThreshold"
}
```

### Dashboard Widgets:
1. **Operational Health:** Throttles, latency, errors
2. **Cost Overview:** Daily spend, capacity utilization
3. **Data Pipeline:** Stream lag, Lambda errors, archival status
4. **Data Quality:** AI confidence trends, deduplication rates

---

## XI. Open Questions & Decisions Needed

### 1. Single-Table Consideration?
**Question:** Should we migrate to single-table design for scale?
**Recommendation:** Not yet. Multi-table is adequate for 1000s of reports/day. Revisit if query patterns become unmanageable or cross-table joins are frequent.

### 2. On-Demand vs Provisioned Billing?
**Question:** Which tables should use on-demand billing?
**Recommendation:**
- **Provisioned:** Reports, Work Logs, AI Cache (high, predictable traffic)
- **On-Demand:** Personnel, Vendors, Constraints (low, spiky traffic)

### 3. Global Tables for Multi-Region?
**Question:** Do we need multi-region replication?
**Recommendation:** Not initially. Add global tables if:
- Multi-region user base emerges
- DR requirements demand < 1 hour RTO
- Cost justifies 2x storage and throughput

### 4. TTL on Work Logs?
**Question:** Should work logs auto-expire after archival to S3?
**Recommendation:** Yes, set TTL = 90 days. Rely on S3 for long-term queries via Athena.

### 5. Deduplication Threshold?
**Question:** What fuzzy match score triggers admin review?
**Recommendation:**
- **Auto-match:** 95-100 (Levenshtein distance < 2)
- **Admin review:** 80-94
- **Create new:** < 80

---

## XII. Testing Strategy

### Unit Tests:
- PK/SK construction logic
- GSI key generation
- TTL calculation
- Attribute validation

### Integration Tests:
- Query all 7 core access patterns
- Stream processing (mock events)
- Cross-table consistency
- Deduplication logic

### Performance Tests:
- Bulk write: 1000 reports in 1 minute
- Query latency: GSI queries under load
- Concurrent updates: Optimistic locking
- Throttling behavior: Exceed provisioned capacity

### Data Migration Tests:
- GSI backfill accuracy
- Zero data loss verification
- Rollback procedures
- Archival and restore

---

## XIII. Summary & Next Steps

### Design Decisions Made:
1. **Multi-table design** (6 tables) for clarity and maintainability
2. **Composite key patterns** (PK/SK) enabling versioning and history
3. **Strategic GSI placement** for 7 core access patterns + additional queries
4. **DynamoDB Streams on all tables** for audit trail and data lifecycle
5. **PITR enabled** for compliance and data protection
6. **TTL on AI cache** for cost optimization
7. **90-day hot tier** in DynamoDB, warm/cold in S3

### Schema Mismatches Identified:
1. Personnel GSI2: Need status + dateLastSeen (not project_id)
2. Vendors: Missing GSI2-TypeIndex
3. Reports: Need GSI3-StatusIndex for workflow queries
4. Constraints: Need GSI3-ProjectDateIndex for timeline queries

### Missing Tables:
1. sitelogix-work-logs (HIGH PRIORITY)
2. sitelogix-ai-analysis-cache (MEDIUM PRIORITY)

### Immediate Next Steps:
1. **Review and approve this design** with dev team and stakeholders
2. **Create migration scripts** for GSI updates (section IV)
3. **Deploy missing tables** (section V)
4. **Implement stream processors** for audit trail
5. **Update application code** to use new indexes and tables
6. **Test all access patterns** under load
7. **Deploy to production** with careful monitoring

### Success Criteria:
- All 7 core access patterns supported with < 100ms latency
- Zero data loss during migration
- Audit trail complete for all changes
- Compliance requirements met (7-year retention, immutability)
- Cost within projected budget ($150/month)
- Team understands and can maintain schema

---

## XIV. Appendix

### A. Key Pattern Examples

**Reports Table:**
```
PK: "REPORT#rpt_20251104_mgr_001_1730750400"
SK: "METADATA"
```

**Personnel Table:**
```
PK: "PERSON#550e8400-e29b-41d4-a716-446655440000"
SK: "PROFILE"
SK: "HISTORY#rpt_20251104_mgr_001_1730750400#2025-11-04T14:30:00Z"
```

**Vendors Table:**
```
PK: "VENDOR#650e8400-e29b-41d4-a716-446655440000"
SK: "PROFILE"
SK: "DELIVERY#rpt_20251104_mgr_001_1730750400#2025-11-04T10:15:00Z"
```

**Constraints Table:**
```
PK: "PROJECT#proj_001"
SK: "CONSTRAINT#750e8400-e29b-41d4-a716-446655440000"
```

**Work Logs Table:**
```
PK: "REPORT#rpt_20251104_mgr_001_1730750400"
SK: "WORKLOG#team_1#level_2"
```

**AI Cache Table:**
```
PK: "REPORT#rpt_20251104_mgr_001_1730750400"
SK: "AI#personnel_extraction#v1.2.3"
```

### B. GSI Query Examples

**Query 1: Get all reports for a project in date range**
```python
response = dynamodb.query(
    TableName='sitelogix-reports',
    IndexName='GSI1-ProjectIndex',
    KeyConditionExpression='project_id = :pid AND report_date BETWEEN :start AND :end',
    ExpressionAttributeValues={
        ':pid': 'proj_001',
        ':start': '2025-10-01',
        ':end': '2025-11-01'
    }
)
```

**Query 2: Find inactive personnel**
```python
response = dynamodb.query(
    TableName='sitelogix-personnel',
    IndexName='GSI2-StatusIndex',
    KeyConditionExpression='status = :status AND dateLastSeen < :cutoff',
    ExpressionAttributeValues={
        ':status': 'active',
        ':cutoff': '2025-10-01'
    }
)
```

**Query 3: Get open critical constraints**
```python
response = dynamodb.query(
    TableName='sitelogix-constraints',
    IndexName='GSI2-StatusIndex',
    KeyConditionExpression='status = :status AND severity = :severity',
    ExpressionAttributeValues={
        ':status': 'open',
        ':severity': 'Critical'
    }
)
```

### C. Deduplication Algorithm Pseudocode

```python
def find_or_create_person(name: str) -> str:
    # Step 1: Normalize name
    normalized = normalize_name(name)

    # Step 2: Query GSI1-NameIndex for exact match
    exact_matches = dynamodb.query(
        IndexName='GSI1-NameIndex',
        KeyConditionExpression='full_name = :name',
        ExpressionAttributeValues={':name': normalized}
    )

    if exact_matches:
        return exact_matches[0]['personId']

    # Step 3: Fuzzy match against all active personnel
    all_personnel = dynamodb.scan(
        TableName='sitelogix-personnel',
        FilterExpression='SK = :sk AND status = :status',
        ExpressionAttributeValues={
            ':sk': 'PROFILE',
            ':status': 'active'
        }
    )

    for person in all_personnel['Items']:
        score = calculate_fuzzy_score(name, person['fullName'], person['nicknames'])

        if score >= 95:
            # Auto-match
            return person['personId']
        elif score >= 80:
            # Flag for admin review
            create_pending_match_record(name, person['personId'], score)
            return 'PENDING_REVIEW'

    # Step 4: No match found - create new person
    person_id = generate_uuid()
    create_person_record(person_id, name)
    return person_id

def calculate_fuzzy_score(input_name, canonical_name, nicknames):
    # Levenshtein distance + phonetic matching
    levenshtein_score = 100 - (levenshtein_distance(input_name, canonical_name) * 10)

    # Check nicknames
    for nickname in nicknames:
        if input_name.lower() == nickname.lower():
            return 100

    # Phonetic match (Soundex/Metaphone)
    phonetic_score = 100 if soundex(input_name) == soundex(canonical_name) else 0

    return max(levenshtein_score, phonetic_score)
```

### D. DynamoDB Streams Processing Example

```python
def process_stream_record(record):
    event_name = record['eventName']  # INSERT, MODIFY, REMOVE
    new_image = record['dynamodb'].get('NewImage', {})
    old_image = record['dynamodb'].get('OldImage', {})

    # Audit Trail
    audit_entry = {
        'timestamp': record['dynamodb']['ApproximateCreationDateTime'],
        'eventName': event_name,
        'tableName': record['eventSourceARN'].split('/')[-3],
        'keys': record['dynamodb']['Keys'],
        'oldImage': old_image,
        'newImage': new_image,
        'userIdentity': record.get('userIdentity', {})
    }

    # Write to S3 audit log
    s3_key = f"audit-trail/{audit_entry['tableName']}/{today}/{record_id}.json"
    s3.put_object(Bucket='sitelogix-audit', Key=s3_key, Body=json.dumps(audit_entry))

    # Archival Logic (if record is old)
    if is_aged_record(new_image, threshold_days=90):
        archive_to_s3(new_image)
        delete_from_dynamodb(record['dynamodb']['Keys'])

    # Metrics Aggregation
    if event_name == 'INSERT' and 'HISTORY' in new_image['SK']['S']:
        update_person_aggregate_metrics(new_image['personId']['S'])
```

---

**Document Status:** Ready for Review & Implementation
**Approval Required:** Lead Developer, DevOps Engineer, CEO
**Next Review Date:** After Phase 1 completion (Week 1)

---

**END OF DOCUMENT**
