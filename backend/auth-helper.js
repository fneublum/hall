/**
 * Run this once to get your Google refresh token
 * node auth-helper.js
 */

require('dotenv').config();
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/oauth/callback'
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/tasks'
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

console.log('\n1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Authorize the app, then wait...\n');

const server = http.createServer(async (req, res) => {
  const query = url.parse(req.url, true).query;
  
  if (query.code) {
    try {
      const { tokens } = await oauth2Client.getToken(query.code);
      
      console.log('✅ Success! Add this to your .env file:\n');
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      
      res.end('Success! Check your terminal for the refresh token. You can close this window.');
      server.close();
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      res.end('Error getting token');
    }
  }
});

server.listen(3000, () => {
  console.log('Waiting for OAuth callback on http://localhost:3000...');
});
