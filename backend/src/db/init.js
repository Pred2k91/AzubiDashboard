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
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
      azubi_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(block_id, azubi_id)
    );

    CREATE TABLE IF NOT EXISTS event_azubis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
      azubi_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(event_id, azubi_id)
    );

    CREATE TABLE IF NOT EXISTS rotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      azubi_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
      azubi_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

    CREATE TABLE IF NOT EXISTS permission_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_super_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL REFERENCES permission_roles(id) ON DELETE CASCADE,
      permission_key TEXT NOT NULL,
      UNIQUE(role_id, permission_key)
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      trigger_type TEXT NOT NULL,
      trigger_config TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workflow_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      action_type TEXT NOT NULL,
      action_config TEXT NOT NULL
    );

    -- entity_key ist generisch (z.B. "azubi:5", "todo:3", "report_entry:12", "event:7"),
    -- da Workflows inzwischen auch nicht-Azubi-bezogene Auslöser abdecken (Aufgaben, Termine).
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      entity_key TEXT NOT NULL,
      trigger_key TEXT NOT NULL,
      fired_at TEXT DEFAULT (datetime('now')),
      UNIQUE(workflow_id, entity_key, trigger_key)
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Frei benennbare Empfänger-Gruppen für Workflow-Aktionen (z.B. "Niederlassung-Admins").
    -- member_type 'user' = fester einzelner Nutzer, 'permission_role' = dynamisch alle
    -- aktuell Ausbilder mit dieser Berechtigungsrolle (wächst/schrumpft mit Rollenzuweisungen).
    CREATE TABLE IF NOT EXISTS notification_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES notification_groups(id) ON DELETE CASCADE,
      member_type TEXT NOT NULL,
      member_id INTEGER NOT NULL,
      UNIQUE(group_id, member_type, member_id)
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

  // Migration: lehrjahre-Spalte hinzufügen falls nicht vorhanden
  try { db.exec("ALTER TABLE school_blocks ADD COLUMN lehrjahre TEXT DEFAULT '[]'") } catch (_) {}

  // Migration: Aufgaben können optional einem Azubi zugewiesen werden (Workflow-Auslöser
  // "Aufgabe zugewiesen"/"Aufgabe überfällig" brauchen dafür einen Empfänger).
  try { db.exec("ALTER TABLE todos ADD COLUMN assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL") } catch (_) {}

  // Migration: Aktions-Empfänger von festen Checkboxen/einem Ziel-Dropdown (to_azubi,
  // to_location_ausbilder, to_all_ausbilder, target) auf eine generische recipients-Liste
  // umstellen -- erlaubt jetzt zusätzlich einzelne Nutzer und benutzerdefinierte Gruppen.
  try {
    const actionRows = db.prepare('SELECT id, action_type, action_config FROM workflow_actions').all()
    const updateAction = db.prepare('UPDATE workflow_actions SET action_config = ? WHERE id = ?')
    for (const row of actionRows) {
      const cfg = JSON.parse(row.action_config)
      if (cfg.recipients) continue // bereits migriert
      const recipients = []
      if (row.action_type === 'email') {
        if (cfg.to_azubi) recipients.push({ type: 'subject_azubi' })
        if (cfg.to_location_ausbilder) recipients.push({ type: 'subject_location_ausbilder' })
        if (cfg.to_all_ausbilder) recipients.push({ type: 'all_ausbilder' })
        delete cfg.to_azubi; delete cfg.to_location_ausbilder; delete cfg.to_all_ausbilder
      } else if (row.action_type === 'push') {
        if (cfg.target === 'azubi') recipients.push({ type: 'subject_azubi' })
        else if (cfg.target === 'ausbilder') recipients.push({ type: 'subject_location_ausbilder' })
        else if (cfg.target === 'all_ausbilder') recipients.push({ type: 'all_ausbilder' })
        delete cfg.target
      }
      cfg.recipients = recipients
      updateAction.run(JSON.stringify(cfg), row.id)
    }
  } catch (_) {}

  // Migration: workflow_runs von der alten azubi_id-Spalte auf einen generischen entity_key
  // umstellen (nötig für neue, nicht-Azubi-bezogene Auslöser). Nur auf alten DBs relevant --
  // frische Installationen bekommen das neue Schema bereits über CREATE TABLE IF NOT EXISTS oben.
  try {
    const workflowRunsCols = db.prepare("PRAGMA table_info(workflow_runs)").all()
    if (workflowRunsCols.some(c => c.name === 'azubi_id')) {
      db.exec(`
        ALTER TABLE workflow_runs RENAME TO workflow_runs_old;
        CREATE TABLE workflow_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
          entity_key TEXT NOT NULL,
          trigger_key TEXT NOT NULL,
          fired_at TEXT DEFAULT (datetime('now')),
          UNIQUE(workflow_id, entity_key, trigger_key)
        );
        INSERT INTO workflow_runs (id, workflow_id, entity_key, trigger_key, fired_at)
          SELECT id, workflow_id, 'azubi:' || azubi_id, trigger_key, fired_at FROM workflow_runs_old;
        DROP TABLE workflow_runs_old;
      `)
    }
  } catch (_) {}

  // Migration: alten Klartext-Admin-PIN entfernen — abgelöst durch echte Benutzerkonten
  db.prepare("DELETE FROM settings WHERE key = 'admin_pin'").run()

  // Migration: Ausbildungsdaten liegen direkt auf users (role='azubi') statt in einer
  // separaten azubis-Tabelle -- jede Person ist genau eine users-Zeile.
  try { db.exec("ALTER TABLE users ADD COLUMN name TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN lehrjahr INTEGER DEFAULT 1") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN start_date TEXT") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN current_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN next_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN next_rotation_date TEXT") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN report_period TEXT DEFAULT 'week'") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN last_report_date TEXT") } catch (_) {}

  // Migration: Profil-/Kontaktfelder für Benutzer (Selbstauskunft + Admin-Profilseite)
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

  // Rechtesystem: Berechtigungsrolle pro Ausbilder-Konto (bei Azubis immer NULL)
  let permissionRoleColumnIsNew = false
  try {
    db.exec("ALTER TABLE users ADD COLUMN permission_role_id INTEGER REFERENCES permission_roles(id) ON DELETE SET NULL")
    permissionRoleColumnIsNew = true
  } catch (_) {}

  bootstrapPermissions(db, permissionRoleColumnIsNew)
  bootstrapFirstUser(db)

  console.log('Database initialized at:', DB_PATH)
}

// Legt die feste "Super Admin"-Rolle an. Beim Einführen des Rechtesystems (Spalte
// permission_role_id ist neu) werden bestehende Ausbilder-Konten automatisch dieser
// Rolle zugewiesen, damit niemand durchs Update ausgesperrt wird. Neu angelegte
// Ausbilder-Konten danach bekommen bewusst KEINE automatische Rolle -- sicherer
// Standard, ein Super Admin muss die Berechtigungsrolle explizit vergeben.
function bootstrapPermissions(db, backfillExistingAusbilder) {
  db.prepare("INSERT OR IGNORE INTO permission_roles (name, is_super_admin) VALUES ('Super Admin', 1)").run()
  if (backfillExistingAusbilder) {
    const superAdmin = db.prepare('SELECT id FROM permission_roles WHERE is_super_admin = 1').get()
    db.prepare(
      "UPDATE users SET permission_role_id = ? WHERE role = 'ausbilder' AND permission_role_id IS NULL"
    ).run(superAdmin.id)
  }
}

// Legt beim allerersten Start ein Ausbilder-Konto an, falls noch keine Benutzer existieren
function bootstrapFirstUser(db) {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c
  if (userCount > 0) return

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@example.com').toLowerCase()
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url')
  const hash = bcrypt.hashSync(password, 10)
  const superAdmin = db.prepare('SELECT id FROM permission_roles WHERE is_super_admin = 1').get()

  db.prepare(
    'INSERT INTO users (email, password_hash, role, must_change_password, permission_role_id) VALUES (?, ?, ?, 1, ?)'
  ).run(email, hash, 'ausbilder', superAdmin.id)

  console.log('========================================')
  console.log('Erstes Ausbilder-Konto wurde angelegt:')
  console.log('  E-Mail:   ' + email)
  console.log('  Passwort: ' + password)
  console.log('Bitte nach dem ersten Login sofort ändern!')
  console.log('========================================')
}

module.exports = { getDb, initDb }
