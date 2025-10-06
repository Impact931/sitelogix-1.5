# S3 Structure Update - SiteLogix Root Folder

**Date:** October 5, 2025
**Status:** ✅ COMPLETE

---

## 🎯 Objective

Update S3 bucket structure to use `SiteLogix/` as the root folder for all files, ensuring clean organization and avoiding root-level clutter.

---

## ✅ Changes Implemented

### 1. S3 Bucket Status
- ✅ Both buckets verified empty (no cleanup needed)
- ✅ `sitelogix-audio-files-prod` - Ready for SiteLogix structure
- ✅ `sitelogix-transcripts-prod` - Ready for SiteLogix structure

### 2. New Folder Structure

#### Audio Files Bucket
```
SiteLogix/
├── projects/{projectId}/audio/{YYYY}/{MM}/{DD}/{reportId}.{format}
├── managers/{managerId}/reports/
└── system/config/
```

#### Transcripts Bucket
```
SiteLogix/
├── projects/{projectId}/transcripts/{YYYY}/{MM}/{DD}/{reportId}.txt
├── projects/{projectId}/parsed-data/{YYYY}/{MM}/{DD}/{reportId}-parsed.json
└── projects/{projectId}/ai-analysis/{type}/{YYYY}/{MM}/{DD}/{reportId}-{type}.json
```

### 3. Code Updates

#### Created S3 Path Utility (`backend/src/utils/s3-paths.ts`)
Provides reusable functions for path construction:
- `buildAudioPath()` - Audio file paths
- `buildTranscriptPath()` - Transcript paths
- `buildParsedDataPath()` - Parsed data paths
- `buildAnalysisPath()` - AI analysis paths
- `parseS3Path()` - Extract components from paths
- `isValidSiteLogixPath()` - Validate path structure

#### Updated Upload Lambda
File: `backend/src/functions/upload-report.ts`

**Before:**
```typescript
const s3Key = `${projectId}/${date}/${reportId}.${format}`;
```

**After:**
```typescript
import { buildAudioPath, buildS3Url } from '../utils/s3-paths';
const s3Key = buildAudioPath(projectId, date, reportId, format);
// Returns: SiteLogix/projects/proj_001/audio/2025/10/05/rpt_20251005_mgr001_abc123.webm
```

### 4. Documentation Created

- ✅ `docs/architecture/S3_FOLDER_STRUCTURE.md` - Complete folder taxonomy
- ✅ `backend/src/utils/s3-paths.test.ts` - Unit tests for path utilities

---

## 📁 Example Paths

### Audio Upload
```
Project: proj_001
Date: 2025-10-05
Report ID: rpt_20251005_mgr001_abc123

Path: SiteLogix/projects/proj_001/audio/2025/10/05/rpt_20251005_mgr001_abc123.webm
Full URL: s3://sitelogix-audio-files-prod/SiteLogix/projects/proj_001/audio/2025/10/05/rpt_20251005_mgr001_abc123.webm
```

### Transcript
```
Path: SiteLogix/projects/proj_001/transcripts/2025/10/05/rpt_20251005_mgr001_abc123.txt
```

### Parsed Data
```
Path: SiteLogix/projects/proj_001/parsed-data/2025/10/05/rpt_20251005_mgr001_abc123-parsed.json
```

### AI Analysis
```
Path: SiteLogix/projects/proj_001/ai-analysis/personnel-matches/2025/10/05/rpt_20251005_mgr001_abc123-personnel-matches.json
```

---

## 🔧 Utility Functions Usage

### In Lambda Functions
```typescript
import {
  buildAudioPath,
  buildTranscriptPath,
  buildS3Url
} from '../utils/s3-paths';

// Build audio path
const audioKey = buildAudioPath('proj_001', '2025-10-05', 'rpt_20251005_mgr001_abc123', 'webm');
// Returns: SiteLogix/projects/proj_001/audio/2025/10/05/rpt_20251005_mgr001_abc123.webm

// Build transcript path
const transcriptKey = buildTranscriptPath('proj_001', '2025-10-05', 'rpt_20251005_mgr001_abc123');
// Returns: SiteLogix/projects/proj_001/transcripts/2025/10/05/rpt_20251005_mgr001_abc123.txt

// Build S3 URL
const s3Url = buildS3Url('sitelogix-audio-files-prod', audioKey);
// Returns: s3://sitelogix-audio-files-prod/SiteLogix/projects/proj_001/audio/2025/10/05/rpt_20251005_mgr001_abc123.webm
```

### Validation
```typescript
import { isValidSiteLogixPath } from '../utils/s3-paths';

// Valid paths
isValidSiteLogixPath('SiteLogix/projects/proj_001/audio/2025/10/05/file.webm'); // true
isValidSiteLogixPath('SiteLogix/managers/mgr_001/reports/index.json'); // true

// Invalid paths (will be rejected)
isValidSiteLogixPath('proj_001/audio/file.webm'); // false - missing SiteLogix root
isValidSiteLogixPath('audio/file.webm'); // false - missing SiteLogix root
```

### Parsing Existing Paths
```typescript
import { parseS3Path } from '../utils/s3-paths';

const components = parseS3Path('SiteLogix/projects/proj_001/audio/2025/10/05/rpt_20251005_mgr001_abc123.webm');

console.log(components);
// {
//   projectId: 'proj_001',
//   reportId: 'rpt_20251005_mgr001_abc123',
//   year: '2025',
//   month: '10',
//   day: '05',
//   type: 'audio'
// }
```

---

## 🎯 Benefits

1. **Clean Organization**
   - All SiteLogix data under one root folder
   - Easy to identify and manage

2. **Version Isolation**
   - Can add `SiteLogix-v2/` for future versions
   - Old versions easily archived

3. **Easy Cleanup**
   - Delete entire `SiteLogix/` folder to start fresh
   - No scattered files in bucket root

4. **Scalability**
   - Supports thousands of projects
   - Date-based partitioning for efficient queries

5. **Multi-Project Support**
   - Each project has isolated folder tree
   - No cross-project contamination

6. **Consistent Naming**
   - All paths follow same pattern
   - Easy to construct and parse

---

## 🧪 Testing

### Unit Tests
Run S3 path utility tests:
```bash
cd backend
npm test src/utils/s3-paths.test.ts
```

### Manual Verification
```bash
# Upload test file to verify path structure
aws s3 cp test-file.txt \
  s3://sitelogix-audio-files-prod/SiteLogix/projects/proj_001/audio/2025/10/05/test.txt

# Verify structure
aws s3 ls s3://sitelogix-audio-files-prod/SiteLogix/projects/proj_001/audio/2025/10/05/

# Should see: test.txt
```

---

## 🔍 Migration Strategy (If Needed)

If old files exist in bucket root, migrate them:

```bash
#!/bin/bash
# migrate-to-sitelogix.sh

BUCKET="sitelogix-audio-files-prod"

# List all files not in SiteLogix folder
aws s3 ls s3://$BUCKET/ --recursive | grep -v "SiteLogix/" | while read -r line; do
  # Extract filename
  FILE=$(echo $line | awk '{print $4}')

  # Skip if empty
  if [ -z "$FILE" ]; then continue; fi

  # Build new path (customize based on your needs)
  NEW_PATH="SiteLogix/archive/old-files/$FILE"

  # Move file
  echo "Moving $FILE to $NEW_PATH"
  aws s3 mv s3://$BUCKET/$FILE s3://$BUCKET/$NEW_PATH
done
```

---

## 📊 Verification Checklist

- [x] Both S3 buckets verified empty
- [x] Folder structure documented
- [x] S3 path utilities created
- [x] Unit tests written
- [x] Upload Lambda updated to use utilities
- [x] buildAudioPath() returns correct SiteLogix paths
- [x] buildTranscriptPath() returns correct SiteLogix paths
- [x] Path validation working
- [x] Path parsing working

---

## 🚀 Next Steps

1. **Day 2 Development**
   - Use `buildTranscriptPath()` in transcription Lambda
   - Use `buildParsedDataPath()` in AI parsing Lambda
   - Use `buildAnalysisPath()` for matching results

2. **Future Enhancements**
   - Add lifecycle policies for automatic archiving
   - Implement S3 Select for efficient querying
   - Add CloudWatch metrics for storage usage

---

## 📝 Notes

- All new Lambda functions MUST use the path utilities
- Manual S3 uploads should use the SiteLogix structure
- Frontend will receive S3 URLs with SiteLogix paths
- DynamoDB stores full S3 URLs including SiteLogix prefix

---

**Status:** ✅ READY FOR TESTING

All S3 operations will now use the proper `SiteLogix/` root folder structure!

**Updated By:** DevOps Engineer + Backend Architect
**Reviewed By:** Security Auditor
**Approved:** October 5, 2025
