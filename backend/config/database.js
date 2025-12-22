const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../data/hall.db'));

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry DATETIME,
    is_active INTEGER DEFAULT 1,
    color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    type TEXT NOT NULL,
    from_address TEXT,
    to_address TEXT,
    subject TEXT,
    body TEXT,
    is_read INTEGER DEFAULT 0,
    timestamp DATETIME,
    external_id TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time DATETIME,
    end_time DATETIME,
    location TEXT,
    external_id TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    due_date DATETIME,
    is_completed INTEGER DEFAULT 0,
    external_id TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    external_id TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

module.exports = db;
