# SiteLogix Unified S3 Structure

## Overview

All SiteLogix data is now stored in a single S3 bucket: `sitelogix-prod`

This provides better organization, easier management, and clearer data relationships.

## Bucket Structure

```
sitelogix-prod/
└── SITELOGIX/
    ├── projects/
    │   └── {projectId}/
    │       ├── reports/
    │       │   └── {YYYY}/{MM}/{DD}/
    │       │       └── {reportId}/
    │       │           ├── audio.webm           # Voice recording
    │       │           ├── transcript.json      # ElevenLabs full transcript
    │       │           ├── parsed-data.json     # Structured report data
    │       │           ├── analysis-personnel-matches.json
    │       │           ├── analysis-vendor-matches.json
    │       │           └── analysis-constraint-analysis.json
    │       ├── metadata/
    │       │   ├── project-info.json
    │       │   └── personnel-roster.json
    │       └── archive/
    │           └── {YYYY}/
    ├── managers/
    │   └── {managerId}/
    │       ├── reports/
    │       └── profile/
    └── system/
        ├── config/
        └── logs/
```

## Path Examples

### Daily Report Files
```
SITELOGIX/projects/proj_002/reports/2025/10/05/rpt_20251005_mgr_002_1728782962961/
├── audio.webm
├── transcript.json
├── parsed-data.json
├── analysis-personnel-matches.json
├── analysis-vendor-matches.json
└── analysis-constraint-analysis.json
```

### Project Metadata
```
SITELOGIX/projects/proj_002/metadata/
├── project-info.json
├── personnel-roster.json
└── vendor-list.json
```

### Manager Data
```
SITELOGIX/managers/mgr_002/
├── reports/
│   └── summary-2025-10.json
└── profile/
    └── profile.json
```

## Benefits of New Structure

1. **Single Source of Truth**: All data in one bucket
2. **Better Organization**: Reports grouped by date hierarchy
3. **Complete Report Package**: All files for a report in one folder
4. **Easier Querying**: Clear path patterns for data retrieval
5. **Scalability**: Date-based partitioning for performance
6. **Simpler Permissions**: Manage one bucket instead of multiple

## Migration Status

✅ **Completed:**
- Created unified `sitelogix-prod` bucket
- Updated S3 path utilities in backend
- Updated frontend to use new structure
- Migrated existing test report
- Configured CORS for direct uploads

## Configuration

### Environment Variables

**Frontend (.env):**
```
VITE_S3_BUCKET=sitelogix-prod
```

**Backend:**
```
S3_BUCKET=sitelogix-prod
REPORTS_TABLE=sitelogix-reports
```

## DynamoDB Schema

Reports are still stored in `sitelogix-reports` table with references to S3 paths:

```json
{
  "PK": "PROJECT#proj_002",
  "SK": "REPORT#2025-10-05#rpt_20251005_mgr_002_1728782962961",
  "report_id": "rpt_20251005_mgr_002_1728782962961",
  "project_id": "proj_002",
  "manager_id": "mgr_002",
  "transcript_s3_path": "s3://sitelogix-prod/SITELOGIX/projects/proj_002/reports/2025/10/05/rpt_20251005_mgr_002_1728782962961/transcript.json",
  "audio_s3_path": "s3://sitelogix-prod/SITELOGIX/projects/proj_002/reports/2025/10/05/rpt_20251005_mgr_002_1728782962961/audio.webm"
}
```

## Next Steps

1. Test new report creation with updated structure
2. Verify all files save to correct locations
3. Implement report retrieval/viewing functionality
4. Set up lifecycle policies for archival
5. Configure backup/replication if needed
