const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');
const googleService = require('../services/google');

router.use(authMiddleware);

// Get emails from all active accounts
router.get('/', async (req, res) => {
  try {
    const { maxResults = 20 } = req.query;
    
    const accounts = db.prepare(`
      SELECT id, name, color FROM accounts 
      WHERE user_id = ? AND is_active = 1 AND provider = 'google'
    `).all(req.user.id);
    
    const allEmails = [];
    
    for (const account of accounts) {
      try {
        const emails = await googleService.getEmails(account.id, parseInt(maxResults));
        allEmails.push(...emails.map(e => ({
          ...e,
          accountId: account.id,
          accountName: account.name,
          accountColor: account.color
        })));
      } catch (error) {
        console.error(`Failed to get emails for account ${account.id}:`, error);
      }
    }
    
    // Sort by date
    allEmails.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json({ emails: allEmails.slice(0, parseInt(maxResults)) });
  } catch (error) {
    console.error('Get emails error:', error);
    res.status(500).json({ error: 'Failed to get emails' });
  }
});

// Get emails from specific account
router.get('/account/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { maxResults = 20 } = req.query;
    
    const account = db.prepare(`
      SELECT id FROM accounts WHERE id = ? AND user_id = ?
    `).get(accountId, req.user.id);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const emails = await googleService.getEmails(accountId, parseInt(maxResults));
    res.json({ emails });
  } catch (error) {
    console.error('Get emails error:', error);
    res.status(500).json({ error: 'Failed to get emails' });
  }
});

// Send email
router.post('/send', async (req, res) => {
  try {
    const { accountId, to, subject, body } = req.body;
    
    if (!to || !subject || !body) {
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
    
    const result = await googleService.sendEmail(targetAccountId, to, subject, body);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

module.exports = router;
