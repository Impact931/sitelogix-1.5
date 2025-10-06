# SiteLogix API Specification v1.0

**Base URL:** `https://api.sitelogix.com/v1`
**Authentication:** AWS Cognito JWT Bearer Token
**Region:** us-east-1

---

## Authentication Endpoints

### POST /auth/login
Login with email and password.

**Request:**
```json
{
  "email": "john.smith@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": "user_123",
    "email": "john.smith@example.com",
    "name": "John Smith",
    "role": "site_manager"
  }
}
```

---

## Report Management Endpoints

### POST /reports/upload
Upload audio file to S3.

**Headers:**
- `Authorization`: Bearer {token}
- `Content-Type`: multipart/form-data

**Request:**
```
file: <binary audio data>
projectId: "proj_001"
managerId: "mgr_001"
date: "2025-10-05"
```

**Response:** `201 Created`
```json
{
  "reportId": "rpt_20251005_mgr001_001",
  "audioFileUrl": "s3://sitelogix-audio-files-prod/SiteLogix/projects/proj_001/audio/2025/10/05/rpt_20251005_mgr001_001.webm",
  "uploadedAt": "2025-10-05T14:30:00Z",
  "status": "uploaded",
  "nextStep": "transcription"
}
```

---

### POST /process/transcribe
Trigger transcription of uploaded audio.

**Request:**
```json
{
  "reportId": "rpt_20251005_mgr001_001",
  "audioFileUrl": "s3://sitelogix-audio-files-prod/SiteLogix/projects/proj_001/audio/2025/10/05/rpt_20251005_mgr001_001.webm"
}
```

**Response:** `202 Accepted`
```json
{
  "reportId": "rpt_20251005_mgr001_001",
  "status": "transcribing",
  "estimatedCompletionTime": "2025-10-05T14:32:00Z",
  "transcriptionJobId": "txn_abc123"
}
```

---

### POST /process/parse
Parse transcript with AI to extract structured data.

**Request:**
```json
{
  "reportId": "rpt_20251005_mgr001_001",
  "transcript": "Today is October 5th. I arrived at the site at 7:30 AM and left at 4:00 PM. We had 12 personnel on site including Mike Johnson, Sarah Williams, Tom Davis..."
}
```

**Response:** `200 OK`
```json
{
  "reportId": "rpt_20251005_mgr001_001",
  "parsedData": {
    "site_arrival_time": "07:30",
    "site_departure_time": "16:00",
    "total_personnel_count": 12,
    "personnel_list": [
      {"name": "Mike Johnson", "confidence": 0.98},
      {"name": "Sarah Williams", "confidence": 0.95},
      {"name": "Tom Davis", "confidence": 0.97}
    ],
    "team_assignments": [
      {
        "team": "Foundation Crew",
        "activity": "Concrete pouring",
        "personnel": ["Mike Johnson", "Sarah Williams"]
      }
    ],
    "weather_conditions": "Clear skies, temperature in the 70s",
    "deliveries": [
      {
        "vendor": "ABC Concrete Supply",
        "items": "20 yards of concrete",
        "time": "09:00",
        "confidence": 0.92
      }
    ],
    "constraints": [
      {
        "description": "Delayed concrete delivery by 30 minutes",
        "category": "Material",
        "duration_hours": 0.5,
        "confidence": 0.89
      }
    ],
    "safety_incidents": []
  },
  "confidence_score": 0.94,
  "validation_errors": []
}
```

---

### POST /process/validate
Validate parsed data against personnel/vendor databases.

**Request:**
```json
{
  "reportId": "rpt_20251005_mgr001_001",
  "parsedData": {
    "personnel_list": [
      {"name": "Mike Johnson"},
      {"name": "Sarah Williams"}
    ],
    "deliveries": [
      {"vendor": "ABC Concrete Supply"}
    ]
  }
}
```

**Response:** `200 OK`
```json
{
  "reportId": "rpt_20251005_mgr001_001",
  "validationResults": {
    "personnel": [
      {
        "spokenName": "Mike Johnson",
        "matchedPersonnel": {
          "personnelId": "P001",
          "fullName": "Michael Johnson",
          "role": "Foreman",
          "confidence": 0.95
        }
      },
      {
        "spokenName": "Sarah Williams",
        "matchedPersonnel": null,
        "suggestions": [
          {"personnelId": "P024", "fullName": "Sara Williams", "confidence": 0.85},
          {"personnelId": "P089", "fullName": "Sarah Williamson", "confidence": 0.78}
        ],
        "requiresManualReview": true
      }
    ],
    "vendors": [
      {
        "spokenName": "ABC Concrete Supply",
        "matchedVendor": {
          "vendorId": "V015",
          "companyName": "ABC Concrete Supply Inc.",
          "confidence": 0.98
        }
      }
    ]
  },
  "validationStatus": "needs_review"
}
```

---

### POST /process/submit
Submit validated report to Google Sheets.

**Request:**
```json
{
  "reportId": "rpt_20251005_mgr001_001",
  "projectId": "proj_001",
  "managerId": "mgr_001",
  "reportDate": "2025-10-05",
  "validatedData": {
    "site_arrival_time": "07:30",
    "site_departure_time": "16:00",
    "total_personnel_count": 12,
    "personnel_list": [
      {"personnelId": "P001", "name": "Michael Johnson", "hours": 8.5}
    ],
    "team_assignments": [...],
    "deliveries": [...],
    "constraints": [...],
    "safety_incidents": []
  }
}
```

**Response:** `201 Created`
```json
{
  "reportId": "rpt_20251005_mgr001_001",
  "status": "submitted",
  "googleSheetsUrl": "https://docs.google.com/spreadsheets/d/abc123/edit#gid=0",
  "rowNumber": 47,
  "submittedAt": "2025-10-05T14:35:00Z",
  "notificationsSent": ["general.manager@example.com"]
}
```

---

### GET /reports/:projectId
Get all reports for a project.

**Query Parameters:**
- `startDate`: ISO date (optional)
- `endDate`: ISO date (optional)
- `managerId`: Manager ID filter (optional)
- `limit`: Number of results (default: 50)
- `nextToken`: Pagination token (optional)

**Response:** `200 OK`
```json
{
  "reports": [
    {
      "reportId": "rpt_20251005_mgr001_001",
      "projectId": "proj_001",
      "managerId": "mgr_001",
      "managerName": "John Smith",
      "reportDate": "2025-10-05",
      "status": "submitted",
      "personnelCount": 12,
      "constraintCount": 1,
      "safetyIncidentCount": 0,
      "createdAt": "2025-10-05T14:30:00Z",
      "submittedAt": "2025-10-05T14:35:00Z"
    }
  ],
  "nextToken": "eyJsYXN0RXZhbHVhdGVkS2V5Ijp7IlBLIjoiUkVQT1JU..."
}
```

---

### GET /reports/:reportId
Get specific report details.

**Response:** `200 OK`
```json
{
  "reportId": "rpt_20251005_mgr001_001",
  "projectId": "proj_001",
  "projectName": "Downtown Tower Construction",
  "managerId": "mgr_001",
  "managerName": "John Smith",
  "reportDate": "2025-10-05",
  "status": "submitted",
  "audioFileUrl": "s3://sitelogix-audio-files-prod/...",
  "transcriptUrl": "s3://sitelogix-transcripts-prod/...",
  "data": {
    "site_arrival_time": "07:30",
    "site_departure_time": "16:00",
    "total_personnel_count": 12,
    "personnel_list": [...],
    "team_assignments": [...],
    "deliveries": [...],
    "constraints": [...],
    "safety_incidents": []
  },
  "createdAt": "2025-10-05T14:30:00Z",
  "submittedAt": "2025-10-05T14:35:00Z"
}
```

---

## Personnel Management

### GET /personnel
Get all personnel in the database.

**Query Parameters:**
- `projectId`: Filter by project (optional)
- `active`: true/false (optional)
- `search`: Search by name (optional)

**Response:** `200 OK`
```json
{
  "personnel": [
    {
      "personnelId": "P001",
      "fullName": "Michael Johnson",
      "role": "Foreman",
      "activeStatus": true,
      "projectAssignments": ["proj_001", "proj_003"],
      "contactInfo": {
        "phone": "+1-555-0123",
        "email": "mjohnson@example.com"
      }
    }
  ]
}
```

---

### POST /personnel
Add new personnel to database.

**Request:**
```json
{
  "fullName": "John Doe",
  "role": "Laborer",
  "contactInfo": {
    "phone": "+1-555-0199",
    "email": "jdoe@example.com",
    "emergencyContact": "+1-555-0200"
  },
  "projectAssignments": ["proj_001"]
}
```

**Response:** `201 Created`
```json
{
  "personnelId": "P125",
  "fullName": "John Doe",
  "role": "Laborer",
  "activeStatus": true,
  "createdAt": "2025-10-05T14:40:00Z"
}
```

---

## Vendor Management

### GET /vendors
Get all vendors in the database.

**Response:** `200 OK`
```json
{
  "vendors": [
    {
      "vendorId": "V015",
      "companyName": "ABC Concrete Supply Inc.",
      "primaryContact": {
        "name": "Jane Smith",
        "phone": "+1-555-9999",
        "email": "jsmith@abcconcrete.com"
      },
      "performanceMetrics": {
        "onTimeRate": 0.94,
        "totalDeliveries": 156,
        "averageRating": 4.7
      },
      "commonItems": ["Concrete", "Gravel", "Sand"]
    }
  ]
}
```

---

### POST /vendors
Add new vendor to database.

**Request:**
```json
{
  "companyName": "XYZ Steel Supply",
  "primaryContact": {
    "name": "Bob Johnson",
    "phone": "+1-555-8888",
    "email": "bjohnson@xyzsteel.com"
  },
  "commonItems": ["Steel beams", "Rebar", "Metal sheets"]
}
```

**Response:** `201 Created`
```json
{
  "vendorId": "V042",
  "companyName": "XYZ Steel Supply",
  "createdAt": "2025-10-05T14:45:00Z"
}
```

---

## Projects

### GET /projects
Get all projects.

**Response:** `200 OK`
```json
{
  "projects": [
    {
      "projectId": "proj_001",
      "projectName": "Downtown Tower Construction",
      "location": "123 Main St, City, State",
      "startDate": "2025-01-15",
      "status": "active",
      "assignedManagers": ["mgr_001", "mgr_003"]
    }
  ]
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "ValidationError",
  "message": "Invalid request parameters",
  "details": [
    {
      "field": "personnel_list",
      "issue": "Must be a non-empty array"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired authentication token"
}
```

### 404 Not Found
```json
{
  "error": "NotFound",
  "message": "Report not found",
  "resourceId": "rpt_20251005_mgr001_999"
}
```

### 500 Internal Server Error
```json
{
  "error": "InternalServerError",
  "message": "An unexpected error occurred",
  "requestId": "req_abc123xyz"
}
```

---

## Rate Limiting

- **Rate Limit:** 100 requests per minute per API key
- **Burst Limit:** 20 requests per second
- **Headers:**
  - `X-RateLimit-Limit`: Total requests allowed
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Timestamp when limit resets

---

## Webhooks (Future Enhancement)

### Event Types
- `report.uploaded`
- `report.transcribed`
- `report.parsed`
- `report.submitted`
- `report.error`

---

**Last Updated:** October 5, 2025
**API Version:** v1.0
**Contact:** jayson@impactconsulting931.com
