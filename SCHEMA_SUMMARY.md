# SiteLogix 1.5 - DynamoDB Schema Quick Reference
## Database Architecture Summary

**Last Updated:** November 4, 2025

---

## Quick Stats

| Metric | Value |
|--------|-------|
| Total Tables | 6 |
| Total GSIs | 15 |
| Tables Deployed | 4 |
| Tables Missing | 2 (work-logs, ai-analysis-cache) |
| Schema Mismatches | 3 (Personnel GSI2, Vendors GSI2, Reports GSI3) |
| Monthly Cost (Projected) | ~$150 |

---

## Table Overview

### 1. sitelogix-reports (PRIMARY ENTITY)
**Status:** ✅ Deployed (needs GSI3 addition)
**Purpose:** Atomic unit - all data originates from reports
**Items:** ~100+ (growing daily)

**Keys:**
- PK: `REPORT#{reportId}`
- SK: `METADATA`

**GSIs:**
- ✅ GSI1-ProjectIndex: `project_id + report_date`
- ✅ GSI2-ManagerIndex: `manager_id + report_date`
- ⚠️ GSI3-StatusIndex: `status + timestamp` (MISSING - needs creation)

**Critical Attributes:**
- reportId, conversationId, projectId, managerId
- reportDate, timestamp, status
- transcriptS3Path, audioS3Path, rawTranscriptText
- aiProcessedAt, aiProcessingVersion, aiConfidenceScore
- GPS coordinates, device metadata
- Checksums (SHA-256) for integrity

### 2. sitelogix-personnel (MASTER REGISTRY)
**Status:** ⚠️ Deployed (needs GSI2 fix)
**Purpose:** Central registry with deduplication and work history
**Items:** 128

**Keys:**
- PK: `PERSON#{personId}`
- SK: `PROFILE` (current) or `HISTORY#{reportId}#{timestamp}` (work history)

**GSIs:**
- ✅ GSI1-NameIndex: `full_name` (for fuzzy matching)
- ⚠️ GSI2-ProjectIndex: `project_id` (WRONG - should be StatusIndex)
- ❌ GSI2-StatusIndex: `status + dateLastSeen` (MISSING - needs creation)

**Critical Attributes:**
- personId, fullName, nicknames, goByName
- currentPosition, employmentStatus, status
- totalReportsCount, totalHoursWorked
- dateFirstSeen, dateLastSeen
- Phone/email (PII - needs encryption)

**History Records:**
- reportId, projectId, position, teamAssignment
- hoursWorked, overtimeHours, activitiesPerformed

### 3. sitelogix-vendors (SUPPLIER/SUBCONTRACTOR REGISTRY)
**Status:** ⚠️ Deployed (needs GSI2 addition)
**Purpose:** Track vendors with delivery and performance history
**Items:** ~50+

**Keys:**
- PK: `VENDOR#{vendorId}`
- SK: `PROFILE` (current) or `DELIVERY#{reportId}#{timestamp}` (deliveries)

**GSIs:**
- ✅ GSI1-CompanyIndex: `company_name` (for fuzzy matching)
- ❌ GSI2-TypeIndex: `vendor_type + dateLastSeen` (MISSING - needs creation)

**Critical Attributes:**
- vendorId, companyName, companyNameVariations
- vendorType, subcontractorTrade, approvalStatus
- totalDeliveriesCount, onTimeDeliveryRate
- dateFirstSeen, dateLastSeen

**Delivery Records:**
- materialsDelivered, deliveryTime, isLateDelivery
- hasIssues, issueDescription, deliveryRating

### 4. sitelogix-constraints (ISSUES & DELAYS)
**Status:** ⚠️ Deployed (needs GSI3 addition)
**Purpose:** Track project constraints, delays, safety issues
**Items:** ~200+

**Keys:**
- PK: `PROJECT#{projectId}`
- SK: `CONSTRAINT#{constraintId}`

**GSIs:**
- ✅ GSI1-CategoryIndex: `category + dateIdentified`
- ✅ GSI2-StatusIndex: `status + severity`
- ❌ GSI3-ProjectDateIndex: `project_id + report_date` (MISSING - needs creation)

**Critical Attributes:**
- constraintId, projectId, reportId, reportDate
- category, subcategory, severity, status
- title, description, extractedFromText
- buildingLevel, specificArea
- assignedTo, dateResolved, resolutionNotes
- relatedVendorId, relatedPersonnelIds

### 5. sitelogix-work-logs (DETAILED ACTIVITY)
**Status:** ❌ NOT DEPLOYED (needs creation)
**Purpose:** Granular work breakdown by team/location
**Priority:** HIGH

**Keys:**
- PK: `REPORT#{reportId}`
- SK: `WORKLOG#{teamId}#{level}`

**GSIs:**
- ❌ GSI1-ProjectDateIndex: `project_id + report_date`
- ❌ GSI2-TeamIndex: `team_id + report_date`

**Critical Attributes:**
- reportId, projectId, teamId, buildingLevel
- personnelAssigned, personnelCount, leadPerson
- taskCategory, taskDescription, quantityCompleted
- hoursWorked, regularHours, overtimeHours
- materialsUsed, equipmentUsed
- progressPercentage, delaysEncountered

**Table JSON:** `/infrastructure/table-work-logs.json`

### 6. sitelogix-ai-analysis-cache (AI PROCESSING)
**Status:** ❌ NOT DEPLOYED (needs creation)
**Purpose:** Store AI summaries, extractions, model performance
**Priority:** MEDIUM

**Keys:**
- PK: `REPORT#{reportId}` or `CACHE#{cacheKey}`
- SK: `AI#{analysisType}#{modelVersion}`

**GSIs:**
- ❌ GSI1-TypeIndex: `analysisType + createdAt`
- ❌ GSI2-ModelIndex: `modelUsed + createdAt`

**Critical Attributes:**
- reportId, cacheKey, analysisType
- modelUsed, modelVersion, modelProvider
- promptTemplate, rawResponse, structuredData
- confidence, validationPassed, needsHumanReview
- processingTime, tokenCount, estimatedCost
- ttl (for auto-expiry)

**Special Features:**
- TTL enabled (90-day expiry)
- Higher throughput (10 RCU/WCU)

**Table JSON:** `/infrastructure/table-ai-analysis-cache.json`

---

## Access Pattern → Index Mapping

| Access Pattern | Table | Index | Performance |
|---------------|-------|-------|-------------|
| Direct report lookup | Reports | PK/SK | < 10ms |
| Project timeline | Reports | GSI1-ProjectIndex | < 50ms |
| Manager performance | Reports | GSI2-ManagerIndex | < 50ms |
| Workflow queue | Reports | GSI3-StatusIndex | < 50ms |
| Fuzzy name search | Personnel | GSI1-NameIndex | < 100ms |
| Inactive personnel | Personnel | GSI2-StatusIndex | < 100ms |
| Personnel history | Personnel | PK/SK (HISTORY#) | < 50ms |
| Fuzzy company search | Vendors | GSI1-CompanyIndex | < 100ms |
| Vendor type filter | Vendors | GSI2-TypeIndex | < 100ms |
| Delivery history | Vendors | PK/SK (DELIVERY#) | < 50ms |
| Category analysis | Constraints | GSI1-CategoryIndex | < 100ms |
| Priority queue | Constraints | GSI2-StatusIndex | < 50ms |
| Project constraints timeline | Constraints | GSI3-ProjectDateIndex | < 100ms |
| Report work logs | Work Logs | PK/SK | < 50ms |
| Project progress | Work Logs | GSI1-ProjectDateIndex | < 100ms |
| Team performance | Work Logs | GSI2-TeamIndex | < 100ms |
| AI cache lookup | AI Cache | PK/SK | < 10ms |
| Analysis type metrics | AI Cache | GSI1-TypeIndex | < 100ms |
| Model performance | AI Cache | GSI2-ModelIndex | < 100ms |

---

## Key Design Patterns

### Pattern 1: Composite Keys for Versioning
```
PK: ENTITY#{entityId}
SK: VERSION#{timestamp} or METADATA
```
**Use Cases:** Reports, Personnel profiles, Vendor profiles

### Pattern 2: History via Sort Key Overloading
```
PK: ENTITY#{entityId}
SK: PROFILE (current)
SK: HISTORY#{reportId}#{timestamp} (historical)
```
**Use Cases:** Personnel work history, Vendor delivery history

### Pattern 3: Hierarchical Keys
```
PK: PROJECT#{projectId}
SK: CONSTRAINT#{constraintId}
```
**Use Cases:** Constraints (grouped by project)

### Pattern 4: Composite Sort Keys
```
SK: WORKLOG#{teamId}#{level}
```
**Use Cases:** Work logs (query by team or level)

---

## Migration Priorities

### Phase 1: Fix Existing Tables (Week 1)
1. ⚠️ sitelogix-personnel: Replace GSI2-ProjectIndex → GSI2-StatusIndex
2. ⚠️ sitelogix-vendors: Add GSI2-TypeIndex
3. ⚠️ sitelogix-reports: Add GSI3-StatusIndex
4. ⚠️ sitelogix-constraints: Add GSI3-ProjectDateIndex
5. ✅ Enable DynamoDB Streams on all tables
6. ✅ Enable PITR on all tables

### Phase 2: Create Missing Tables (Week 2)
1. ❌ Deploy sitelogix-work-logs
2. ❌ Deploy sitelogix-ai-analysis-cache

### Phase 3: Application Integration (Week 3-4)
1. Update report processing to use work-logs
2. Implement AI cache read/write logic
3. Update deduplication queries to use correct GSIs
4. Deploy stream processors (audit trail, archival)

---

## Audit Trail & Compliance

### DynamoDB Streams (All Tables)
- **Enabled:** ✅ (or pending in Phase 1)
- **View Type:** NEW_AND_OLD_IMAGES
- **Purpose:** Audit trail, data lifecycle, denormalization

### Point-in-Time Recovery (All Tables)
- **Enabled:** ✅ (or pending in Phase 1)
- **Window:** 35 days
- **Purpose:** Compliance, data protection, rollback

### Encryption
- **At Rest:** KMS encryption (all tables)
- **At Transit:** TLS 1.2+
- **Field-Level:** PII fields (phone, email) - application-layer

### Retention Strategy
- **Hot (DynamoDB):** 0-90 days
- **Warm (S3 Standard):** 90 days - 1 year
- **Cold (S3 Glacier):** 1-7 years (OSHA compliance)

---

## Cost Breakdown

### Current (4 Tables)
- Provisioned Capacity: ~$50/month
- Storage: ~$5/month
- PITR: ~$12/month
- Streams: ~$10/month
- **Total:** ~$77/month

### Projected (6 Tables + Enhancements)
- Provisioned Capacity: ~$80/month
- Storage: ~$10/month
- PITR: ~$20/month
- Streams: ~$20/month
- GSIs: ~$30/month
- **Total:** ~$160/month

### Optimization Opportunities
- Use on-demand billing for low-traffic tables: -$20/month
- Sparse GSIs (only populate for recent records): -$10/month
- Archive to S3 (aged data): -$5/month
- Reserved capacity (if committed): -$25/month
- **Optimized Total:** ~$100-110/month

---

## Security Checklist

### Data Protection
- [x] Encryption at rest (KMS)
- [x] Encryption in transit (TLS)
- [ ] Field-level encryption (PII)
- [x] PITR enabled
- [ ] Automated backups configured

### Access Control
- [ ] IAM policies (least privilege)
- [ ] VPC endpoints (private access)
- [ ] CloudTrail logging enabled
- [ ] Resource tags for governance

### Audit Trail
- [x] DynamoDB Streams enabled
- [ ] Audit log Lambda deployed
- [ ] S3 access logging enabled
- [ ] Immutable audit log (S3 Object Lock)

### Compliance
- [x] 7-year retention design
- [ ] Legal hold capability
- [x] Checksums for integrity
- [ ] OSHA compliance mapping

---

## Monitoring Metrics

### Performance
- DynamoDB throttled requests (target: 0)
- Query latency (target: < 100ms)
- GSI replication lag (target: < 1s)

### Costs
- Daily spend per table
- Capacity utilization (target: 70-80%)
- Anomaly detection

### Data Quality
- AI confidence scores (track trends)
- Deduplication match rate
- Failed extractions count

### Compliance
- Audit log completeness
- Backup success rate
- PITR verification

---

## Quick Commands

### List All Tables
```bash
aws dynamodb list-tables --query "TableNames[?contains(@, 'sitelogix')]"
```

### Check Table Status
```bash
aws dynamodb describe-table --table-name sitelogix-reports --query 'Table.{Status:TableStatus,Items:ItemCount,Size:TableSizeBytes}'
```

### Query Example (Project Timeline)
```bash
aws dynamodb query \
  --table-name sitelogix-reports \
  --index-name GSI1-ProjectIndex \
  --key-condition-expression "project_id = :pid AND report_date BETWEEN :start AND :end" \
  --expression-attribute-values '{":pid":{"S":"proj_001"},":start":{"S":"2025-10-01"},":end":{"S":"2025-11-01"}}'
```

### Check Streams Status
```bash
for table in sitelogix-reports sitelogix-personnel sitelogix-vendors sitelogix-constraints; do
  echo "$table: $(aws dynamodb describe-table --table-name $table --query 'Table.StreamSpecification.StreamEnabled')"
done
```

### Check PITR Status
```bash
for table in sitelogix-reports sitelogix-personnel sitelogix-vendors sitelogix-constraints; do
  echo "$table: $(aws dynamodb describe-continuous-backups --table-name $table --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus')"
done
```

---

## Related Documentation

- **Complete Schema Design:** `/DYNAMODB_COMPLETE_SCHEMA_DESIGN.md` (70+ pages)
- **Migration Plan:** `/infrastructure/MIGRATION_PLAN.md` (step-by-step guide)
- **Table Definitions:** `/infrastructure/table-*.json` (CloudFormation ready)
- **RFC-008:** `/# RFC-008 - Database Planning Guidance.md` (requirements)
- **DATABASE_DESIGN.md:** `/DATABASE_DESIGN.md` (original design doc)

---

## Next Steps

### Immediate Actions
1. **Review:** Complete schema design with dev team
2. **Approve:** Migration plan and timeline
3. **Test:** Deploy to staging environment first
4. **Execute:** Run migration (estimated 1-2 weeks)

### Week 1 Deliverables
- All 6 tables operational
- All GSIs active and queryable
- Streams and PITR enabled
- Application code updated

### Success Criteria
- ✅ Zero data loss
- ✅ All 7 core access patterns supported
- ✅ Query latency < 100ms
- ✅ Audit trail complete
- ✅ Costs within budget

---

**Document Owner:** Database Architect
**Last Review:** November 4, 2025
**Status:** Ready for Implementation
