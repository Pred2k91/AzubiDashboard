const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requireAuth } = require('../middleware/auth')
const { calcStatus, getThresholds } = require('./reports')

// Liefert den mit dem eingeloggten Benutzer verknüpften Azubi-Datensatz —
// die azubi_id kommt IMMER aus der Session (req.user), niemals aus der Anfrage,
// damit ein Azubi niemals Daten eines anderen Azubis abrufen kann.
function getOwnAzubi(req) {
  if (!req.user.azubi_id) return null
  const db = getDb()
  return db.prepare('SELECT * FROM azubis WHERE id = ? AND active = 1').get(req.user.azubi_id)
}

router.get('/', requireAuth, (req, res) => {
  try {
    const azubi = getOwnAzubi(req)
    if (!azubi) return res.json({ linked: false })
    res.json({
      linked: true,
      id: azubi.id,
      name: azubi.name,
      lehrjahr: azubi.lehrjahr,
      start_date: azubi.start_date,
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/team', requireAuth, (req, res) => {
  try {
    const azubi = getOwnAzubi(req)
    if (!azubi) return res.json({ linked: false })
    const db = getDb()
    const current = azubi.current_department_id
      ? db.prepare('SELECT id, name, color, location FROM departments WHERE id = ?').get(azubi.current_department_id)
      : null
    const next = azubi.next_department_id
      ? {
          ...db.prepare('SELECT id, name, color, location FROM departments WHERE id = ?').get(azubi.next_department_id),
          date: azubi.next_rotation_date,
        }
      : null
    res.json({ linked: true, current, next })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/calendar', requireAuth, (req, res) => {
  try {
    const azubi = getOwnAzubi(req)
    if (!azubi) return res.json({ linked: false, events: [] })
    const db = getDb()
    const { start, end } = req.query
    const events = (start && end)
      ? db.prepare(`
          SELECT ce.* FROM calendar_events ce
          JOIN event_azubis ea ON ea.event_id = ce.id
          WHERE ea.azubi_id = ? AND ce.start_datetime <= ? AND ce.end_datetime >= ?
          ORDER BY ce.start_datetime ASC
        `).all(azubi.id, end, start)
      : db.prepare(`
          SELECT ce.* FROM calendar_events ce
          JOIN event_azubis ea ON ea.event_id = ce.id
          WHERE ea.azubi_id = ?
          ORDER BY ce.start_datetime ASC
        `).all(azubi.id)
    res.json({ linked: true, events })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/reports', requireAuth, (req, res) => {
  try {
    const azubi = getOwnAzubi(req)
    if (!azubi) return res.json({ linked: false })
    const db = getDb()
    const { warn, alert } = getThresholds(db)
    res.json({
      linked: true,
      warn,
      alert,
      last_report_date: azubi.last_report_date,
      ...calcStatus(azubi.last_report_date, warn, alert),
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
