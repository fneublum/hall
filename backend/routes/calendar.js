const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');
const googleService = require('../services/google');

router.use(authMiddleware);

// Get calendar events from all active accounts
router.get('/', async (req, res) => {
  try {
    const { maxResults = 20 } = req.query;
    
    const accounts = db.prepare(`
      SELECT id, name, color FROM accounts 
      WHERE user_id = ? AND is_active = 1 AND provider = 'google'
    `).all(req.user.id);
    
    const allEvents = [];
    
    for (const account of accounts) {
      try {
        const events = await googleService.getCalendarEvents(account.id, parseInt(maxResults));
        allEvents.push(...events.map(e => ({
          ...e,
          accountId: account.id,
          accountName: account.name,
          accountColor: account.color
        })));
      } catch (error) {
        console.error(`Failed to get events for account ${account.id}:`, error);
      }
    }
    
    // Sort by start time
    allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    res.json({ events: allEvents.slice(0, parseInt(maxResults)) });
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({ error: 'Failed to get calendar events' });
  }
});

// Get today's events
router.get('/today', async (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT id, name, color FROM accounts 
      WHERE user_id = ? AND is_active = 1 AND provider = 'google'
    `).all(req.user.id);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const allEvents = [];
    
    for (const account of accounts) {
      try {
        const events = await googleService.getCalendarEvents(account.id, 50);
        const todayEvents = events.filter(e => {
          const eventDate = new Date(e.start);
          return eventDate >= today && eventDate < tomorrow;
        });
        allEvents.push(...todayEvents.map(e => ({
          ...e,
          accountId: account.id,
          accountName: account.name,
          accountColor: account.color
        })));
      } catch (error) {
        console.error(`Failed to get events for account ${account.id}:`, error);
      }
    }
    
    allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    res.json({ events: allEvents });
  } catch (error) {
    console.error('Get today events error:', error);
    res.status(500).json({ error: 'Failed to get today events' });
  }
});

// Create calendar event
router.post('/', async (req, res) => {
  try {
    const { accountId, title, start, end, description, location } = req.body;
    
    if (!title || !start || !end) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    let targetAccountId = accountId;
    if (!targetAccountId) {
      const defaultAccount = db.prepare(`
        SELECT id FROM accounts WHERE user_id = ? AND is_active = 1 AND provider = 'google' LIMIT 1
      `).get(req.user.id);
      targetAccountId = defaultAccount?.id;
    }
    
    if (!targetAccountId) {
      return res.status(400).json({ error: 'No account available' });
    }
    
    const result = await googleService.createCalendarEvent(targetAccountId, {
      title, start, end, description, location
    });
    
    res.json({ success: true, event: result });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

module.exports = router;
