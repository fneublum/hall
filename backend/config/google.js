const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

function getAuthUrl(state = '') {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: state,
    prompt: 'consent'
  });
}

async function getTokensFromCode(code) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

function setCredentials(tokens) {
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

async function refreshAccessToken(refreshToken) {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

module.exports = {
  oauth2Client,
  SCOPES,
  getAuthUrl,
  getTokensFromCode,
  setCredentials,
  refreshAccessToken
};
