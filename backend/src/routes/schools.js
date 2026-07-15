const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requireRole } = require('../middleware/auth')

// ── Schulen ───────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const schools = db.prepare('SELECT * FROM vocational_schools ORDER BY name ASC').all()
    res.json(schools)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const { name, color, location } = req.body
    if (!name) return res.status(400).json({ error: 'name ist erforderlich' })
    const result = db.prepare(
      'INSERT INTO vocational_schools (name, color, location) VALUES (?, ?, ?)'
    ).run(name, color || '#06b6d4', location || '')
    res.status(201).json(db.prepare('SELECT * FROM vocational_schools WHERE id = ?').get(result.lastInsertRowid))
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Schule existiert bereits' })
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const { name, color, location } = req.body
    db.prepare('UPDATE vocational_schools SET name=?, color=?, location=? WHERE id=?')
      .run(name, color || '#06b6d4', location || '', req.params.id)
    const school = db.prepare('SELECT * FROM vocational_schools WHERE id = ?').get(req.params.id)
    if (!school) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(school)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM vocational_schools WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Blöcke ────────────────────────────────────────────────────────────────────

function blockWithAzubis(db, block) {
  const azubis = db.prepare(`
    SELECT a.id, a.name, a.lehrjahr FROM school_block_azubis sba
    JOIN users a ON sba.azubi_id = a.id
    WHERE sba.block_id = ? ORDER BY a.lehrjahr, a.name ASC
  `).all(block.id)
  return { ...block, azubis, azubi_ids: azubis.map(a => a.id) }
}

function saveBlockAzubis(db, blockId, azubiIds) {
  db.prepare('DELETE FROM school_block_azubis WHERE block_id = ?').run(blockId)
  const insert = db.prepare('INSERT OR IGNORE INTO school_block_azubis (block_id, azubi_id) VALUES (?, ?)')
  const run = db.transaction(() => { for (const id of (azubiIds || [])) insert.run(blockId, id) })
  run()
}

router.get('/:schoolId/blocks', (req, res) => {
  try {
    const db = getDb()
    const blocks = db.prepare('SELECT * FROM school_blocks WHERE school_id = ? ORDER BY start_date DESC').all(req.params.schoolId)
    res.json(blocks.map(b => blockWithAzubis(db, b)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/:schoolId/blocks', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const { start_date, end_date, notes, azubi_ids } = req.body
    if (!start_date || !end_date) return res.status(400).json({ error: 'start_date und end_date erforderlich' })
    const result = db.prepare(
      'INSERT INTO school_blocks (school_id, start_date, end_date, notes) VALUES (?, ?, ?, ?)'
    ).run(req.params.schoolId, start_date, end_date, notes || '')
    saveBlockAzubis(db, result.lastInsertRowid, azubi_ids)
    res.status(201).json(blockWithAzubis(db, db.prepare('SELECT * FROM school_blocks WHERE id = ?').get(result.lastInsertRowid)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/blocks/:id', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const { start_date, end_date, notes, azubi_ids } = req.body
    db.prepare('UPDATE school_blocks SET start_date=?, end_date=?, notes=? WHERE id=?')
      .run(start_date, end_date, notes || '', req.params.id)
    saveBlockAzubis(db, req.params.id, azubi_ids)
    res.json(blockWithAzubis(db, db.prepare('SELECT * FROM school_blocks WHERE id = ?').get(req.params.id)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/blocks/:id', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM school_blocks WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
