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
  // Section 1 - Admin (Required)
  {
    id: 'arrival_time',
    question: 'What time did you arrive at the site?',
    keywords: ['arrive', 'arrival time', 'got to site', 'started work', 'got here'],
    required: true,
    order: 1,
    category: 'time'
  },
  {
    id: 'departure_time',
    question: 'What time did you leave the site?',
    keywords: ['leave', 'left', 'departure time', 'end of day', 'finished'],
    required: true,
    order: 2,
    category: 'time'
  },
  {
    id: 'personnel_count',
    question: 'How many personnel were on site today?',
    keywords: ['how many', 'number of workers', 'crew size', 'total people', 'personnel count'],
    required: true,
    order: 3,
    category: 'personnel'
  },
  {
    id: 'personnel_names',
    question: 'Please name the personnel present',
    keywords: ['name', 'who was there', 'list the names', 'crew members', 'team members'],
    required: true,
    order: 4,
    category: 'personnel'
  },
  {
    id: 'onsite_activities',
    question: 'Describe the on-site team activities',
    keywords: ['activities', 'work', 'tasks', 'what they did', 'team activities'],
    required: true,
    order: 5,
    category: 'general'
  },

  // Section 2 - Materials (Optional)
  {
    id: 'material_deliveries',
    question: 'Were there any material deliveries by supplier?',
    keywords: ['deliveries', 'materials', 'shipments', 'supplies', 'supplier'],
    required: false,
    order: 6,
    category: 'materials'
  },
  {
    id: 'materials_returned',
    question: 'Were any materials returned?',
    keywords: ['returned', 'return', 'sent back', 'materials back'],
    required: false,
    order: 7,
    category: 'materials'
  },
  {
    id: 'material_issues',
    question: 'Were there any issues with material delivery?',
    keywords: ['issues', 'problems', 'delivery issues', 'material problems'],
    required: false,
    order: 8,
    category: 'materials'
  },

  // Section 3 - Off-Site (Optional)
  {
    id: 'offsite_personnel_count',
    question: 'How many off-site or specialty personnel worked today?',
    keywords: ['off-site', 'offsite', 'specialty', 'off site personnel'],
    required: false,
    order: 9,
    category: 'personnel'
  },
  {
    id: 'offsite_total_hours',
    question: 'What were the total off-site hours?',
    keywords: ['off-site hours', 'offsite hours', 'specialty hours'],
    required: false,
    order: 10,
    category: 'time'
  },
  {
    id: 'offsite_activities',
    question: 'What were the off-site team activities?',
    keywords: ['off-site activities', 'offsite work', 'specialty activities'],
    required: false,
    order: 11,
    category: 'general'
  },

  // Section 4 - General
  {
    id: 'weather',
    question: 'How was the weather today?',
    keywords: ['weather', 'rain', 'sunny', 'temperature', 'conditions'],
    required: false,
    order: 12,
    category: 'general'
  },
  {
    id: 'constraints_delays',
    question: 'Were there any constraints or delays?',
    keywords: ['constraints', 'delays', 'hold ups', 'issues', 'problems'],
    required: false,
    order: 13,
    category: 'general'
  },
  {
    id: 'safety_incidents',
    question: 'Were there any safety incidents?',
    keywords: ['safety', 'incidents', 'accidents', 'injuries', 'safety issues'],
    required: true,
    order: 14,
    category: 'safety'
  },
  {
    id: 'additional_notes',
    question: 'Any additional notes or observations?',
    keywords: ['additional notes', 'anything else', 'other information', 'final notes'],
    required: false,
    order: 15,
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
