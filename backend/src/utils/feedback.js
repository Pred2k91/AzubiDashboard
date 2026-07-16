const crypto = require('crypto')
const { getDb } = require('../db/init')
const { sendMail } = require('./mailer')
// Lazy (nicht am Dateianfang) requiret, da scheduler.js seinerseits diese Datei benötigt
// (für checkUpcomingRotationFeedback) -- ein Require am Kopf beider Dateien wäre ein
// echter Zirkelbezug. Zur Aufruf-Zeit (nicht zur Ladezeit) sind beide Module fertig
// geladen, das Require hier innerhalb der Funktion löst das gefahrlos auf.
function fireEventWorkflows(...args) {
  return require('../scheduler').fireEventWorkflows(...args)
}

function getTemplate(db, kind) {
  return db.prepare('SELECT * FROM feedback_templates WHERE kind = ?').get(kind)
}

function buildFeedbackLink(token) {
  const base = process.env.APP_BASE_URL || 'http://localhost:3000'
  return `${base}/feedback/${token}`
}

const SEND_DAYS_SETTING_KEY = 'feedback_send_days_before'
const ENABLED_SETTING_KEY = 'feedback_enabled'

function getFeedbackSendDaysBefore(db) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SEND_DAYS_SETTING_KEY)
  if (!row) return 0
  try { return Number(JSON.parse(row.value)) || 0 } catch { return 0 }
}

function setFeedbackSendDaysBefore(db, days) {
  db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at"
  ).run(SEND_DAYS_SETTING_KEY, JSON.stringify(days))
}

// Default aktiv (Feature ist bereits produktiv im Einsatz) -- die Einstellung dient als
// Not-Aus, falls das System vorübergehend ganz pausiert werden soll, ohne etwas zu löschen.
function getFeedbackEnabled(db) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(ENABLED_SETTING_KEY)
  if (!row) return true
  try { return JSON.parse(row.value) !== false } catch { return true }
}

function setFeedbackEnabled(db, enabled) {
  db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at"
  ).run(ENABLED_SETTING_KEY, JSON.stringify(!!enabled))
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity
  return Math.floor((new Date(dateStr) - Date.now()) / 86400000)
}

function sendFeedbackInviteEmail(instance, azubiName, departmentName, contactEmail) {
  if (!contactEmail) {
    console.log(`[feedback] Kein Ansprechpartner mit E-Mail für Abteilung "${departmentName}" hinterlegt -- Einladung NICHT versendet (Feedback #${instance.id}).`)
    return
  }
  const link = buildFeedbackLink(instance.access_token)
  sendMail({
    to: contactEmail,
    subject: `Feedback zu ${azubiName} (${departmentName})`,
    text: `Hallo,\n\n${azubiName} hat den Einsatz in eurer Abteilung "${departmentName}" abgeschlossen. Bitte gebt über folgenden Link ein kurzes Feedback ab:\n\n${link}\n\nDer Link bleibt gültig, bis ihr den Bogen ausgefüllt und abgeschickt habt.`,
    html: `<p>Hallo,</p><p>${azubiName} hat den Einsatz in eurer Abteilung "${departmentName}" abgeschlossen. Bitte gebt über folgenden Link ein kurzes Feedback ab:</p><p><a href="${link}">${link}</a></p><p>Der Link bleibt gültig, bis ihr den Bogen ausgefüllt und abgeschickt habt.</p>`,
  }).catch(err => console.error('[feedback] E-Mail-Versand fehlgeschlagen:', err.message))
}

// Wird beim Abschluss eines Abteilungsdurchlaufs aufgerufen (siehe azubis.js/syncNextRotation),
// ODER schon vorab X Tage vor dem geplanten Wechsel (siehe checkUpcomingRotationFeedback unten),
// ODER manuell über feedback.js (POST /test, POST /send-all) -- legt für die Abteilung je eine
// Azubi->Team- und eine Team->Azubi-Bewertung an und verschickt die Team->Azubi-Einladung per
// Mail an den hinterlegten Ansprechpartner. Gibt die angelegten Instanzen (inkl. Magic-Link)
// zurück, oder null, wenn für diesen Durchlauf schon einmal Feedback angelegt wurde (rotation_id
// -- verhindert Duplikate, egal welcher der drei Wege zuerst dran war).
function createDepartureFeedback(db, azubiId, departmentId) {
  if (!departmentId) return null // Azubi hatte zuvor keine Abteilung -- nichts zu bewerten
  if (!getFeedbackEnabled(db)) return null // globaler Not-Aus -- gilt für alle drei Auslöse-Wege gleichermaßen

  const azubi = db.prepare('SELECT name FROM users WHERE id = ?').get(azubiId)
  const department = db.prepare('SELECT name, contact_email FROM departments WHERE id = ?').get(departmentId)
  if (!azubi || !department) return null

  const rotation = db.prepare(
    'SELECT id FROM rotations WHERE azubi_id = ? AND department_id = ? ORDER BY start_date DESC LIMIT 1'
  ).get(azubiId, departmentId)
  const rotationId = rotation?.id || null

  if (rotationId) {
    const already = db.prepare(
      'SELECT 1 FROM feedback_instances WHERE azubi_id = ? AND department_id = ? AND rotation_id = ?'
    ).get(azubiId, departmentId, rotationId)
    if (already) return null
  }

  const azubiTemplate = getTemplate(db, 'azubi_to_team')
  const teamTemplate = getTemplate(db, 'team_to_azubi')
  const created = { azubi_instance_id: null, team_instance_id: null, team_link: null }

  if (azubiTemplate) {
    const result = db.prepare(`
      INSERT INTO feedback_instances (kind, template_id, azubi_id, department_id, rotation_id, questions_snapshot, status)
      VALUES ('azubi_to_team', ?, ?, ?, ?, ?, 'pending')
    `).run(azubiTemplate.id, azubiId, departmentId, rotationId, azubiTemplate.questions)
    created.azubi_instance_id = result.lastInsertRowid
  }

  if (teamTemplate) {
    const token = crypto.randomBytes(24).toString('hex')
    const result = db.prepare(`
      INSERT INTO feedback_instances (kind, template_id, azubi_id, department_id, rotation_id, questions_snapshot, status, access_token)
      VALUES ('team_to_azubi', ?, ?, ?, ?, ?, 'pending', ?)
    `).run(teamTemplate.id, azubiId, departmentId, rotationId, teamTemplate.questions, token)
    created.team_instance_id = result.lastInsertRowid
    created.team_link = buildFeedbackLink(token)
    sendFeedbackInviteEmail({ id: created.team_instance_id, access_token: token }, azubi.name, department.name, department.contact_email)
  }

  return created
}

// Fire-and-forget-Workflow-Hook fürs Einreichen (beide kind) -- separat exportiert, damit
// feedback.js's public-Route das ohne eigene Scheduler-Abhängigkeit auslösen kann.
// department ({ name, contact_email }) macht "Ansprechpartner der Abteilung" als
// Empfänger nutzbar, z.B. um die Abteilung zu bestätigen, dass ihr Bogen angekommen ist.
function notifyFeedbackSubmitted(instance, azubi, department) {
  const kindLabel = instance.kind === 'azubi_to_team' ? 'Azubi-Feedback' : 'Team-Feedback'
  fireEventWorkflows(
    'feedback_submitted', `feedback:${instance.id}`, `submitted:${instance.submitted_at}`, azubi,
    { name: azubi?.name || '', title: `${kindLabel}: ${department?.name || ''}`, date: instance.submitted_at }, department
  ).catch(err => console.error('[workflows] Fehler:', err.message))
}

// Legt Feedback bereits X Tage vor dem geplanten Wechsel an (statt erst beim tatsächlichen
// Wechsel), abhängig von der Einstellung feedback_send_days_before (0 = wie bisher: erst wenn
// next_rotation_date erreicht/überschritten ist). Wird sowohl vom stündlichen Scheduler-Tick
// als auch vom manuellen "Alle Feedbacks verschicken"-Button (POST /send-all) aufgerufen --
// createDepartureFeedback() dedupliziert selbst über rotation_id, mehrfaches Aufrufen ist
// also unschädlich. Gibt die Anzahl tatsächlich neu angelegter Bewertungspaare zurück.
function checkUpcomingRotationFeedback(db) {
  if (!getFeedbackEnabled(db)) return 0
  const daysBefore = getFeedbackSendDaysBefore(db)
  const azubis = db.prepare(`
    SELECT id, current_department_id, next_rotation_date FROM users
    WHERE role = 'azubi' AND active = 1 AND next_rotation_date IS NOT NULL AND current_department_id IS NOT NULL
  `).all()

  let created = 0
  for (const azubi of azubis) {
    if (daysUntil(azubi.next_rotation_date) > daysBefore) continue
    const result = createDepartureFeedback(db, azubi.id, azubi.current_department_id)
    if (result) created++
  }
  return created
}

module.exports = {
  createDepartureFeedback, notifyFeedbackSubmitted, getTemplate, sendFeedbackInviteEmail,
  checkUpcomingRotationFeedback, getFeedbackSendDaysBefore, setFeedbackSendDaysBefore,
  getFeedbackEnabled, setFeedbackEnabled,
}
