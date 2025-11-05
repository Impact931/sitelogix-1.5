# SiteLogix Admin Tables - Design Summary

**Date**: November 5, 2025
**Database Architect**: Database Architecture Team
**Version**: 2.0

---

## Executive Summary

This document summarizes the comprehensive DynamoDB schema design for SiteLogix's admin and project management features. The design supports multi-tenant operations with role-based access control (RBAC) and provides efficient query patterns for construction site management.

---

## Tables Designed

### 1. Enhanced Personnel Table (sitelogix-personnel-v2)
**Purpose**: Employee management with health tracking, team assignments, and hourly rates

**Key Features**:
- Role-based access (user, manager, admin, superadmin)
- Health status tracking with medical restrictions
- Team assignment with GSI for efficient team queries
- Hours tracking (weekly/monthly aggregations)
- Employee number for badge integration

**Capacity**: 10 RCU / 10 WCU
**Storage Estimate**: ~500 employees = ~50 KB each = 25 MB

---

### 2. Projects Table (sitelogix-projects)
**Purpose**: Construction project management with budgets, timelines, and milestones

**Key Features**:
- Multi-status support (planning, active, on-hold, complete)
- Milestone tracking with individual status
- Budget tracking (total and spent)
- Team member assignments via composite keys
- Manager assignment with GSI

**Capacity**: 10 RCU / 10 WCU
**Storage Estimate**: ~100 projects = ~200 KB each = 20 MB

---

### 3. Users/Auth Table (sitelogix-users)
**Purpose**: Authentication and authorization with secure password storage

**Key Features**:
- Bcrypt password hashing (12 salt rounds)
- MFA support flag
- Account disable capability
- Login tracking (last login, login count)
- Username GSI for fast authentication

**Capacity**: 15 RCU / 10 WCU (higher read for auth)
**Storage Estimate**: ~500 users = ~5 KB each = 2.5 MB

**Security**: Point-in-time recovery enabled, marked as sensitive data

---

### 4. Time Tracking Table (sitelogix-time-tracking)
**Purpose**: Employee hours tracking by project with payroll support

**Key Features**:
- Regular, overtime, and double-time hours
- Week and month indexes for payroll
- Project-based hours tracking
- Manager approval workflow
- Pay calculation at entry time

**Capacity**: 20 RCU / 20 WCU (highest - daily entries)
**Storage Estimate**: ~500 employees × 20 days/month × 2 projects = 20,000 entries/month = ~1 GB/year

---

## Key Design Decisions

### 1. Partition Key Strategy
**Decision**: Use entity type prefix with UUID
```
EMPLOYEE#<uuid>
PROJECT#<uuid>
USER#<uuid>
```

**Rationale**:
- Ensures unique distribution across partitions
- Prevents hot partitions
- Makes entity type clear from key

---

### 2. Global Secondary Indexes (GSIs)
**Decision**: Create GSIs for all common query patterns

**Personnel GSIs**:
- GSI1: Name lookup (search/autocomplete)
- GSI2: Employee number (badge scanning)
- GSI3: Team membership (team queries)
- GSI4: Role + Status (filter active users by role)

**Projects GSIs**:
- GSI1: Project name (search)
- GSI2: Status + Date (active projects)
- GSI3: Manager (manager's projects)

**Users GSIs**:
- GSI1: Username (authentication) - **CRITICAL PATH**
- GSI2: Employee link (user from employee)
- GSI3: Role + Status (filter by role)

**Time Tracking GSIs**:
- GSI1: Project + Date (project costs)
- GSI2: Week (weekly payroll)
- GSI3: Month (monthly payroll)

**Rationale**: Avoid table scans at all costs - GSIs enable O(n) queries vs O(N) scans

---

### 3. Denormalization Strategy
**Decision**: Denormalize frequently accessed data in Time Tracking table

**Denormalized Fields**:
- `employee_name` (from Personnel)
- `project_name` (from Projects)
- `hourly_rate` (from Personnel - frozen at entry time)

**Rationale**:
- Single query gets all display data
- No cross-table joins needed
- Historical accuracy (rate at time of work)

**Trade-off**: Must update denormalized data when source changes

---

### 4. Composite Sort Keys
**Decision**: Use composite SK for multi-entity relationships

**Example - Time Tracking**:
```
PK: EMPLOYEE#emp-001
SK: DATE#2025-11-05#PROJECT#proj-001
```

**Benefits**:
- One employee, multiple projects per day
- Efficient date range queries
- Natural chronological sorting

**Example - Projects**:
```
PK: PROJECT#proj-001, SK: METADATA        → Project info
PK: PROJECT#proj-001, SK: TEAM#emp-001    → Team member
PK: PROJECT#proj-001, SK: TEAM#emp-002    → Team member
```

**Benefits**:
- Get project + all team members in one query
- Easy add/remove team members

---

### 5. Week/Month Indexing
**Decision**: Use ISO 8601 week format for time aggregation

**Format**:
- Week: `2025-W45` (week 45 of 2025)
- Month: `2025-11` (November 2025)

**Rationale**:
- International standard
- Easy range queries
- Consistent week boundaries (Monday-Sunday)

---

### 6. Capacity Planning
**Decision**: Start with provisioned capacity, enable auto-scaling

**Initial Allocations**:
| Table | RCU | WCU | Rationale |
|-------|-----|-----|-----------|
| Personnel | 10 | 10 | Moderate read/write |
| Projects | 10 | 10 | Moderate read/write |
| Users | 15 | 10 | High read (auth), moderate write |
| Time Tracking | 20 | 20 | High read/write (reports + daily entries) |

**Auto-scaling**: Min 5, Max 2x provisioned, Target 70%

**Cost**: ~$68/month for provisioned capacity (24/7)

---

## Access Pattern Highlights

### Most Frequent Queries (Top 10)

1. **User Authentication** - Users GSI1 (username)
   - Frequency: Every user login
   - Performance: O(1), ~5ms

2. **Get Employee Time Entries** - Time Tracking PK+SK range
   - Frequency: Daily (employee timesheet view)
   - Performance: O(n), ~10ms for 30 days

3. **Get Project Details** - Projects PK
   - Frequency: Multiple times per session
   - Performance: O(1), ~5ms

4. **Get Active Projects** - Projects GSI2 (status)
   - Frequency: Dashboard loads
   - Performance: O(n), ~20ms for 50 projects

5. **Get Employee Details** - Personnel PK
   - Frequency: Profile views, reports
   - Performance: O(1), ~5ms

6. **Get Manager's Projects** - Projects GSI3 (manager_id)
   - Frequency: Manager dashboard
   - Performance: O(n), ~15ms for 10 projects

7. **Get Team Members** - Personnel GSI3 (team_id)
   - Frequency: Team management views
   - Performance: O(n), ~10ms for 20 members

8. **Get Week Hours** - Time Tracking GSI2 (week)
   - Frequency: Weekly payroll
   - Performance: O(n), ~50ms for 500 employees

9. **Get Project Hours** - Time Tracking GSI1 (project_id)
   - Frequency: Project cost reports
   - Performance: O(n), ~30ms for 1000 entries

10. **Search Employee by Name** - Personnel GSI1 (name)
    - Frequency: Search/autocomplete
    - Performance: O(1), ~5ms

---

## Security Features

### Authentication
- **Password Hashing**: Bcrypt with 12 salt rounds
- **MFA Support**: Flag for multi-factor authentication
- **Session Management**: JWT tokens with refresh
- **Account Lockout**: Disable capability for security incidents

### Authorization (RBAC)
```
Superadmin: Full system access
    ├─ Create/delete users
    ├─ Manage all projects
    ├─ View all data
    └─ System configuration

Admin: Company-wide management
    ├─ Manage projects
    ├─ Manage employees
    ├─ View all reports
    └─ Approve time (all)

Manager: Project management
    ├─ Manage assigned projects
    ├─ View team members
    ├─ Approve team time
    └─ Project reports

User: Basic access
    ├─ View assigned projects
    ├─ Submit time entries
    ├─ View own data
    └─ Basic reports
```

### Data Protection
- **Encryption at Rest**: AES-256 (all tables)
- **Encryption in Transit**: TLS 1.2+ (all API calls)
- **Point-in-Time Recovery**: 35 days (all tables)
- **DynamoDB Streams**: Audit trail (all tables)
- **Backup**: On-demand backups retained 90 days

---

## Migration Strategy

### Approach: Dual-Write with Zero Downtime

**Phase 1**: Create new tables, enable dual-write
- New tables created
- Application writes to both v1 and v2
- Reads still from v1

**Phase 2**: Backfill historical data
- Script migrates all v1 data to v2
- Validation ensures 100% data accuracy
- Rollback plan in place

**Phase 3**: Switch reads to v2
- Application reads from v2
- Still dual-writing for safety
- Monitor for 1 week

**Phase 4**: Disable dual-write
- Application only writes to v2
- v1 table archived after 1 month
- Migration complete

**Timeline**: 3-4 weeks total

**Risk Mitigation**:
- Backups at every stage
- Validation scripts
- Rollback procedures
- Monitoring and alerts

---

## Cost Analysis

### Monthly Costs (Provisioned Capacity)

| Component | Cost |
|-----------|------|
| Personnel Table (10 RCU, 10 WCU) | $12.79 |
| Projects Table (10 RCU, 10 WCU) | $12.79 |
| Users Table (15 RCU, 10 WCU) | $16.43 |
| Time Tracking (20 RCU, 20 WCU) | $25.58 |
| **Subtotal** | **$67.59** |
| Data Storage (~1 GB/year) | ~$0.25/month |
| Backups (continuous + on-demand) | ~$5.00/month |
| DynamoDB Streams | ~$2.00/month |
| **Total Monthly Cost** | **~$75/month** |

### Cost Optimization Options

**Option 1: Auto-Scaling** (Recommended)
- Scale down during off-hours (nights, weekends)
- Potential savings: 30-40%
- **New cost**: ~$45-50/month

**Option 2: On-Demand Billing**
- Pay per request
- Best for unpredictable workload
- Break-even: ~25M reads + 5M writes/month
- **Estimated cost**: $50-80/month (varies)

**Option 3: Reserved Capacity**
- Commit to 1-year capacity
- Savings: 20% discount
- Best for stable workload
- **New cost**: ~$60/month

**Recommendation**: Start with provisioned + auto-scaling

---

## Testing and Validation

### Pre-Production Testing

**Load Testing**:
- 500 concurrent users
- 1000 requests/second
- 95th percentile latency < 50ms
- Zero throttling errors

**Query Performance**:
- All GetItem queries < 10ms
- All Query operations < 50ms
- All BatchGet operations < 100ms

**Data Validation**:
- 100% record count match
- 100% data accuracy (sample validation)
- All GSIs functioning correctly

**Rollback Testing**:
- Practice rollback in staging
- Document rollback procedures
- Train team on emergency procedures

---

## Monitoring and Alerting

### CloudWatch Metrics to Monitor

**Performance**:
- Average latency (target: < 10ms)
- P99 latency (target: < 50ms)
- Throttled requests (target: 0)

**Capacity**:
- Consumed read capacity (alert: > 80%)
- Consumed write capacity (alert: > 80%)
- Account-level limits (alert: > 70%)

**Errors**:
- UserErrors (throttling)
- SystemErrors (service issues)
- Conditional check failures

**Business Metrics**:
- Login success rate (target: > 99%)
- Time entry submissions (track daily)
- Project creation rate (track weekly)

### Alarms Configuration
```bash
# Example: High consumed capacity alarm
aws cloudwatch put-metric-alarm \
  --alarm-name sitelogix-time-tracking-high-reads \
  --metric-name ConsumedReadCapacityUnits \
  --namespace AWS/DynamoDB \
  --statistic Average \
  --period 300 \
  --threshold 16 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=TableName,Value=sitelogix-time-tracking
```

---

## Files Delivered

### Core Schema Files
1. **admin-tables-schemas.json** - Complete DynamoDB table definitions
2. **sample-data.json** - Test data for all tables
3. **ADMIN_TABLES_README.md** - Comprehensive documentation

### Documentation
4. **access-patterns.md** - All query patterns with examples
5. **migration-plan.md** - Step-by-step migration guide
6. **table-relationships.md** - Entity relationships and data flow

### Scripts
7. **scripts/create-admin-tables.sh** - Automated table creation
8. **SCHEMA_DESIGN_SUMMARY.md** - This summary document

---

## Next Steps

### Immediate (Week 1)
1. Review schemas with stakeholders
2. Create tables in test environment
3. Load sample data for testing
4. Validate access patterns

### Short-term (Weeks 2-3)
1. Implement backend services
2. Build authentication layer
3. Create time tracking API
4. Develop project management UI

### Migration (Week 4)
1. Deploy v2 tables to production
2. Enable dual-write mode
3. Backfill historical data
4. Validate and switch reads

### Long-term (Month 2+)
1. Monitor performance and costs
2. Optimize based on usage patterns
3. Add advanced features
4. Scale as needed

---

## Success Criteria

Migration is successful when:
- [ ] All tables created and active
- [ ] All GSIs functioning correctly
- [ ] 100% data migrated accurately
- [ ] Zero data loss incidents
- [ ] Query performance meets targets
- [ ] Cost within budget
- [ ] Zero customer-facing errors
- [ ] Team trained on new schema
- [ ] Documentation complete
- [ ] Monitoring and alerts configured

---

## Support and Resources

### Documentation Locations
- **Schema Files**: `/infrastructure/`
- **API Docs**: `/docs/api/`
- **Architecture**: `/docs/architecture/`

### Useful Commands
```bash
# List all SiteLogix tables
aws dynamodb list-tables --query 'TableNames[?contains(@, `sitelogix`)]'

# Get table status
aws dynamodb describe-table --table-name sitelogix-personnel-v2

# Check consumed capacity
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=sitelogix-personnel-v2 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 --statistics Sum
```

### Training Resources
- DynamoDB Best Practices: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html
- Access Patterns: See `access-patterns.md`
- Migration Guide: See `migration-plan.md`

---

## Appendix: Design Alternatives Considered

### Alternative 1: SQL Database (PostgreSQL/MySQL)
**Pros**: Relational model, ACID transactions, complex queries
**Cons**: Scaling challenges, higher operational overhead, cost
**Decision**: DynamoDB chosen for scalability and AWS integration

### Alternative 2: Single-Table Design (All entities in one table)
**Pros**: Ultimate flexibility, fewer tables to manage
**Cons**: Complex queries, difficult to understand, hard to migrate
**Decision**: Separate tables chosen for clarity and maintainability

### Alternative 3: On-Demand Billing
**Pros**: No capacity planning, scales automatically
**Cons**: Unpredictable costs, potentially expensive
**Decision**: Provisioned with auto-scaling for cost control

### Alternative 4: Aurora Serverless
**Pros**: SQL queries, auto-scaling, point-in-time recovery
**Cons**: Cold start latency, VPC required, higher minimum cost
**Decision**: DynamoDB chosen for lower latency and simpler architecture

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-15 | Initial schema (reports, personnel, vendors, constraints) |
| 2.0 | 2025-11-05 | Admin tables (personnel v2, projects, users, time tracking) |

---

## Approval Signatures

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Database Architect | TBD | 2025-11-05 | __________ |
| Backend Lead | TBD | __________ | __________ |
| DevOps Lead | TBD | __________ | __________ |
| Product Manager | TBD | __________ | __________ |
| CTO | TBD | __________ | __________ |

---

**Document End**
