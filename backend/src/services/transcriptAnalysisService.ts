/**
 * Transcript Analysis Service
 *
 * Uses AI (Claude or GPT-4) to extract structured data from conversation transcripts
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

interface TranscriptMessage {
  role: 'user' | 'agent';
  message: string;
  timestamp?: string;
}

interface TranscriptData {
  conversation_id: string;
  transcript?: TranscriptMessage[];
  metadata?: any;
}

interface AnalysisContext {
  projectName: string;
  projectLocation: string;
  managerName: string;
  reportDate: string;
}

export interface ExtractedPersonnel {
  fullName: string;
  goByName: string;
  position: string;
  teamAssignment: string;
  hoursWorked: number;
  overtimeHours: number;
  healthStatus: string;
  activitiesPerformed?: string;
  extractedFromText: string;
}

export interface ExtractedWorkLog {
  teamId: string;
  level: string;
  personnelAssigned: string[];
  personnelCount: number;
  taskDescription: string;
  hoursWorked: number;
  overtimeHours: number;
  materialsUsed?: string[];
  equipmentUsed?: string[];
  extractedFromText: string;
}

export interface ExtractedConstraint {
  category: 'delay' | 'safety' | 'material' | 'weather' | 'labor' | 'coordination' | 'other';
  level: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  extractedFromText: string;
}

export interface ExtractedVendor {
  companyName: string;
  vendorType: 'supplier' | 'subcontractor' | 'rental' | 'other';
  materialsDelivered: string;
  deliveryTime?: string;
  receivedBy?: string;
  deliveryNotes?: string;
  extractedFromText: string;
}

export interface TimeSummary {
  totalPersonnelCount: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  arrivalTime?: string;
  departureTime?: string;
}

export interface ExtractedReportData {
  personnel: ExtractedPersonnel[];
  workLogs: ExtractedWorkLog[];
  constraints: ExtractedConstraint[];
  vendors: ExtractedVendor[];
  timeSummary: TimeSummary;
}

export class TranscriptAnalysisService {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;
  private preferredModel: 'claude' | 'gpt4' = 'claude';

  constructor(config: {
    anthropicApiKey?: string;
    openaiApiKey?: string;
    preferredModel?: 'claude' | 'gpt4';
  }) {
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
    this.preferredModel = config.preferredModel || 'claude';
  }

  /**
   * Convert transcript messages to plain text
   */
  private transcriptToText(transcript: TranscriptMessage[]): string {
    return transcript
      .map(msg => {
        const role = msg.role === 'user' ? 'Manager' : 'Roxy';
        return `${role}: ${msg.message}`;
      })
      .join('\n\n');
  }

  /**
   * Build extraction prompt
   */
  private buildExtractionPrompt(
    rawTranscript: string,
    context: AnalysisContext
  ): string {
    return `You are an AI assistant specialized in extracting structured construction data from daily report conversations.

CONTEXT:
- Project: ${context.projectName}
- Location: ${context.projectLocation}
- Manager: ${context.managerName}
- Date: ${context.reportDate}

TRANSCRIPT:
${rawTranscript}

TASK:
Extract ALL of the following information in JSON format:

1. PERSONNEL:
For each person mentioned, extract:
- fullName: Full name (best guess at formal name)
- goByName: Nickname or "go by" name
- position: Position (Project Manager, Foreman, Journeyman, Apprentice)
- teamAssignment: Team assignment (Project Manager, Team 1, Team 2, Team 3, Team 4, etc.)
- hoursWorked: Hours worked (number)
- overtimeHours: Overtime hours (number, default 0)
- healthStatus: Health/limitation status (Healthy, N/A, or specific limitation)
- activitiesPerformed: Brief description of activities (optional)
- extractedFromText: Quote the exact text snippet where this information was mentioned

2. WORK ACTIVITIES (workLogs):
For each team/group, extract:
- teamId: Team identifier (Project Manager, Team 1, Team 2, etc.)
- level: Building level or area worked (e.g., "Level 1", "Level 2 & 3 (Office)", "General")
- personnelAssigned: Array of full names assigned to this work
- personnelCount: Number of personnel
- taskDescription: Description of what they worked on
- hoursWorked: Total team hours
- overtimeHours: Total team overtime hours
- materialsUsed: Array of materials used (optional)
- equipmentUsed: Array of equipment used (optional)
- extractedFromText: Quote the exact text

3. CONSTRAINTS/ISSUES (constraints):
For each issue mentioned, extract:
- category: One of: delay, safety, material, weather, labor, coordination, other
- level: Building level affected (e.g., "Level 1", "General")
- severity: One of: low, medium, high, critical
- title: Short title (1-5 words)
- description: Full description
- status: One of: open, in_progress, resolved
- extractedFromText: Quote the exact text

4. VENDORS/DELIVERIES (vendors):
For each delivery or vendor mention, extract:
- companyName: Company name
- vendorType: One of: supplier, subcontractor, rental, other
- materialsDelivered: Description of materials/services
- deliveryTime: Time of delivery if mentioned
- receivedBy: Person who received if mentioned
- deliveryNotes: Any issues or special notes
- extractedFromText: Quote the exact text

5. TIME SUMMARY (timeSummary):
Extract:
- totalPersonnelCount: Total unique personnel mentioned
- totalRegularHours: Sum of all regular hours
- totalOvertimeHours: Sum of all overtime hours
- arrivalTime: Site arrival time if mentioned
- departureTime: Site departure time if mentioned

IMPORTANT RULES:
- Include "extractedFromText" field with direct quotes from transcript
- Use null for missing data - don't guess
- Be conservative - only extract information that is clearly stated
- Preserve exact spellings of names as mentioned
- Use consistent team naming (Team 1, Team 2, Project Manager, etc.)
- For position, use one of: Project Manager, Foreman, Journeyman, Apprentice
- For healthStatus, use: Healthy, N/A, or describe the specific limitation

Return ONLY a valid JSON object with this exact structure:
{
  "personnel": [...],
  "workLogs": [...],
  "constraints": [...],
  "vendors": [...],
  "timeSummary": {...}
}`;
  }

  /**
   * Analyze transcript using Claude
   */
  private async analyzeWithClaude(
    prompt: string
  ): Promise<ExtractedReportData> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    const message = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from response (Claude sometimes wraps it in markdown)
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n/, '').replace(/\n```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n/, '').replace(/\n```$/, '');
    }

    return JSON.parse(jsonText);
  }

  /**
   * Analyze transcript using GPT-4
   */
  private async analyzeWithGPT4(
    prompt: string
  ): Promise<ExtractedReportData> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant specialized in extracting structured construction data from daily report conversations. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('No response from GPT-4');
    }

    return JSON.parse(content);
  }

  /**
   * Analyze transcript and extract structured data
   */
  async analyzeTranscript(
    transcriptData: TranscriptData,
    context: AnalysisContext
  ): Promise<ExtractedReportData> {
    try {
      // Convert transcript to text
      const rawTranscript = this.transcriptToText(transcriptData.transcript || []);

      if (!rawTranscript || rawTranscript.trim().length === 0) {
        throw new Error('Empty transcript');
      }

      // Build prompt
      const prompt = this.buildExtractionPrompt(rawTranscript, context);

      // Analyze with preferred model
      let result: ExtractedReportData;

      if (this.preferredModel === 'claude' && this.anthropic) {
        console.log('🤖 Analyzing transcript with Claude 3.5 Sonnet...');
        result = await this.analyzeWithClaude(prompt);
      } else if (this.preferredModel === 'gpt4' && this.openai) {
        console.log('🤖 Analyzing transcript with GPT-4...');
        result = await this.analyzeWithGPT4(prompt);
      } else {
        // Fallback to available model
        if (this.anthropic) {
          console.log('🤖 Analyzing transcript with Claude 3.5 Sonnet (fallback)...');
          result = await this.analyzeWithClaude(prompt);
        } else if (this.openai) {
          console.log('🤖 Analyzing transcript with GPT-4 (fallback)...');
          result = await this.analyzeWithGPT4(prompt);
        } else {
          throw new Error('No AI provider configured');
        }
      }

      console.log('✅ Transcript analysis complete:');
      console.log(`   - Personnel: ${result.personnel.length}`);
      console.log(`   - Work Logs: ${result.workLogs.length}`);
      console.log(`   - Constraints: ${result.constraints.length}`);
      console.log(`   - Vendors: ${result.vendors.length}`);

      return result;
    } catch (error) {
      console.error('❌ Transcript analysis failed:', error);
      throw error;
    }
  }
}

// Export singleton
let analysisServiceInstance: TranscriptAnalysisService | null = null;

export function initializeTranscriptAnalysisService(config: {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  preferredModel?: 'claude' | 'gpt4';
}): TranscriptAnalysisService {
  analysisServiceInstance = new TranscriptAnalysisService(config);
  return analysisServiceInstance;
}

export function getTranscriptAnalysisService(): TranscriptAnalysisService {
  if (!analysisServiceInstance) {
    throw new Error('Transcript analysis service not initialized');
  }
  return analysisServiceInstance;
}
