// Analytics Agent: Critical Event Detection
// Auto-detects injuries, major damage, safety violations, significant delays

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const OpenAI = require('openai');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Critical keywords for fast screening
const CRITICAL_KEYWORDS = {
  injury: ['injury', 'injured', 'accident', 'ambulance', 'hospital', 'ER', 'hurt', 'medical', 'paramedic', 'first aid'],
  safety: ['unsafe', 'OSHA', 'violation', 'hazard', 'danger', 'risk', 'safety issue'],
  damage: ['collapse', 'structural damage', 'failed', 'broken', 'destroyed', 'damaged'],
  major_delay: ['shut down', 'stop work', 'major delay', 'unable to proceed', 'halt'],
  quality: ['failed inspection', 'rework', 'condemned', 'rejected']
};

/**
 * Detect critical events in report
 */
async function detectCriticalEvents(report) {
  console.log(`🚨 Scanning for critical events in report ${report.report_id}`);

  const transcript = report.transcript || '';
  const issues = report.extracted_data?.issues || [];

  // Step 1: Fast keyword screening
  const detectedKeywords = fastKeywordScan(transcript, issues);

  if (detectedKeywords.length === 0) {
    console.log('✅ No critical event keywords detected');
    return { critical_events: [] };
  }

  console.log(`⚠️ Detected potential critical event keywords: ${detectedKeywords.join(', ')}`);

  // Step 2: AI confirmation and analysis
  const criticalEvents = await confirmWithAI(report, transcript, issues, detectedKeywords);

  // Step 3: Store and notify
  const storedEvents = [];
  for (const event of criticalEvents) {
    if (event.is_critical) {
      await storeCriticalEvent(report, event);

      // Send immediate notification
      await sendCriticalEventNotification(report, event);

      storedEvents.push(event);
    }
  }

  return { critical_events: storedEvents };
}

/**
 * Fast keyword scanning for initial detection
 */
function fastKeywordScan(transcript, issues) {
  const text = (transcript + ' ' + JSON.stringify(issues)).toLowerCase();
  const detected = [];

  for (const [category, keywords] of Object.entries(CRITICAL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        detected.push({ category, keyword });
      }
    }
  }

  return detected;
}

/**
 * Use OpenAI to confirm and analyze potential critical events
 */
async function confirmWithAI(report, transcript, issues, detectedKeywords) {
  const prompt = `URGENT: Analyze this construction report for CRITICAL safety or operational events.

Report Date: ${report.report_date}
Project: ${report.project_name || report.project_id}

Transcript:
${transcript}

Extracted Issues:
${JSON.stringify(issues, null, 2)}

Detected Keywords: ${detectedKeywords.map(d => d.keyword).join(', ')}

CRITICAL EVENTS include:
- ANY injury (no matter how minor)
- Structural damage or collapse
- Equipment failure causing safety hazard
- OSHA violations or unsafe conditions
- Work stoppage or major delays (> 4 hours)
- Property damage > $5,000
- Failed inspections requiring rework

For EACH potential critical event:
1. Is this ACTUALLY a critical event requiring immediate supervisor notification? (Be conservative - false positive is better than missing a real event)
2. Event type (injury/damage/delay/safety/quality)
3. Severity (1-10 scale, where 10 is most severe)
4. Who was involved?
5. What exactly happened?
6. What immediate actions were taken?
7. Does this require executive escalation? (Yes if severity > 7)
8. Recommended next steps

Return JSON array of events:
{
  "events": [
    {
      "is_critical": true/false,
      "event_type": "injury" | "damage" | "delay" | "safety" | "quality",
      "severity": 8,
      "description": "Worker fell from scaffold",
      "persons_involved": ["John Doe"],
      "immediate_actions": "Called ambulance, secured area, stopped work",
      "requires_executive_escalation": true,
      "next_steps": ["File OSHA report", "Investigate cause", "Safety training review"],
      "confidence": 0.95
    }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a construction safety analyst. Your primary goal is to identify critical events that require immediate attention. Be conservative - it is better to report a potential critical event than to miss one.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2, // Very low for consistent, conservative detection
      max_tokens: 1500
    });

    const analysis = JSON.parse(completion.choices[0].message.content);
    return analysis.events || [];

  } catch (error) {
    console.error('❌ Error analyzing with OpenAI:', error);
    // In case of AI failure, still flag as potential critical for manual review
    return [{
      is_critical: true,
      event_type: 'unknown',
      severity: 5,
      description: 'Potential critical event detected by keywords but AI analysis failed',
      persons_involved: [],
      immediate_actions: 'Requires manual review',
      requires_executive_escalation: false,
      next_steps: ['Manual review required'],
      confidence: 0.3
    }];
  }
}

/**
 * Store critical event in DynamoDB
 */
async function storeCriticalEvent(report, event) {
  const timestamp = new Date().toISOString();
  const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const item = {
    PK: `CRITICAL_EVENT#${eventId}`,
    SK: `TIMESTAMP#${timestamp}`,
    GSI1PK: `PROJECT#${report.project_id}`,
    GSI1SK: `SEVERITY#${event.severity}`,
    GSI2PK: `TYPE#${event.event_type}`,
    GSI2SK: event.severity,

    // Event details
    event_id: eventId,
    event_type: event.event_type,
    severity: event.severity,
    description: event.description,

    // Report context
    report_id: report.report_id,
    project_id: report.project_id,
    project_name: report.project_name,
    report_date: report.report_date,
    reporter: report.manager_name,

    // Involved parties
    persons_involved: event.persons_involved || [],

    // Actions
    immediate_actions: event.immediate_actions,
    next_steps: event.next_steps || [],

    // Escalation
    requires_executive_escalation: event.requires_executive_escalation,
    notification_sent: false,
    escalation_sent: false,

    // Status
    status: 'open',
    assigned_to: null,
    resolved_at: null,

    // Metadata
    confidence: event.confidence,
    detected_at: timestamp,
    ttl: Math.floor(Date.now() / 1000) + (730 * 24 * 60 * 60) // 2 years retention
  };

  await docClient.send(new PutCommand({
    TableName: 'sitelogix-analytics',
    Item: item
  }));

  console.log(`✅ Stored critical event: ${eventId}`);
  return eventId;
}

/**
 * Send email notification for critical event
 */
async function sendCriticalEventNotification(report, event) {
  const recipientEmail = process.env.NOTIFICATION_EMAIL || 'jayson@impactconsulting931.com';

  const severityEmoji = event.severity >= 8 ? '🚨🚨🚨' : event.severity >= 6 ? '⚠️⚠️' : '⚠️';
  const urgency = event.severity >= 8 ? 'URGENT' : event.severity >= 6 ? 'HIGH PRIORITY' : 'ATTENTION REQUIRED';

  const emailParams = {
    Source: recipientEmail, // Using same email as sender (will be configured later)
    Destination: {
      ToAddresses: [recipientEmail]
    },
    Message: {
      Subject: {
        Data: `${severityEmoji} ${urgency}: Critical Event - ${event.event_type.toUpperCase()}`
      },
      Body: {
        Html: {
          Data: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .severity-high { color: #dc2626; font-weight: bold; font-size: 24px; }
    .section { margin: 20px 0; padding: 15px; background: white; border-left: 4px solid #dc2626; }
    .label { font-weight: bold; color: #6b7280; margin-bottom: 5px; }
    .value { color: #111827; }
    .actions { background: #fef2f2; padding: 15px; border-radius: 8px; margin-top: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${severityEmoji} CRITICAL EVENT DETECTED</h1>
      <p>Immediate attention required</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="label">Event Type:</div>
        <div class="value" style="font-size: 20px; color: #dc2626; font-weight: bold;">${event.event_type.toUpperCase()}</div>
      </div>

      <div class="section">
        <div class="label">Severity Level:</div>
        <div class="severity-high">${event.severity}/10</div>
      </div>

      <div class="section">
        <div class="label">Description:</div>
        <div class="value">${event.description}</div>
      </div>

      <div class="section">
        <div class="label">Project:</div>
        <div class="value">${report.project_name || report.project_id}</div>
        <div class="label" style="margin-top: 10px;">Date:</div>
        <div class="value">${report.report_date}</div>
        <div class="label" style="margin-top: 10px;">Reported By:</div>
        <div class="value">${report.manager_name || 'Unknown'}</div>
      </div>

      ${event.persons_involved?.length > 0 ? `
      <div class="section">
        <div class="label">Persons Involved:</div>
        <div class="value">${event.persons_involved.join(', ')}</div>
      </div>
      ` : ''}

      <div class="section">
        <div class="label">Immediate Actions Taken:</div>
        <div class="value">${event.immediate_actions || 'None specified'}</div>
      </div>

      ${event.next_steps?.length > 0 ? `
      <div class="section">
        <div class="label">Recommended Next Steps:</div>
        <ul>
          ${event.next_steps.map(step => `<li>${step}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${event.requires_executive_escalation ? `
      <div class="actions">
        <p style="color: #dc2626; font-weight: bold; margin: 0;">⚠️ EXECUTIVE ESCALATION REQUIRED</p>
        <p style="margin: 10px 0 0 0;">This event requires immediate executive attention due to high severity.</p>
      </div>
      ` : ''}

      <div style="margin-top: 30px; padding: 15px; background: #e5e7eb; border-radius: 8px; text-align: center;">
        <p style="margin: 0; color: #6b7280; font-size: 12px;">
          This is an automated alert from SiteLogix Analytics<br/>
          Report ID: ${report.report_id}
        </p>
      </div>
    </div>
  </div>
</body>
</html>
          `
        }
      }
    }
  };

  try {
    await sesClient.send(new SendEmailCommand(emailParams));
    console.log(`📧 Critical event notification sent to ${recipientEmail}`);
  } catch (error) {
    console.error('❌ Error sending email notification:', error);
    // Don't fail the whole process if email fails
  }
}

/**
 * Get critical events
 */
async function getCriticalEvents(params) {
  const { project_id, event_type, severity_min, status = 'open' } = params;

  if (project_id) {
    const result = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :project',
      FilterExpression: status ? '#status = :status' : undefined,
      ExpressionAttributeNames: status ? { '#status': 'status' } : undefined,
      ExpressionAttributeValues: {
        ':project': `PROJECT#${project_id}`,
        ...(status && { ':status': status })
      },
      ScanIndexForward: false // Most recent first
    }));
    return result.Items || [];
  }

  if (event_type) {
    const result = await docClient.send(new QueryCommand({
      TableName: 'sitelogix-analytics',
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :type',
      FilterExpression: status ? '#status = :status' : undefined,
      ExpressionAttributeNames: status ? { '#status': 'status' } : undefined,
      ExpressionAttributeValues: {
        ':type': `TYPE#${event_type}`,
        ...(status && { ':status': status })
      },
      ScanIndexForward: false
    }));
    return result.Items || [];
  }

  return [];
}

module.exports = {
  detectCriticalEvents,
  getCriticalEvents,
  sendCriticalEventNotification
};
