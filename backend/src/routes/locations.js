const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requireRole } = require('../middleware/auth')

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const locations = db.prepare('SELECT * FROM locations ORDER BY name ASC').all()
    res.json(locations)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const { name, short_code } = req.body
    if (!name) return res.status(400).json({ error: 'name ist erforderlich' })
    const result = db.prepare(
      'INSERT INTO locations (name, short_code) VALUES (?, ?)'
    ).run(name, short_code || '')
    const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(loc)
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Niederlassung mit diesem Namen existiert bereits' })
    }
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const { name, short_code } = req.body
    db.prepare(
      'UPDATE locations SET name=?, short_code=? WHERE id=?'
    ).run(name, short_code || '', req.params.id)
    const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id)
    if (!loc) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(loc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
