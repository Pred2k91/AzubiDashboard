const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../../../data/dashboard.db')

let db

function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

function initDb() {
  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      start_datetime TEXT NOT NULL,
      end_datetime TEXT NOT NULL,
      all_day INTEGER DEFAULT 0,
      color TEXT DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'open',
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      color TEXT DEFAULT '#6366f1',
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6366f1',
      description TEXT DEFAULT '',
      location TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS azubis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      lehrjahr INTEGER DEFAULT 1,
      start_date TEXT,
      current_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      email TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vocational_schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#06b6d4',
      location TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS school_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL REFERENCES vocational_schools(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      lehrjahre TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS school_block_azubis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_id INTEGER NOT NULL REFERENCES school_blocks(id) ON DELETE CASCADE,
      azubi_id INTEGER NOT NULL REFERENCES azubis(id) ON DELETE CASCADE,
      UNIQUE(block_id, azubi_id)
    );

    CREATE TABLE IF NOT EXISTS event_azubis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
      azubi_id INTEGER NOT NULL REFERENCES azubis(id) ON DELETE CASCADE,
      UNIQUE(event_id, azubi_id)
    );

    CREATE TABLE IF NOT EXISTS rotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      azubi_id INTEGER NOT NULL REFERENCES azubis(id) ON DELETE CASCADE,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('kiosk_layout', '[]'),
      ('theme_accent', '"#6366f1"'),
      ('dashboard_title', '"Ausbildungsdashboard"'),
      ('refresh_interval', '300000'),
      ('widgets_enabled', '{"clock":true,"calendar":true,"todos":true,"departments":true,"notes":true}');
  `)

  // Migration: lehrjahre-Spalte hinzufügen falls nicht vorhanden
  try { db.exec("ALTER TABLE school_blocks ADD COLUMN lehrjahre TEXT DEFAULT '[]'") } catch (_) {}

  console.log('Database initialized at:', DB_PATH)
}

module.exports = { getDb, initDb }
