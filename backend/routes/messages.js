const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const twilioService = require('../services/twilio');

router.use(authMiddleware);

// Get all messages (SMS + WhatsApp)
router.get('/', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const messages = await twilioService.getMessages(parseInt(limit));
    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages', details: error.message });
  }
});

// Get SMS messages only
router.get('/sms', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const messages = await twilioService.getSMSMessages(parseInt(limit));
    res.json({ messages });
  } catch (error) {
    console.error('Get SMS error:', error);
    res.status(500).json({ error: 'Failed to get SMS messages', details: error.message });
  }
});

// Get WhatsApp messages only
router.get('/whatsapp', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const messages = await twilioService.getWhatsAppMessages(parseInt(limit));
    res.json({ messages });
  } catch (error) {
    console.error('Get WhatsApp error:', error);
    res.status(500).json({ error: 'Failed to get WhatsApp messages', details: error.message });
  }
});

// Send SMS
router.post('/sms', async (req, res) => {
  try {
    const { to, body } = req.body;
    
    if (!to || !body) {
      return res.status(400).json({ error: 'Phone number and message body required' });
    }
    
    const result = await twilioService.sendSMS(to, body);
    res.json({ success: true, message: result });
  } catch (error) {
    console.error('Send SMS error:', error);
    res.status(500).json({ error: 'Failed to send SMS', details: error.message });
  }
});

// Send WhatsApp message
router.post('/whatsapp', async (req, res) => {
  try {
    const { to, body } = req.body;
    
    if (!to || !body) {
      return res.status(400).json({ error: 'Phone number and message body required' });
    }
    
    const result = await twilioService.sendWhatsApp(to, body);
    res.json({ success: true, message: result });
  } catch (error) {
    console.error('Send WhatsApp error:', error);
    res.status(500).json({ error: 'Failed to send WhatsApp message', details: error.message });
  }
});

module.exports = router;
