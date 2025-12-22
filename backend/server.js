require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');

// Import routes
const authRoutes = require('./routes/auth');
const accountsRoutes = require('./routes/accounts');
const emailRoutes = require('./routes/email');
const calendarRoutes = require('./routes/calendar');
const tasksRoutes = require('./routes/tasks');
const contactsRoutes = require('./routes/contacts');
const messagesRoutes = require('./routes/messages');
const chatRoutes = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3000;

// Store for pending WhatsApp verifications (in production, use database)
const pendingVerifications = new Map();

// Middleware
app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5500',
      credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
      secret: process.env.SESSION_SECRET || 'hall-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
              secure: process.env.NODE_ENV === 'production',
              httpOnly: true,
              maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      }
}));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WhatsApp Webhook - receives incoming messages from Twilio
app.post('/api/webhook/whatsapp', async (req, res) => {
      try {
              const { Body, From, To } = req.body;
              const messageBody = (Body || '').trim().toUpperCase();
              const fromNumber = From ? From.replace('whatsapp:', '') : '';

              console.log('WhatsApp webhook received:', { from: fromNumber, body: messageBody });

              // Handle SETUP command
              if (messageBody === 'SETUP') {
                        // Generate a 6-digit verification code
                        const verificationCode = crypto.randomInt(100000, 999999).toString();

                        // Store the pending verification (expires in 10 minutes)
                        pendingVerifications.set(verificationCode, {
                                    phoneNumber: fromNumber,
                                    createdAt: Date.now(),
                                    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
                        });

                        // Clean up expired codes
                        for (const [code, data] of pendingVerifications.entries()) {
                                    if (Date.now() > data.expiresAt) {
                                                  pendingVerifications.delete(code);
                                    }
                        }

                        // Send response via Twilio
                        const twilioClient = require('twilio')(
                                    process.env.TWILIO_SID,
                                    process.env.TWILIO_AUTH
                                  );

                        await twilioClient.messages.create({
                                    body: `Welcome to HALL! Your verification code is: ${verificationCode}\n\nEnter this code in the HALL app to connect your WhatsApp.\n\nThis code expires in 10 minutes.`,
                                    from: To,
                                    to: From
                        });

                        console.log('Verification code sent:', verificationCode, 'to', fromNumber);
              }

              // Respond to Twilio with empty TwiML
              res.type('text/xml');
              res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      } catch (error) {
              console.error('WhatsApp webhook error:', error);
              res.type('text/xml');
              res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }
});

// API endpoint to verify WhatsApp code and link account
app.post('/api/verify-whatsapp', async (req, res) => {
      try {
              const { code, userId } = req.body;

              if (!code || !userId) {
                        return res.status(400).json({ error: 'Code and userId are required' });
              }

              const verification = pendingVerifications.get(code);

              if (!verification) {
                        return res.status(400).json({ error: 'Invalid or expired verification code' });
              }

              if (Date.now() > verification.expiresAt) {
                        pendingVerifications.delete(code);
                        return res.status(400).json({ error: 'Verification code has expired' });
              }

              // Link the WhatsApp number to the user account
              const db = require('./config/database');

              // Create or update the WhatsApp account for this user
              const { data: existingAccount } = await db.supabase
                .from('accounts')
                .select('*')
                .eq('user_id', userId)
                .eq('type', 'whatsapp')
                .single();

              if (existingAccount) {
                        // Update existing account
                        await db.supabase
                          .from('accounts')
                          .update({ 
                                        provider_id: verification.phoneNumber,
                                        is_active: true,
                                        updated_at: new Date().toISOString()
                          })
                          .eq('id', existingAccount.id);
              } else {
                        // Create new WhatsApp account
                        await db.supabase
                          .from('accounts')
                          .insert({
                                        user_id: userId,
                                        name: 'WhatsApp',
                                        type: 'whatsapp',
                                        provider: 'twilio',
                                        provider_id: verification.phoneNumber,
                                        is_active: true,
                                        color: '#25D366'
                          });
              }

              // Remove the used verification code
              pendingVerifications.delete(code);

              res.json({ 
                        success: true, 
                        message: 'WhatsApp connected successfully',
                        phoneNumber: verification.phoneNumber 
              });
      } catch (error) {
              console.error('Verify WhatsApp error:', error);
              res.status(500).json({ error: 'Failed to verify WhatsApp' });
      }
});

// Dashboard data - aggregated endpoint
app.get('/api/dashboard', async (req, res) => {
      const token = req.session?.token || req.headers['authorization']?.replace('Bearer ', '');

      if (!token) {
              return res.status(401).json({ error: 'Authentication required' });
      }

      try {
              const db = require('./config/database');

              // Get session using Supabase
              const { data: sessionData, error: sessionError } = await db.supabase
                .from('sessions')
                .select('user_id')
                .eq('token', token)
                .gt('expires_at', new Date().toISOString())
                .single();

              if (sessionError || !sessionData) {
                        return res.status(401).json({ error: 'Invalid session' });
              }

              // Get accounts using Supabase
              const { data: accounts, error: accountsError } = await db.supabase
                .from('accounts')
                .select('id, name, type, provider, is_active, color')
                .eq('user_id', sessionData.user_id)
                .eq('is_active', true);

              if (accountsError) {
                        throw accountsError;
              }

              res.json({
                        accounts: accounts || [],
                        summary: {
                                    emailCount: 0,
                                    whatsappCount: 0,
                                    smsCount: 0,
                                    todayEvents: 0,
                                    pendingTasks: 0
                        }
              });
      } catch (error) {
              console.error('Dashboard error:', error);
              res.status(500).json({ error: 'Failed to load dashboard' });
      }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
      console.error('Server error:', err);
      res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
      console.log(`
      ╔═══════════════════════════════════════════╗
      ║           HALL Backend Server             ║
      ╠═══════════════════════════════════════════╣
      ║  Status: Running                          ║
      ║  Port:   ${PORT}                             ║
      ║  URL:    http://localhost:${PORT}            ║
      ╚═══════════════════════════════════════════╝
      `);
});

module.exports = app;
