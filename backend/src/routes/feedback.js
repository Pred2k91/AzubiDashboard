const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requireAuth, requirePermission, scopeLocationIds, idsClause } = require('../middleware/auth')
const { notifyFeedbackSubmitted, sendFeedbackInviteEmail, createDepartureFeedback } = require('../utils/feedback')

function parseInstance(row) {
  return {
    ...row,
    questions_snapshot: JSON.parse(row.questions_snapshot),
    answers: row.answers ? JSON.parse(row.answers) : null,
  }
}

// Fordert für jede Frage im Snapshot eine passende Antwort -- Bewertung 1-5 (ganzzahlig)
// bzw. nicht-leerer Text. Kein Feld darf fehlen, ein Feedbackbogen wird immer vollständig
// abgegeben (kein Teil-Speichern als Entwurf vorgesehen).
function validateAnswers(questions, answers) {
  if (!answers || typeof answers !== 'object') return 'Antworten fehlen'
  for (const q of questions) {
    const value = answers[q.id]
    if (q.type === 'rating') {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 1 || n > 5) return `Frage "${q.label}": Bewertung von 1-5 erforderlich`
    } else {
      if (!value || !String(value).trim()) return `Frage "${q.label}": Text erforderlich`
    }
  }
  return null
}

// ── Admin-/Ausbilder-Übersicht (feedback.manage, niederlassungsgescoped) ─────────────

router.get('/', requirePermission('feedback.manage'), (req, res) => {
  try {
    const db = getDb()
    const { kind, status, azubi_id } = req.query
    const clauses = []
    const params = []
    if (kind) { clauses.push('fi.kind = ?'); params.push(kind) }
    if (status) { clauses.push('fi.status = ?'); params.push(status) }
    if (azubi_id) { clauses.push('fi.azubi_id = ?'); params.push(azubi_id) }
    const locIds = scopeLocationIds(req)
    if (locIds) {
      clauses.push(`fi.azubi_id IN (SELECT user_id FROM user_locations WHERE location_id IN ${idsClause(locIds)})`)
      params.push(...locIds)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = db.prepare(`
      SELECT fi.*, a.name as azubi_name, d.name as department_name
      FROM feedback_instances fi
      JOIN users a ON a.id = fi.azubi_id
      JOIN departments d ON d.id = fi.department_id
      ${where}
      ORDER BY fi.created_at DESC
    `).all(...params)
    res.json(rows.map(parseInstance))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/:id', requirePermission('feedback.manage'), (req, res) => {
  try {
    const db = getDb()
    const row = db.prepare(`
      SELECT fi.*, a.name as azubi_name, d.name as department_name
      FROM feedback_instances fi
      JOIN users a ON a.id = fi.azubi_id
      JOIN departments d ON d.id = fi.department_id
      WHERE fi.id = ?
    `).get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Nicht gefunden' })
    const locIds = scopeLocationIds(req)
    if (locIds) {
      const allowed = db.prepare(
        `SELECT 1 FROM user_locations WHERE user_id = ? AND location_id IN ${idsClause(locIds)}`
      ).get(row.azubi_id, ...locIds)
      if (!allowed) return res.status(404).json({ error: 'Nicht gefunden' })
    }
    res.json(parseInstance(row))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/:id/resend', requirePermission('feedback.manage'), (req, res) => {
  try {
    const db = getDb()
    const row = db.prepare(`
      SELECT fi.*, a.name as azubi_name, d.name as department_name, d.contact_email
      FROM feedback_instances fi
      JOIN users a ON a.id = fi.azubi_id
      JOIN departments d ON d.id = fi.department_id
      WHERE fi.id = ?
    `).get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Nicht gefunden' })
    if (row.kind !== 'team_to_azubi') return res.status(400).json({ error: 'Nur Team->Azubi-Bögen haben einen Einladungslink' })
    if (row.status !== 'pending') return res.status(400).json({ error: 'Bereits abgeschickt' })
    if (!row.contact_email) return res.status(400).json({ error: 'Kein Ansprechpartner mit E-Mail für diese Abteilung hinterlegt' })
    sendFeedbackInviteEmail(row, row.azubi_name, row.department_name, row.contact_email)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Manueller Testlauf, unabhängig von einem echten Abteilungswechsel -- legt für den
// gewählten Azubi/Abteilung dasselbe Paar aus Azubi->Team- und Team->Azubi-Bewertung an
// wie ein echter Wechsel, und gibt den Team-Link direkt zurück. Dafür wird kein SMTP
// gebraucht (die Einladungsmail wird zusätzlich versucht, aber ist für den Test irrelevant).
router.post('/test', requirePermission('feedback.manage'), (req, res) => {
  try {
    const { azubi_id, department_id } = req.body
    if (!azubi_id || !department_id) return res.status(400).json({ error: 'azubi_id und department_id sind erforderlich' })
    const db = getDb()
    const azubi = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'azubi'").get(azubi_id)
    if (!azubi) return res.status(404).json({ error: 'Azubi nicht gefunden' })
    const department = db.prepare('SELECT id FROM departments WHERE id = ?').get(department_id)
    if (!department) return res.status(404).json({ error: 'Abteilung nicht gefunden' })

    const created = createDepartureFeedback(db, azubi_id, department_id)
    res.status(201).json(created)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Azubi-Selbstbedienung (eigene azubi_to_team-Bögen) ──────────────────────────────

router.get('/mine/list', requireAuth, (req, res) => {
  try {
    if (req.user.role !== 'azubi') return res.json([])
    const db = getDb()
    const rows = db.prepare(`
      SELECT fi.*, d.name as department_name
      FROM feedback_instances fi
      JOIN departments d ON d.id = fi.department_id
      WHERE fi.kind = 'azubi_to_team' AND fi.azubi_id = ?
      ORDER BY fi.created_at DESC
    `).all(req.user.id)
    res.json(rows.map(parseInstance))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/mine/:id', requireAuth, (req, res) => {
  try {
    if (req.user.role !== 'azubi') return res.status(404).json({ error: 'Nicht gefunden' })
    const db = getDb()
    const row = db.prepare(`
      SELECT fi.*, d.name as department_name
      FROM feedback_instances fi JOIN departments d ON d.id = fi.department_id
      WHERE fi.id = ? AND fi.azubi_id = ? AND fi.kind = 'azubi_to_team'
    `).get(req.params.id, req.user.id)
    if (!row) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(parseInstance(row))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/mine/:id', requireAuth, (req, res) => {
  try {
    if (req.user.role !== 'azubi') return res.status(404).json({ error: 'Nicht gefunden' })
    const db = getDb()
    const row = db.prepare(
      "SELECT * FROM feedback_instances WHERE id = ? AND azubi_id = ? AND kind = 'azubi_to_team'"
    ).get(req.params.id, req.user.id)
    if (!row) return res.status(404).json({ error: 'Nicht gefunden' })
    if (row.status !== 'pending') return res.status(400).json({ error: 'Bereits abgeschickt' })

    const questions = JSON.parse(row.questions_snapshot)
    const validationError = validateAnswers(questions, req.body.answers)
    if (validationError) return res.status(400).json({ error: validationError })

    db.prepare("UPDATE feedback_instances SET answers=?, status='submitted', submitted_at=datetime('now') WHERE id=?")
      .run(JSON.stringify(req.body.answers), row.id)

    const updated = db.prepare(`
      SELECT fi.*, d.name as department_name, d.contact_email as department_contact_email
      FROM feedback_instances fi JOIN departments d ON d.id = fi.department_id WHERE fi.id = ?
    `).get(row.id)
    notifyFeedbackSubmitted(updated, req.user, { name: updated.department_name, contact_email: updated.department_contact_email })
    res.json(parseInstance(updated))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Öffentlicher Magic-Link (kein Login -- Abteilungsleiter haben keinen Systemzugang) ──

router.get('/public/:token', (req, res) => {
  try {
    const db = getDb()
    const row = db.prepare(`
      SELECT fi.*, a.name as azubi_name, d.name as department_name
      FROM feedback_instances fi
      JOIN users a ON a.id = fi.azubi_id
      JOIN departments d ON d.id = fi.department_id
      WHERE fi.access_token = ?
    `).get(req.params.token)
    if (!row) return res.status(404).json({ error: 'Ungültiger Link' })
    if (row.status !== 'pending') return res.status(410).json({ error: 'Dieser Bogen wurde bereits abgeschickt' })
    res.json({
      azubi_name: row.azubi_name,
      department_name: row.department_name,
      questions: JSON.parse(row.questions_snapshot),
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/public/:token', (req, res) => {
  try {
    const db = getDb()
    const row = db.prepare('SELECT * FROM feedback_instances WHERE access_token = ?').get(req.params.token)
    if (!row) return res.status(404).json({ error: 'Ungültiger Link' })
    if (row.status !== 'pending') return res.status(410).json({ error: 'Dieser Bogen wurde bereits abgeschickt' })

    const questions = JSON.parse(row.questions_snapshot)
    const validationError = validateAnswers(questions, req.body.answers)
    if (validationError) return res.status(400).json({ error: validationError })

    db.prepare("UPDATE feedback_instances SET answers=?, status='submitted', submitted_at=datetime('now') WHERE id=?")
      .run(JSON.stringify(req.body.answers), row.id)

    const updated = db.prepare(`
      SELECT fi.*, a.id as azubi_id, a.name as azubi_name, a.email as azubi_email,
             d.name as department_name, d.contact_email as department_contact_email
      FROM feedback_instances fi
      JOIN users a ON a.id = fi.azubi_id
      JOIN departments d ON d.id = fi.department_id
      WHERE fi.id = ?
    `).get(row.id)
    const azubi = { id: updated.azubi_id, name: updated.azubi_name, email: updated.azubi_email }
    notifyFeedbackSubmitted(updated, azubi, { name: updated.department_name, contact_email: updated.department_contact_email })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
