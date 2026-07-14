const Database = require('better-sqlite3')
const path = require('path')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')

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

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      type TEXT DEFAULT 'announcement',
      priority TEXT DEFAULT 'normal',
      date TEXT,
      azubi_ids TEXT DEFAULT '[]',
      color TEXT DEFAULT '#6366f1',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'local',
      role TEXT NOT NULL DEFAULT 'azubi',
      azubi_id INTEGER REFERENCES azubis(id) ON DELETE SET NULL,
      active INTEGER DEFAULT 1,
      must_change_password INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      user_agent TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS report_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      azubi_id INTEGER NOT NULL REFERENCES azubis(id) ON DELETE CASCADE,
      period_type TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      lehrjahr INTEGER,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      submitted_at TEXT,
      reviewed_at TEXT,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      review_comment TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(azubi_id, period_start)
    );

    CREATE TABLE IF NOT EXISTS report_entry_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_entry_id INTEGER NOT NULL REFERENCES report_entries(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      day_type TEXT NOT NULL DEFAULT 'betrieb',
      activities_text TEXT DEFAULT '',
      hours REAL,
      UNIQUE(report_entry_id, date)
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      short_code TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      UNIQUE(user_id, location_id)
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('report_warn_days', '14'),
      ('report_alert_days', '28'),
      ('kiosk_layout', '[]'),
      ('theme_accent', '"#6366f1"'),
      ('dashboard_title', '"Ausbildungsdashboard"'),
      ('refresh_interval', '300000'),
      ('widgets_enabled', '{"clock":true,"calendar":true,"todos":true,"departments":true,"notes":true}');
  `)

  // Migration: birthday-Spalte hinzufügen falls nicht vorhanden
  try { db.exec("ALTER TABLE azubis ADD COLUMN birthday TEXT") } catch (_) {}
  // Migration: last_report_date-Spalte hinzufügen
  try { db.exec("ALTER TABLE azubis ADD COLUMN last_report_date TEXT") } catch (_) {}

  // Migration: lehrjahre-Spalte hinzufügen falls nicht vorhanden
  try { db.exec("ALTER TABLE school_blocks ADD COLUMN lehrjahre TEXT DEFAULT '[]'") } catch (_) {}

  // Migration: geplanter Abteilungswechsel pro Azubi (next_department_id/next_rotation_date)
  try { db.exec("ALTER TABLE azubis ADD COLUMN next_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL") } catch (_) {}
  try { db.exec("ALTER TABLE azubis ADD COLUMN next_rotation_date TEXT") } catch (_) {}

  // Migration: Berichtsheft-Führungsrhythmus pro Azubi ('day' | 'week', IHK/HWK-konform)
  try { db.exec("ALTER TABLE azubis ADD COLUMN report_period TEXT DEFAULT 'week'") } catch (_) {}

  // Migration: alten Klartext-Admin-PIN entfernen — abgelöst durch echte Benutzerkonten
  db.prepare("DELETE FROM settings WHERE key = 'admin_pin'").run()

  // Migration: Profil-/Kontaktfelder für Benutzer (Selbstauskunft + Admin-Profilseite).
  // azubis bleibt bewusst unverändert -- name/birthday eines verknüpften Azubis bleiben
  // dort die alleinige Quelle der Wahrheit, diese Felder gelten nur für Nutzer ohne azubi_id.
  try { db.exec("ALTER TABLE users ADD COLUMN salutation TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN first_name TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN last_name TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN birthday TEXT") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN mobile_phone TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN street TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN postal_code TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN city TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN personnel_number TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN job_title TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN about_me TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN public_note TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN misc_note TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT") } catch (_) {}

  bootstrapFirstUser(db)

  console.log('Database initialized at:', DB_PATH)
}

// Legt beim allerersten Start ein Ausbilder-Konto an, falls noch keine Benutzer existieren
function bootstrapFirstUser(db) {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c
  if (userCount > 0) return

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@example.com').toLowerCase()
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url')
  const hash = bcrypt.hashSync(password, 10)

  db.prepare(
    'INSERT INTO users (email, password_hash, role, must_change_password) VALUES (?, ?, ?, 1)'
  ).run(email, hash, 'ausbilder')

  console.log('========================================')
  console.log('Erstes Ausbilder-Konto wurde angelegt:')
  console.log('  E-Mail:   ' + email)
  console.log('  Passwort: ' + password)
  console.log('Bitte nach dem ersten Login sofort ändern!')
  console.log('========================================')
}

module.exports = { getDb, initDb }
