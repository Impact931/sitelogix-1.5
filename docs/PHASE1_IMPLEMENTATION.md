# SiteLogix Analytics - Phase 1 Implementation Plan
## Foundation & Daily Report Compliance System

**Start Date:** November 5, 2025
**Target Completion:** 2 Weeks
**Status:** Ready to Begin

---

## Implementation Decisions (Confirmed)

### AI Provider Strategy
- **Primary:** OpenAI GPT-4o for complex reasoning, financial impact, critical analysis
- **Secondary:** OpenAI o1 for advanced multi-step reasoning when needed
- **Fallback:** AWS Bedrock Claude 3.5 for high-volume batch processing
- **Utility:** AWS Comprehend for basic NER and sentiment

### Processing Model
- **Beta Phase (Now):** Real-time processing after each report submission
- **Production Phase:** 4x daily scheduled batch processing (6AM, 12PM, 4PM, 10PM CST)
- **Transition Plan:** Build with both modes, toggle via environment variable

### Historical Analysis Windows
- 30-day rolling window
- 60-day rolling window
- 90-day rolling window
- Year-to-Date (YTD)
- By Project (with same 30/60/90/YTD breakdowns)

### Alert System
- **Phase 1:** In-app notifications only
- **Critical Events:** Display in notification panel (no email/SMS yet)
- **Daily Report Deadlines:** Email + in-app notifications (REQUIRED)
- **Future:** SMS integration for critical events

### Budget & Monitoring
- Open budget for beta testing
- Daily spend monitoring dashboard
- Cost alerts at $50/day threshold
- Future: Per-user licensing model

---

## New Critical Requirements

### 1. Daily Report Deadline System

**Business Rule:**
- Daily reports MUST be filed by **6:00 PM CST** each day
- Grace period: 15 minutes (final deadline 6:15 PM CST)

**Notification Flow:**
```
5:00 PM CST → In-app reminder: "Daily report due in 1 hour"
6:00 PM CST → Check if report filed
             ├─ YES → Mark compliance, clear reminder
             └─ NO  → Send email to user: "Daily report overdue"
                      Show in-app urgent notification

6:15 PM CST → Final check
             ├─ YES → Mark late but filed
             └─ NO  → Send email to supervisor: "User X failed to file report for [date]"
                      Log compliance violation
```

**Technical Implementation:**
- AWS EventBridge cron rule: `cron(0 17,18 * * ? *)` (5PM and 6PM CST)
- Lambda function: `daily-report-compliance-checker`
- DynamoDB table: `sitelogix-compliance-tracking`
- SES for email notifications

### 2. Real-Time Clock Display

**Requirements:**
- Display current time in CST prominently in app header
- Show countdown to daily report deadline (when < 2 hours)
- Visual urgency indicators:
  - Green: > 2 hours remaining
  - Yellow: 1-2 hours remaining
  - Red: < 1 hour remaining
  - Flashing Red: < 15 minutes

**UI Location:**
```
┌─────────────────────────────────────────────────────┐
│  SiteLogix              🕐 4:23 PM CST              │
│                         ⏰ Report due in 1h 37m     │
└─────────────────────────────────────────────────────┘
```

### 3. User/Employee Onboarding System

**Admin Functions Needed:**
- Create new user accounts
- Assign users to projects
- Set user roles (Site Manager, Foreman, Supervisor, Admin)
- Configure notification preferences
- Set daily report requirements (some users may be exempt)
- Deactivate/reactivate users

**UI Flow:**
```
Admin Dashboard
  ├─ Users Management
  │   ├─ Add New User
  │   ├─ Edit User
  │   ├─ Deactivate User
  │   └─ View User Activity
  ├─ Project Assignments
  └─ Notification Settings
```

---

## Phase 1 Deliverables

### Week 1: Core Analytics Foundation

#### Day 1-2: Setup & Infrastructure
- [x] OpenAI API integration
- [ ] AWS Bedrock configuration
- [ ] Create DynamoDB analytics tables
- [ ] Set up EventBridge schedules
- [ ] Configure AWS SES for email notifications

#### Day 3-4: Hours Calculator Agent
- [ ] Build personnel hours extraction logic
- [ ] OpenAI GPT-4o integration for hour inference
- [ ] Overtime calculation engine (1.5x/2.0x rules)
- [ ] Weekly aggregation logic
- [ ] Cost calculation with labor rates
- [ ] API endpoint: `POST /api/analytics/calculate-hours`

#### Day 5: Vendor Performance Tracking
- [ ] Vendor delivery tracking system
- [ ] Performance scoring algorithm (0-100)
- [ ] On-time vs late delivery metrics
- [ ] Trend analysis (improving/declining/stable)
- [ ] Risk level classification
- [ ] API endpoint: `GET /api/analytics/vendor-performance`

### Week 2: Daily Report Compliance & Dashboard

#### Day 6-7: Critical Event Detection
- [ ] Keyword-based initial screening
- [ ] OpenAI confirmation analysis
- [ ] Severity classification (1-10)
- [ ] In-app notification system
- [ ] Event logging and tracking
- [ ] API endpoint: `GET /api/analytics/critical-events`

#### Day 8-9: Daily Report Deadline System
- [ ] Compliance tracking table
- [ ] EventBridge cron jobs (5PM, 6PM CST)
- [ ] Lambda compliance checker
- [ ] Email notification templates
- [ ] Supervisor escalation logic
- [ ] API endpoint: `GET /api/analytics/compliance-status`

#### Day 10-11: Real-Time Clock & Notifications
- [ ] Header clock component (CST)
- [ ] Deadline countdown timer
- [ ] Visual urgency indicators
- [ ] In-app notification panel
- [ ] Browser notification permissions
- [ ] Notification history

#### Day 12-14: Analytics Dashboard V1
- [ ] KPI cards (hours, issues, compliance)
- [ ] Hours by project chart
- [ ] Vendor performance matrix
- [ ] Critical events feed
- [ ] Compliance calendar view
- [ ] Daily report status indicator

---

## Technical Specifications

### 1. Daily Report Compliance System

#### DynamoDB Table: `sitelogix-compliance-tracking`

```typescript
interface ComplianceRecord {
  PK: string;  // USER#{user_id}
  SK: string;  // DATE#{YYYY-MM-DD}

  user_id: string;
  user_name: string;
  project_id: string;
  report_date: string;          // YYYY-MM-DD

  // Status tracking
  report_filed: boolean;
  report_id?: string;
  filed_at?: string;            // ISO timestamp
  filed_late: boolean;

  // Notification tracking
  reminder_sent_5pm: boolean;
  overdue_notification_sent: boolean;
  supervisor_escalation_sent: boolean;

  // Timing
  deadline: string;             // ISO timestamp (6:00 PM CST)
  grace_deadline: string;       // ISO timestamp (6:15 PM CST)

  // Compliance metrics
  compliance_status: 'on_time' | 'late' | 'missed' | 'exempt';
  minutes_late?: number;
}

// Example record
{
  PK: 'USER#user_001',
  SK: 'DATE#2025-11-05',
  user_id: 'user_001',
  user_name: 'Scott Russell',
  project_id: 'project_001',
  report_date: '2025-11-05',
  report_filed: true,
  report_id: 'report_abc123',
  filed_at: '2025-11-05T17:45:00Z',
  filed_late: false,
  reminder_sent_5pm: true,
  overdue_notification_sent: false,
  supervisor_escalation_sent: false,
  deadline: '2025-11-06T00:00:00Z',      // 6:00 PM CST = midnight UTC
  grace_deadline: '2025-11-06T00:15:00Z', // 6:15 PM CST
  compliance_status: 'on_time',
  minutes_late: 0
}
```

#### Lambda Function: `daily-report-compliance-checker.ts`

```typescript
import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export const handler = async (event) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const hour = now.getHours(); // UTC

  // Convert to CST (UTC-6)
  const cstHour = (hour - 6 + 24) % 24;

  if (cstHour === 17) {
    // 5:00 PM CST - Send reminders
    await sendReminders(today);
  } else if (cstHour === 18) {
    // 6:00 PM CST - Check compliance
    await checkCompliance(today);
  }
};

async function sendReminders(date: string) {
  // Get all users who haven't filed today's report
  const users = await getUsersWithoutReport(date);

  for (const user of users) {
    // Send in-app notification
    await sendInAppNotification(user.user_id, {
      type: 'reminder',
      title: 'Daily Report Reminder',
      message: 'Your daily report is due in 1 hour (6:00 PM CST)',
      urgency: 'medium',
      action_url: '/roxy'
    });

    // Update compliance tracking
    await updateComplianceRecord(user.user_id, date, {
      reminder_sent_5pm: true
    });
  }
}

async function checkCompliance(date: string) {
  const users = await getUsersWithoutReport(date);

  for (const user of users) {
    // Send overdue email to user
    await sendEmail({
      to: user.email,
      subject: '⚠️ Daily Report Overdue - Action Required',
      body: `
        <h2>Daily Report Overdue</h2>
        <p>Hi ${user.name},</p>
        <p>Your daily construction report for <strong>${date}</strong> was not received by the 6:00 PM CST deadline.</p>
        <p><strong>You have until 6:15 PM CST to submit your report.</strong></p>
        <p>After 6:15 PM, this will be escalated to your supervisor.</p>
        <p><a href="${process.env.APP_URL}/roxy">Submit Report Now</a></p>
      `
    });

    // In-app urgent notification
    await sendInAppNotification(user.user_id, {
      type: 'urgent',
      title: '⚠️ Daily Report OVERDUE',
      message: 'Submit your report immediately to avoid supervisor escalation',
      urgency: 'high',
      action_url: '/roxy'
    });

    // Update tracking
    await updateComplianceRecord(user.user_id, date, {
      overdue_notification_sent: true
    });

    // Schedule grace period check (15 minutes)
    await scheduleGracePeriodCheck(user, date);
  }
}

async function checkGracePeriod(userId: string, date: string) {
  const record = await getComplianceRecord(userId, date);

  if (!record.report_filed) {
    // Still not filed - escalate to supervisor
    const supervisor = await getSupervisorForUser(userId);

    await sendEmail({
      to: supervisor.email,
      subject: `🚨 Missed Report - ${record.user_name} - ${date}`,
      body: `
        <h2>Daily Report Compliance Violation</h2>
        <p>Employee: <strong>${record.user_name}</strong></p>
        <p>Project: <strong>${record.project_name}</strong></p>
        <p>Date: <strong>${date}</strong></p>
        <p>Status: <strong>Report Not Filed</strong></p>
        <p>The daily report was not submitted by the 6:15 PM CST final deadline.</p>
        <p>Please follow up with ${record.user_name}.</p>
      `
    });

    // Update tracking
    await updateComplianceRecord(userId, date, {
      supervisor_escalation_sent: true,
      compliance_status: 'missed'
    });

    // Log violation
    await logComplianceViolation(userId, date);
  }
}
```

#### EventBridge Schedule Rules

```typescript
// Reminder at 5:00 PM CST (11:00 PM UTC)
{
  Name: 'daily-report-reminder',
  ScheduleExpression: 'cron(0 23 * * ? *)',
  Target: {
    Arn: 'arn:aws:lambda:...:function:daily-report-compliance-checker',
    Input: JSON.stringify({ action: 'send_reminders' })
  }
}

// Compliance check at 6:00 PM CST (12:00 AM UTC next day)
{
  Name: 'daily-report-compliance-check',
  ScheduleExpression: 'cron(0 0 * * ? *)',
  Target: {
    Arn: 'arn:aws:lambda:...:function:daily-report-compliance-checker',
    Input: JSON.stringify({ action: 'check_compliance' })
  }
}

// Grace period check at 6:15 PM CST (12:15 AM UTC next day)
{
  Name: 'daily-report-grace-period',
  ScheduleExpression: 'cron(15 0 * * ? *)',
  Target: {
    Arn: 'arn:aws:lambda:...:function:daily-report-compliance-checker',
    Input: JSON.stringify({ action: 'check_grace_period' })
  }
}
```

### 2. Real-Time Clock Component

```typescript
// frontend/src/components/DeadlineClock.tsx

import { useState, useEffect } from 'react';

interface DeadlineClockProps {
  userId: string;
  todayReportFiled: boolean;
}

export function DeadlineClock({ userId, todayReportFiled }: DeadlineClockProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeUntilDeadline, setTimeUntilDeadline] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      // Calculate deadline (6:00 PM CST today)
      const deadline = new Date(now);
      deadline.setHours(18, 0, 0, 0); // 6:00 PM CST

      const msUntilDeadline = deadline.getTime() - now.getTime();
      setTimeUntilDeadline(msUntilDeadline);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago',
      timeZoneName: 'short'
    });
  };

  const formatCountdown = (ms: number) => {
    if (ms < 0) return 'OVERDUE';

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  const getUrgencyLevel = (ms: number): 'safe' | 'warning' | 'urgent' | 'overdue' => {
    if (ms < 0) return 'overdue';
    if (ms < 15 * 60 * 1000) return 'urgent';    // < 15 min
    if (ms < 60 * 60 * 1000) return 'urgent';    // < 1 hour
    if (ms < 2 * 60 * 60 * 1000) return 'warning'; // < 2 hours
    return 'safe';
  };

  // Don't show countdown if report already filed
  if (todayReportFiled) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="text-white">{formatTime(currentTime)}</span>
        <span className="text-green-400 font-semibold">Report Filed</span>
      </div>
    );
  }

  const urgency = getUrgencyLevel(timeUntilDeadline);
  const urgencyColors = {
    safe: 'text-green-400',
    warning: 'text-yellow-400',
    urgent: 'text-red-400',
    overdue: 'text-red-500 animate-pulse'
  };

  return (
    <div className="flex items-center space-x-3 text-sm">
      {/* Current Time */}
      <div className="flex items-center space-x-1">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-white font-medium">{formatTime(currentTime)}</span>
      </div>

      {/* Deadline Countdown */}
      <div className={`flex items-center space-x-1 ${urgencyColors[urgency]}`}>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        <span className="font-bold">
          {urgency === 'overdue' ? 'REPORT OVERDUE' : `Due in ${formatCountdown(timeUntilDeadline)}`}
        </span>
      </div>
    </div>
  );
}
```

### 3. User Management System

#### API Endpoints

```typescript
// User CRUD operations
POST   /api/admin/users              // Create new user
GET    /api/admin/users              // List all users
GET    /api/admin/users/:id          // Get user details
PUT    /api/admin/users/:id          // Update user
DELETE /api/admin/users/:id          // Deactivate user

// Project assignments
POST   /api/admin/users/:id/projects // Assign user to project
DELETE /api/admin/users/:id/projects/:projectId // Remove assignment

// Compliance reporting
GET    /api/admin/compliance/daily   // Today's compliance status
GET    /api/admin/compliance/history // Historical compliance
```

#### DynamoDB Table: `sitelogix-users`

```typescript
interface User {
  PK: string;  // USER#{user_id}
  SK: string;  // METADATA

  user_id: string;
  email: string;
  name: string;
  go_by_name?: string;
  phone?: string;

  role: 'site_manager' | 'foreman' | 'supervisor' | 'admin' | 'super_admin';

  // Project assignments
  primary_project_id?: string;
  assigned_projects: string[];

  // Daily report settings
  daily_report_required: boolean;
  report_deadline_cst: string;  // "18:00" for 6:00 PM
  supervisor_id?: string;

  // Notification preferences
  notifications: {
    email_enabled: boolean;
    sms_enabled: boolean;
    in_app_enabled: boolean;
    reminder_5pm: boolean;
  };

  // Status
  active: boolean;
  created_at: string;
  created_by: string;
  last_login?: string;
}
```

---

## API Endpoints Summary

### Analytics Endpoints

```typescript
// Hours tracking
POST   /api/analytics/calculate-hours
GET    /api/analytics/personnel-hours?project_id&start_date&end_date

// Vendor performance
GET    /api/analytics/vendor-performance?vendor_id&time_period
GET    /api/analytics/vendor-performance/:vendorId/history

// Critical events
GET    /api/analytics/critical-events?severity&status
GET    /api/analytics/critical-events/:eventId

// Compliance
GET    /api/analytics/compliance/status
GET    /api/analytics/compliance/daily
GET    /api/analytics/compliance/history?user_id&start_date&end_date

// Insights (Phase 2)
GET    /api/analytics/insights?project_id&time_period
```

### Admin Endpoints

```typescript
// User management
POST   /api/admin/users
GET    /api/admin/users
GET    /api/admin/users/:id
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id

// Project assignments
POST   /api/admin/users/:id/projects
DELETE /api/admin/users/:id/projects/:projectId

// Notifications
POST   /api/admin/notifications/send
GET    /api/admin/notifications/history
```

---

## Cost Monitoring Dashboard

```typescript
// API endpoint for cost tracking
GET /api/admin/cost-monitoring

// Response
{
  success: true,
  data: {
    today: {
      date: '2025-11-05',
      openai_cost: 12.45,
      bedrock_cost: 3.20,
      comprehend_cost: 1.15,
      lambda_cost: 0.80,
      total_cost: 17.60,
      api_calls: {
        openai: 45,
        bedrock: 12,
        comprehend: 23
      }
    },
    yesterday: { ... },
    last_7_days: {
      total_cost: 98.30,
      avg_daily_cost: 14.04
    },
    month_to_date: {
      total_cost: 245.60,
      projected_monthly: 734.00,
      budget_status: 'on_track'  // or 'warning' or 'over_budget'
    },
    alerts: [
      {
        type: 'daily_threshold',
        message: 'Daily cost approaching $50 limit',
        current: 17.60,
        threshold: 50.00
      }
    ]
  }
}
```

---

## Development Schedule

### Week 1 (Nov 5-11)

**Tuesday Nov 5:**
- Set up OpenAI API integration
- Configure AWS SES for email notifications
- Create DynamoDB tables (analytics, compliance, users)

**Wednesday Nov 6:**
- Build Hours Calculator agent
- OpenAI GPT-4o integration for hour inference
- Create API endpoint for hours calculation

**Thursday Nov 7:**
- Vendor Performance tracking system
- Performance scoring algorithm
- API endpoints for vendor analytics

**Friday Nov 8:**
- Critical Event detection system
- Keyword screening + OpenAI confirmation
- Event logging and API endpoints

**Weekend (optional):**
- Testing and refinement

### Week 2 (Nov 12-18)

**Monday Nov 12:**
- Daily report compliance checker Lambda
- EventBridge cron schedules
- Email notification templates

**Tuesday Nov 13:**
- Real-time clock component
- Deadline countdown timer
- In-app notification system

**Wednesday Nov 14:**
- User management API endpoints
- Admin dashboard components
- Project assignment functionality

**Thursday Nov 15:**
- Analytics dashboard UI
- KPI cards and charts
- Compliance calendar view

**Friday Nov 16:**
- Integration testing
- Bug fixes
- Performance optimization

**Weekend:**
- User acceptance testing
- Documentation

**Monday Nov 19:**
- Deploy to production
- Monitor initial usage
- Phase 1 complete! 🎉

---

## Success Criteria

### Phase 1 Completion Checklist

- [ ] Hours calculation working with 85%+ accuracy
- [ ] Vendor performance scoring implemented
- [ ] Critical events detected and logged
- [ ] Daily report deadline system functional
  - [ ] 5PM reminders sent
  - [ ] 6PM overdue emails sent
  - [ ] 6:15PM supervisor escalations sent
- [ ] Real-time clock displaying in app header
- [ ] In-app notifications working
- [ ] Analytics dashboard showing KPIs
- [ ] User management system operational
- [ ] Cost monitoring dashboard functional
- [ ] All API endpoints documented
- [ ] OpenAI API cost < $30/day

### Quality Metrics

- API response time: < 2 seconds (p95)
- OpenAI accuracy: > 85% for hours calculation
- Critical event false positive rate: < 10%
- Email delivery success rate: > 99%
- Notification delivery latency: < 30 seconds
- Dashboard load time: < 3 seconds

---

## Next Steps - Immediate Actions

1. **Get OpenAI API Key**
   - Create/confirm OpenAI account
   - Generate API key with GPT-4o access
   - Store in AWS Secrets Manager

2. **Configure AWS SES**
   - Verify sender email domain
   - Request production access (if in sandbox)
   - Set up email templates

3. **Review & Approve**
   - Review this implementation plan
   - Confirm all requirements captured
   - Approve to begin development

**Ready to start?** I can begin implementation immediately once you confirm approval.
