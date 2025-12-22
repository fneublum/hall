const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');
const googleService = require('../services/google');

router.use(authMiddleware);

// Get contacts from all active accounts
router.get('/', async (req, res) => {
    try {
          const { data: accounts } = await db.supabase
            .from('accounts')
            .select('id, name, color')
            .eq('user_id', req.user.id)
            .eq('is_active', true)
            .eq('provider', 'google');

          const allContacts = [];

          for (const account of (accounts || [])) {
                  try {
                            const contacts = await googleService.getContacts(account.id);
                            allContacts.push(...contacts.map(c => ({
                                        ...c,
                                        accountId: account.id,
                                        accountName: account.name,
                                        accountColor: account.color
                            })));
                  } catch (error) {
                            console.error('Failed to get contacts for account', account.id, error);
                  }
          }

          allContacts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          res.json({ contacts: allContacts });
    } catch (error) {
          console.error('Get contacts error:', error);
          res.status(500).json({ error: 'Failed to get contacts' });
    }
});

// Search contacts
router.get('/search', async (req, res) => {
    try {
          const { q } = req.query;

          if (!q) {
                  return res.json({ contacts: [] });
          }

          const { data: accounts } = await db.supabase
            .from('accounts')
            .select('id, name, color')
            .eq('user_id', req.user.id)
            .eq('is_active', true)
            .eq('provider', 'google');

          const allContacts = [];

          for (const account of (accounts || [])) {
                  try {
                            const contacts = await googleService.searchContacts(account.id, q);
                            allContacts.push(...contacts.map(c => ({
                                        ...c,
                                        accountId: account.id,
                                        accountName: account.name,
                                        accountColor: account.color
                            })));
                  } catch (error) {
                            console.error('Failed to search contacts for account', account.id, error);
                  }
          }

          res.json({ contacts: allContacts });
    } catch (error) {
          console.error('Search contacts error:', error);
          res.status(500).json({ error: 'Failed to search contacts' });
    }
});

module.exports = router;
