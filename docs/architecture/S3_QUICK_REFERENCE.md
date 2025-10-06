# S3 Quick Reference - SiteLogix

**Quick lookup for S3 path patterns**

---

## 🎯 Key Principle

**ALL files MUST be under the `SiteLogix/` root folder**

❌ **WRONG:** `proj_001/audio/file.webm`
✅ **CORRECT:** `SiteLogix/projects/proj_001/audio/2025/10/05/file.webm`

---

## 📁 Common Paths

### Audio File
```
SiteLogix/projects/{projectId}/audio/{YYYY}/{MM}/{DD}/{reportId}.webm
```

### Transcript (Text)
```
SiteLogix/projects/{projectId}/transcripts/{YYYY}/{MM}/{DD}/{reportId}.txt
```

### Parsed Data (JSON)
```
SiteLogix/projects/{projectId}/parsed-data/{YYYY}/{MM}/{DD}/{reportId}-parsed.json
```

### Personnel Matches
```
SiteLogix/projects/{projectId}/ai-analysis/personnel-matches/{YYYY}/{MM}/{DD}/{reportId}-personnel-matches.json
```

### Vendor Matches
```
SiteLogix/projects/{projectId}/ai-analysis/vendor-matches/{YYYY}/{MM}/{DD}/{reportId}-vendor-matches.json
```

---

## 💻 Code Examples

### Upload Audio
```typescript
import { buildAudioPath, buildS3Url } from '../utils/s3-paths';

const key = buildAudioPath('proj_001', '2025-10-05', 'rpt_20251005_mgr001_abc123', 'webm');
// SiteLogix/projects/proj_001/audio/2025/10/05/rpt_20251005_mgr001_abc123.webm

const url = buildS3Url('sitelogix-audio-files-prod', key);
// s3://sitelogix-audio-files-prod/SiteLogix/projects/proj_001/audio/2025/10/05/rpt_20251005_mgr001_abc123.webm
```

### Save Transcript
```typescript
import { buildTranscriptPath } from '../utils/s3-paths';

const key = buildTranscriptPath('proj_001', '2025-10-05', 'rpt_20251005_mgr001_abc123');
// SiteLogix/projects/proj_001/transcripts/2025/10/05/rpt_20251005_mgr001_abc123.txt
```

---

## 🔍 Query Patterns

### All reports for a project on a specific date
```bash
aws s3 ls s3://sitelogix-audio-files-prod/SiteLogix/projects/proj_001/audio/2025/10/05/
```

### All reports for October 2025
```bash
aws s3 ls s3://sitelogix-audio-files-prod/SiteLogix/projects/proj_001/audio/2025/10/ --recursive
```

### All transcripts for a project
```bash
aws s3 ls s3://sitelogix-transcripts-prod/SiteLogix/projects/proj_001/transcripts/ --recursive
```

---

## 📦 Buckets

| Bucket | Purpose |
|--------|---------|
| `sitelogix-audio-files-prod` | Audio recordings |
| `sitelogix-transcripts-prod` | Transcripts, parsed data, AI analysis |

---

## ✅ Validation

Before saving any file, verify path starts with `SiteLogix/`:

```typescript
import { isValidSiteLogixPath } from '../utils/s3-paths';

if (!isValidSiteLogixPath(path)) {
  throw new Error('Invalid S3 path - must start with SiteLogix/');
}
```

---

**Last Updated:** October 5, 2025
