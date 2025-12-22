const Anthropic = require('@anthropic-ai/sdk');
const googleService = require('./google');
const db = require('../config/database');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const SYSTEM_PROMPT = `You are HALL, an AI assistant integrated into a unified communication dashboard. You help users manage their emails, calendar, tasks, SMS, WhatsApp messages, and contacts across multiple accounts.

You have access to the following tools:
1. send_email - Send an email
2. create_event - Create a calendar event
3. create_task - Create a task
4. search_emails - Search through emails
5. get_calendar - Get upcoming calendar events
6. get_tasks - Get task list
7. get_contacts - Search contacts

When users ask you to perform actions, use the appropriate tools. Be concise and helpful.
For any action that modifies data (sending, creating, updating), confirm with the user first.`;

const TOOLS = [
  {
    name: 'send_email',
    description: 'Send an email to a recipient',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body content' },
        accountId: { type: 'string', description: 'Account ID to send from' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'create_event',
    description: 'Create a calendar event',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title' },
        start: { type: 'string', description: 'Start time in ISO format' },
        end: { type: 'string', description: 'End time in ISO format' },
        description: { type: 'string', description: 'Event description' },
        location: { type: 'string', description: 'Event location' },
        accountId: { type: 'string', description: 'Account ID' }
      },
      required: ['title', 'start', 'end']
    }
  },
  {
    name: 'create_task',
    description: 'Create a new task',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        notes: { type: 'string', description: 'Task notes' },
        due: { type: 'string', description: 'Due date in ISO format' },
        accountId: { type: 'string', description: 'Account ID' }
      },
      required: ['title']
    }
  },
  {
    name: 'get_emails',
    description: 'Get recent emails from inbox',
    input_schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account ID' },
        maxResults: { type: 'number', description: 'Maximum number of emails to retrieve' }
      }
    }
  },
  {
    name: 'get_calendar',
    description: 'Get upcoming calendar events',
    input_schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account ID' },
        maxResults: { type: 'number', description: 'Maximum number of events' }
      }
    }
  },
  {
    name: 'get_tasks',
    description: 'Get task list',
    input_schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account ID' }
      }
    }
  },
  {
    name: 'get_contacts',
    description: 'Get contacts list',
    input_schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account ID' },
        maxResults: { type: 'number', description: 'Maximum number of contacts' }
      }
    }
  }
];

async function executeToolCall(toolName, toolInput, userId) {
  // Get default account if not specified
  let accountId = toolInput.accountId;
  if (!accountId) {
    const defaultAccount = db.prepare(`
      SELECT id FROM accounts WHERE user_id = ? AND is_active = 1 LIMIT 1
    `).get(userId);
    accountId = defaultAccount?.id;
  }

  if (!accountId) {
    return { error: 'No active account found. Please connect an account first.' };
  }

  try {
    switch (toolName) {
      case 'send_email':
        return await googleService.sendEmail(accountId, toolInput.to, toolInput.subject, toolInput.body);
      
      case 'create_event':
        return await googleService.createCalendarEvent(accountId, {
          title: toolInput.title,
          start: toolInput.start,
          end: toolInput.end,
          description: toolInput.description,
          location: toolInput.location
        });
      
      case 'create_task':
        return await googleService.createTask(accountId, {
          title: toolInput.title,
          notes: toolInput.notes,
          due: toolInput.due
        });
      
      case 'get_emails':
        return await googleService.getEmails(accountId, toolInput.maxResults || 10);
      
      case 'get_calendar':
        return await googleService.getCalendarEvents(accountId, toolInput.maxResults || 10);
      
      case 'get_tasks':
        return await googleService.getTasks(accountId);
      
      case 'get_contacts':
        return await googleService.getContacts(accountId, toolInput.maxResults || 50);
      
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error);
    return { error: error.message };
  }
}

async function chat(userId, message, conversationHistory = []) {
  // Get user's accounts for context
  const accounts = db.prepare(`
    SELECT id, name, type, provider FROM accounts WHERE user_id = ? AND is_active = 1
  `).all(userId);

  const contextMessage = accounts.length > 0
    ? `\n\nUser has ${accounts.length} connected account(s): ${accounts.map(a => `${a.name} (${a.provider})`).join(', ')}`
    : '\n\nUser has no connected accounts yet.';

  const messages = [
    ...conversationHistory,
    { role: 'user', content: message }
  ];

  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT + contextMessage,
    tools: TOOLS,
    messages
  });

  // Handle tool use
  while (response.stop_reason === 'tool_use') {
    const toolUseBlock = response.content.find(block => block.type === 'tool_use');
    
    if (toolUseBlock) {
      const toolResult = await executeToolCall(toolUseBlock.name, toolUseBlock.input, userId);
      
      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify(toolResult)
        }]
      });

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT + contextMessage,
        tools: TOOLS,
        messages
      });
    }
  }

  // Extract text response
  const textContent = response.content.find(block => block.type === 'text');
  return {
    response: textContent?.text || 'I apologize, but I was unable to generate a response.',
    conversationHistory: messages
  };
}

module.exports = { chat, executeToolCall };
