const Anthropic = require('@anthropic-ai/sdk');
const gmail = require('./tools/gmail');
const calendar = require('./tools/calendar');
const contacts = require('./tools/contacts');
const tasks = require('./tools/tasks');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Hall, an intelligent productivity assistant. Current time: ${new Date().toISOString()}. Timezone: America/New_York.

You help manage:
- Email (Gmail): Read, send, reply, draft, label emails
- Calendar: Check availability, create/update/delete events
- Contacts: Search, create, update contacts
- Tasks: Create, complete, list tasks

Be concise in responses. Confirm actions taken. Ask for clarification if needed.`;

const TOOLS = [
  // Gmail Tools
  {
    name: 'gmail_send',
    description: 'Send an email',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (HTML supported)' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'gmail_read',
    description: 'Get recent emails or search emails',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (optional)' },
        maxResults: { type: 'number', description: 'Max emails to return', default: 10 }
      }
    }
  },
  {
    name: 'gmail_reply',
    description: 'Reply to an email',
    input_schema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'ID of email to reply to' },
        body: { type: 'string', description: 'Reply body' }
      },
      required: ['messageId', 'body']
    }
  },
  // Calendar Tools
  {
    name: 'calendar_list',
    description: 'Get upcoming events',
    input_schema: {
      type: 'object',
      properties: {
        timeMin: { type: 'string', description: 'Start time (ISO format)' },
        timeMax: { type: 'string', description: 'End time (ISO format)' },
        maxResults: { type: 'number', default: 10 }
      }
    }
  },
  {
    name: 'calendar_create',
    description: 'Create a calendar event',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title' },
        start: { type: 'string', description: 'Start time (ISO format)' },
        end: { type: 'string', description: 'End time (ISO format)' },
        description: { type: 'string', description: 'Event description' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails' }
      },
      required: ['summary', 'start', 'end']
    }
  },
  {
    name: 'calendar_delete',
    description: 'Delete a calendar event',
    input_schema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID to delete' }
      },
      required: ['eventId']
    }
  },
  {
    name: 'calendar_availability',
    description: 'Check if a time slot is available',
    input_schema: {
      type: 'object',
      properties: {
        timeMin: { type: 'string', description: 'Start time (ISO format)' },
        timeMax: { type: 'string', description: 'End time (ISO format)' }
      },
      required: ['timeMin', 'timeMax']
    }
  },
  // Contacts Tools
  {
    name: 'contacts_search',
    description: 'Search contacts by name or email',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' }
      },
      required: ['query']
    }
  },
  {
    name: 'contacts_create',
    description: 'Create a new contact',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Contact name' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' }
      },
      required: ['name']
    }
  },
  // Tasks Tools
  {
    name: 'tasks_list',
    description: 'Get tasks from a task list',
    input_schema: {
      type: 'object',
      properties: {
        showCompleted: { type: 'boolean', default: false }
      }
    }
  },
  {
    name: 'tasks_create',
    description: 'Create a new task',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        notes: { type: 'string', description: 'Task notes' },
        due: { type: 'string', description: 'Due date (ISO format)' }
      },
      required: ['title']
    }
  },
  {
    name: 'tasks_complete',
    description: 'Mark a task as complete',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID' }
      },
      required: ['taskId']
    }
  }
];

// Tool executor
async function executeTool(name, input) {
  console.log(`Executing tool: ${name}`, input);
  
  try {
    switch (name) {
      // Gmail
      case 'gmail_send': return await gmail.send(input);
      case 'gmail_read': return await gmail.read(input);
      case 'gmail_reply': return await gmail.reply(input);
      // Calendar
      case 'calendar_list': return await calendar.list(input);
      case 'calendar_create': return await calendar.create(input);
      case 'calendar_delete': return await calendar.delete(input);
      case 'calendar_availability': return await calendar.checkAvailability(input);
      // Contacts
      case 'contacts_search': return await contacts.search(input);
      case 'contacts_create': return await contacts.create(input);
      // Tasks
      case 'tasks_list': return await tasks.list(input);
      case 'tasks_create': return await tasks.create(input);
      case 'tasks_complete': return await tasks.complete(input);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    console.error(`Tool error (${name}):`, error);
    return { error: error.message };
  }
}

async function processMessage(userMessage, history = []) {
  const messages = [
    ...history,
    { role: 'user', content: userMessage }
  ];

  let response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages
  });

  // Handle tool calls iteratively
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    const toolResults = [];

    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(toolUse.name, toolUse.input);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result)
      });
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages
    });
  }

  // Extract text response
  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text || 'Done.';
}

module.exports = { processMessage };
