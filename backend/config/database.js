const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Database wrapper for compatibility with existing code
const db = {
    supabase,

    // Helper to run raw SQL (for complex queries)
    async query(sql, params = []) {
          const { data, error } = await supabase.rpc('exec_sql', { query: sql, params });
          if (error) throw error;
          return data;
    },

    // Users table operations
    users: {
          async findById(id) {
                  const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
                  if (error && error.code !== 'PGRST116') throw error;
                  return data;
          },
          async findByEmail(email) {
                  const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
                  if (error && error.code !== 'PGRST116') throw error;
                  return data;
          },
          async create(user) {
                  const { data, error } = await supabase.from('users').insert(user).select().single();
                  if (error) throw error;
                  return data;
          },
          async update(id, updates) {
                  const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
                  if (error) throw error;
                  return data;
          }
    },

    // Accounts table operations
    accounts: {
          async findById(id) {
                  const { data, error } = await supabase.from('accounts').select('*').eq('id', id).single();
                  if (error && error.code !== 'PGRST116') throw error;
                  return data;
          },
          async findByUserId(userId) {
                  const { data, error } = await supabase.from('accounts').select('*').eq('user_id', userId);
                  if (error) throw error;
                  return data || [];
          },
          async create(account) {
                  const { data, error } = await supabase.from('accounts').insert(account).select().single();
                  if (error) throw error;
                  return data;
          },
          async update(id, updates) {
                  const { data, error } = await supabase.from('accounts').update(updates).eq('id', id).select().single();
                  if (error) throw error;
                  return data;
          },
          async delete(id) {
                  const { error } = await supabase.from('accounts').delete().eq('id', id);
                  if (error) throw error;
          }
    },

    // Messages table operations
    messages: {
          async findByAccountId(accountId, limit = 50) {
                  const { data, error } = await supabase.from('messages').select('*').eq('account_id', accountId).order('timestamp', { ascending: false }).limit(limit);
                  if (error) throw error;
                  return data || [];
          },
          async create(message) {
                  const { data, error } = await supabase.from('messages').insert(message).select().single();
                  if (error) throw error;
                  return data;
          },
          async markAsRead(id) {
                  const { error } = await supabase.from('messages').update({ is_read: 1 }).eq('id', id);
                  if (error) throw error;
          }
    },

    // Calendar events table operations
    calendar_events: {
          async findByAccountId(accountId) {
                  const { data, error } = await supabase.from('calendar_events').select('*').eq('account_id', accountId).order('start_time', { ascending: true });
                  if (error) throw error;
                  return data || [];
          },
          async create(event) {
                  const { data, error } = await supabase.from('calendar_events').insert(event).select().single();
                  if (error) throw error;
                  return data;
          },
          async update(id, updates) {
                  const { data, error } = await supabase.from('calendar_events').update(updates).eq('id', id).select().single();
                  if (error) throw error;
                  return data;
          },
          async delete(id) {
                  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
                  if (error) throw error;
          }
    },

    // Tasks table operations
    tasks: {
          async findByAccountId(accountId) {
                  const { data, error } = await supabase.from('tasks').select('*').eq('account_id', accountId).order('due_date', { ascending: true });
                  if (error) throw error;
                  return data || [];
          },
          async create(task) {
                  const { data, error } = await supabase.from('tasks').insert(task).select().single();
                  if (error) throw error;
                  return data;
          },
          async update(id, updates) {
                  const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
                  if (error) throw error;
                  return data;
          },
          async delete(id) {
                  const { error } = await supabase.from('tasks').delete().eq('id', id);
                  if (error) throw error;
          }
    },

    // Contacts table operations
    contacts: {
          async findByAccountId(accountId) {
                  const { data, error } = await supabase.from('contacts').select('*').eq('account_id', accountId).order('name', { ascending: true });
                  if (error) throw error;
                  return data || [];
          },
          async create(contact) {
                  const { data, error } = await supabase.from('contacts').insert(contact).select().single();
                  if (error) throw error;
                  return data;
          },
          async update(id, updates) {
                  const { data, error } = await supabase.from('contacts').update(updates).eq('id', id).select().single();
                  if (error) throw error;
                  return data;
          },
          async delete(id) {
                  const { error } = await supabase.from('contacts').delete().eq('id', id);
                  if (error) throw error;
          }
    },

    // Sessions table operations
    sessions: {
          async findByToken(token) {
                  const { data, error } = await supabase.from('sessions').select('*').eq('token', token).single();
                  if (error && error.code !== 'PGRST116') throw error;
                  return data;
          },
          async create(session) {
                  const { data, error } = await supabase.from('sessions').insert(session).select().single();
                  if (error) throw error;
                  return data;
          },
          async delete(id) {
                  const { error } = await supabase.from('sessions').delete().eq('id', id);
                  if (error) throw error;
          },
          async deleteExpired() {
                  const { error } = await supabase.from('sessions').delete().lt('expires_at', new Date().toISOString());
                  if (error) throw error;
          }
    }
};

module.exports = db;
