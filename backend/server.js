require('dotenv').config();
const express = require('express');
const { processMessage } = require('./claude');
const twilio = require('twilio');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

// Memory store (use Redis in production)
const memory = new Map();

// WhatsApp webhook from Twilio
app.post('/webhook/whatsapp', async (req, res) => {
  try {
    const { From, Body, NumMedia } = req.body;
    const userId = From;
    
    console.log(`Message from ${From}: ${Body}`);
    
    // Get conversation history
    const history = memory.get(userId) || [];
    
    // Process with Claude
    const response = await processMessage(Body, history);
    
    // Update memory (keep last 20 messages)
    history.push({ role: 'user', content: Body });
    history.push({ role: 'assistant', content: response });
    if (history.length > 40) history.splice(0, 2);
    memory.set(userId, history);
    
    // Send response via WhatsApp
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: From,
      body: response.substring(0, 1600) // Twilio limit
    });
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error');
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Dev endpoint for testing without Twilio
app.post('/chat', async (req, res) => {
  try {
    const { message, userId = 'dev' } = req.body;
    const history = memory.get(userId) || [];
    
    const response = await processMessage(message, history);
    
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: response });
    if (history.length > 40) history.splice(0, 2);
    memory.set(userId, history);
    
    res.json({ response });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HALL running on port ${PORT}`));
