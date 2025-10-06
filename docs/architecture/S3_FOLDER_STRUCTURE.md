# SiteLogix S3 Folder Structure

**Version:** 1.5
**Last Updated:** October 5, 2025

---

## 📁 Folder Taxonomy

All SiteLogix data is organized under a root **SiteLogix/** folder to maintain clean separation and avoid root-level clutter.

---

## 🗂️ Audio Files Bucket Structure

**Bucket:** `sitelogix-audio-files-prod`

```
SiteLogix/
├── projects/
│   ├── {project_id}/              # e.g., proj_001
│   │   ├── audio/
│   │   │   ├── 2025/
│   │   │   │   ├── 10/            # Month
│   │   │   │   │   ├── 05/        # Day
│   │   │   │   │   │   ├── rpt_20251005_mgr001_abc123.webm
│   │   │   │   │   │   ├── rpt_20251005_mgr002_def456.webm
│   │   │   │   │   │   └── ...
│   │   │   │   │   ├── 06/
│   │   │   │   │   └── ...
│   │   │   │   └── 11/
│   │   │   └── 2026/
│   │   ├── metadata/
│   │   │   └── project-info.json
│   │   └── archive/
│   │       └── old-reports/
│   ├── proj_002/
│   ├── proj_003/
│   └── ...
├── managers/
│   ├── {manager_id}/              # e.g., mgr_001
│   │   ├── reports/
│   │   │   └── report-index.json
│   │   └── profile/
│   │       └── manager-profile.json
│   └── ...
└── system/
    ├── config/
    │   └── app-config.json
    └── logs/
        └── upload-logs/
```

---

## 📄 Transcripts Bucket Structure

**Bucket:** `sitelogix-transcripts-prod`

```
SiteLogix/
├── projects/
│   ├── {project_id}/              # e.g., proj_001
│   │   ├── transcripts/
│   │   │   ├── 2025/
│   │   │   │   ├── 10/
│   │   │   │   │   ├── 05/
│   │   │   │   │   │   ├── rpt_20251005_mgr001_abc123.txt
│   │   │   │   │   │   ├── rpt_20251005_mgr001_abc123.json  # Structured data
│   │   │   │   │   │   └── ...
│   │   │   │   │   └── ...
│   │   │   │   └── ...
│   │   │   └── 2026/
│   │   ├── parsed-data/
│   │   │   ├── 2025/
│   │   │   │   └── 10/
│   │   │   │       └── 05/
│   │   │   │           ├── rpt_20251005_mgr001_abc123-parsed.json
│   │   │   │           └── ...
│   │   │   └── ...
│   │   └── ai-analysis/
│   │       ├── personnel-matches/
│   │       ├── vendor-matches/
│   │       └── constraint-analysis/
│   └── ...
├── archive/
│   └── old-versions/
└── system/
    └── processing-logs/
```

---

## 🎯 Path Patterns

### Audio File Upload Path
```
SiteLogix/projects/{projectId}/audio/{YYYY}/{MM}/{DD}/{reportId}.{format}
```

**Example:**
```
SiteLogix/projects/proj_001/audio/2025/10/05/rpt_20251005_mgr001_abc123.webm
```

### Transcript Path
```
SiteLogix/projects/{projectId}/transcripts/{YYYY}/{MM}/{DD}/{reportId}.txt
```

**Example:**
```
SiteLogix/projects/proj_001/transcripts/2025/10/05/rpt_20251005_mgr001_abc123.txt
```

### Parsed Data Path
```
SiteLogix/projects/{projectId}/parsed-data/{YYYY}/{MM}/{DD}/{reportId}-parsed.json
```

**Example:**
```
SiteLogix/projects/proj_001/parsed-data/2025/10/05/rpt_20251005_mgr001_abc123-parsed.json
```

---

## 📊 Naming Conventions

### Report ID Format
```
rpt_{YYYYMMDD}_{managerId}_{uniqueId}
```

**Components:**
- `rpt_` - Fixed prefix
- `YYYYMMDD` - Date without separators
- `managerId` - Manager identifier (e.g., mgr_001)
- `uniqueId` - 8-character UUID

**Example:** `rpt_20251005_mgr001_abc12345`

### File Extensions
- **Audio:** `.webm`, `.mp3`, `.wav`, `.m4a`
- **Transcripts:** `.txt` (plain text), `.json` (structured)
- **Parsed Data:** `.json`
- **Metadata:** `.json`

---

## 🔐 Access Patterns

### By Project
Query all reports for a specific project:
```
s3://sitelogix-audio-files-prod/SiteLogix/projects/{projectId}/audio/
```

### By Date Range
Query reports for a specific date:
```
s3://sitelogix-audio-files-prod/SiteLogix/projects/{projectId}/audio/2025/10/05/
```

### By Manager (via DynamoDB GSI)
Use DynamoDB GSI2-ManagerIndex to find report IDs, then construct S3 paths.

---

## 🗄️ Archive Strategy

### Auto-Archive Rules
- Reports older than 2 years → Move to `archive/` folder
- Transition to S3 Glacier after 1 year
- Permanent retention for compliance

### Archive Path
```
SiteLogix/projects/{projectId}/archive/{YYYY}/{reportId}.webm
```

---

## 🔄 Migration from Root Structure

If existing files are in root folder, migrate them:

```bash
# List any root-level files
aws s3 ls s3://sitelogix-audio-files-prod/ --recursive | grep -v "SiteLogix/"

# Move to proper structure (example)
aws s3 mv s3://bucket/old-file.webm \
  s3://bucket/SiteLogix/projects/proj_001/audio/2025/10/05/old-file.webm
```

---

## 📝 Lambda Code Path Construction

### TypeScript/JavaScript
```typescript
const buildAudioPath = (projectId: string, reportDate: string, reportId: string, format: string): string => {
  const date = new Date(reportDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `SiteLogix/projects/${projectId}/audio/${year}/${month}/${day}/${reportId}.${format}`;
};

// Example usage:
const s3Key = buildAudioPath('proj_001', '2025-10-05', 'rpt_20251005_mgr001_abc123', 'webm');
// Returns: "SiteLogix/projects/proj_001/audio/2025/10/05/rpt_20251005_mgr001_abc123.webm"
```

---

## 🎨 Visualization

```
sitelogix-audio-files-prod/
└── SiteLogix/                          ← ROOT FOLDER
    ├── projects/                       ← All project data
    │   ├── proj_001/
    │   │   ├── audio/                  ← Voice recordings
    │   │   │   └── 2025/10/05/
    │   │   ├── metadata/               ← Project config
    │   │   └── archive/                ← Old reports
    │   └── proj_002/
    ├── managers/                       ← Manager-specific data
    │   └── mgr_001/
    └── system/                         ← System files
        └── config/

sitelogix-transcripts-prod/
└── SiteLogix/                          ← ROOT FOLDER
    ├── projects/
    │   └── proj_001/
    │       ├── transcripts/            ← Text transcripts
    │       ├── parsed-data/            ← AI-parsed JSON
    │       └── ai-analysis/            ← Matching results
    └── archive/
```

---

## ✅ Benefits of This Structure

1. **Clean Organization:** All SiteLogix data in one root folder
2. **Easy Cleanup:** Can delete entire `SiteLogix/` folder to start fresh
3. **Project Isolation:** Each project has its own folder tree
4. **Date-based Queries:** Efficient querying by year/month/day
5. **Scalability:** Can support thousands of projects without clutter
6. **Multi-tenancy Ready:** Can add `SiteLogix-v2/` for new versions

---

## 🚨 Important Notes

- **Never save files to bucket root** - Always use `SiteLogix/` prefix
- **Consistent naming** - Use lowercase, hyphens for multi-word folders
- **Date format** - Always use YYYY/MM/DD for chronological sorting
- **Project IDs** - Use consistent format (e.g., proj_001, proj_002)
- **Report IDs** - Must be globally unique across all projects

---

**Last Review:** October 5, 2025
**Next Review:** After Day 2 implementation
