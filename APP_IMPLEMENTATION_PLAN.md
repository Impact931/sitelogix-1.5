# SiteLogix 1.5 - Complete App Implementation Plan
## From Training Data to Production-Ready Application

**Date**: November 4, 2025
**Status**: 🚀 READY TO BUILD
**Priority**: CRITICAL - Foundation for all future features

---

## Executive Summary

Transform SiteLogix from a demo app with test data into a production-ready construction management platform with:
- 102 historical reports processed and available
- Complete authentication & authorization system
- Role-based access (Super Admin, Foreman, Worker)
- 7 foremen and 12+ projects pre-loaded
- Enhanced reporting interface with filtering
- Modular landing page for future agents (Roxy, Reba, Ranger)

**Timeline**: 3-4 days
**Complexity**: High (authentication, data extraction, UI enhancements)
**Risk**: Medium (dependent on AI extraction accuracy)

---

## User Roles & Permissions

### Super Admin (2 users)
**Users**: Jayson Rivas (CTO), Robert Trask (Owner)

**Permissions**:
- Full system access
- User management (add/edit/delete users)
- Role assignment
- Project management (create/edit/archive)
- View all reports across all projects
- System configuration
- Analytics access (all projects)
- Audit log access

### Foreman (7 users)
**Users**: Kenny, Kurt, Wes, Mike, Brian, Jim, Scott

**Permissions**:
- Create daily reports via Roxy
- View/edit own reports
- View team member reports (if assigned as manager)
- Create/edit projects (if project admin)
- Add/manage employees on their projects
- View project analytics
- Edit report data/outputs (with approval workflow)

### Worker (Future - Not in Phase 1)
**Permissions**:
- Create incident reports via Reba
- Create material tracking via Ranger
- View own reports
- Limited analytics

---

## Database Schema Updates

### New Tables

#### 1. **users** (DynamoDB)
```
PK: USER#{user_id}
SK: METADATA

Attributes:
- user_id (string, UUID)
- email (string, unique)
- password_hash (string, bcrypt)
- full_name (string)
- role (enum: super_admin, foreman, worker)
- phone (string, optional)
- assigned_projects[] (array of project_ids)
- created_at (ISO timestamp)
- updated_at (ISO timestamp)
- last_login (ISO timestamp)
- status (enum: active, inactive, suspended)
- permissions (object: {can_create_reports, can_edit_reports, can_manage_users, etc.})

GSI1: EmailIndex (email)
GSI2: RoleIndex (role + status)
```

#### 2. **projects** (DynamoDB - Enhanced)
```
PK: PROJECT#{project_id}
SK: METADATA

Attributes:
- project_id (string, canonical ID from training)
- project_name (string, canonical)
- abbreviations[] (array: ["CC", "Cortex Commons"])
- location (object: {address, city, state, zip})
- status (enum: active, on_hold, completed, archived)
- project_manager_id (user_id)
- team_members[] (array of user_ids)
- budget (number, optional)
- start_date (ISO date)
- end_date (ISO date, optional)
- created_at (ISO timestamp)
- updated_at (ISO timestamp)
- metadata (object: custom fields)

GSI1: StatusIndex (status + project_name)
GSI2: ManagerIndex (project_manager_id + status)
```

#### 3. **sessions** (DynamoDB)
```
PK: SESSION#{session_id}
SK: METADATA

Attributes:
- session_id (string, UUID)
- user_id (string)
- token (string, JWT)
- expires_at (ISO timestamp)
- created_at (ISO timestamp)
- last_activity (ISO timestamp)
- ip_address (string)
- user_agent (string)

TTL: expires_at (auto-delete after 7 days)
GSI1: UserIndex (user_id + expires_at)
```

### Enhanced Existing Tables

#### **sitelogix-reports** (Add fields)
- `created_by_user_id` (string) - Who submitted the report
- `project_id` (string) - Canonical project ID
- `extraction_confidence` (number, 0-1) - AI confidence score
- `manual_edits` (array) - Track manual corrections
- `approval_status` (enum: pending, approved, rejected)
- `approved_by` (user_id, optional)
- `approved_at` (ISO timestamp, optional)

---

## Phase 1: Data Extraction Pipeline (Day 1)

### Goal
Process 102 training transcripts through Claude AI and populate DynamoDB with structured data.

### Components

#### 1. **Extraction Service** (`backend/src/services/extractionService.ts`)

**Features**:
- Read transcript from S3
- Send to Claude AI with Roxy prompt v1.0
- Parse JSON response
- Validate extracted data
- Calculate confidence scores
- Store in DynamoDB
- Handle errors gracefully

**Roxy Prompt v1.0**:
```typescript
const ROXY_EXTRACTION_PROMPT = `
You are Roxy, an AI agent specialized in extracting structured data from construction daily reports.

TASK: Extract the following entities from the provided transcript:

REQUIRED FIELDS:
1. report_date (YYYY-MM-DD format)
2. reporter_name (first + last if available)
3. project_name (full name, not abbreviation)
4. total_hours (reporter's hours for the day)

OPTIONAL FIELDS:
5. additional_personnel[] (array of {name, hours, role})
6. work_completed[] (array of completed tasks)
7. work_in_progress[] (array of ongoing tasks)
8. issues[] (array of problems/delays/constraints)
9. vendors[] (array of {company, delivery_type, time})
10. weather_notes (if mentioned)

NORMALIZATION RULES:
- "CC" = "Cortex Commons"
- "MM" = "Mellow Mushroom" (default) or "Monsanto" (if context indicates)
- "Nash Twr 2" = "Nashville Yards Tower 2"
- "SLU Res" = "Saint Louis University Residence Hall"
- "Meharry" = "Meharry Medical College"
- "Owen glass burner" = "Owen Glassburn"
- "Bryan" = "Brian"

OUTPUT FORMAT: JSON only, no explanations

{
  "report_date": "2022-07-05",
  "reporter_name": "Kenny",
  "project_name": "Cortex Commons",
  "total_hours": 6.5,
  "additional_personnel": [
    {"name": "Scott Russell", "hours": 6.5, "role": "plumber"}
  ],
  "work_completed": ["Cored 6 inch hole in north wall"],
  "issues": ["Left early due to high temps"],
  "extraction_confidence": 0.92
}
`;
```

#### 2. **Batch Processing Script** (`process-training-transcripts.js`)

**Features**:
- Read all transcripts from S3
- Process in batches of 10 (avoid rate limits)
- Progress tracking
- Error recovery (skip failed, continue processing)
- Summary report (success rate, common errors)
- Dry-run mode for testing

**Command**:
```bash
node process-training-transcripts.js --batch-size 10 --dry-run false
```

#### 3. **Entity Normalization** (`backend/src/services/entityNormalizationService.ts`)

**Features**:
- Fuzzy match personnel names (Levenshtein distance)
- Map project abbreviations to canonical names
- Assign canonical IDs (per_001, proj_001)
- Build master entity lists
- Handle duplicates
- Confidence scoring

**Canonical Entities** (Pre-loaded from training data):

**Personnel Master List**:
```typescript
{
  per_001: { name: "Kenny", aliases: ["Ken"], role: "Superintendent" },
  per_002: { name: "Kurt", aliases: [], role: "Foreman" },
  per_003: { name: "Wes", aliases: [], role: "Foreman" },
  per_004: { name: "Mike", aliases: [], role: "Foreman" },
  per_005: { name: "Brian", aliases: ["Bryan"], role: "Foreman" },
  per_006: { name: "Jim", aliases: [], role: "Foreman" },
  per_007: { name: "Scott", aliases: [], role: "Foreman" },
  per_008: { name: "Scott Russell", aliases: ["Russell"], role: "Plumber" },
  per_009: { name: "Owen Glassburn", aliases: ["Owen glass burner"], role: "Laborer" }
}
```

**Project Master List**:
```typescript
{
  proj_001: { name: "Cortex Commons", abbrev: ["CC"] },
  proj_002: { name: "Meharry Medical College", abbrev: ["Meharry"] },
  proj_003: { name: "Nashville Yards Tower 2", abbrev: ["Nash Twr 2", "Nash Tower 2"] },
  proj_004: { name: "Mellow Mushroom", abbrev: ["MM"] },
  proj_005: { name: "Saint Louis University Residence Hall", abbrev: ["SLU Res"] },
  proj_006: { name: "Bommarito Automotive", abbrev: ["Bommarito"] },
  proj_007: { name: "Surgery Partners", abbrev: ["Sx Partners", "Six Partners"] },
  proj_008: { name: "Carpenters Hall", abbrev: ["Carpenters"] },
  proj_009: { name: "Monsanto", abbrev: [] },
  proj_010: { name: "Parkway North", abbrev: [] },
  proj_011: { name: "Samantha's House", abbrev: [] },
  proj_012: { name: "Brentwood", abbrev: [] },
  proj_013: { name: "Triad", abbrev: [] }
}
```

### Execution Plan

**Step 1**: Build extraction service (2 hours)
**Step 2**: Test on 3 sample transcripts (30 min)
**Step 3**: Process first 10 transcripts (Phase 1 baseline) (1 hour)
**Step 4**: Review extraction quality, refine prompt (1 hour)
**Step 5**: Process remaining 92 transcripts (2 hours)
**Step 6**: Data quality validation (1 hour)

**Total**: ~7-8 hours (1 full day)

---

## Phase 2: Authentication & Authorization (Day 2)

### Goal
Implement complete auth system with role-based access control.

### Components

#### 1. **Authentication Service** (`backend/src/services/authService.ts`)

**Features**:
- User registration (admin only)
- Login with email + password
- JWT token generation
- Token validation
- Password hashing (bcrypt)
- Session management
- Logout

**API Endpoints**:
```
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh-token
GET  /api/auth/me (get current user)
POST /api/auth/change-password
```

#### 2. **User Management** (`backend/src/services/userService.ts`)

**Features**:
- Create user (super admin only)
- Update user
- Delete/deactivate user
- Assign roles
- Assign projects
- List users (with filters)
- Get user by ID

**API Endpoints**:
```
GET    /api/users (list all, super admin only)
GET    /api/users/{id}
POST   /api/users (create, super admin only)
PUT    /api/users/{id}
DELETE /api/users/{id} (soft delete, super admin only)
POST   /api/users/{id}/assign-project
POST   /api/users/{id}/assign-role
```

#### 3. **Middleware** (`backend/src/middleware/auth.ts`)

**Features**:
- Authenticate request (validate JWT)
- Authorize by role (super_admin, foreman, worker)
- Authorize by resource (can user access this report?)
- Rate limiting
- CORS handling

**Usage**:
```typescript
router.get('/api/admin/users',
  authenticate,
  authorize(['super_admin']),
  listUsers
);

router.get('/api/reports/:id',
  authenticate,
  authorizeResourceAccess('report'),
  getReport
);
```

### Seed Data

#### Super Admins
```typescript
[
  {
    user_id: "admin_001",
    email: "jayson@sitelogix.com",
    full_name: "Jayson Rivas",
    role: "super_admin",
    password: "secure_password_hash"
  },
  {
    user_id: "admin_002",
    email: "robert@sitelogix.com",
    full_name: "Robert Trask",
    role: "super_admin",
    password: "secure_password_hash"
  }
]
```

#### Foremen (from training data)
```typescript
[
  { user_id: "per_001", email: "kenny@sitelogix.com", full_name: "Kenny [Last]", role: "foreman", assigned_projects: ["proj_001"] },
  { user_id: "per_002", email: "kurt@sitelogix.com", full_name: "Kurt [Last]", role: "foreman", assigned_projects: ["proj_002"] },
  { user_id: "per_003", email: "wes@sitelogix.com", full_name: "Wes [Last]", role: "foreman", assigned_projects: ["proj_004", "proj_005", "proj_006"] },
  { user_id: "per_004", email: "mike@sitelogix.com", full_name: "Mike [Last]", role: "foreman", assigned_projects: ["proj_003"] },
  { user_id: "per_005", email: "brian@sitelogix.com", full_name: "Brian [Last]", role: "foreman", assigned_projects: ["proj_003"] },
  { user_id: "per_006", email: "jim@sitelogix.com", full_name: "Jim [Last]", role: "foreman", assigned_projects: ["proj_007", "proj_010", "proj_011"] },
  { user_id: "per_007", email: "scott@sitelogix.com", full_name: "Scott [Last]", role: "foreman", assigned_projects: ["proj_009", "proj_005"] }
]
```

### Execution Plan

**Step 1**: Build auth service + middleware (3 hours)
**Step 2**: Build user management service (2 hours)
**Step 3**: Create seed data script (1 hour)
**Step 4**: Deploy backend + test APIs (1 hour)
**Step 5**: Update frontend to use auth (2 hours)

**Total**: ~9 hours (1 full day)

---

## Phase 3: Frontend UI Enhancements (Day 3)

### Goal
Build production-ready UI with landing page, user management, and enhanced reporting.

### Components

#### 1. **Landing Page** (`frontend/src/components/LandingPage.tsx`)

**Layout**:
```
+------------------------------------------+
|  SiteLogix Logo      [User Menu]         |
+------------------------------------------+
|                                          |
|     Welcome back, Jayson Rivas!          |
|                                          |
|  +------------+  +------------+  +-----+ |
|  |   ROXY     |  |   REBA     |  |RANGER|
|  |  Daily     |  | Incident   |  | Mat. ||
|  |  Report    |  |  Report    |  |Track ||
|  | [Active]   |  |[Coming Soon| |[Soon]||
|  +------------+  +------------+  +-----+ |
|                                          |
|  Recent Activity:                        |
|  - 102 reports loaded                    |
|  - 7 projects active                     |
|  - 5 reports today                       |
|                                          |
+------------------------------------------+
```

**Features**:
- Role-based card visibility
- Quick stats
- Recent activity feed
- Navigation to each agent
- User profile dropdown (settings, logout)

#### 2. **User Management** (`frontend/src/components/admin/UserManagement.tsx`)

**Features** (Super Admin Only):
- List all users (table view)
- Add new user (modal form)
- Edit user (inline or modal)
- Assign role (dropdown)
- Assign projects (multi-select)
- Deactivate/activate user
- Search/filter users

**UI**:
```
Users Management
[+ Add User]  [Search: ___]  [Filter: All Roles ▼]

| Name          | Email               | Role      | Projects    | Status | Actions |
|---------------|---------------------|-----------|-------------|--------|---------|
| Jayson Rivas  | jayson@...          | Super Admin| All        | Active | [Edit]  |
| Kenny [Last]  | kenny@...           | Foreman   | CC          | Active | [Edit]  |
| Kurt [Last]   | kurt@...            | Foreman   | Meharry     | Active | [Edit]  |
...
```

#### 3. **Enhanced Daily Reports** (`frontend/src/components/DailyReports.tsx`)

**Features**:
- Filter by project (dropdown)
- Filter by user: "My Reports", "All Reports", "By User" (dropdown)
- Filter by date range (date picker)
- Sort by date, project, reporter
- Pagination
- Export to CSV
- Bulk actions (approve multiple)

**UI**:
```
Daily Reports
[Project: All ▼] [User: All Reports ▼] [Date: Last 30 days ▼] [Search: ___]

Found 102 reports

| Date       | Project        | Reporter | Hours | Status   | Actions      |
|------------|----------------|----------|-------|----------|--------------|
| 2022-07-30 | Meharry        | Kurt     | 8.0   | Approved | [View][Edit] |
| 2022-07-29 | Cortex Commons | Kenny    | 7.0   | Approved | [View][Edit] |
...

[< Previous] Page 1 of 11 [Next >]
```

#### 4. **Project Management** (`frontend/src/components/admin/ProjectManagement.tsx`)

**Features** (Admin + Foreman):
- List all projects (card view)
- Add new project
- Edit project details
- Assign team members
- View project reports
- Project analytics (hours, costs, timeline)
- Archive project

**UI**:
```
Projects
[+ New Project]  [View: Cards ▼]  [Filter: Active ▼]

+-----------------------------+  +-----------------------------+
| Cortex Commons (CC)         |  | Meharry Medical College     |
| Location: St. Louis, MO     |  | Location: Nashville, TN     |
| Manager: Kenny              |  | Manager: Kurt               |
| Status: Active              |  | Status: Active              |
| Reports: 26                 |  | Reports: 24                 |
| [View] [Edit] [Analytics]   |  | [View] [Edit] [Analytics]   |
+-----------------------------+  +-----------------------------+
```

#### 5. **Foreman Interface** (`frontend/src/components/foreman/ForemanDashboard.tsx`)

**Features** (Foreman Role):
- My projects (assigned only)
- Create new report (Roxy)
- View/edit my reports
- Manage employees on my projects
- Project timeline view
- Team hours summary

**UI**:
```
Foreman Dashboard - Kenny

My Projects
+-----------------------------+
| Cortex Commons (CC)         |
| 26 reports | 5 team members |
| [New Report] [View All]     |
+-----------------------------+

Recent Reports
| Date       | Project | Hours | Status   | Actions |
|------------|---------|-------|----------|---------|
| Today      | CC      | 6.5   | Draft    | [Edit]  |
| Yesterday  | CC      | 8.0   | Approved | [View]  |

Team Members
- Scott Russell (Plumber) - 48 hours this week
- Owen Glassburn (Laborer) - 45 hours this week
[+ Add Team Member]
```

### Execution Plan

**Step 1**: Build landing page (2 hours)
**Step 2**: Build user management (3 hours)
**Step 3**: Enhanced daily reports (3 hours)
**Step 4**: Project management (3 hours)
**Step 5**: Foreman dashboard (2 hours)
**Step 6**: Polish & responsive design (2 hours)

**Total**: ~15 hours (2 days)

---

## Phase 4: Testing & Deployment (Day 4)

### Goal
End-to-end testing and production deployment.

### Test Scenarios

#### 1. **Authentication Flow**
- [ ] Super admin can login
- [ ] Foreman can login
- [ ] Invalid credentials rejected
- [ ] JWT token works across requests
- [ ] Logout clears session
- [ ] Unauthorized access blocked

#### 2. **User Management**
- [ ] Super admin can create users
- [ ] Super admin can edit users
- [ ] Super admin can assign roles
- [ ] Foreman cannot access user management
- [ ] User list displays correctly
- [ ] Search/filter works

#### 3. **Data Extraction**
- [ ] All 102 transcripts processed
- [ ] Data appears in DynamoDB
- [ ] Personnel normalized (no duplicates)
- [ ] Projects normalized
- [ ] Confidence scores calculated
- [ ] Error handling works

#### 4. **Reports Interface**
- [ ] Reports display with filters
- [ ] Filter by project works
- [ ] Filter by user works
- [ ] Date range filter works
- [ ] Pagination works
- [ ] Report detail view works
- [ ] Edit functionality works

#### 5. **Projects**
- [ ] Projects display correctly
- [ ] Project detail shows reports
- [ ] Foreman can create project
- [ ] Team assignment works
- [ ] Project analytics accurate

#### 6. **Landing Page**
- [ ] Role-based card visibility
- [ ] Navigation works
- [ ] Stats are accurate
- [ ] Recent activity updates

### Deployment

**Backend**:
```bash
./deploy-api-lambda.sh
```

**Frontend**:
```bash
cd frontend
npm run build
amplify publish
```

### Execution Plan

**Step 1**: Unit tests (authentication, extraction) (2 hours)
**Step 2**: Integration tests (end-to-end flows) (2 hours)
**Step 3**: Manual testing (all user stories) (2 hours)
**Step 4**: Bug fixes (2 hours)
**Step 5**: Deploy to AWS (1 hour)
**Step 6**: Production smoke tests (1 hour)

**Total**: ~10 hours (1 full day)

---

## Success Metrics

### Phase 1 (Data Extraction)
- [ ] 95%+ of 102 transcripts processed successfully
- [ ] 90%+ extraction accuracy on core fields
- [ ] All personnel deduplicated (7 unique foremen)
- [ ] All projects deduplicated (12-13 unique projects)
- [ ] Data visible in DynamoDB

### Phase 2 (Authentication)
- [ ] All API endpoints protected
- [ ] 2 super admins can login
- [ ] 7 foremen can login
- [ ] Role-based access working
- [ ] Session management stable

### Phase 3 (UI)
- [ ] Landing page functional
- [ ] User management accessible (super admin)
- [ ] Reports filterable by project/user/date
- [ ] Foreman can create/edit reports
- [ ] Project management working

### Phase 4 (Testing)
- [ ] 100% of critical paths tested
- [ ] Zero authentication bugs
- [ ] Zero data integrity issues
- [ ] <500ms API response time
- [ ] Mobile responsive

---

## Risk Mitigation

### Risk 1: Low Extraction Accuracy
**Mitigation**:
- Start with 10 sample transcripts
- Manual review and prompt refinement
- Confidence scoring to flag low-quality extractions
- Manual review queue for <80% confidence

### Risk 2: Authentication Complexity
**Mitigation**:
- Use proven libraries (bcrypt, jsonwebtoken)
- Start with simple role model
- Add complexity incrementally
- Comprehensive testing before deployment

### Risk 3: UI Performance with 102 Reports
**Mitigation**:
- Implement pagination (20 per page)
- Backend filtering (not client-side)
- Lazy loading
- Caching

### Risk 4: Time Constraints
**Mitigation**:
- Prioritize Phase 1-2 (data + auth)
- Phase 3 UI can be iterative
- MVP first, polish later
- Use UI component libraries (Tailwind, shadcn/ui)

---

## Next Immediate Steps

### Today (November 4)
1. ✅ Create this implementation plan
2. ⏳ Build extraction service
3. ⏳ Process 10 sample transcripts
4. ⏳ Review extraction quality
5. ⏳ Process all 102 transcripts

### Tomorrow (November 5)
1. ⏳ Build authentication system
2. ⏳ Build user management
3. ⏳ Seed database with users + projects
4. ⏳ Deploy backend

### Day 3 (November 6)
1. ⏳ Build landing page
2. ⏳ Build user management UI
3. ⏳ Enhance reports interface
4. ⏳ Build project management

### Day 4 (November 7)
1. ⏳ Testing
2. ⏳ Bug fixes
3. ⏳ Deployment
4. ⏳ Documentation

---

## Questions to Address

1. **Default passwords for foremen?**
   - Option A: Generate random, email to each
   - Option B: Use "SiteLogix2025!" for all, force change on first login
   - **Recommended**: Option B

2. **Project locations?**
   - Most can be inferred (Meharry = Nashville, Cortex Commons = St. Louis)
   - Need to research others (Parkway North, Samantha's House)
   - **Action**: Add "Unknown" for now, let foremen update

3. **Approval workflow for report edits?**
   - Option A: Foreman edits immediately saved
   - Option B: Edits require super admin approval
   - **Recommended**: Option A for Phase 1, Option B for Phase 2

4. **Reba and Ranger agent stubs?**
   - Option A: Show "Coming Soon" cards (no functionality)
   - Option B: Build basic forms even if they don't work yet
   - **Recommended**: Option A

---

**Status**: ✅ PLAN COMPLETE - READY TO BUILD
**Owner**: Claude Code + UI/UX Agent + Data Scientist Agent
**Priority**: CRITICAL
**Estimated Completion**: November 7, 2025
