const { getDb } = require('./db/init')
const { TRIGGER_TYPES, renderTemplate } = require('./workflowCatalog')
const { sendMail } = require('./utils/mailer')
const { sendPushToUsers } = require('./utils/webpush')
const { checkUpcomingRotationFeedback } = require('./utils/feedback')

function daysSince(dateStr) {
  if (!dateStr) return Infinity
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000)
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity
  return Math.floor((new Date(dateStr) - Date.now()) / 86400000)
}

// Erweitert einen sonst einmaligen trigger_key um einen Wiederholungs-"Eimer", damit ein
// Workflow nicht nur einmal, sondern alle `repeatEveryDays` Tage erneut feuert, solange die
// zugrundeliegende Bedingung bestehen bleibt (z.B. weiterhin überfällig) -- ohne das würde
// derselbe entity_key/trigger_key für immer als "schon gefeuert" gelten. `days` wächst bei
// "seit X"-Auslösern (überfällig) und schrumpft bei "bis X"-Auslösern (steht bevor) --
// in beiden Fällen ändert sich der Eimer-Index periodisch, das reicht für die Deduplizierung.
function recurringKey(baseKey, days, repeatEveryDays) {
  const repeat = Number(repeatEveryDays) || 0
  if (repeat <= 0 || !Number.isFinite(days)) return baseKey
  return `${baseKey}:r${Math.floor(Math.max(days, 0) / repeat)}`
}

// Ausbilder, die für einen Azubi "zuständig" sind: Super Admins (sehen ohnehin alles)
// plus Ausbilder, die mindestens eine Niederlassung mit dem Azubi teilen. Verhindert,
// dass z.B. ein überfälliges Berichtsheft eines Köln-Azubis auch den Hamburg-Ausbilder
// per Push/E-Mail benachrichtigt.
function getLocationScopedAusbilderIds(db, azubiId) {
  return db.prepare(`
    SELECT id FROM users
    WHERE role = 'ausbilder' AND active = 1
      AND (
        permission_role_id IN (SELECT id FROM permission_roles WHERE is_super_admin = 1)
        OR id IN (
          SELECT user_id FROM user_locations
          WHERE location_id IN (SELECT location_id FROM user_locations WHERE user_id = ?)
        )
      )
  `).all(azubiId).map(r => r.id)
}

// Für Auslöser ohne (oder unabhängig von) einen Niederlassungs-Bezug, z.B. eine
// unzugewiesene Aufgabe oder ein Termin ohne verknüpfte Azubis.
function getAllAusbilderIds(db) {
  return db.prepare("SELECT id FROM users WHERE role = 'ausbilder' AND active = 1").all().map(r => r.id)
}

// Löst eine Empfänger-Gruppe in konkrete Nutzer-IDs auf: feste Mitglieder (member_type
// 'user') plus dynamisch alle aktiven Ausbilder mit einer verknüpften Berechtigungsrolle
// (member_type 'permission_role') -- wächst/schrumpft automatisch mit Rollenzuweisungen.
function resolveGroupMemberIds(db, groupId) {
  const members = db.prepare('SELECT member_type, member_id FROM notification_group_members WHERE group_id = ?').all(groupId)
  const ids = new Set()
  for (const m of members) {
    if (m.member_type === 'user') {
      ids.add(m.member_id)
    } else if (m.member_type === 'permission_role') {
      db.prepare("SELECT id FROM users WHERE permission_role_id = ? AND active = 1").all(m.member_id).forEach(r => ids.add(r.id))
    }
  }
  return [...ids]
}

// Löst die generische `recipients`-Liste einer Aktion (siehe workflowCatalog.js) in
// konkrete Nutzer-IDs auf. azubi kann null sein (kein Betroffener bei diesem Auslöser) --
// "subject_*"-Einträge liefern dann einfach nichts, außer "subject_location_ausbilder"
// weicht mangels Niederlassung auf alle Ausbilder aus (gleiche Logik wie zuvor bei
// to_location_ausbilder/target: 'ausbilder').
function resolveRecipientUserIds(db, recipients, azubi) {
  const ids = new Set()
  for (const r of (recipients || [])) {
    if (r.type === 'subject_azubi') {
      if (azubi) ids.add(azubi.id)
    } else if (r.type === 'subject_location_ausbilder') {
      const scoped = azubi ? getLocationScopedAusbilderIds(db, azubi.id) : getAllAusbilderIds(db)
      scoped.forEach(id => ids.add(id))
    } else if (r.type === 'all_ausbilder') {
      getAllAusbilderIds(db).forEach(id => ids.add(id))
    } else if (r.type === 'user' && r.user_id) {
      ids.add(r.user_id)
    } else if (r.type === 'group' && r.group_id) {
      resolveGroupMemberIds(db, r.group_id).forEach(id => ids.add(id))
    }
  }
  return [...ids]
}

function loadActiveWorkflows(db) {
  const workflows = db.prepare('SELECT * FROM workflows WHERE active = 1').all()
  const getActions = db.prepare('SELECT * FROM workflow_actions WHERE workflow_id = ? ORDER BY position ASC')
  return workflows.map(w => ({
    ...w,
    trigger_config: JSON.parse(w.trigger_config),
    actions: getActions.all(w.id).map(a => ({ ...a, action_config: JSON.parse(a.action_config) })),
  }))
}

// azubi kann null sein (z.B. unzugewiesene Aufgabe, Termin ohne verknüpfte Azubis) --
// siehe resolveRecipientUserIds() für die genaue Fallback-Logik pro Empfänger-Typ.
// department (optional, { name, contact_email }) ist die einzige Möglichkeit, Abteilungs-
// leiter zu erreichen -- sie sind keine Systemnutzer und tauchen daher nie in
// resolveRecipientUserIds() auf. Nur für die E-Mail-Aktion relevant (kein Push ohne Konto).
async function runAction(action, azubi, vars, department) {
  const db = getDb()
  if (action.action_type === 'email') {
    const cfg = action.action_config
    const userIds = resolveRecipientUserIds(db, cfg.recipients, azubi)
    const recipients = new Set()
    if (userIds.length) {
      const rows = db.prepare(`SELECT email FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`).all(...userIds)
      rows.forEach(r => { if (r.email) recipients.add(r.email) })
    }
    if (department?.contact_email && (cfg.recipients || []).some(r => r.type === 'department_contact')) {
      recipients.add(department.contact_email)
    }
    if (Array.isArray(cfg.cc)) cfg.cc.filter(Boolean).forEach(e => recipients.add(e))
    if (recipients.size === 0) return
    const [to, ...cc] = [...recipients]
    await sendMail({
      to, cc,
      subject: renderTemplate(cfg.subject, vars),
      text: renderTemplate(cfg.body, vars),
    }).catch(err => console.error('[scheduler] E-Mail-Aktion fehlgeschlagen:', err.message))
  } else if (action.action_type === 'push') {
    const cfg = action.action_config
    const userIds = resolveRecipientUserIds(db, cfg.recipients, azubi)
    if (!userIds.length) return
    await sendPushToUsers(userIds, {
      title: renderTemplate(cfg.title, vars),
      body: renderTemplate(cfg.body, vars),
    }).catch(err => console.error('[scheduler] Push-Aktion fehlgeschlagen:', err.message))
  }
}

// Führt alle Aktionen eines Workflows aus, falls diese Kombination aus entity_key +
// trigger_key noch nicht gefeuert hat (siehe Kommentar an der Tabelle in db/init.js).
async function fireIfNew(db, workflow, entityKey, triggerKey, azubi, vars, department) {
  const already = db.prepare(
    'SELECT 1 FROM workflow_runs WHERE workflow_id = ? AND entity_key = ? AND trigger_key = ?'
  ).get(workflow.id, entityKey, triggerKey)
  if (already) return false

  for (const action of workflow.actions) {
    await runAction(action, azubi, vars, department)
  }
  db.prepare(
    'INSERT OR IGNORE INTO workflow_runs (workflow_id, entity_key, trigger_key) VALUES (?, ?, ?)'
  ).run(workflow.id, entityKey, triggerKey)
  return true
}

// Für Sofort-Auslöser (Bericht abgelehnt/genehmigt, Aufgabe zugewiesen, Termin angelegt),
// die direkt aus der jeweiligen Route heraus aufgerufen werden statt aus dem Scheduler-
// Tick. Wird bewusst "fire and forget" (ohne await) aus den Routen aufgerufen, damit ein
// langsamer Mail-/Push-Versand nie die eigentliche API-Antwort verzögert.
async function fireEventWorkflows(triggerType, entityKey, triggerKey, azubi, vars, department) {
  const db = getDb()
  const workflows = loadActiveWorkflows(db).filter(w => w.trigger_type === triggerType)
  for (const workflow of workflows) {
    try {
      await fireIfNew(db, workflow, entityKey, triggerKey, azubi, vars, department)
    } catch (err) {
      console.error(`[scheduler] Fehler bei Workflow "${workflow.name}":`, err.message)
    }
  }
}

async function pollReportOverdue(db, workflow) {
  const minDays = Number(workflow.trigger_config.min_days) || 1
  const repeatEvery = workflow.trigger_config.repeat_every_days
  const azubis = db.prepare(`
    SELECT a.id, a.name, a.email, a.last_report_date, a.created_at,
           d.name as dept_name, d.contact_email as dept_contact_email
    FROM users a LEFT JOIN departments d ON d.id = a.current_department_id
    WHERE a.role = 'azubi' AND a.active = 1 AND a.lehrjahr > 0
  `).all()

  for (const azubi of azubis) {
    const days = daysSince(azubi.last_report_date)
    if (days < minDays) continue
    const baseKey = azubi.last_report_date || 'never'
    // Ohne last_report_date ist `days` Infinity (noch nie eingereicht) -- für den
    // Wiederholungs-Eimer wird ersatzweise seit Kontoerstellung gezählt, sonst würde
    // "noch nie eingereicht" trotz repeat_every_days nie erneut feuern.
    const bucketDays = Number.isFinite(days) ? days : daysSince(azubi.created_at)
    const triggerKey = recurringKey(baseKey, bucketDays, repeatEvery)
    const vars = { name: azubi.name, days_overdue: Number.isFinite(days) ? days : 'vielen', days: Number.isFinite(days) ? days : 'vielen' }
    const department = azubi.dept_name ? { name: azubi.dept_name, contact_email: azubi.dept_contact_email } : null
    await fireIfNew(db, workflow, `azubi:${azubi.id}`, triggerKey, azubi, vars, department)
  }
}

async function pollRotationUpcoming(db, workflow) {
  const daysBefore = Number(workflow.trigger_config.days_before) || 0
  const repeatEvery = workflow.trigger_config.repeat_every_days
  const azubis = db.prepare(`
    SELECT a.id, a.name, a.email, a.next_rotation_date, d.name as dept_name, d.contact_email as dept_contact_email
    FROM users a LEFT JOIN departments d ON d.id = a.next_department_id
    WHERE a.role = 'azubi' AND a.active = 1 AND a.next_rotation_date IS NOT NULL
  `).all()

  for (const azubi of azubis) {
    const until = daysUntil(azubi.next_rotation_date)
    if (until > daysBefore || until < 0) continue
    const triggerKey = recurringKey(`rotation:${azubi.next_rotation_date}`, until, repeatEvery)
    const vars = { name: azubi.name, days: until, days_overdue: until, date: azubi.next_rotation_date, title: azubi.dept_name || '' }
    // Ansprechpartner der Abteilung, in die der Azubi WECHSELT (next_department) -- damit
    // kann z.B. die neue Abteilung frühzeitig über den bevorstehenden Zugang informiert werden.
    const department = azubi.dept_name ? { name: azubi.dept_name, contact_email: azubi.dept_contact_email } : null
    await fireIfNew(db, workflow, `azubi:${azubi.id}`, triggerKey, azubi, vars, department)
  }
}

async function pollReportPendingReview(db, workflow) {
  const minDays = Number(workflow.trigger_config.min_days) || 1
  const repeatEvery = workflow.trigger_config.repeat_every_days
  const entries = db.prepare(`
    SELECT re.id, re.azubi_id, re.submitted_at, a.name, a.email,
           d.name as dept_name, d.contact_email as dept_contact_email
    FROM report_entries re
    JOIN users a ON a.id = re.azubi_id
    LEFT JOIN departments d ON d.id = re.department_id
    WHERE re.status = 'submitted' AND a.active = 1
  `).all()

  for (const entry of entries) {
    const days = daysSince(entry.submitted_at)
    if (days < minDays) continue
    const triggerKey = recurringKey(`submitted:${entry.submitted_at}`, days, repeatEvery)
    const azubi = { id: entry.azubi_id, name: entry.name, email: entry.email }
    const vars = { name: azubi.name, days, days_overdue: days, date: entry.submitted_at }
    const department = entry.dept_name ? { name: entry.dept_name, contact_email: entry.dept_contact_email } : null
    await fireIfNew(db, workflow, `report_entry:${entry.id}`, triggerKey, azubi, vars, department)
  }
}

async function pollTodoOverdue(db, workflow) {
  const minDays = Number(workflow.trigger_config.min_days) || 0
  const repeatEvery = workflow.trigger_config.repeat_every_days
  const todos = db.prepare(`
    SELECT t.id, t.title, t.due_date, t.assigned_to, u.name as assignee_name, u.email as assignee_email
    FROM todos t LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.status != 'done' AND t.due_date IS NOT NULL
  `).all()

  for (const todo of todos) {
    const days = daysSince(todo.due_date)
    if (days < minDays) continue
    const triggerKey = recurringKey(`overdue:${todo.due_date}`, days, repeatEvery)
    const azubi = todo.assigned_to ? { id: todo.assigned_to, name: todo.assignee_name, email: todo.assignee_email } : null
    const vars = { title: todo.title, name: azubi?.name || '', days, days_overdue: days, date: todo.due_date }
    await fireIfNew(db, workflow, `todo:${todo.id}`, triggerKey, azubi, vars)
  }
}

async function pollEventUpcoming(db, workflow) {
  const daysBefore = Number(workflow.trigger_config.days_before) || 0
  const repeatEvery = workflow.trigger_config.repeat_every_days
  const events = db.prepare('SELECT id, title, start_datetime FROM calendar_events').all()

  for (const event of events) {
    const until = daysUntil(event.start_datetime)
    if (until > daysBefore || until < 0) continue
    const triggerKey = recurringKey(`upcoming:${event.start_datetime}`, until, repeatEvery)
    const azubiRows = db.prepare(`
      SELECT u.id, u.name, u.email FROM event_azubis ea JOIN users u ON u.id = ea.azubi_id
      WHERE ea.event_id = ? AND u.active = 1
    `).all(event.id)

    if (azubiRows.length === 0) {
      const vars = { title: event.title, name: '', days: until, days_overdue: until, date: event.start_datetime }
      await fireIfNew(db, workflow, `event:${event.id}`, triggerKey, null, vars)
      continue
    }
    for (const azubi of azubiRows) {
      const vars = { title: event.title, name: azubi.name, days: until, days_overdue: until, date: event.start_datetime }
      await fireIfNew(db, workflow, `event:${event.id}:azubi:${azubi.id}`, triggerKey, azubi, vars)
    }
  }
}

// kind='azubi_to_team' -- der Azubi ist ein echter Systemnutzer, kann also z.B. per Push
// erinnert werden. "Ansprechpartner der Abteilung" ist hier trotzdem wählbar (z.B. um die
// Abteilung parallel zu informieren), aber typischerweise reicht subject_azubi.
async function pollFeedbackPending(db, workflow) {
  const minDays = Number(workflow.trigger_config.min_days) || 1
  const repeatEvery = workflow.trigger_config.repeat_every_days
  const rows = db.prepare(`
    SELECT fi.id, fi.created_at, fi.azubi_id, a.name as azubi_name, a.email as azubi_email,
           d.name as dept_name, d.contact_email as dept_contact_email
    FROM feedback_instances fi
    JOIN users a ON a.id = fi.azubi_id
    JOIN departments d ON d.id = fi.department_id
    WHERE fi.kind = 'azubi_to_team' AND fi.status = 'pending' AND a.active = 1
  `).all()

  for (const row of rows) {
    const days = daysSince(row.created_at)
    if (days < minDays) continue
    const triggerKey = recurringKey(`pending:${row.created_at}`, days, repeatEvery)
    const azubi = { id: row.azubi_id, name: row.azubi_name, email: row.azubi_email }
    const vars = { name: azubi.name, title: row.dept_name, days, days_overdue: days }
    const department = { name: row.dept_name, contact_email: row.dept_contact_email }
    await fireIfNew(db, workflow, `feedback:${row.id}`, triggerKey, azubi, vars, department)
  }
}

// kind='team_to_azubi' -- der Ansprechpartner der Abteilung ist KEIN Systemnutzer, kann
// also nur per E-Mail über "Ansprechpartner der betroffenen Abteilung" erreicht werden,
// nicht per Push und nicht über subject_azubi/subject_location_ausbilder (der Azubi selbst
// füllt diesen Bogen ja nicht aus).
async function pollFeedbackPendingTeam(db, workflow) {
  const minDays = Number(workflow.trigger_config.min_days) || 1
  const repeatEvery = workflow.trigger_config.repeat_every_days
  const rows = db.prepare(`
    SELECT fi.id, fi.created_at, fi.azubi_id, a.name as azubi_name, a.email as azubi_email,
           d.name as dept_name, d.contact_email as dept_contact_email
    FROM feedback_instances fi
    JOIN users a ON a.id = fi.azubi_id
    JOIN departments d ON d.id = fi.department_id
    WHERE fi.kind = 'team_to_azubi' AND fi.status = 'pending'
  `).all()

  for (const row of rows) {
    const days = daysSince(row.created_at)
    if (days < minDays) continue
    const triggerKey = recurringKey(`pending:${row.created_at}`, days, repeatEvery)
    const azubi = { id: row.azubi_id, name: row.azubi_name, email: row.azubi_email }
    const vars = { name: azubi.name, title: row.dept_name, days, days_overdue: days }
    const department = { name: row.dept_name, contact_email: row.dept_contact_email }
    await fireIfNew(db, workflow, `feedback:${row.id}`, triggerKey, azubi, vars, department)
  }
}

const POLLERS = {
  report_overdue: pollReportOverdue,
  rotation_upcoming: pollRotationUpcoming,
  report_pending_review: pollReportPendingReview,
  todo_overdue: pollTodoOverdue,
  event_upcoming: pollEventUpcoming,
  feedback_pending: pollFeedbackPending,
  feedback_pending_team: pollFeedbackPendingTeam,
  // report_submitted / report_rejected / report_approved / todo_assigned / event_created /
  // event_cancelled / feedback_submitted sind Sofort-Auslöser -- siehe fireEventWorkflows(),
  // aufgerufen direkt aus den jeweiligen Routen.
}

// Einmal beim Start und danach stündlich aufgerufen (siehe index.js). Wertet alle aktiven
// Workflows mit einem zeitbasierten Auslöser gegen den aktuellen Datenbestand aus.
async function runWorkflowsTick() {
  const db = getDb()
  const workflows = loadActiveWorkflows(db)

  for (const workflow of workflows) {
    if (!TRIGGER_TYPES.includes(workflow.trigger_type)) continue
    const poll = POLLERS[workflow.trigger_type]
    if (!poll) continue
    try {
      await poll(db, workflow)
    } catch (err) {
      console.error(`[scheduler] Fehler bei Workflow "${workflow.name}":`, err.message)
    }
  }
}

function runFeedbackCheck() {
  try { checkUpcomingRotationFeedback(getDb()) } catch (err) { console.error('[scheduler] Feedback-Check fehlgeschlagen:', err.message) }
}

function startScheduler() {
  runWorkflowsTick().catch(err => console.error('[scheduler] Fehler:', err.message))
  runFeedbackCheck()
  return setInterval(() => {
    runWorkflowsTick().catch(err => console.error('[scheduler] Fehler:', err.message))
    runFeedbackCheck()
  }, 60 * 60 * 1000)
}

module.exports = { runWorkflowsTick, startScheduler, fireEventWorkflows, getLocationScopedAusbilderIds }
