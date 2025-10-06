/**
 * Generate Beautiful HTML Reports for Construction Daily Reports
 *
 * Creates professional, print-ready HTML reports with:
 * - BLUF format
 * - Professional styling
 * - Data tables
 * - Print optimization
 */

function generateHTMLReport(extracted, context) {
  const { reportId, reportDate, projectId, managerName, projectName } = context;

  // Format date
  const dateObj = new Date(reportDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const formattedDate = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;

  // Check for critical issues
  const criticalIssues = extracted.constraints.filter(c => c.severity === 'high');
  const injuries = extracted.personnel.filter(p => p.healthStatus && p.healthStatus.toLowerCase().includes('injury'));
  const hasInjuries = injuries.length > 0;
  const hasCriticalIssues = criticalIssues.length > 0;

  // Group work by team
  const workByTeam = {};
  for (const work of extracted.workLogs) {
    const team = work.teamId || 'General';
    if (!workByTeam[team]) workByTeam[team] = [];
    workByTeam[team].push(work);
  }

  // Group personnel by team
  const personnelByTeam = {};
  for (const person of extracted.personnel) {
    const team = person.teamAssignment || 'Management/Support';
    if (!personnelByTeam[team]) personnelByTeam[team] = [];
    personnelByTeam[team].push(person);
  }

  // Generate narrative
  const teamCount = Object.keys(workByTeam).length;
  let narrative = `Today's work involved ${extracted.personnel.length} personnel across ${teamCount} team${teamCount > 1 ? 's' : ''}, `;
  narrative += `completing ${extracted.workLogs.length} major activities. `;

  const accomplishments = [];
  for (const [team, activities] of Object.entries(workByTeam)) {
    if (activities.length > 0) {
      accomplishments.push(`${team} focused on ${activities.map(a => a.description.toLowerCase()).join(', ')}`);
    }
  }
  narrative += accomplishments.join('; ') + '. ';

  if (extracted.vendors.length > 0) {
    narrative += `Material deliveries were received from ${extracted.vendors.map(v => v.companyName || v.name).join(', ')}. `;
  }

  if (extracted.constraints.length > 0) {
    narrative += `${extracted.constraints.length} issue${extracted.constraints.length > 1 ? 's were' : ' was'} identified requiring attention.`;
  } else {
    narrative += `No significant issues or delays reported.`;
  }

  // Build HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Report - ${projectName} - ${formattedDate}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }

    .report-container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      border-radius: 8px;
    }

    /* Header */
    .report-header {
      text-align: center;
      border-bottom: 4px solid #2c5aa0;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .company-name {
      font-size: 28px;
      font-weight: bold;
      color: #2c5aa0;
      margin-bottom: 5px;
    }

    .report-title {
      font-size: 20px;
      color: #666;
      margin-bottom: 15px;
    }

    .project-info {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      background: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 30px;
      font-size: 14px;
    }

    .project-info-item {
      display: flex;
    }

    .project-info-label {
      font-weight: bold;
      margin-right: 10px;
      color: #2c5aa0;
    }

    /* BLUF Section */
    .bluf-section {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 8px;
      margin-bottom: 30px;
    }

    .bluf-section h2 {
      font-size: 22px;
      margin-bottom: 15px;
      border-bottom: 2px solid rgba(255,255,255,0.3);
      padding-bottom: 10px;
    }

    .critical-alert {
      background: #dc3545;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 15px;
      border-left: 4px solid #fff;
    }

    .critical-alert h3 {
      font-size: 18px;
      margin-bottom: 10px;
    }

    .critical-alert ul {
      list-style: none;
      margin-left: 10px;
    }

    .critical-alert li {
      margin: 5px 0;
      padding-left: 20px;
      position: relative;
    }

    .critical-alert li:before {
      content: '⚠';
      position: absolute;
      left: 0;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }

    .metric-card {
      background: rgba(255,255,255,0.2);
      padding: 15px;
      border-radius: 5px;
      text-align: center;
    }

    .metric-value {
      font-size: 28px;
      font-weight: bold;
      display: block;
    }

    .metric-label {
      font-size: 14px;
      opacity: 0.9;
      display: block;
      margin-top: 5px;
    }

    /* Sections */
    .section {
      margin-bottom: 35px;
    }

    .section h2 {
      font-size: 20px;
      color: #2c5aa0;
      border-bottom: 2px solid #2c5aa0;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }

    .narrative-text {
      background: #f8f9fa;
      padding: 20px;
      border-left: 4px solid #2c5aa0;
      border-radius: 4px;
      font-size: 15px;
      line-height: 1.8;
    }

    /* Activity Lists */
    .activity-group {
      margin-bottom: 20px;
    }

    .team-header {
      font-size: 16px;
      font-weight: bold;
      color: #2c5aa0;
      margin-bottom: 10px;
      padding: 10px;
      background: #e3f2fd;
      border-radius: 4px;
    }

    .activity-list {
      list-style: none;
      margin-left: 20px;
    }

    .activity-item {
      margin: 10px 0;
      padding: 10px;
      background: #fafafa;
      border-radius: 4px;
      border-left: 3px solid #2c5aa0;
    }

    .activity-description {
      font-weight: 500;
      margin-bottom: 5px;
    }

    .activity-meta {
      font-size: 13px;
      color: #666;
      margin-left: 15px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 14px;
    }

    th {
      background: #2c5aa0;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }

    td {
      padding: 10px 12px;
      border-bottom: 1px solid #ddd;
    }

    tr:hover {
      background: #f8f9fa;
    }

    /* Issues */
    .priority-section {
      margin-bottom: 25px;
    }

    .priority-high {
      border-left: 4px solid #dc3545;
    }

    .priority-medium {
      border-left: 4px solid #ffc107;
    }

    .priority-low {
      border-left: 4px solid #28a745;
    }

    .issue-card {
      background: #fff;
      padding: 15px;
      margin: 10px 0;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .issue-title {
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 15px;
    }

    .issue-meta {
      font-size: 13px;
      color: #666;
      margin-top: 8px;
    }

    /* Personnel Roster */
    .roster-team {
      margin-bottom: 20px;
    }

    .roster-team-name {
      font-weight: bold;
      color: #2c5aa0;
      margin-bottom: 10px;
      font-size: 16px;
    }

    .person-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #fafafa;
      margin: 5px 0;
      border-radius: 4px;
    }

    .person-info {
      flex: 1;
    }

    .person-hours {
      color: #2c5aa0;
      font-weight: 600;
    }

    /* Footer */
    .report-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #ddd;
      text-align: center;
      color: #666;
      font-size: 13px;
    }

    /* Print Styles */
    @media print {
      body {
        background: white;
        padding: 0;
      }

      .report-container {
        box-shadow: none;
        max-width: 100%;
        padding: 20px;
      }

      .section {
        page-break-inside: avoid;
      }

      .bluf-section {
        background: #667eea;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Header -->
    <div class="report-header">
      <div class="company-name">PARKWAY CONSTRUCTION SERVICES</div>
      <div class="report-title">Daily Construction Report</div>
    </div>

    <!-- Project Info -->
    <div class="project-info">
      <div class="project-info-item">
        <span class="project-info-label">PROJECT:</span>
        <span>${projectName}</span>
      </div>
      <div class="project-info-item">
        <span class="project-info-label">DATE:</span>
        <span>${formattedDate}</span>
      </div>
      <div class="project-info-item">
        <span class="project-info-label">PROJECT MANAGER:</span>
        <span>${managerName}</span>
      </div>
      <div class="project-info-item">
        <span class="project-info-label">REPORT ID:</span>
        <span>${reportId}</span>
      </div>
    </div>

    <!-- BLUF Section -->
    <div class="bluf-section">
      <h2>BOTTOM LINE UP FRONT</h2>

      ${hasInjuries || hasCriticalIssues ? `
      <div class="critical-alert">
        <h3>⚠️ CRITICAL ALERTS</h3>
        <ul>
          ${injuries.map(p => `<li>INJURY REPORTED: ${p.fullName} - ${p.healthStatus}</li>`).join('')}
          ${criticalIssues.map(i => `<li>HIGH SEVERITY ISSUE: ${i.title} - ${i.description}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <div class="metrics-grid">
        <div class="metric-card">
          <span class="metric-value">${extracted.personnel.length}</span>
          <span class="metric-label">Personnel on Site</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${extracted.timeSummary.totalRegularHours + extracted.timeSummary.totalOvertimeHours}</span>
          <span class="metric-label">Total Hours</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${extracted.workLogs.length}</span>
          <span class="metric-label">Activities Completed</span>
        </div>
        ${extracted.constraints.length > 0 ? `
        <div class="metric-card">
          <span class="metric-value">${extracted.constraints.length}</span>
          <span class="metric-label">Issues Reported</span>
        </div>
        ` : ''}
        ${extracted.vendors.length > 0 ? `
        <div class="metric-card">
          <span class="metric-value">${extracted.vendors.length}</span>
          <span class="metric-label">Deliveries Received</span>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Daily Summary -->
    <div class="section">
      <h2>DAILY SUMMARY</h2>
      <div class="narrative-text">${narrative}</div>
    </div>

    <!-- Work Activities -->
    <div class="section">
      <h2>WORK ACTIVITIES & ACCOMPLISHMENTS</h2>
      ${Object.entries(workByTeam).map(([team, activities]) => `
        <div class="activity-group">
          <div class="team-header">${team}</div>
          <ul class="activity-list">
            ${activities.map(activity => `
              <li class="activity-item">
                <div class="activity-description">${activity.description}</div>
                ${activity.personnelAssigned && activity.personnelAssigned.length > 0 ? `
                  <div class="activity-meta">Crew: ${activity.personnelAssigned.join(', ')}</div>
                ` : ''}
                ${activity.hoursWorked ? `
                  <div class="activity-meta">Hours: ${activity.hoursWorked}</div>
                ` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('')}
    </div>

    <!-- Issues & Constraints -->
    ${extracted.constraints.length > 0 ? `
    <div class="section">
      <h2>ISSUES & CONSTRAINTS</h2>

      ${criticalIssues.length > 0 ? `
      <div class="priority-section">
        <h3 style="color: #dc3545; margin-bottom: 15px;">🔴 HIGH PRIORITY</h3>
        ${criticalIssues.map(issue => `
          <div class="issue-card priority-high">
            <div class="issue-title">${issue.title}</div>
            <div>${issue.description}</div>
            <div class="issue-meta">
              Status: ${issue.status}
              ${issue.assignedTo ? ` | Assigned to: ${issue.assignedTo}` : ''}
              ${issue.level ? ` | Location: ${issue.level}` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${extracted.constraints.filter(c => c.severity === 'medium').length > 0 ? `
      <div class="priority-section">
        <h3 style="color: #ffc107; margin-bottom: 15px;">🟡 MEDIUM PRIORITY</h3>
        ${extracted.constraints.filter(c => c.severity === 'medium').map(issue => `
          <div class="issue-card priority-medium">
            <div class="issue-title">${issue.title}</div>
            <div>${issue.description}</div>
            <div class="issue-meta">
              Status: ${issue.status}
              ${issue.assignedTo ? ` | Assigned to: ${issue.assignedTo}` : ''}
              ${issue.level ? ` | Location: ${issue.level}` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${extracted.constraints.filter(c => c.severity === 'low' || !c.severity).length > 0 ? `
      <div class="priority-section">
        <h3 style="color: #28a745; margin-bottom: 15px;">🟢 LOW PRIORITY</h3>
        ${extracted.constraints.filter(c => c.severity === 'low' || !c.severity).map(issue => `
          <div class="issue-card priority-low">
            <div class="issue-title">${issue.title}</div>
            <div>${issue.description}</div>
            <div class="issue-meta">
              Status: ${issue.status}
              ${issue.assignedTo ? ` | Assigned to: ${issue.assignedTo}` : ''}
              ${issue.level ? ` | Location: ${issue.level}` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      ` : ''}
    </div>
    ` : ''}

    <!-- Material Deliveries -->
    ${extracted.vendors.length > 0 ? `
    <div class="section">
      <h2>MATERIAL DELIVERIES</h2>
      <table>
        <thead>
          <tr>
            <th>Supplier</th>
            <th>Materials</th>
            <th>Delivery Time</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${extracted.vendors.map(vendor => `
            <tr>
              <td>${vendor.companyName || vendor.name || 'Unknown'}</td>
              <td>${vendor.materialsDelivered || 'N/A'}</td>
              <td>${vendor.deliveryTime || 'N/A'}</td>
              <td>${vendor.notes || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Personnel Roster -->
    <div class="section">
      <h2>PERSONNEL ROSTER</h2>
      ${Object.entries(personnelByTeam).map(([team, people]) => `
        <div class="roster-team">
          <div class="roster-team-name">${team} (${people.length} personnel)</div>
          ${people.map(person => {
            const goByName = person.goByName || person.fullName?.split(' ')[0] || '';
            const status = person.healthStatus === 'Healthy' ? '✓' : '⚠';
            return `
              <div class="person-card">
                <div class="person-info">
                  <span>${status}</span>
                  <strong>${person.fullName}</strong> (${goByName}) - ${person.position || 'Worker'}
                  ${person.healthStatus && person.healthStatus !== 'Healthy' ? `<span style="color: #dc3545; margin-left: 10px;">[${person.healthStatus}]</span>` : ''}
                </div>
                <div class="person-hours">
                  ${person.hoursWorked || 8}h${person.overtimeHours && person.overtimeHours > 0 ? ` + ${person.overtimeHours}h OT` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `).join('')}
    </div>

    <!-- Footer -->
    <div class="report-footer">
      <div>Report generated: ${new Date().toLocaleString()}</div>
      <div>Contact: ${managerName}</div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { generateHTMLReport };
