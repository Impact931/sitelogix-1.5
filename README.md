# SiteLogix 1.5 - Voice-Driven Daily Construction Reporting

**Version:** 1.5
**Launch Date:** October 9, 2025
**Status:** 🚧 In Development

---

## 📋 Project Overview

Transform manual construction daily reporting into an efficient, voice-driven system that ensures 100% compliance, reduces reporting time by 90%, and builds a foundation for advanced construction analytics and OSHA compliance.

### Key Objectives
- ✅ **Compliance:** Ensure timely daily reporting across all construction sites (7 PM deadline)
- ✅ **Efficiency:** Reduce reporting time from 30+ minutes to 3-5 minutes
- ✅ **Data Quality:** Capture comprehensive, structured data for management decision-making
- ✅ **Scalability:** Support multiple concurrent projects and site managers

### Success Metrics
- 100% daily report submission compliance
- <5 minute average report completion time
- Zero data entry errors through voice validation
- 95% user adoption rate across 6 site managers

---

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- React 18+ with TypeScript
- Progressive Web App (PWA) with Workbox
- Tailwind CSS for styling
- React Query for state management

**Backend:**
- AWS Amplify Gen 2
- AWS Lambda (Node.js 18+)
- AWS API Gateway (REST + WebSocket)

**Storage:**
- AWS S3 (audio files, transcripts)
- DynamoDB (structured data)
- Google Sheets API v4 (live reporting)

**AI & Voice:**
- ElevenLabs API (Speech-to-Text)
- OpenAI GPT-4o / Claude 3.5 Sonnet (Data parsing)
- ElevenLabs Conversational AI

---

## 📁 Project Structure

```
sitelogix-1.5/
├── frontend/                 # React PWA application
│   ├── public/
│   └── src/
│       ├── components/       # React components
│       │   ├── Admin/        # Login and project selection
│       │   ├── VoiceRecording/ # Voice recording interface
│       │   └── Confirmation/  # Review and confirmation
│       ├── services/         # API clients and services
│       ├── hooks/            # Custom React hooks
│       ├── types/            # TypeScript types
│       └── utils/            # Utility functions
│
├── backend/                  # AWS Lambda functions
│   ├── src/
│   │   ├── functions/        # Lambda handlers
│   │   ├── services/         # Business logic
│   │   ├── utils/            # Shared utilities
│   │   └── types/            # TypeScript types
│   └── tests/                # Backend tests
│
├── infrastructure/           # IaC and deployment
│   ├── cdk/                  # AWS CDK stacks
│   ├── terraform/            # Terraform configs (alternative)
│   └── scripts/              # Deployment scripts
│
├── docs/                     # Documentation
│   ├── api/                  # API documentation
│   ├── user-guide/           # End-user guides
│   └── architecture/         # Architecture diagrams
│
├── tests/                    # E2E and integration tests
│   ├── e2e/                  # Puppeteer tests
│   └── integration/          # Integration tests
│
├── Agents/                   # AI Agent definitions
├── .env                      # Environment variables
├── BUILD_PLAN.md             # Detailed build plan
├── AGENT_ASSIGNMENTS.md      # Agent team assignments
└── SiteLogix-1-5.md          # Product Requirements Document (PRD)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- AWS CLI configured
- AWS Amplify CLI: `npm install -g @aws-amplify/cli`

### Environment Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Impact931/sitelogix-1.5.git
   cd sitelogix-1.5
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Install dependencies:**
   ```bash
   # Frontend
   cd frontend
   npm install

   # Backend
   cd ../backend
   npm install
   ```

4. **Deploy infrastructure:**
   ```bash
   # Initialize Amplify
   amplify init

   # Deploy backend
   amplify push

   # Deploy frontend
   cd frontend
   npm run build
   amplify publish
   ```

---

## 📖 Documentation

- **[Build Plan](./BUILD_PLAN.md)** - Detailed 4-day implementation plan
- **[Agent Assignments](./AGENT_ASSIGNMENTS.md)** - Team and agent responsibilities
- **[PRD](./SiteLogix-1-5.md)** - Product Requirements Document
- **[API Documentation](./docs/api/)** - API endpoint specifications
- **[User Guide](./docs/user-guide/)** - End-user training materials

---

## 🔑 Key Features

### 1. Voice-First Interface
- Natural speech recognition with ElevenLabs integration
- Single-session recording with visual checklist
- AI-driven data extraction and validation

### 2. Offline Capability
- Local storage with automatic sync when connected
- 7-day offline storage capacity
- Background sync queue management

### 3. Multi-Project Support
- Separate data streams for concurrent construction projects
- Project-specific Google Sheets workbooks
- Per-project personnel and vendor databases

### 4. Intelligent Data Processing
- AI parsing with OpenAI/Claude
- Personnel and vendor fuzzy matching
- Constraint taxonomy categorization
- Validation and confidence scoring

### 5. Google Sheets Integration
- Real-time data population
- Multi-sheet workbook structure
- Template preservation and formatting

---

## 🧪 Testing

### Unit Tests
```bash
cd backend
npm test
```

### Integration Tests
```bash
cd tests/integration
npm test
```

### E2E Tests
```bash
cd tests/e2e
npm run test:e2e
```

---

## 📊 Monitoring

### CloudWatch Dashboards
- API request metrics
- Lambda execution times
- DynamoDB performance
- Error rates and alerts

### Sentry Error Tracking
- Real-time error monitoring
- Stack trace analysis
- Performance monitoring

---

## 🔒 Security

- **Authentication:** AWS Cognito with MFA support
- **Data Encryption:** TLS 1.3 in transit, AES-256 at rest
- **API Security:** Rate limiting, CORS, API key rotation
- **Compliance:** OSHA reporting standards

---

## 📅 Development Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| **Phase 1:** Infrastructure | Day 1 (Oct 5) | 🚧 In Progress |
| **Phase 2:** Voice Processing | Day 2 (Oct 6) | ⏳ Pending |
| **Phase 3:** Validation & UX | Day 3 (Oct 7) | ⏳ Pending |
| **Phase 4:** Production & Training | Day 4 (Oct 8-9) | ⏳ Pending |

---

## 👥 Team

### Development Teams
- **Infrastructure & DevOps:** AWS setup, CI/CD, monitoring
- **Backend Architecture:** API design, Lambda functions, Google Sheets
- **Database Design:** DynamoDB schemas, matching algorithms
- **Frontend Development:** React PWA, voice UI, offline sync
- **UI/UX Design:** Mobile-first design, accessibility
- **AI & Voice Processing:** ElevenLabs, OpenAI integration, parsing
- **Security & Compliance:** IAM, encryption, OSHA standards
- **Testing & QA:** Unit, integration, E2E tests
- **Documentation:** User guides, API docs, training materials
- **Product Management:** Sprint planning, stakeholder communication

---

## 🐛 Issue Tracking

Report issues via:
- **GitHub Issues:** [Create Issue](https://github.com/Impact931/sitelogix-1.5/issues)
- **Email:** jayson@impactconsulting931.com
- **Slack:** #sitelogix-support

---

## 📝 License

Proprietary - Impact Consulting © 2025

---

## 🙏 Acknowledgments

- **Product Owner:** Impact Consulting
- **Technical Lead:** Jayson Rivas
- **Development Team:** Multi-agent AI development system
- **Voice Technology:** ElevenLabs
- **AI Parsing:** OpenAI / Anthropic Claude

---

**For detailed build instructions, see [BUILD_PLAN.md](./BUILD_PLAN.md)**
**For agent assignments, see [AGENT_ASSIGNMENTS.md](./AGENT_ASSIGNMENTS.md)**
