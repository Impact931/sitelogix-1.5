# SiteLogix S3 Bucket Cleanup & Reorganization Plan

**Date**: November 4, 2025
**Status**: 🚨 CRITICAL - Structure Needs Immediate Cleanup

---

## Current State - Problems Identified

### 1. Multiple Redundant Buckets

We currently have **3 SiteLogix buckets**:

| Bucket Name | Status | Contents | Problem |
|-------------|--------|----------|---------|
| `sitelogix-prod` | ✅ Active | 44 files (audio, transcripts, reports) | Contains everything - good |
| `sitelogix-audio-files-prod` | ❌ Empty | 0 files | Redundant, unused |
| `sitelogix-transcripts-prod` | ⚠️ Partially used | 6 files | Redundant, inconsistent paths |

**Problem**: Having 3 buckets for one app is confusing and unmaintainable. Everything should be in ONE bucket.

### 2. Inconsistent Path Structure

**Path Case Inconsistency**:
- `sitelogix-prod`: Uses `SITELOGIX/projects/...` (uppercase)
- `sitelogix-transcripts-prod`: Has BOTH:
  - `SITELOGIX/projects/...` (uppercase) - new uploads
  - `SiteLogix/projects/...` (mixed case) - old upload

**Problem**: Case-sensitive systems will treat these as different paths, causing file access issues.

### 3. Poor Folder Organization

**Current structure in sitelogix-prod**:
```
SITELOGIX/projects/proj_001/reports/2025/09/24/rpt_20250924_mgr_001_1759719349208/
├── transcript.json
├── audio.webm
└── report.html
```

**Problems**:
- Audio and transcripts mixed in the same `/reports/` folder
- No separation between raw transcripts and processed transcripts
- No clear exports or backups folder
- The "SITELOGIX" prefix inside the bucket is redundant (bucket name already says sitelogix)

---

## Proposed Clean Structure

### Single Bucket Design

**Use ONLY**: `sitelogix-prod`

**Delete**:
- `sitelogix-audio-files-prod` (empty)
- `sitelogix-transcripts-prod` (move files, then delete)

### Intuitive Folder Hierarchy

```
sitelogix-prod/
│
├── projects/                              # All project data
│   └── {project_id}/                      # e.g., proj_001, proj_002
│       │
│       ├── audio/                         # Raw audio recordings
│       │   └── {YYYY}/                    # Year-based organization
│       │       └── {MM}/                  # Month
│       │           └── {DD}/              # Day
│       │               └── {report_id}.webm
│       │
│       ├── transcripts/                   # All transcript data
│       │   ├── raw/                       # Raw text transcripts (from Roxy)
│       │   │   └── {YYYY}/{MM}/{DD}/{report_id}.txt
│       │   │
│       │   └── processed/                 # Processed JSON transcripts
│       │       └── {YYYY}/{MM}/{DD}/{report_id}.json
│       │
│       ├── reports/                       # Generated reports
│       │   └── {YYYY}/{MM}/{DD}/
│       │       └── {report_id}/
│       │           ├── report.html        # HTML report
│       │           ├── metadata.json      # Report metadata
│       │           └── analytics.json     # Extracted analytics
│       │
│       └── documents/                     # Project documents (PDFs, images, etc.)
│           └── {document_type}/
│
├── training/                              # Training data for AI/ML
│   ├── annotated/                         # Human-annotated examples
│   ├── validated/                         # Validated extractions
│   └── test-cases/                        # Test transcripts
│
├── exports/                               # Data exports
│   ├── google-sheets/                     # Sheets export logs
│   ├── pdf-reports/                       # PDF exports
│   └── csv-data/                          # CSV exports
│
├── backups/                               # Automated backups
│   └── {YYYY}/{MM}/{DD}/
│       └── {table_name}/
│
└── temp/                                  # Temporary processing files
    └── {YYYY}/{MM}/{DD}/
```

### Why This Structure Works

1. **Intuitive Navigation**: Clear folder names tell you exactly what's inside
2. **Scalable**: Can handle unlimited projects and files
3. **Type Separation**: Audio, transcripts, and reports are cleanly separated
4. **Date Organization**: Easy to find files by date
5. **Future-Proof**: Room for training data, exports, backups
6. **No Redundancy**: Everything is in its logical place

---

## Migration Plan

### Phase 1: Consolidate Transcripts (Immediate)

**Goal**: Move all transcripts from `sitelogix-transcripts-prod` to `sitelogix-prod`

1. **Copy 6 transcript files** from `sitelogix-transcripts-prod` to `sitelogix-prod`:
   ```
   FROM: sitelogix-transcripts-prod/SITELOGIX/projects/proj_001/transcripts/2025/11/...
   TO:   sitelogix-prod/projects/proj_001/transcripts/raw/2025/11/...
   ```

2. **Verify all files copied successfully**

3. **Delete empty bucket**: `sitelogix-audio-files-prod`

4. **Delete after verification**: `sitelogix-transcripts-prod`

### Phase 2: Reorganize Existing Files (High Priority)

**Goal**: Restructure files in `sitelogix-prod` to match new taxonomy

1. **Create new folder structure** in `sitelogix-prod`

2. **Move audio files**:
   ```
   FROM: projects/proj_001/reports/2025/10/04/rpt_xxx/audio.webm
   TO:   projects/proj_001/audio/2025/10/04/rpt_xxx.webm
   ```

3. **Move transcripts**:
   ```
   FROM: projects/proj_001/reports/2025/10/04/rpt_xxx/transcript.json
   TO:   projects/proj_001/transcripts/processed/2025/10/04/rpt_xxx.json
   ```

4. **Keep reports in place** (already well-organized):
   ```
   KEEP: projects/proj_001/reports/2025/10/04/rpt_xxx/report.html
   ```

5. **Remove "SITELOGIX" prefix** from all paths (bucket name already indicates app)

### Phase 3: Update Application Code (Critical)

**Goal**: Update all S3 references in code

**Files to Update**:

1. **Backend Lambda** (`backend/src/functions/api-handler.js`):
   - Update S3 bucket references
   - Update S3 key paths
   - Add constants for folder structure

2. **Frontend** (`frontend/src/services/reportService.ts`):
   - Update S3 URL construction
   - Update file path logic

3. **Batch Scripts**:
   - `batch-process-transcripts.js` - Update S3 paths
   - `process-*.js` scripts - Update bucket references

4. **Environment Variables**:
   - Update any hardcoded bucket names
   - Add configuration for folder structure

### Phase 4: Update Infrastructure (Important)

1. **S3 Lifecycle Policies**: Update to new folder structure
2. **IAM Policies**: Ensure permissions cover new paths
3. **CloudWatch Logs**: Update any S3 path monitoring
4. **Documentation**: Update all S3 references in docs

### Phase 5: Testing (Essential)

1. Test file uploads to new structure
2. Test file retrieval from new paths
3. Test Roxy agent transcript processing
4. Test report generation
5. Verify lifecycle policies work correctly

---

## Execution Checklist

### Immediate Actions (Today)
- [ ] Backup current bucket structure documentation
- [ ] Create migration script for Phase 1
- [ ] Test migration script on 1-2 files
- [ ] Execute Phase 1 (consolidate transcripts)
- [ ] Delete empty/redundant buckets
- [ ] Update `batch-process-transcripts.js` to use new paths

### Short-Term (This Week)
- [ ] Create Phase 2 migration script (reorganize files)
- [ ] Test reorganization on single project
- [ ] Execute Phase 2 for all projects
- [ ] Update all application code (Phase 3)
- [ ] Deploy updated code to AWS
- [ ] Run full integration tests

### Long-Term (Next 2 Weeks)
- [ ] Update infrastructure as code (CloudFormation/scripts)
- [ ] Update all documentation
- [ ] Create S3 structure diagram
- [ ] Implement automated structure validation
- [ ] Set up monitoring for new folder structure

---

## Risk Mitigation

### Backup Strategy

**Before ANY migration**:
1. Create full bucket snapshot documentation
2. Enable versioning on `sitelogix-prod` (if not already enabled)
3. Keep old buckets for 30 days after migration
4. Test restoration from backup

### Rollback Plan

If migration fails:
1. All files remain in original locations (copy, not move)
2. Revert code changes via Git
3. Keep old buckets active until verification complete

### Validation

After migration:
1. Verify file count matches before/after
2. Check all file sizes match
3. Test file access via API
4. Test file upload via Roxy
5. Verify reports can be generated

---

## Cost Impact

**Current Cost**: ~$5-10/month (3 buckets, 44 files)

**After Cleanup**: ~$3-7/month (1 bucket, better organized)

**Savings**: ~$2-3/month from:
- Deleting 2 empty/redundant buckets
- Better lifecycle policy application
- Improved storage efficiency

---

## Success Criteria

### Short-Term Success
- ✅ Only 1 SiteLogix bucket exists
- ✅ All paths follow consistent naming (lowercase)
- ✅ All files are in their logical folders
- ✅ No "SITELOGIX" prefix inside bucket

### Long-Term Success
- ✅ New uploads go to correct folders automatically
- ✅ All team members understand folder structure
- ✅ Documentation is up-to-date
- ✅ Monitoring catches structure violations
- ✅ Lifecycle policies work correctly
- ✅ Backup/restore is tested and documented

---

## Next Steps

**Recommended Approach**: Execute Phase 1 immediately, then test thoroughly before proceeding.

1. ✅ Review this plan with team
2. ⏳ Execute Phase 1 (consolidate transcripts) - **CAN DO NOW**
3. ⏳ Update `batch-process-transcripts.js` - **CAN DO NOW**
4. ⏳ Test with new transcript uploads
5. ⏳ Plan Phase 2 execution window (requires code changes)
6. ⏳ Execute Phase 2-5 systematically

**Estimated Time**:
- Phase 1: 30 minutes
- Phase 2: 2 hours
- Phase 3: 3 hours
- Phase 4: 1 hour
- Phase 5: 2 hours
- **Total**: ~8.5 hours

---

## Questions for Discussion

1. **Timing**: When should we execute Phase 2 (requires code changes)?
2. **Testing**: Do we have a staging environment to test migrations?
3. **Monitoring**: Should we add S3 access logging to track usage?
4. **Training Data**: Do we want to keep the 96 transcripts you mentioned as training data in `/training/` folder?
5. **Versioning**: Should we enable S3 versioning for data protection?

---

**Author**: Claude Code
**Version**: 1.0
**Status**: Awaiting Approval
