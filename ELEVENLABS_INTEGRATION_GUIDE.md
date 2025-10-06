# ElevenLabs Integration Guide - SiteLogix

## Overview

SiteLogix uses ElevenLabs Conversational AI (agent "Roxy") to conduct voice-based daily construction report interviews.

## Dynamic Variables & Personalization

### How It Works

When a user starts a conversation, we pass **dynamic variables** to personalize Roxy's context:

```typescript
const conversation = await Conversation.startSession({
  agentId: 'agent_5101k6atqv7gezstbzcpvdqhvmgh',
  dynamicVariables: {
    manager_name: 'Sarah Johnson',
    manager_id: 'mgr_002',
    project_name: 'Riverside Complex',
    project_location: '456 River Rd, City, State'
  },
  // ... other options
});
```

### In ElevenLabs Agent Configuration

To use these variables in Roxy's prompt, reference them with `{{variable_name}}`:

```
Hello {{manager_name}}! I'm ready to help you with your daily report for {{project_name}}.

Let's go through today's information for the project at {{project_location}}.
```

### Benefits

✅ **No multiple agents needed** - One agent handles all users/projects
✅ **Personalized experience** - Roxy knows who she's talking to
✅ **Dynamic context** - Variables updated per session
✅ **Seamless flow** - No need for users to repeat their info

## Customizable Checklist

### Admin Interface

Location: `/admin/checklist` (component: `ChecklistAdmin.tsx`)

Admins can:
- ✏️ Edit question text
- 🔑 Modify keywords for auto-completion
- ✅ Mark items as required/optional
- ↕️ Reorder questions
- ➕ Add new items
- 🗑️ Delete items
- 📋 View generated agent prompt

### Configuration File

`frontend/src/config/checklistConfig.ts`

```typescript
interface ChecklistItem {
  id: string;
  question: string;
  keywords: string[];      // For auto-checking items
  required: boolean;       // Must be covered
  order: number;          // Display order
  category?: string;      // 'time' | 'personnel' | 'materials' | 'safety' | 'general'
}
```

### Default Checklist Items

Section 1 - Admin
1. Arrival time (required)
2. Departure time (required)
3. Personnel count (required)
4. Personnel names (required)
5. Weather (Optional)

Section 2 - On-Site Details
6. On-Site Team assignments (required)
7. On-Siete Team Activities (required)
8. Material deliveries (optional)

Section 3 - Off-Site/Specialty Work
9. Off-Site/Specialty Total Hours (optional)
10. Off-Site/Specialty Personnel Count (Optional)
11. Off-Site/Specialty Team Activities (Optional)

Section 4 - Issues
12. Constraints/delays (optional)
13. Safety incidents (required)
14. Additional notes (optional)

### How Keywords Work

During conversation, we monitor messages for keywords:

```typescript
keywords: ['arrive at site', 'arrival time', 'got to site', 'started work']
```

If any keyword is mentioned, that checklist item is auto-checked ✅

### Storage

- **LocalStorage**: `sitelogix_checklist_config`
- **Persistence**: Survives page reloads
- **Scope**: Per-browser (not synced across devices)

## Updating Roxy's Agent Prompt

### Option 1: Manual Update (Current)

1. Open ChecklistAdmin
2. Click "View Agent Prompt"
3. Copy the generated prompt
4. Go to [ElevenLabs Dashboard](https://elevenlabs.io/app/conversational-ai)
5. Select Roxy agent
6. Paste into System Prompt
7. Save

### Option 2: API Update (Future Enhancement)

```typescript
// Pseudo-code for future implementation
const updateAgentPrompt = async (newPrompt: string) => {
  await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
    method: 'PATCH',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: {
        prompt: newPrompt
      }
    })
  });
};
```

### Generated Prompt Format

```
You are Roxy, a helpful AI assistant for construction daily reports.

Your job is to conduct a friendly but thorough interview to collect the following information:

REQUIRED QUESTIONS (Follow the checklist above - they must be asked):
1. What time did you arrive at the site?
2. What time did you leave the site?
3. How many personnel were on site today?
...

OPTIONAL QUESTIONS (ask if relevant):
1. Were there any material deliveries?
2. Describe any constraints or delays
...

Be conversational and natural. Don't read these questions verbatim - adapt them to the flow of conversation.
```

## Knowledge Base (Future Enhancement)

ElevenLabs supports adding custom knowledge via:
- 📁 File uploads (PDF, TXT, etc.)
- 🔗 URL scraping
- 📝 Text blocks
- 💾 Limit: 20MB or 300k characters (non-enterprise)

### Potential Use Cases

- Project-specific safety procedures
- Company policies
- Personnel roster with specializations
- Vendor contact information
- Common construction terms/glossary

## Session Overrides

For advanced customization, ElevenLabs supports **overrides**:

```typescript
const conversation = await Conversation.startSession({
  agentId,
  overrides: {
    agent: {
      prompt: {
        prompt: customPromptForThisSession
      },
      firstMessage: "Hey! Ready for your daily report?"
    }
  }
});
```

⚠️ **Security Note**: Overrides must be enabled in agent's Security tab

## Best Practices

### 1. Dynamic Variables vs Overrides

✅ **Use Dynamic Variables for**:
- User names, IDs
- Project information
- Date/time values
- Simple personalization

❌ **Avoid Overrides for**:
- Simple variable substitution
- Frequently changing data

### 2. Checklist Design

- Keep questions clear and concise
- Use conversational language
- Include diverse keywords (people describe things differently)
- Mark time-critical items as required
- Group related questions together

### 3. Keyword Selection

Good keywords:
- ✅ "arrive at site", "arrival time", "got to site"
- ✅ Natural phrases users actually say

Bad keywords:
- ❌ Single words like "arrive" (too broad)
- ❌ Technical jargon users won't use

## API Endpoints Used

### Start Conversation
```
WebSocket: wss://api.elevenlabs.io/v1/convai/conversation
```

### Get Transcript
```
GET https://api.elevenlabs.io/v1/convai/conversations/{conversationId}
Header: xi-api-key: {API_KEY}
```

### Get Audio
```
GET https://api.elevenlabs.io/v1/convai/conversations/{conversationId}/audio
Header: xi-api-key: {API_KEY}
Returns: audio/webm (Opus codec)
```

## Environment Variables

```env
VITE_ELEVEN_LABS_API_KEY=sk_...
VITE_ELEVEN_LABS_AGENT_ID=agent_5101k6atqv7gezstbzcpvdqhvmgh
```

## Files Modified/Created

### Core Integration
- `src/hooks/useElevenLabsConversation.ts` - Updated to use dynamicVariables
- `src/components/VoiceReportingScreen.tsx` - Uses configurable checklist

### Checklist System
- `src/config/checklistConfig.ts` - Configuration and utilities
- `src/components/ChecklistAdmin.tsx` - Admin interface

## Next Steps

1. ✅ Dynamic variables implemented
2. ✅ Checklist customization working
3. 🔄 Test with real users
4. 🔄 Optionally: Add API integration to update agent prompt programmatically
5. 🔄 Optionally: Add knowledge base with company/project docs
6. 🔄 Optionally: Implement session overrides for special cases

## Support & Documentation

- [ElevenLabs Docs](https://elevenlabs.io/docs)
- [Dynamic Variables Guide](https://elevenlabs.io/docs/agents-platform/customization/personalization/dynamic-variables)
- [Conversational AI Overview](https://elevenlabs.io/docs/agents-platform/overview)
