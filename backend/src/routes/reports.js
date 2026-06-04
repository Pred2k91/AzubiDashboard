const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')

function getThresholds(db) {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('report_warn_days','report_alert_days')").all()
  const get = (k, def) => { try { return parseInt(JSON.parse(rows.find(r => r.key === k)?.value || String(def))) } catch { return def } }
  return { warn: get('report_warn_days', 14), alert: get('report_alert_days', 28) }
}

function calcStatus(lastDate, warn, alert) {
  if (!lastDate) return { status: 'alert', days: null }
  const days = Math.floor((Date.now() - new Date(lastDate)) / 86400000)
  if (days > alert) return { status: 'alert', days }
  if (days > warn) return { status: 'warn', days }
  return { status: 'ok', days }
}

// GET /api/reports — Status aller Azubis
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const { warn, alert } = getThresholds(db)
    const azubis = db.prepare(`
      SELECT id, name, lehrjahr, last_report_date
      FROM azubis WHERE active = 1
      ORDER BY lehrjahr ASC, name ASC
    `).all()

    const result = azubis.map(a => ({
      ...a,
      ...calcStatus(a.last_report_date, warn, alert),
    })).sort((a, b) => {
      const order = { alert: 0, warn: 1, ok: 2 }
      return (order[a.status] - order[b.status]) || (b.days ?? 999) - (a.days ?? 999)
    })

    res.json({ azubis: result, warn, alert })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/reports/:id — Einreichung markieren
router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const date = req.body.date || new Date().toISOString().slice(0, 10)
    db.prepare('UPDATE azubis SET last_report_date = ? WHERE id = ?').run(date, req.params.id)
    res.json({ success: true, date })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/reports/bulk — Mehrere auf einmal markieren
router.put('/bulk/submit', (req, res) => {
  try {
    const db = getDb()
    const { ids, date } = req.body
    const d = date || new Date().toISOString().slice(0, 10)
    const stmt = db.prepare('UPDATE azubis SET last_report_date = ? WHERE id = ?')
    const run = db.transaction(() => ids.forEach(id => stmt.run(d, id)))
    run()
    res.json({ success: true, count: ids.length, date: d })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
