const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requireRole } = require('../middleware/auth')

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const departments = db.prepare('SELECT * FROM departments ORDER BY name ASC').all()
    res.json(departments)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const { name, color, description, location } = req.body
    if (!name) return res.status(400).json({ error: 'name ist erforderlich' })
    const result = db.prepare(
      'INSERT INTO departments (name, color, description, location) VALUES (?, ?, ?, ?)'
    ).run(name, color || '#6366f1', description || '', location || '')
    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(dept)
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Abteilung mit diesem Namen existiert bereits' })
    }
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const { name, color, description, location } = req.body
    db.prepare(
      'UPDATE departments SET name=?, color=?, description=?, location=? WHERE id=?'
    ).run(name, color || '#6366f1', description || '', location || '', req.params.id)
    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id)
    if (!dept) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(dept)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
