"use strict";
/**
 * Transcript Analysis Service
 *
 * Uses AI (Claude or GPT-4) to extract structured data from conversation transcripts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptAnalysisService = void 0;
exports.initializeTranscriptAnalysisService = initializeTranscriptAnalysisService;
exports.getTranscriptAnalysisService = getTranscriptAnalysisService;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const openai_1 = __importDefault(require("openai"));
class TranscriptAnalysisService {
    constructor(config) {
        this.anthropic = null;
        this.openai = null;
        this.preferredModel = 'claude';
        if (config.anthropicApiKey) {
            this.anthropic = new sdk_1.default({ apiKey: config.anthropicApiKey });
        }
        if (config.openaiApiKey) {
            this.openai = new openai_1.default({ apiKey: config.openaiApiKey });
        }
        this.preferredModel = config.preferredModel || 'claude';
    }
    /**
     * Convert transcript messages to plain text
     */
    transcriptToText(transcript) {
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
    buildExtractionPrompt(rawTranscript, context) {
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
    async analyzeWithClaude(prompt) {
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
        }
        else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n/, '').replace(/\n```$/, '');
        }
        return JSON.parse(jsonText);
    }
    /**
     * Analyze transcript using GPT-4
     */
    async analyzeWithGPT4(prompt) {
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
    async analyzeTranscript(transcriptData, context) {
        try {
            // Convert transcript to text
            const rawTranscript = this.transcriptToText(transcriptData.transcript || []);
            if (!rawTranscript || rawTranscript.trim().length === 0) {
                throw new Error('Empty transcript');
            }
            // Build prompt
            const prompt = this.buildExtractionPrompt(rawTranscript, context);
            // Analyze with preferred model
            let result;
            if (this.preferredModel === 'claude' && this.anthropic) {
                console.log('🤖 Analyzing transcript with Claude 3.5 Sonnet...');
                result = await this.analyzeWithClaude(prompt);
            }
            else if (this.preferredModel === 'gpt4' && this.openai) {
                console.log('🤖 Analyzing transcript with GPT-4...');
                result = await this.analyzeWithGPT4(prompt);
            }
            else {
                // Fallback to available model
                if (this.anthropic) {
                    console.log('🤖 Analyzing transcript with Claude 3.5 Sonnet (fallback)...');
                    result = await this.analyzeWithClaude(prompt);
                }
                else if (this.openai) {
                    console.log('🤖 Analyzing transcript with GPT-4 (fallback)...');
                    result = await this.analyzeWithGPT4(prompt);
                }
                else {
                    throw new Error('No AI provider configured');
                }
            }
            console.log('✅ Transcript analysis complete:');
            console.log(`   - Personnel: ${result.personnel.length}`);
            console.log(`   - Work Logs: ${result.workLogs.length}`);
            console.log(`   - Constraints: ${result.constraints.length}`);
            console.log(`   - Vendors: ${result.vendors.length}`);
            return result;
        }
        catch (error) {
            console.error('❌ Transcript analysis failed:', error);
            throw error;
        }
    }
}
exports.TranscriptAnalysisService = TranscriptAnalysisService;
// Export singleton
let analysisServiceInstance = null;
function initializeTranscriptAnalysisService(config) {
    analysisServiceInstance = new TranscriptAnalysisService(config);
    return analysisServiceInstance;
}
function getTranscriptAnalysisService() {
    if (!analysisServiceInstance) {
        throw new Error('Transcript analysis service not initialized');
    }
    return analysisServiceInstance;
}
//# sourceMappingURL=transcriptAnalysisService.js.map