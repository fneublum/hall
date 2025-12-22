const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');
const googleService = require('../services/google');

router.use(authMiddleware);

// Get contacts from all active accounts
router.get('/', async (req, res) => {
  try {
    const { maxResults = 100, search } = req.query;
    
    const accounts = db.prepare(`
      SELECT id, name, color FROM accounts 
      WHERE user_id = ? AND is_active = 1 AND provider = 'google'
    `).all(req.user.id);
    
    let allContacts = [];
    
    for (const account of accounts) {
      try {
        const contacts = await googleService.getContacts(account.id, parseInt(maxResults));
        allContacts.push(...contacts.map(c => ({
          ...c,
          accountId: account.id,
          accountName: account.name,
          accountColor: account.color
        })));
      } catch (error) {
        console.error(`Failed to get contacts for account ${account.id}:`, error);
      }
    }
    
    // Filter by search term if provided
    if (search) {
      const searchLower = search.toLowerCase();
      allContacts = allContacts.filter(c => 
        c.name?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower) ||
        c.phone?.includes(search)
      );
    }
    
    // Sort by name
    allContacts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    res.json({ contacts: allContacts.slice(0, parseInt(maxResults)) });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to get contacts' });
  }
});

// Search contacts by name or email
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const accounts = db.prepare(`
      SELECT id, name, color FROM accounts 
      WHERE user_id = ? AND is_active = 1 AND provider = 'google'
    `).all(req.user.id);
    
    const searchLower = q.toLowerCase();
    const matchingContacts = [];
    
    for (const account of accounts) {
      try {
        const contacts = await googleService.getContacts(account.id, 200);
        const matches = contacts.filter(c => 
          c.name?.toLowerCase().includes(searchLower) ||
          c.email?.toLowerCase().includes(searchLower)
        );
        matchingContacts.push(...matches.map(c => ({
          ...c,
          accountId: account.id,
          accountName: account.name,
          accountColor: account.color
        })));
      } catch (error) {
        console.error(`Failed to search contacts for account ${account.id}:`, error);
      }
    }
    
    res.json({ contacts: matchingContacts.slice(0, 20) });
  } catch (error) {
    console.error('Search contacts error:', error);
    res.status(500).json({ error: 'Failed to search contacts' });
  }
});

module.exports = router;
