const db = require('../config/database');

async function authMiddleware(req, res, next) {
    const sessionToken = req.session?.token || req.headers['authorization']?.replace('Bearer ', '');

    if (!sessionToken) {
          return res.status(401).json({ error: 'Authentication required' });
    }

    try {
          // Get session from Supabase
          const { data: session, error: sessionError } = await db.supabase
            .from('sessions')
            .select('*, users!inner(id, email, name)')
            .eq('token', sessionToken)
            .gt('expires_at', new Date().toISOString())
            .single();

          if (sessionError || !session) {
                  return res.status(401).json({ error: 'Invalid or expired session' });
          }

          req.user = {
                  id: session.users.id,
                  email: session.users.email,
                  name: session.users.name
          };

          next();
    } catch (error) {
          console.error('Auth middleware error:', error);
          res.status(500).json({ error: 'Authentication error' });
    }
}

async function optionalAuth(req, res, next) {
    const sessionToken = req.session?.token || req.headers['authorization']?.replace('Bearer ', '');

    if (sessionToken) {
          try {
                  const { data: session } = await db.supabase
                    .from('sessions')
                    .select('*, users!inner(id, email, name)')
                    .eq('token', sessionToken)
                    .gt('expires_at', new Date().toISOString())
                    .single();

                  if (session) {
                            req.user = {
                                        id: session.users.id,
                                        email: session.users.email,
                                        name: session.users.name
                            };
                  }
          } catch (error) {
                  console.error('Optional auth error:', error);
          }
    }

    next();
}

module.exports = { authMiddleware, optionalAuth };
