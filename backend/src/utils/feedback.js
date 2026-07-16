const crypto = require('crypto')
const { getDb } = require('../db/init')
const { sendMail } = require('./mailer')
const { fireEventWorkflows } = require('../scheduler')

function getTemplate(db, kind) {
  return db.prepare('SELECT * FROM feedback_templates WHERE kind = ?').get(kind)
}

function buildFeedbackLink(token) {
  const base = process.env.APP_BASE_URL || 'http://localhost:3000'
  return `${base}/feedback/${token}`
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

// Wird beim Abschluss eines Abteilungsdurchlaufs aufgerufen (siehe azubis.js/syncNextRotation)
// -- legt für die verlassene Abteilung je eine Azubi->Team- und eine Team->Azubi-Bewertung an
// und verschickt die Team->Azubi-Einladung per Mail an den hinterlegten Ansprechpartner.
// Gibt die angelegten Instanzen (inkl. Magic-Link) zurück -- praktisch sowohl für den echten
// Rotations-Trigger als auch für den manuellen Testlauf in feedback.js (POST /test), wo kein
// SMTP nötig ist, weil der Link direkt im Admin-UI angezeigt werden kann.
function createDepartureFeedback(db, azubiId, departmentId) {
  if (!departmentId) return null // Azubi hatte zuvor keine Abteilung -- nichts zu bewerten

  const azubi = db.prepare('SELECT name FROM users WHERE id = ?').get(azubiId)
  const department = db.prepare('SELECT name, contact_email FROM departments WHERE id = ?').get(departmentId)
  if (!azubi || !department) return null

  const rotation = db.prepare(
    'SELECT id FROM rotations WHERE azubi_id = ? AND department_id = ? ORDER BY start_date DESC LIMIT 1'
  ).get(azubiId, departmentId)
  const rotationId = rotation?.id || null

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

module.exports = { createDepartureFeedback, notifyFeedbackSubmitted, getTemplate, sendFeedbackInviteEmail }
