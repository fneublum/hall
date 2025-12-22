const { google } = require('googleapis');
const { setCredentials, refreshAccessToken } = require('../config/google');
const db = require('../config/database');

async function getAuthenticatedClient(accountId) {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  
  if (!account) {
    throw new Error('Account not found');
  }

  // Check if token needs refresh
  const tokenExpiry = new Date(account.token_expiry);
  if (tokenExpiry <= new Date()) {
    const newTokens = await refreshAccessToken(account.refresh_token);
    
    db.prepare(`
      UPDATE accounts 
      SET access_token = ?, token_expiry = ? 
      WHERE id = ?
    `).run(newTokens.access_token, new Date(newTokens.expiry_date).toISOString(), accountId);
    
    return setCredentials(newTokens);
  }

  return setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token
  });
}

// Gmail Service
async function getEmails(accountId, maxResults = 20) {
  const auth = await getAuthenticatedClient(accountId);
  const gmail = google.gmail({ version: 'v1', auth });

  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    labelIds: ['INBOX']
  });

  const messages = [];
  for (const msg of response.data.messages || []) {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date']
    });

    const headers = detail.data.payload.headers;
    messages.push({
      id: msg.id,
      from: headers.find(h => h.name === 'From')?.value || '',
      subject: headers.find(h => h.name === 'Subject')?.value || '',
      date: headers.find(h => h.name === 'Date')?.value || '',
      snippet: detail.data.snippet,
      isRead: !detail.data.labelIds?.includes('UNREAD')
    });
  }

  return messages;
}

async function sendEmail(accountId, to, subject, body) {
  const auth = await getAuthenticatedClient(accountId);
  const gmail = google.gmail({ version: 'v1', auth });

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    '',
    body
  ].join('\n');

  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage }
  });

  return response.data;
}

// Calendar Service
async function getCalendarEvents(accountId, maxResults = 10) {
  const auth = await getAuthenticatedClient(accountId);
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime'
  });

  return (response.data.items || []).map(event => ({
    id: event.id,
    title: event.summary,
    description: event.description,
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    location: event.location
  }));
}

async function createCalendarEvent(accountId, event) {
  const auth = await getAuthenticatedClient(accountId);
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: event.title,
      description: event.description,
      start: { dateTime: event.start, timeZone: 'UTC' },
      end: { dateTime: event.end, timeZone: 'UTC' },
      location: event.location
    }
  });

  return response.data;
}

// Tasks Service
async function getTasks(accountId) {
  const auth = await getAuthenticatedClient(accountId);
  const tasks = google.tasks({ version: 'v1', auth });

  // Get task lists
  const listsResponse = await tasks.tasklists.list();
  const taskList = listsResponse.data.items?.[0];

  if (!taskList) return [];

  const response = await tasks.tasks.list({
    tasklist: taskList.id,
    showCompleted: true
  });

  return (response.data.items || []).map(task => ({
    id: task.id,
    title: task.title,
    notes: task.notes,
    due: task.due,
    isCompleted: task.status === 'completed'
  }));
}

async function createTask(accountId, task) {
  const auth = await getAuthenticatedClient(accountId);
  const tasks = google.tasks({ version: 'v1', auth });

  const listsResponse = await tasks.tasklists.list();
  const taskList = listsResponse.data.items?.[0];

  if (!taskList) throw new Error('No task list found');

  const response = await tasks.tasks.insert({
    tasklist: taskList.id,
    requestBody: {
      title: task.title,
      notes: task.notes,
      due: task.due
    }
  });

  return response.data;
}

async function updateTask(accountId, taskId, updates) {
  const auth = await getAuthenticatedClient(accountId);
  const tasks = google.tasks({ version: 'v1', auth });

  const listsResponse = await tasks.tasklists.list();
  const taskList = listsResponse.data.items?.[0];

  if (!taskList) throw new Error('No task list found');

  const response = await tasks.tasks.patch({
    tasklist: taskList.id,
    task: taskId,
    requestBody: {
      status: updates.isCompleted ? 'completed' : 'needsAction',
      ...updates
    }
  });

  return response.data;
}

// Contacts Service
async function getContacts(accountId, maxResults = 100) {
  const auth = await getAuthenticatedClient(accountId);
  const people = google.people({ version: 'v1', auth });

  const response = await people.people.connections.list({
    resourceName: 'people/me',
    pageSize: maxResults,
    personFields: 'names,emailAddresses,phoneNumbers'
  });

  return (response.data.connections || []).map(person => ({
    id: person.resourceName,
    name: person.names?.[0]?.displayName || '',
    email: person.emailAddresses?.[0]?.value || '',
    phone: person.phoneNumbers?.[0]?.value || ''
  }));
}

module.exports = {
  getAuthenticatedClient,
  getEmails,
  sendEmail,
  getCalendarEvents,
  createCalendarEvent,
  getTasks,
  createTask,
  updateTask,
  getContacts
};
