# SiteLogix 1.5 - Agent & MCP Assignments

**Generated:** October 5, 2025
**Project:** Voice-Driven Daily Construction Reporting System
**Timeline:** 4-Day Sprint (Oct 5-9, 2025)

---

## 🎯 Project Organization Strategy

This document outlines the assignment of specialized agents and MCP tools to specific workstreams for the SiteLogix 1.5 build. All agents will work concurrently on their assigned tasks with clear handoff points.

---

## 📋 MCP Tools Available

### Active MCP Servers
1. **AWS Amplify MCP** - Infrastructure deployment and management
2. **Context7 MCP** - Project context and knowledge management
3. **Sequential Thinking MCP** - Structured problem-solving and planning
4. **ElevenLabs MCP** - Voice/speech processing integration
5. **OpenAI MCP** - AI parsing and natural language processing
6. **Brave Search MCP** - Research and documentation lookup
7. **Puppeteer MCP** - E2E testing and browser automation

### CLI Tools
- **AWS CLI** - Direct AWS resource management
- **OpenAI CLI** - API testing and validation

---

## 👥 Agent Teams & Assignments

### **TEAM 1: Infrastructure & DevOps**

#### **Agent: DevOps Engineer**
**Primary Responsibilities:**
- AWS Amplify Gen 2 project setup
- CI/CD pipeline configuration
- Infrastructure provisioning (S3, DynamoDB, Lambda, API Gateway)
- Monitoring and logging setup (CloudWatch, Sentry)
- Environment configuration (.env management)

**MCP Tools:**
- AWS Amplify MCP
- AWS CLI
- Context7 MCP (documentation)

**Deliverables:**
- [ ] Amplify project initialized
- [ ] S3 buckets created (audio-files, transcripts)
- [ ] DynamoDB tables defined (reports, personnel, vendors, constraints)
- [ ] Lambda functions scaffolded
- [ ] API Gateway configured
- [ ] CloudWatch dashboards created
- [ ] GitHub Actions CI/CD pipeline

**Day 1 Tasks:**
```bash
# Initialize AWS Amplify project
npx create-amplify@latest

# Set up S3 buckets
aws s3 mb s3://sitelogix-audio-files --region us-east-1
aws s3 mb s3://sitelogix-transcripts --region us-east-1

# Create DynamoDB tables
aws dynamodb create-table --table-name sitelogix-reports ...
aws dynamodb create-table --table-name sitelogix-personnel ...
aws dynamodb create-table --table-name sitelogix-vendors ...
aws dynamodb create-table --table-name sitelogix-constraints ...

# Deploy infrastructure
cdk deploy --all
```

---

### **TEAM 2: Backend Architecture**

#### **Agent: Backend Architect**
**Primary Responsibilities:**
- RESTful API design and documentation
- Lambda function architecture
- Data flow pipeline design
- Google Sheets API integration
- Database schema validation
- Error handling and retry logic

**MCP Tools:**
- Context7 MCP (API documentation)
- Sequential Thinking MCP (architecture planning)
- AWS Amplify MCP (deployment)

**Deliverables:**
- [ ] API endpoint specifications (OpenAPI/Swagger)
- [ ] Lambda function structure
- [ ] S3 → Lambda → Processing pipeline
- [ ] Google Sheets API client implementation
- [ ] Authentication flow (AWS Cognito)
- [ ] Error handling middleware

**Day 1-2 Tasks:**
```
API Endpoints to Design:
- POST /reports/upload - Upload audio file
- POST /process/transcribe - Trigger transcription
- POST /process/parse - Parse transcript with AI
- POST /process/submit - Submit to Google Sheets
- GET /reports/{projectId} - Get reports
- POST /personnel - Manage personnel database
- POST /vendors - Manage vendor database
```

**Day 2-3 Tasks:**
- Implement ElevenLabs STT integration
- Implement OpenAI/Claude parsing logic
- Build Google Sheets multi-sheet writer
- Create validation layer

---

### **TEAM 3: Database Design**

#### **Agent: Database Architect**
**Primary Responsibilities:**
- DynamoDB schema design with GSIs
- Personnel master database structure
- Vendor tracking database structure
- Constraint taxonomy design
- Data migration scripts
- Query optimization

**MCP Tools:**
- Context7 MCP (data dictionary)
- Sequential Thinking MCP (schema planning)

**Deliverables:**
- [ ] Complete DynamoDB table schemas
- [ ] Global Secondary Indexes (GSIs) for queries
- [ ] Personnel matching algorithm
- [ ] Vendor matching algorithm
- [ ] Constraint categorization logic
- [ ] Seed data scripts

**Day 1 Schema:**
```
reports_table:
  PK: REPORT#<project_id>#<date>
  SK: MANAGER#<manager_id>#<timestamp>
  Attributes: [manager_name, personnel_list, deliveries, constraints, etc.]
  GSI1: project_id (query by project)
  GSI2: manager_id (query by manager)

personnel_master_table:
  PK: PERSONNEL#<personnel_id>
  SK: METADATA
  Attributes: [full_name, role, active_status, projects]
  GSI1: full_name (fuzzy matching)

vendor_master_table:
  PK: VENDOR#<vendor_id>
  SK: METADATA
  Attributes: [company_name, performance_metrics]
  GSI1: company_name (fuzzy matching)

constraints_taxonomy_table:
  PK: CONSTRAINT#<constraint_id>
  SK: PROJECT#<project_id>#<date>
  Attributes: [category, description, duration, cost_impact]
  GSI1: category (analytics)
```

---

### **TEAM 4: Frontend Development**

#### **Agent: Frontend Developer**
**Primary Responsibilities:**
- React PWA application structure
- Admin/Login interface
- Voice recording interface
- Confirmation/Review UI
- Offline storage (IndexedDB)
- Service Worker for PWA

**MCP Tools:**
- Puppeteer MCP (E2E testing)
- Context7 MCP (component documentation)

**Deliverables:**
- [ ] React app with TypeScript
- [ ] PWA configuration (manifest, service worker)
- [ ] Admin interface (manager/project selection)
- [ ] Voice recording component
- [ ] Visual checklist component
- [ ] Confirmation screen with editing
- [ ] Offline sync manager

**Day 1 Components:**
```
src/
├── components/
│   ├── Admin/
│   │   ├── LoginScreen.tsx
│   │   ├── ProjectSelector.tsx
│   │   └── ManagerSelector.tsx
│   ├── VoiceRecording/
│   │   ├── RecordingInterface.tsx
│   │   ├── VisualChecklist.tsx
│   │   ├── AudioWaveform.tsx
│   │   └── RecordButton.tsx
│   ├── Confirmation/
│   │   ├── ReviewScreen.tsx
│   │   ├── EditableDataFields.tsx
│   │   └── SubmitConfirmation.tsx
├── services/
│   ├── audioRecorder.ts
│   ├── offlineStorage.ts
│   ├── apiClient.ts
│   └── syncManager.ts
├── hooks/
│   ├── useAudioRecording.ts
│   ├── useOfflineSync.ts
│   └── useFormValidation.ts
└── App.tsx
```

**Day 2-3 Features:**
- MediaRecorder API integration
- IndexedDB for offline reports
- Background sync when online
- Audio compression before upload

---

### **TEAM 5: UI/UX Design**

#### **Agent: UI/UX Designer**
**Primary Responsibilities:**
- Mobile-first responsive design
- Visual checklist design
- Recording interface UX
- Accessibility (WCAG compliance)
- Component styling (Tailwind CSS)
- Loading states and animations

**MCP Tools:**
- Puppeteer MCP (visual regression testing)
- Context7 MCP (design system documentation)

**Deliverables:**
- [ ] Design system (colors, typography, spacing)
- [ ] Mobile-optimized layouts
- [ ] Recording interface mockups
- [ ] Confirmation screen design
- [ ] Error state designs
- [ ] Accessibility audit

**Day 1 Design System:**
```css
/* Tailwind Config */
theme: {
  colors: {
    primary: '#1E40AF', // Construction blue
    secondary: '#F59E0B', // Safety yellow
    success: '#10B981',
    error: '#EF4444',
    background: '#F3F4F6',
    surface: '#FFFFFF'
  },
  fontFamily: {
    sans: ['Inter', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace']
  }
}
```

---

### **TEAM 6: AI & Voice Processing**

#### **Agent: Data Scientist**
**Primary Responsibilities:**
- ElevenLabs API integration
- OpenAI/Claude parsing prompts
- Data extraction algorithms
- Personnel fuzzy matching
- Vendor fuzzy matching
- Constraint categorization ML

**MCP Tools:**
- ElevenLabs MCP
- OpenAI MCP
- Sequential Thinking MCP (algorithm design)
- Context7 MCP (prompt library)

**Deliverables:**
- [ ] ElevenLabs Speech-to-Text integration
- [ ] AI parsing prompts (structured data extraction)
- [ ] Personnel name matching (fuzzy logic)
- [ ] Vendor name matching (fuzzy logic)
- [ ] Constraint categorization (NLP)
- [ ] Validation and confidence scoring

**Day 2 AI Prompts:**
```
System Prompt for Data Extraction:
"You are a construction reporting data extraction specialist.
Extract the following structured data from the voice transcript:

REQUIRED FIELDS:
- site_arrival_time (HH:MM format)
- site_departure_time (HH:MM format)
- total_personnel_count (number)
- personnel_list (array of names)
- team_assignments (array of {team, activity, personnel})
- weather_conditions (string)
- deliveries (array of {vendor, items, time})
- constraints (array of {description, duration, category})
- safety_incidents (array of {type, description})

Return JSON only, no explanations."
```

**Day 3 Fuzzy Matching:**
```python
# Personnel fuzzy matching algorithm
from fuzzywuzzy import fuzz

def match_personnel(spoken_name, database):
    """
    Fuzzy match spoken name against personnel database
    Returns best match with confidence score
    """
    matches = []
    for person in database:
        score = fuzz.ratio(spoken_name.lower(), person['full_name'].lower())
        if score > 80:  # 80% confidence threshold
            matches.append({'person': person, 'confidence': score})

    return sorted(matches, key=lambda x: x['confidence'], reverse=True)
```

---

### **TEAM 7: Security & Compliance**

#### **Agent: Security Auditor**
**Primary Responsibilities:**
- AWS IAM roles and policies
- API security (rate limiting, auth)
- Data encryption (at rest and in transit)
- OSHA compliance validation
- Audio file security
- PII protection

**MCP Tools:**
- AWS CLI (IAM management)
- Context7 MCP (security documentation)

**Deliverables:**
- [ ] IAM roles for Lambda functions
- [ ] S3 bucket encryption policies
- [ ] DynamoDB encryption configuration
- [ ] API Gateway authentication
- [ ] CORS configuration
- [ ] Security audit report

**Day 1 Security Setup:**
```bash
# Create IAM role for Lambda
aws iam create-role --role-name SiteLogixLambdaRole ...

# S3 bucket encryption
aws s3api put-bucket-encryption \
  --bucket sitelogix-audio-files \
  --server-side-encryption-configuration ...

# DynamoDB encryption
aws dynamodb update-table \
  --table-name sitelogix-reports \
  --sse-specification Enabled=true
```

---

### **TEAM 8: Integration & Testing**

#### **Agent: Code Reviewer**
**Primary Responsibilities:**
- Code quality review
- Integration testing
- E2E test automation
- Performance testing
- Bug triage and fixes

**MCP Tools:**
- Puppeteer MCP (E2E testing)
- Sequential Thinking MCP (test planning)

**Deliverables:**
- [ ] Unit test suites
- [ ] Integration test suites
- [ ] E2E test automation (Puppeteer)
- [ ] Performance benchmarks
- [ ] Bug tracking and resolution

**Day 3-4 Testing:**
```javascript
// E2E Test with Puppeteer
describe('Voice Report Submission Flow', () => {
  it('should complete full report submission', async () => {
    await page.goto('https://app.sitelogix.com');

    // Login and select project
    await page.select('#manager', 'John Smith');
    await page.select('#project', 'Downtown Tower');

    // Record voice report
    await page.click('#record-button');
    await page.waitForTimeout(5000); // 5 second recording
    await page.click('#stop-button');

    // Wait for processing
    await page.waitForSelector('#confirmation-screen');

    // Verify parsed data
    const personnelCount = await page.$eval('#personnel-count', el => el.textContent);
    expect(personnelCount).toBe('12');

    // Submit report
    await page.click('#submit-button');

    // Verify success
    await page.waitForSelector('#success-message');
  });
});
```

---

### **TEAM 9: Documentation & Training**

#### **Agent: Business Analyst**
**Primary Responsibilities:**
- User training materials
- API documentation
- System architecture documentation
- Troubleshooting guides
- Success metrics tracking

**MCP Tools:**
- Context7 MCP (knowledge management)
- Brave Search MCP (research)

**Deliverables:**
- [ ] User training guide (site managers)
- [ ] Video tutorial scripts
- [ ] Quick reference card
- [ ] API reference documentation
- [ ] System architecture diagrams
- [ ] Troubleshooting runbook

**Day 4 Training Materials:**
```
USER TRAINING GUIDE

## Getting Started (5 minutes)
1. Open app on mobile device
2. Select your name and project
3. Tap "Start Daily Report"

## Recording Your Report (3-5 minutes)
Follow the visual checklist:
✓ Arrival/departure times
✓ Personnel count and names
✓ Team activities
✓ Weather conditions
✓ Deliveries
✓ Any delays or issues

Speak naturally - the AI will extract the data.

## Review and Submit
1. Check the parsed information
2. Edit any incorrect details
3. Tap "Submit Report"
4. Confirmation sent to your email
```

---

### **TEAM 10: Product Management**

#### **Agent: Product Strategist**
**Primary Responsibilities:**
- Feature prioritization
- Sprint planning
- Stakeholder communication
- Success metrics definition
- Post-launch roadmap

**MCP Tools:**
- Context7 MCP (product requirements)
- Sequential Thinking MCP (strategy planning)

**Deliverables:**
- [ ] Sprint backlog prioritization
- [ ] Daily standup agendas
- [ ] Stakeholder communication plan
- [ ] Success criteria validation
- [ ] V2.0 roadmap

---

## 🔄 Work Streams & Dependencies

### **Stream 1: Foundation (Day 1)**
**Parallel Execution:**
- DevOps Engineer → AWS infrastructure
- Database Architect → Schema design
- Frontend Developer → React app scaffold
- Backend Architect → API design

**Handoff:** Infrastructure ready for backend deployment

---

### **Stream 2: Core Features (Day 2)**
**Parallel Execution:**
- Backend Architect → Lambda functions + Google Sheets
- Frontend Developer → Voice recording UI
- Data Scientist → ElevenLabs + AI parsing
- UI/UX Designer → Component styling

**Handoff:** Voice-to-text pipeline functional

---

### **Stream 3: Integration (Day 3)**
**Parallel Execution:**
- Backend Architect → Personnel/vendor matching
- Frontend Developer → Confirmation UI + offline sync
- Data Scientist → Fuzzy matching algorithms
- Code Reviewer → Integration testing

**Handoff:** End-to-end workflow complete

---

### **Stream 4: Polish & Launch (Day 4)**
**Parallel Execution:**
- Code Reviewer → E2E testing + bug fixes
- Security Auditor → Security audit
- DevOps Engineer → Production deployment
- Business Analyst → Training materials
- Product Strategist → Launch coordination

**Handoff:** Production launch + user training

---

## 📊 Daily Stand-up Structure

### Day 1 (Oct 5) - Foundation Sprint
**9:00 AM Stand-up:**
- DevOps: Infrastructure status
- Database: Schema review
- Frontend: App structure
- Backend: API design

**5:00 PM Review:**
- Demo: Basic login + file upload working
- Blockers: Address any AWS/config issues

---

### Day 2 (Oct 6) - Voice Processing Sprint
**9:00 AM Stand-up:**
- Backend: Google Sheets integration
- Frontend: Voice recording UI
- Data Scientist: ElevenLabs progress
- UI/UX: Design system

**5:00 PM Review:**
- Demo: Voice recording → S3 → Transcription
- Blockers: API rate limits, audio quality

---

### Day 3 (Oct 7) - Validation Sprint
**9:00 AM Stand-up:**
- Backend: Personnel/vendor matching
- Frontend: Confirmation UI
- Data Scientist: Fuzzy matching
- Code Reviewer: Test coverage

**5:00 PM Review:**
- Demo: Full voice-to-sheet workflow
- Blockers: Matching accuracy, edge cases

---

### Day 4 (Oct 8-9) - Launch Sprint
**9:00 AM Stand-up:**
- Code Reviewer: Critical bugs
- DevOps: Deployment readiness
- Business Analyst: Training prep
- Security: Final audit

**5:00 PM Review:**
- Demo: Production deployment
- Training: Site manager onboarding
- Launch: Go-live announcement

---

## 🎯 Success Criteria by Team

### Infrastructure (DevOps Engineer)
- ✅ All AWS resources operational
- ✅ CI/CD pipeline deploying successfully
- ✅ Monitoring dashboards showing data
- ✅ Zero critical infrastructure issues

### Backend (Backend Architect)
- ✅ All API endpoints responding
- ✅ Google Sheets population <30 seconds
- ✅ Error rate <1%
- ✅ 100% uptime during testing

### Database (Database Architect)
- ✅ All tables created with GSIs
- ✅ Query latency <100ms
- ✅ Personnel matching >95% accurate
- ✅ Vendor matching >95% accurate

### Frontend (Frontend Developer + UI/UX Designer)
- ✅ PWA installable on mobile
- ✅ Offline mode working
- ✅ Voice recording UI responsive
- ✅ WCAG accessibility standards met

### AI Processing (Data Scientist)
- ✅ Voice-to-text accuracy >90%
- ✅ Data extraction accuracy >95%
- ✅ Processing time <2 minutes
- ✅ Confidence scoring implemented

### Security (Security Auditor)
- ✅ All data encrypted
- ✅ IAM roles least-privilege
- ✅ Security audit passed
- ✅ No critical vulnerabilities

### Testing (Code Reviewer)
- ✅ 80%+ code coverage
- ✅ All E2E tests passing
- ✅ Performance benchmarks met
- ✅ Zero P0/P1 bugs

### Documentation (Business Analyst)
- ✅ User guide complete
- ✅ API docs published
- ✅ Training materials ready
- ✅ Troubleshooting guide available

---

## 🚀 Launch Readiness Checklist

### Technical Readiness
- [ ] All agents completed deliverables
- [ ] E2E tests passing
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Production deployment successful

### User Readiness
- [ ] Training materials complete
- [ ] 2-3 pilot users trained
- [ ] Feedback incorporated
- [ ] Support process established

### Business Readiness
- [ ] Success metrics defined
- [ ] Monitoring dashboards live
- [ ] Escalation process documented
- [ ] Launch communication sent

---

## 📞 Communication Channels

### Agent Coordination
- **Slack Channel:** #sitelogix-build
- **Daily Standups:** 9:00 AM ET
- **Demo Sessions:** 5:00 PM ET
- **Blockers:** Tag @lead immediately

### Stakeholder Updates
- **Daily Summary:** Email to jayson@impactconsulting931.com
- **Critical Issues:** Immediate Slack notification
- **Weekly Review:** Friday 3:00 PM ET

---

**Last Updated:** October 5, 2025
**Next Review:** Daily at 9:00 AM ET
**Project Lead:** Impact Consulting
