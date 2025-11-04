/**
 * AI Model Registry
 *
 * Model versioning and prompt management for AI pipeline
 * Implements RFC-008 model versioning requirements
 */

export interface AIModelVersion {
  modelId: string;              // e.g., "claude-3-5-sonnet-20241022"
  version: string;              // e.g., "v2.1.0"
  promptVersion: string;        // e.g., "extraction-v2.1"
  capabilities: string[];       // e.g., ["personnel", "vendors", "constraints"]
  accuracy: {
    personnel: number;          // Historical accuracy %
    vendors: number;
    constraints: number;
  };
  status: 'active' | 'deprecated' | 'experimental';
  deployedAt: string;
  deprecatedAt?: string;
}

export interface PromptTemplate {
  version: string;
  template: string;
  variables: string[];
  capabilities: string[];
  includesConfidenceScoring: boolean;
}

export class AIModelRegistry {

  private static models: Map<string, AIModelVersion> = new Map([
    ['v1.0.0', {
      modelId: 'claude-3-5-sonnet-20241022',
      version: 'v1.0.0',
      promptVersion: 'extraction-v1.0',
      capabilities: ['personnel', 'vendors', 'constraints', 'work_logs'],
      accuracy: {
        personnel: 88,
        vendors: 82,
        constraints: 85
      },
      status: 'deprecated',
      deployedAt: '2025-09-01T00:00:00Z',
      deprecatedAt: '2025-11-04T00:00:00Z'
    }],
    ['v2.0.0', {
      modelId: 'claude-3-5-sonnet-20241022',
      version: 'v2.0.0',
      promptVersion: 'extraction-v2.0',
      capabilities: ['personnel', 'vendors', 'constraints', 'work_logs', 'confidence'],
      accuracy: {
        personnel: 92,
        vendors: 87,
        constraints: 89
      },
      status: 'active',
      deployedAt: '2025-11-04T00:00:00Z'
    }]
  ]);

  /**
   * Get active model version
   */
  static getActiveVersion(): AIModelVersion {
    const active = Array.from(this.models.values())
      .find(m => m.status === 'active');

    if (!active) {
      throw new Error('No active AI model version');
    }

    return active;
  }

  /**
   * Get specific model version
   */
  static getVersion(version: string): AIModelVersion | null {
    return this.models.get(version) || null;
  }

  /**
   * Register new model version
   */
  static registerNewVersion(model: AIModelVersion): void {
    // Mark previous active as deprecated
    const previousActive = Array.from(this.models.values())
      .find(m => m.status === 'active');

    if (previousActive) {
      previousActive.status = 'deprecated';
      previousActive.deprecatedAt = new Date().toISOString();
    }

    this.models.set(model.version, model);

    console.log(`✅ Registered new AI model version: ${model.version}`);
    console.log(`   - Model ID: ${model.modelId}`);
    console.log(`   - Prompt Version: ${model.promptVersion}`);
    console.log(`   - Status: ${model.status}`);
  }

  /**
   * Get all model versions
   */
  static getAllVersions(): AIModelVersion[] {
    return Array.from(this.models.values());
  }

  /**
   * Get model version history
   */
  static getVersionHistory(): Array<{
    version: string;
    status: string;
    deployedAt: string;
    deprecatedAt?: string;
  }> {
    return Array.from(this.models.values())
      .map(m => ({
        version: m.version,
        status: m.status,
        deployedAt: m.deployedAt,
        deprecatedAt: m.deprecatedAt
      }))
      .sort((a, b) =>
        new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime()
      );
  }
}

export class PromptRegistry {

  private static prompts: Map<string, PromptTemplate> = new Map([
    ['extraction-v1.0', {
      version: 'extraction-v1.0',
      template: `You are an AI assistant specialized in extracting structured construction data from daily report conversations.

CONTEXT:
- Project: {projectName}
- Location: {projectLocation}
- Manager: {managerName}
- Date: {reportDate}

TRANSCRIPT:
{rawTranscriptText}

TASK:
Extract ALL of the following information in JSON format:

1. PERSONNEL:
For each person mentioned, extract:
- fullName: Full name (best guess at formal name)
- goByName: Nickname or "go by" name
- position: Position (Project Manager, Foreman, Journeyman, Apprentice)
- teamAssignment: Team assignment (Project Manager, Team 1, Team 2, etc.)
- hoursWorked: Hours worked (number)
- overtimeHours: Overtime hours (number, default 0)
- healthStatus: Health/limitation status
- activitiesPerformed: Brief description of activities (optional)
- extractedFromText: Quote the exact text snippet

2. WORK ACTIVITIES (workLogs):
For each team/group, extract:
- teamId, level, personnelAssigned, personnelCount, taskDescription, hoursWorked, overtimeHours
- materialsUsed, equipmentUsed (optional)
- extractedFromText

3. CONSTRAINTS/ISSUES (constraints):
For each issue mentioned, extract:
- category (delay, safety, material, weather, labor, coordination, other)
- level, severity (low, medium, high, critical), title, description, status
- extractedFromText

4. VENDORS/DELIVERIES (vendors):
For each delivery or vendor mention, extract:
- companyName, vendorType, materialsDelivered, deliveryTime, receivedBy, deliveryNotes
- extractedFromText

5. TIME SUMMARY (timeSummary):
- totalPersonnelCount, totalRegularHours, totalOvertimeHours, arrivalTime, departureTime

IMPORTANT:
- Include "extractedFromText" field with direct quotes
- Use null for missing data
- Be conservative - only extract clearly stated information

Return a valid JSON object with keys: personnel, workLogs, constraints, vendors, timeSummary`,
      variables: ['projectName', 'projectLocation', 'managerName', 'reportDate', 'rawTranscriptText'],
      capabilities: ['personnel', 'vendors', 'constraints', 'work_logs'],
      includesConfidenceScoring: false
    }],
    ['extraction-v2.0', {
      version: 'extraction-v2.0',
      template: `You are an AI assistant specialized in extracting structured construction data from daily report conversations.

CONTEXT:
- Project: {projectName}
- Location: {projectLocation}
- Manager: {managerName}
- Date: {reportDate}

TRANSCRIPT:
{rawTranscriptText}

TASK:
Extract ALL of the following information in JSON format WITH CONFIDENCE SCORES:

1. PERSONNEL:
For each person mentioned, extract:
- fullName: Full name (best guess at formal name)
- goByName: Nickname or "go by" name
- position: Position (Project Manager, Foreman, Journeyman, Apprentice)
- teamAssignment: Team assignment (Project Manager, Team 1, Team 2, etc.)
- hoursWorked: Hours worked (number)
- overtimeHours: Overtime hours (number, default 0)
- healthStatus: Health/limitation status
- activitiesPerformed: Brief description of activities (optional)
- extractedFromText: Quote the exact text snippet
- confidence: Confidence score 0-100

2. WORK ACTIVITIES (workLogs):
For each team/group, extract:
- teamId, level, personnelAssigned, personnelCount, taskDescription, hoursWorked, overtimeHours
- materialsUsed, equipmentUsed (optional)
- extractedFromText
- confidence: Confidence score 0-100

3. CONSTRAINTS/ISSUES (constraints):
For each issue mentioned, extract:
- category (delay, safety, material, weather, labor, coordination, other)
- level, severity (low, medium, high, critical), title, description, status
- extractedFromText
- confidence: Confidence score 0-100

4. VENDORS/DELIVERIES (vendors):
For each delivery or vendor mention, extract:
- companyName, vendorType, materialsDelivered, deliveryTime, receivedBy, deliveryNotes
- extractedFromText
- confidence: Confidence score 0-100

5. TIME SUMMARY (timeSummary):
- totalPersonnelCount, totalRegularHours, totalOvertimeHours, arrivalTime, departureTime

CONFIDENCE SCORING GUIDE:
- 90-100: Explicitly stated, unambiguous
- 70-89: Clearly implied, high certainty
- 50-69: Inferred from context, moderate certainty
- 30-49: Uncertain, may need verification
- 0-29: Guess, requires manual review

IMPORTANT:
- Include "extractedFromText" field with direct quotes
- Use null for missing data
- Be conservative - only extract clearly stated information
- Always provide confidence scores

Return a valid JSON object with keys: personnel, workLogs, constraints, vendors, timeSummary`,
      variables: ['projectName', 'projectLocation', 'managerName', 'reportDate', 'rawTranscriptText'],
      capabilities: ['personnel', 'vendors', 'constraints', 'work_logs', 'confidence'],
      includesConfidenceScoring: true
    }]
  ]);

  /**
   * Get prompt template by version
   */
  static getPrompt(version: string): PromptTemplate {
    const prompt = this.prompts.get(version);
    if (!prompt) {
      throw new Error(`Prompt version ${version} not found`);
    }
    return prompt;
  }

  /**
   * Register new prompt template
   */
  static registerPrompt(prompt: PromptTemplate): void {
    this.prompts.set(prompt.version, prompt);
    console.log(`✅ Registered new prompt template: ${prompt.version}`);
  }

  /**
   * Build prompt with variables
   */
  static buildPrompt(version: string, variables: Record<string, string>): string {
    const template = this.getPrompt(version);

    let prompt = template.template;

    // Replace all variables
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value);
    }

    return prompt;
  }

  /**
   * Get latest prompt for capability
   */
  static getLatestPromptForCapability(capability: string): PromptTemplate {
    const prompts = Array.from(this.prompts.values())
      .filter(p => p.capabilities.includes(capability))
      .sort((a, b) => b.version.localeCompare(a.version));

    if (prompts.length === 0) {
      throw new Error(`No prompt found for capability: ${capability}`);
    }

    return prompts[0];
  }
}

// Export singleton access
export function getActiveAIModel(): AIModelVersion {
  return AIModelRegistry.getActiveVersion();
}

export function getPromptTemplate(version: string): PromptTemplate {
  return PromptRegistry.getPrompt(version);
}

export function buildExtractionPrompt(variables: Record<string, string>): string {
  const activeModel = AIModelRegistry.getActiveVersion();
  return PromptRegistry.buildPrompt(activeModel.promptVersion, variables);
}
