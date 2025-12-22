const db = require('../config/database');

function authMiddleware(req, res, next) {
  const sessionToken = req.session?.token || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!sessionToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const session = db.prepare(`
      SELECT s.*, u.id as user_id, u.email, u.name 
      FROM sessions s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(sessionToken);

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.user = {
      id: session.user_id,
      email: session.email,
      name: session.name
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

function optionalAuth(req, res, next) {
  const sessionToken = req.session?.token || req.headers['authorization']?.replace('Bearer ', '');
  
  if (sessionToken) {
    try {
      const session = db.prepare(`
        SELECT s.*, u.id as user_id, u.email, u.name 
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.token = ? AND s.expires_at > datetime('now')
      `).get(sessionToken);

      if (session) {
        req.user = {
          id: session.user_id,
          email: session.email,
          name: session.name
        };
      }
    } catch (error) {
      console.error('Optional auth error:', error);
    }
  }
  
  next();
}

module.exports = { authMiddleware, optionalAuth };
