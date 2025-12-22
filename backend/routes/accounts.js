const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

router.use(authMiddleware);

// Get all accounts for user
router.get('/', async (req, res) => {
    try {
          const accounts = await db.accounts.findByUserId(req.user.id);
          res.json({ accounts });
    } catch (error) {
          console.error('Get accounts error:', error);
          res.status(500).json({ error: 'Failed to get accounts' });
    }
});

// Toggle account active status
router.patch('/:id/toggle', async (req, res) => {
    try {
          const { id } = req.params;

          // Get account
          const account = await db.accounts.findById(id);

          if (!account || account.user_id !== req.user.id) {
                  return res.status(404).json({ error: 'Account not found' });
          }

          // Toggle active status
          await db.accounts.update(id, {
                  is_active: !account.is_active
          });

          res.json({ success: true, is_active: !account.is_active });
    } catch (error) {
          console.error('Toggle account error:', error);
          res.status(500).json({ error: 'Failed to toggle account' });
    }
});

// Update account
router.patch('/:id', async (req, res) => {
    try {
          const { id } = req.params;
          const { name, color, is_active } = req.body;

          // Check ownership
          const account = await db.accounts.findById(id);

          if (!account || account.user_id !== req.user.id) {
                  return res.status(404).json({ error: 'Account not found' });
          }

          // Build updates object
          const updates = {};
          if (name !== undefined) updates.name = name;
          if (color !== undefined) updates.color = color;
          if (is_active !== undefined) updates.is_active = is_active;

          await db.accounts.update(id, updates);

          res.json({ success: true });
    } catch (error) {
          console.error('Update account error:', error);
          res.status(500).json({ error: 'Failed to update account' });
    }
});

// Delete account
router.delete('/:id', async (req, res) => {
    try {
          const { id } = req.params;

          // Check ownership
          const account = await db.accounts.findById(id);

          if (!account || account.user_id !== req.user.id) {
                  return res.status(404).json({ error: 'Account not found' });
          }

          await db.accounts.delete(id);

          res.json({ success: true });
    } catch (error) {
          console.error('Delete account error:', error);
          res.status(500).json({ error: 'Failed to delete account' });
    }
});

module.exports = router;
