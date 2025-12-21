const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

async function list({ timeMin, timeMax, maxResults = 10 }) {
  const now = new Date().toISOString();
  
  const res = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: timeMin || now,
    timeMax: timeMax,
    maxResults,
    singleEvents: true,
    orderBy: 'startTime'
  });

  return {
    events: res.data.items.map(e => ({
      id: e.id,
      summary: e.summary,
      start: e.start.dateTime || e.start.date,
      end: e.end.dateTime || e.end.date,
      description: e.description,
      attendees: e.attendees?.map(a => a.email)
    }))
  };
}

async function create({ summary, start, end, description, attendees = [] }) {
  const event = {
    summary,
    description,
    start: { dateTime: start, timeZone: 'America/New_York' },
    end: { dateTime: end, timeZone: 'America/New_York' },
    attendees: attendees.map(email => ({ email }))
  };

  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: event,
    sendUpdates: 'all'
  });

  return { success: true, eventId: res.data.id, link: res.data.htmlLink };
}

async function deleteEvent({ eventId }) {
  await calendar.events.delete({
    calendarId: CALENDAR_ID,
    eventId
  });

  return { success: true, deleted: eventId };
}

async function checkAvailability({ timeMin, timeMax }) {
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: CALENDAR_ID }]
    }
  });

  const busy = res.data.calendars[CALENDAR_ID].busy;
  return {
    available: busy.length === 0,
    busySlots: busy
  };
}

module.exports = { list, create, delete: deleteEvent, checkAvailability };
