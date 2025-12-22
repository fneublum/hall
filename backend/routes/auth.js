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

          // Check if user exists
          const existing = await db.users.findByEmail(email);
          if (existing) {
                  return res.status(400).json({ error: 'Email already registered' });
          }

          const passwordHash = await bcrypt.hash(password, 10);
          const userId = uuidv4();

          // Create user
          await db.users.create({
                  id: userId,
                  email,
                  name: name || email.split('@')[0],
                  password_hash: passwordHash
          });

          // Create session
          const token = uuidv4();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          await db.sessions.create({
                  id: uuidv4(),
                  user_id: userId,
                  token,
                  expires_at: expiresAt
          });

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

          const user = await db.users.findByEmail(email);
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

          await db.sessions.create({
                  id: uuidv4(),
                  user_id: user.id,
                  token,
                  expires_at: expiresAt
          });

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
router.post('/logout', async (req, res) => {
    const token = req.session?.token || req.headers['authorization']?.replace('Bearer ', '');

    if (token) {
          const session = await db.sessions.findByToken(token);
          if (session) {
                  await db.sessions.delete(session.id);
          }
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
                  let user = await db.users.findByEmail(googleUser.email);
                  if (!user) {
                            userId = uuidv4();
                            await db.users.create({
                                        id: userId,
                                        email: googleUser.email,
                                        name: googleUser.name
                            });
                  } else {
                            userId = user.id;
                  }
          }

          // Create or update account
          const { data: existingAccount } = await db.supabase
            .from('accounts')
            .select('id')
            .eq('user_id', userId)
            .eq('provider', 'google')
            .eq('name', googleUser.email)
            .single();

          const accountId = existingAccount?.id || uuidv4();
          const tokenExpiry = new Date(tokens.expiry_date).toISOString();

          if (existingAccount) {
                  await db.accounts.update(accountId, {
                            access_token: tokens.access_token,
                            refresh_token: tokens.refresh_token || undefined,
                            token_expiry: tokenExpiry
                  });
          } else {
                  await db.accounts.create({
                            id: accountId,
                            user_id: userId,
                            name: googleUser.email,
                            type: 'email',
                            provider: 'google',
                            access_token: tokens.access_token,
                            refresh_token: tokens.refresh_token,
                            token_expiry: tokenExpiry,
                            color: '#' + Math.floor(Math.random() * 16777215).toString(16)
                  });
          }

          // Create session
          const sessionToken = uuidv4();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          await db.sessions.create({
                  id: uuidv4(),
                  user_id: userId,
                  token: sessionToken,
                  expires_at: expiresAt
          });

          res.redirect(`${process.env.FRONTEND_URL}/dashboard.html?token=${sessionToken}`);
    } catch (error) {
          console.error('Google OAuth callback error:', error);
          res.redirect(`${process.env.FRONTEND_URL}?error=oauth_failed`);
    }
});

// Get current user
router.get('/me', async (req, res) => {
    const token = req.session?.token || req.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
          return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
          const { data: session } = await db.supabase
            .from('sessions')
            .select('*, users!inner(id, email, name)')
            .eq('token', token)
            .gt('expires_at', new Date().toISOString())
            .single();

          if (!session) {
                  return res.status(401).json({ error: 'Invalid or expired session' });
          }

          res.json({ user: session.users });
    } catch (error) {
          console.error('Get user error:', error);
          res.status(401).json({ error: 'Invalid or expired session' });
    }
});

module.exports = router;
