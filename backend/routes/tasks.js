const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');
const googleService = require('../services/google');

router.use(authMiddleware);

// Get tasks from all active accounts
router.get('/', async (req, res) => {
    try {
          const { data: accounts } = await db.supabase
            .from('accounts')
            .select('id, name, color')
            .eq('user_id', req.user.id)
            .eq('is_active', true)
            .eq('provider', 'google');

          const allTasks = [];

          for (const account of (accounts || [])) {
                  try {
                            const tasks = await googleService.getTasks(account.id);
                            allTasks.push(...tasks.map(t => ({
                                        ...t,
                                        accountId: account.id,
                                        accountName: account.name,
                                        accountColor: account.color
                            })));
                  } catch (error) {
                            console.error('Failed to get tasks for account', account.id, error);
                  }
          }

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
                  const { data: defaultAccount } = await db.supabase
                    .from('accounts')
                    .select('id')
                    .eq('user_id', req.user.id)
                    .eq('is_active', true)
                    .eq('provider', 'google')
                    .limit(1)
                    .single();

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

          const account = await db.accounts.findById(accountId);

          if (!account || account.user_id !== req.user.id) {
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
