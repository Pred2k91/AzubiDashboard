const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const { status } = req.query
    let todos
    if (status) {
      todos = db.prepare('SELECT * FROM todos WHERE status = ? ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END ASC, due_date ASC, created_at DESC').all(status)
    } else {
      todos = db.prepare('SELECT * FROM todos ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END ASC, due_date ASC, created_at DESC').all()
    }
    res.json(todos)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', (req, res) => {
  try {
    const db = getDb()
    const { title, description, priority, status, due_date } = req.body
    if (!title) return res.status(400).json({ error: 'title ist erforderlich' })
    const result = db.prepare(
      'INSERT INTO todos (title, description, priority, status, due_date) VALUES (?, ?, ?, ?, ?)'
    ).run(title, description || '', priority || 'medium', status || 'open', due_date || null)
    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(todo)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const { title, description, priority, status, due_date } = req.body
    db.prepare(
      "UPDATE todos SET title=?, description=?, priority=?, status=?, due_date=?, updated_at=datetime('now') WHERE id=?"
    ).run(title, description || '', priority || 'medium', status || 'open', due_date || null, req.params.id)
    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id)
    if (!todo) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(todo)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
