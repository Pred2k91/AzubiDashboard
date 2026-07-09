const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requireRole } = require('../middleware/auth')

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const notes = db.prepare('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC').all()
    res.json(notes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const { title, content, color, pinned } = req.body
    if (!title) return res.status(400).json({ error: 'title ist erforderlich' })
    const result = db.prepare(
      'INSERT INTO notes (title, content, color, pinned) VALUES (?, ?, ?, ?)'
    ).run(title, content || '', color || '#6366f1', pinned ? 1 : 0)
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(note)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const { title, content, color, pinned } = req.body
    db.prepare(
      "UPDATE notes SET title=?, content=?, color=?, pinned=?, updated_at=datetime('now') WHERE id=?"
    ).run(title, content || '', color || '#6366f1', pinned ? 1 : 0, req.params.id)
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id)
    if (!note) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(note)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
