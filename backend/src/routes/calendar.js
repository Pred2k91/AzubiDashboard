const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')

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
    res.json(events)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', (req, res) => {
  try {
    const db = getDb()
    const { title, description, start_datetime, end_datetime, all_day, color } = req.body
    if (!title || !start_datetime || !end_datetime) {
      return res.status(400).json({ error: 'title, start_datetime und end_datetime sind erforderlich' })
    }
    const result = db.prepare(
      'INSERT INTO calendar_events (title, description, start_datetime, end_datetime, all_day, color) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(title, description || '', start_datetime, end_datetime, all_day ? 1 : 0, color || '#6366f1')
    const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(event)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const { title, description, start_datetime, end_datetime, all_day, color } = req.body
    db.prepare(
      'UPDATE calendar_events SET title=?, description=?, start_datetime=?, end_datetime=?, all_day=?, color=? WHERE id=?'
    ).run(title, description || '', start_datetime, end_datetime, all_day ? 1 : 0, color || '#6366f1', req.params.id)
    const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id)
    if (!event) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(event)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
