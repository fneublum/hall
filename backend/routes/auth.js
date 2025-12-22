const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { getAuthUrl, getTokensFromCode, oauth2Client } = require('../config/google');
const { google } = require('googleapis');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    db.prepare(`
      INSERT INTO users (id, email, name, password_hash)
      VALUES (?, ?, ?, ?)
    `).run(userId, email, name || email.split('@')[0], passwordHash);

    // Create session
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), userId, token, expiresAt);

    req.session.token = token;

    res.json({
      success: true,
      user: { id: userId, email, name: name || email.split('@')[0] },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), user.id, token, expiresAt);

    req.session.token = token;

    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  const token = req.session?.token || req.headers['authorization']?.replace('Bearer ', '');
  
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  
  req.session.destroy();
  res.json({ success: true });
});

// Google OAuth - Start
router.get('/google', (req, res) => {
  const userId = req.query.userId || req.session?.userId;
  const state = userId ? Buffer.from(JSON.stringify({ userId })).toString('base64') : '';
  const authUrl = getAuthUrl(state);
  res.redirect(authUrl);
});

// Google OAuth - Callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}?error=no_code`);
    }

    const tokens = await getTokensFromCode(code);
    
    // Get user info from Google
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    // Parse state to get userId
    let userId;
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        userId = stateData.userId;
      } catch (e) {}
    }

    // If no userId, create or find user
    if (!userId) {
      let user = db.prepare('SELECT id FROM users WHERE email = ?').get(googleUser.email);
      
      if (!user) {
        userId = uuidv4();
        db.prepare(`
          INSERT INTO users (id, email, name)
          VALUES (?, ?, ?)
        `).run(userId, googleUser.email, googleUser.name);
      } else {
        userId = user.id;
      }
    }

    // Create or update account
    const existingAccount = db.prepare(`
      SELECT id FROM accounts WHERE user_id = ? AND provider = 'google' AND name = ?
    `).get(userId, googleUser.email);

    const accountId = existingAccount?.id || uuidv4();
    const tokenExpiry = new Date(tokens.expiry_date).toISOString();

    if (existingAccount) {
      db.prepare(`
        UPDATE accounts 
        SET access_token = ?, refresh_token = COALESCE(?, refresh_token), token_expiry = ?
        WHERE id = ?
      `).run(tokens.access_token, tokens.refresh_token, tokenExpiry, accountId);
    } else {
      db.prepare(`
        INSERT INTO accounts (id, user_id, name, type, provider, access_token, refresh_token, token_expiry, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        accountId, userId, googleUser.email, 'email', 'google',
        tokens.access_token, tokens.refresh_token, tokenExpiry,
        '#' + Math.floor(Math.random()*16777215).toString(16)
      );
    }

    // Create session
    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), userId, sessionToken, expiresAt);

    res.redirect(`${process.env.FRONTEND_URL}/dashboard.html?token=${sessionToken}`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?error=oauth_failed`);
  }
});

// Get current user
router.get('/me', (req, res) => {
  const token = req.session?.token || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const session = db.prepare(`
    SELECT u.id, u.email, u.name 
    FROM sessions s 
    JOIN users u ON s.user_id = u.id 
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  res.json({ user: session });
});

module.exports = router;
