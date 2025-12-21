const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

async function send({ to, subject, body }) {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    body
  ].join('\n');

  const encoded = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded }
  });

  return { success: true, messageId: res.data.id };
}

async function read({ query = '', maxResults = 10 }) {
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults
  });

  const messages = res.data.messages || [];
  const detailed = [];

  for (const msg of messages.slice(0, 5)) {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date']
    });

    const headers = detail.data.payload.headers;
    detailed.push({
      id: msg.id,
      from: headers.find(h => h.name === 'From')?.value,
      subject: headers.find(h => h.name === 'Subject')?.value,
      date: headers.find(h => h.name === 'Date')?.value,
      snippet: detail.data.snippet
    });
  }

  return { emails: detailed, total: messages.length };
}

async function reply({ messageId, body }) {
  // Get original message for threading
  const original = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'Subject', 'Message-ID']
  });

  const headers = original.data.payload.headers;
  const from = headers.find(h => h.name === 'From')?.value;
  const subject = headers.find(h => h.name === 'Subject')?.value;
  const msgId = headers.find(h => h.name === 'Message-ID')?.value;

  const message = [
    `To: ${from}`,
    `Subject: Re: ${subject}`,
    `In-Reply-To: ${msgId}`,
    `References: ${msgId}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    body
  ].join('\n');

  const encoded = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encoded,
      threadId: original.data.threadId
    }
  });

  return { success: true, messageId: res.data.id };
}

module.exports = { send, read, reply };
