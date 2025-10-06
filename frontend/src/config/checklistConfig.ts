/**
 * Daily Report Checklist Configuration
 *
 * This file defines the checklist items used during voice reporting.
 * Items can be customized by admins to match specific project requirements.
 */

export interface ChecklistItem {
  id: string;
  question: string;
  keywords: string[];
  required: boolean;
  order: number;
  category?: 'time' | 'personnel' | 'materials' | 'safety' | 'general';
}

export const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'arrival_time',
    question: 'What time did you arrive at the site?',
    keywords: ['arrive at site', 'arrival time', 'got to site', 'started work', 'begin work'],
    required: true,
    order: 1,
    category: 'time'
  },
  {
    id: 'departure_time',
    question: 'What time did you leave the site?',
    keywords: ['leave site', 'left site', 'departure time', 'end of day', 'finished work'],
    required: true,
    order: 2,
    category: 'time'
  },
  {
    id: 'personnel_count',
    question: 'How many personnel were on site today?',
    keywords: ['how many personnel', 'number of workers', 'crew size', 'total people'],
    required: true,
    order: 3,
    category: 'personnel'
  },
  {
    id: 'personnel_names',
    question: 'Please name the personnel present',
    keywords: ['name the personnel', 'who was there', 'list the names', 'crew members'],
    required: true,
    order: 4,
    category: 'personnel'
  },
  {
    id: 'team_assignments',
    question: 'Describe team assignments and activities',
    keywords: ['team assignments', 'work activities', 'what they were doing', 'tasks'],
    required: true,
    order: 5,
    category: 'general'
  },
  {
    id: 'deliveries',
    question: 'Were there any material deliveries?',
    keywords: ['deliveries', 'materials delivered', 'shipments', 'supplies arrived'],
    required: false,
    order: 6,
    category: 'materials'
  },
  {
    id: 'constraints',
    question: 'Describe any constraints or delays',
    keywords: ['constraints', 'delays', 'problems', 'issues', 'hold ups'],
    required: false,
    order: 7,
    category: 'general'
  },
  {
    id: 'safety',
    question: 'Were there any safety incidents?',
    keywords: ['safety incidents', 'accidents', 'injuries', 'safety issues'],
    required: true,
    order: 8,
    category: 'safety'
  },
  {
    id: 'additional_notes',
    question: 'Any additional notes or observations?',
    keywords: ['additional notes', 'anything else', 'other information', 'final notes'],
    required: false,
    order: 9,
    category: 'general'
  }
];

/**
 * Get checklist items from localStorage or use defaults
 */
export const getChecklistItems = (): ChecklistItem[] => {
  try {
    const stored = localStorage.getItem('sitelogix_checklist_config');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.sort((a: ChecklistItem, b: ChecklistItem) => a.order - b.order);
    }
  } catch (error) {
    console.error('Error loading checklist config:', error);
  }
  return DEFAULT_CHECKLIST_ITEMS;
};

/**
 * Save checklist items to localStorage
 */
export const saveChecklistItems = (items: ChecklistItem[]): void => {
  try {
    localStorage.setItem('sitelogix_checklist_config', JSON.stringify(items));
  } catch (error) {
    console.error('Error saving checklist config:', error);
  }
};

/**
 * Reset checklist to defaults
 */
export const resetChecklistToDefaults = (): void => {
  localStorage.removeItem('sitelogix_checklist_config');
};

/**
 * Convert checklist items to ElevenLabs agent prompt
 * This generates the dynamic prompt that Roxy will use
 */
export const generateAgentPrompt = (items: ChecklistItem[]): string => {
  const requiredItems = items.filter(item => item.required);
  const optionalItems = items.filter(item => !item.required);

  let prompt = `You are Roxy, a helpful AI assistant for construction daily reports.\n\n`;
  prompt += `Your job is to conduct a friendly but thorough interview to collect the following information:\n\n`;

  prompt += `REQUIRED QUESTIONS (must be asked):\n`;
  requiredItems.forEach((item, index) => {
    prompt += `${index + 1}. ${item.question}\n`;
  });

  if (optionalItems.length > 0) {
    prompt += `\nOPTIONAL QUESTIONS (ask if relevant):\n`;
    optionalItems.forEach((item, index) => {
      prompt += `${index + 1}. ${item.question}\n`;
    });
  }

  prompt += `\n`;
  prompt += `Be conversational and natural. Don't read these questions verbatim - adapt them to the flow of conversation.\n`;
  prompt += `If the user volunteers information, acknowledge it and move on.\n`;
  prompt += `Keep the interview focused but allow for natural conversation.\n`;

  return prompt;
};

/**
 * Get keywords array for checklist tracking
 */
export const getChecklistKeywords = (items: ChecklistItem[]): string[][] => {
  return items.map(item => item.keywords);
};
