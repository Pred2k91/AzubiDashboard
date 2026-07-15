const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requireRole } = require('../middleware/auth')

function parseAzubis(db, row) {
  try {
    const ids = JSON.parse(row.azubi_ids || '[]')
    if (!ids.length) return { ...row, azubi_ids: [], azubis: [] }
    const azubis = db.prepare(
      `SELECT id, name, lehrjahr FROM users WHERE role = 'azubi' AND id IN (${ids.join(',')}) ORDER BY lehrjahr, name`
    ).all()
    return { ...row, azubi_ids: ids, azubis }
  } catch { return { ...row, azubi_ids: [], azubis: [] } }
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

router.post('/', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const { title, content, type, priority, date, azubi_ids, color } = req.body
    if (!title) return res.status(400).json({ error: 'title erforderlich' })
    const result = db.prepare(`
      INSERT INTO announcements (title, content, type, priority, date, azubi_ids, color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, content || '', type || 'announcement',
      priority || 'normal', date || null,
      JSON.stringify(azubi_ids || []), color || '#6366f1'
    )
    res.status(201).json(parseAzubis(db, db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const { title, content, type, priority, date, azubi_ids, color, active } = req.body
    db.prepare(`
      UPDATE announcements SET title=?, content=?, type=?, priority=?, date=?, azubi_ids=?, color=?, active=? WHERE id=?
    `).run(
      title, content || '', type || 'announcement',
      priority || 'normal', date || null,
      JSON.stringify(azubi_ids || []), color || '#6366f1',
      active !== undefined ? active : 1, req.params.id
    )
    const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(parseAzubis(db, row))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
