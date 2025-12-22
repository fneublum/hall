const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const claudeService = require('../services/claude');

// Store conversation history in memory (in production, use Redis or database)
const conversationStore = new Map();

router.use(authMiddleware);

// Send message to HALL AI
router.post('/', async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get or create conversation history
    const convId = conversationId || `${req.user.id}-${Date.now()}`;
    const history = conversationStore.get(convId) || [];
    
    const result = await claudeService.chat(req.user.id, message, history);
    
    // Store updated history
    conversationStore.set(convId, result.conversationHistory);
    
    // Clean up old conversations (keep last 100)
    if (conversationStore.size > 100) {
      const oldestKey = conversationStore.keys().next().value;
      conversationStore.delete(oldestKey);
    }
    
    res.json({
      response: result.response,
      conversationId: convId
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message', details: error.message });
  }
});

// Clear conversation
router.delete('/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  conversationStore.delete(conversationId);
  res.json({ success: true });
});

// Get conversation history
router.get('/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  const history = conversationStore.get(conversationId) || [];
  
  // Filter to only return user and assistant text messages
  const messages = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role,
      content: typeof m.content === 'string' 
        ? m.content 
        : m.content.find(c => c.type === 'text')?.text || ''
    }));
  
  res.json({ messages });
});

module.exports = router;
