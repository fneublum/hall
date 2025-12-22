require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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

// Dashboard data - aggregated endpoint
app.get('/api/dashboard', async (req, res) => {
  const token = req.session?.token || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const db = require('./config/database');
    const session = db.prepare(`
      SELECT u.id as user_id FROM sessions s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token);
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    const accounts = db.prepare(`
      SELECT id, name, type, provider, is_active, color
      FROM accounts WHERE user_id = ? AND is_active = 1
    `).all(session.user_id);
    
    res.json({
      accounts,
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
║  Status:  Running                         ║
║  Port:    ${PORT}                            ║
║  URL:     http://localhost:${PORT}           ║
╚═══════════════════════════════════════════╝
  `);
});

module.exports = app;
