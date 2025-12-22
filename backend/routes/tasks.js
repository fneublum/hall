const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');
const googleService = require('../services/google');

router.use(authMiddleware);

// Get tasks from all active accounts
router.get('/', async (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT id, name, color FROM accounts 
      WHERE user_id = ? AND is_active = 1 AND provider = 'google'
    `).all(req.user.id);
    
    const allTasks = [];
    
    for (const account of accounts) {
      try {
        const tasks = await googleService.getTasks(account.id);
        allTasks.push(...tasks.map(t => ({
          ...t,
          accountId: account.id,
          accountName: account.name,
          accountColor: account.color
        })));
      } catch (error) {
        console.error(`Failed to get tasks for account ${account.id}:`, error);
      }
    }
    
    // Sort: incomplete first, then by due date
    allTasks.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due) - new Date(b.due);
    });
    
    res.json({ tasks: allTasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// Create task
router.post('/', async (req, res) => {
  try {
    const { accountId, title, notes, due } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
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
    
    const result = await googleService.createTask(targetAccountId, { title, notes, due });
    res.json({ success: true, task: result });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.patch('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { accountId, isCompleted, title, notes, due } = req.body;
    
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }
    
    const account = db.prepare(`
      SELECT id FROM accounts WHERE id = ? AND user_id = ?
    `).get(accountId, req.user.id);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const updates = {};
    if (isCompleted !== undefined) updates.isCompleted = isCompleted;
    if (title !== undefined) updates.title = title;
    if (notes !== undefined) updates.notes = notes;
    if (due !== undefined) updates.due = due;
    
    const result = await googleService.updateTask(accountId, taskId, updates);
    res.json({ success: true, task: result });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

module.exports = router;
