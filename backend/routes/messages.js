const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');

router.use(authMiddleware);

// Get messages for an account
router.get('/account/:accountId', async (req, res) => {
    try {
          const { accountId } = req.params;
          const { limit = 50 } = req.query;

          const account = await db.accounts.findById(accountId);

          if (!account || account.user_id !== req.user.id) {
                  return res.status(404).json({ error: 'Account not found' });
          }

          const messages = await db.messages.findByAccountId(accountId, parseInt(limit));
          res.json({ messages });
    } catch (error) {
          console.error('Get messages error:', error);
          res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Create a message
router.post('/', async (req, res) => {
    try {
          const { accountId, content, direction, externalId } = req.body;

          if (!accountId || !content) {
                  return res.status(400).json({ error: 'Account ID and content are required' });
          }

          const account = await db.accounts.findById(accountId);

          if (!account || account.user_id !== req.user.id) {
                  return res.status(404).json({ error: 'Account not found' });
          }

          const message = await db.messages.create({
                  account_id: accountId,
                  content,
                  direction: direction || 'outgoing',
                  external_id: externalId,
                  is_read: direction === 'outgoing'
          });

          res.json({ success: true, message });
    } catch (error) {
          console.error('Create message error:', error);
          res.status(500).json({ error: 'Failed to create message' });
    }
});

// Mark message as read
router.patch('/:id/read', async (req, res) => {
    try {
          const { id } = req.params;

          await db.messages.markAsRead(id);
          res.json({ success: true });
    } catch (error) {
          console.error('Mark message read error:', error);
          res.status(500).json({ error: 'Failed to mark message as read' });
    }
});

module.exports = router;
