const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

router.use(authMiddleware);

// Get all accounts for user
router.get('/', (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT id, name, type, provider, is_active, color, created_at
      FROM accounts WHERE user_id = ?
    `).all(req.user.id);
    
    res.json({ accounts });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

// Toggle account active status
router.patch('/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    
    const account = db.prepare(`
      SELECT * FROM accounts WHERE id = ? AND user_id = ?
    `).get(id, req.user.id);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    db.prepare(`
      UPDATE accounts SET is_active = ? WHERE id = ?
    `).run(account.is_active ? 0 : 1, id);
    
    res.json({ success: true, is_active: !account.is_active });
  } catch (error) {
    console.error('Toggle account error:', error);
    res.status(500).json({ error: 'Failed to toggle account' });
  }
});

// Update account
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, is_active } = req.body;
    
    const account = db.prepare(`
      SELECT * FROM accounts WHERE id = ? AND user_id = ?
    `).get(id, req.user.id);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    db.prepare(`
      UPDATE accounts 
      SET name = COALESCE(?, name), color = COALESCE(?, color), is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(name, color, is_active, id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// Delete account
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const result = db.prepare(`
      DELETE FROM accounts WHERE id = ? AND user_id = ?
    `).run(id, req.user.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
