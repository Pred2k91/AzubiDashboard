const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requirePermission } = require('../middleware/auth')
const { sendMail } = require('../utils/mailer')
const { sendPushToUsers } = require('../utils/webpush')

function parseAzubis(db, row) {
  let notifyLocationIds = []
  try { notifyLocationIds = JSON.parse(row.notify_location_ids || '[]') } catch { notifyLocationIds = [] }
  try {
    const ids = JSON.parse(row.azubi_ids || '[]')
    if (!ids.length) return { ...row, azubi_ids: [], azubis: [], notify_location_ids: notifyLocationIds }
    const azubis = db.prepare(
      `SELECT id, name, lehrjahr FROM users WHERE role = 'azubi' AND id IN (${ids.join(',')}) ORDER BY lehrjahr, name`
    ).all()
    return { ...row, azubi_ids: ids, azubis, notify_location_ids: notifyLocationIds }
  } catch { return { ...row, azubi_ids: [], azubis: [], notify_location_ids: notifyLocationIds } }
}

// Aktive Nutzer (jede Rolle -- das Schwarze Brett ist für Azubis und Ausbilder gleichermaßen),
// optional auf bestimmte Niederlassungen eingeschränkt. Leere/keine Auswahl = alle Niederlassungen.
function resolveNotifyRecipients(db, locationIds) {
  if (!locationIds || locationIds.length === 0) {
    return db.prepare('SELECT id, email FROM users WHERE active = 1').all()
  }
  return db.prepare(`
    SELECT DISTINCT u.id, u.email FROM users u
    JOIN user_locations ul ON ul.user_id = u.id
    WHERE u.active = 1 AND ul.location_id IN (${locationIds.map(() => '?').join(',')})
  `).all(...locationIds)
}

// Feuert nur beim Anlegen einer Ankündigung, nicht bei jeder Bearbeitung -- "fire and forget",
// damit ein langsamer Mail-/Push-Versand die API-Antwort nicht verzögert.
function notifyAnnouncementCreated(db, announcement, notifyPush, notifyEmail, locationIds) {
  if (!notifyPush && !notifyEmail) return
  const recipients = resolveNotifyRecipients(db, locationIds)
  if (!recipients.length) return
  if (notifyPush) {
    sendPushToUsers(recipients.map(r => r.id), { title: announcement.title, body: announcement.content || '' })
      .catch(err => console.error('[announcements] Push fehlgeschlagen:', err.message))
  }
  if (notifyEmail) {
    const emails = recipients.map(r => r.email).filter(Boolean)
    if (emails.length) {
      const [to, ...cc] = emails
      sendMail({ to, cc, subject: announcement.title, text: announcement.content || '' })
        .catch(err => console.error('[announcements] E-Mail fehlgeschlagen:', err.message))
    }
  }
}

// GET all active (nicht abgelaufen, nicht deaktiviert)
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const today = new Date().toISOString().slice(0, 10)
    const rows = db.prepare(`
      SELECT * FROM announcements
      WHERE active = 1
        AND (date IS NULL OR type = 'exam' OR date >= ?)
      ORDER BY
        CASE priority WHEN 'urgent' THEN 1 WHEN 'important' THEN 2 ELSE 3 END ASC,
        CASE type WHEN 'exam' THEN date ELSE date END ASC,
        created_at DESC
    `).all(today)
    res.json(rows.map(r => parseAzubis(db, r)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET all (Admin, inkl. abgelaufene)
router.get('/all', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare(`
      SELECT * FROM announcements ORDER BY created_at DESC
    `).all()
    res.json(rows.map(r => parseAzubis(db, r)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', requirePermission('announcements.manage'), (req, res) => {
  try {
    const db = getDb()
    const { title, content, type, priority, date, azubi_ids, color, notify_push, notify_email, notify_location_ids } = req.body
    if (!title) return res.status(400).json({ error: 'title erforderlich' })
    const result = db.prepare(`
      INSERT INTO announcements (title, content, type, priority, date, azubi_ids, color, notify_push, notify_email, notify_location_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, content || '', type || 'announcement',
      priority || 'normal', date || null,
      JSON.stringify(azubi_ids || []), color || '#6366f1',
      notify_push ? 1 : 0, notify_email ? 1 : 0, JSON.stringify(notify_location_ids || [])
    )
    const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid)
    notifyAnnouncementCreated(db, row, !!notify_push, !!notify_email, notify_location_ids || [])
    res.status(201).json(parseAzubis(db, row))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', requirePermission('announcements.manage'), (req, res) => {
  try {
    const db = getDb()
    const { title, content, type, priority, date, azubi_ids, color, active, notify_push, notify_email, notify_location_ids } = req.body
    db.prepare(`
      UPDATE announcements SET title=?, content=?, type=?, priority=?, date=?, azubi_ids=?, color=?, active=?,
        notify_push=?, notify_email=?, notify_location_ids=? WHERE id=?
    `).run(
      title, content || '', type || 'announcement',
      priority || 'normal', date || null,
      JSON.stringify(azubi_ids || []), color || '#6366f1',
      active !== undefined ? active : 1,
      notify_push ? 1 : 0, notify_email ? 1 : 0, JSON.stringify(notify_location_ids || []),
      req.params.id
    )
    const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(parseAzubis(db, row))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', requirePermission('announcements.manage'), (req, res) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
