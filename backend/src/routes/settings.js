const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requirePermission } = require('../middleware/auth')

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT key, value FROM settings').all()
    const settings = {}
    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value)
      } catch {
        settings[row.key] = row.value
      }
    }
    res.json(settings)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:key', requirePermission('settings.manage'), (req, res) => {
  try {
    const db = getDb()
    const value = JSON.stringify(req.body.value)
    db.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at"
    ).run(req.params.key, value)
    res.json({ key: req.params.key, value: req.body.value })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
