const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requirePermission } = require('../middleware/auth')

function attachAzubis(db, events) {
  if (!events.length) return events
  const ids = events.map(e => e.id).join(',')
  const rows = db.prepare(`
    SELECT ea.event_id, a.id, a.name, a.lehrjahr
    FROM event_azubis ea
    JOIN users a ON ea.azubi_id = a.id
    WHERE ea.event_id IN (${ids})
    ORDER BY a.name ASC
  `).all()
  const map = {}
  for (const r of rows) {
    if (!map[r.event_id]) map[r.event_id] = []
    map[r.event_id].push({ id: r.id, name: r.name, lehrjahr: r.lehrjahr })
  }
  return events.map(e => ({ ...e, azubi_ids: (map[e.id] || []).map(a => a.id), azubis: map[e.id] || [] }))
}

function saveAzubis(db, eventId, azubiIds) {
  db.prepare('DELETE FROM event_azubis WHERE event_id = ?').run(eventId)
  const insert = db.prepare('INSERT OR IGNORE INTO event_azubis (event_id, azubi_id) VALUES (?, ?)')
  const run = db.transaction(() => {
    for (const id of (azubiIds || [])) insert.run(eventId, id)
  })
  run()
}

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const { start, end } = req.query
    let events
    if (start && end) {
      events = db.prepare(
        'SELECT * FROM calendar_events WHERE start_datetime <= ? AND end_datetime >= ? ORDER BY start_datetime ASC'
      ).all(end, start)
    } else {
      events = db.prepare('SELECT * FROM calendar_events ORDER BY start_datetime ASC').all()
    }
    res.json(attachAzubis(db, events))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', requirePermission('calendar.manage'), (req, res) => {
  try {
    const db = getDb()
    const { title, description, start_datetime, end_datetime, all_day, color, azubi_ids } = req.body
    if (!title || !start_datetime || !end_datetime) {
      return res.status(400).json({ error: 'title, start_datetime und end_datetime sind erforderlich' })
    }
    const result = db.prepare(
      'INSERT INTO calendar_events (title, description, start_datetime, end_datetime, all_day, color) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(title, description || '', start_datetime, end_datetime, all_day ? 1 : 0, color || '#6366f1')
    saveAzubis(db, result.lastInsertRowid, azubi_ids)
    const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(attachAzubis(db, [event])[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', requirePermission('calendar.manage'), (req, res) => {
  try {
    const db = getDb()
    const { title, description, start_datetime, end_datetime, all_day, color, azubi_ids } = req.body
    db.prepare(
      'UPDATE calendar_events SET title=?, description=?, start_datetime=?, end_datetime=?, all_day=?, color=? WHERE id=?'
    ).run(title, description || '', start_datetime, end_datetime, all_day ? 1 : 0, color || '#6366f1', req.params.id)
    saveAzubis(db, req.params.id, azubi_ids)
    const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id)
    if (!event) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(attachAzubis(db, [event])[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', requirePermission('calendar.manage'), (req, res) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
