const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requirePermission } = require('../middleware/auth')

const KINDS = ['azubi_to_team', 'team_to_azubi']

router.use(requirePermission('feedback.manage'))

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM feedback_templates').all()
    res.json(rows.map(r => ({ ...r, questions: JSON.parse(r.questions) })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:kind', (req, res) => {
  try {
    const { kind } = req.params
    if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Ungültige Art' })
    const { name, questions } = req.body
    if (!name) return res.status(400).json({ error: 'name ist erforderlich' })
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Mindestens eine Frage ist erforderlich' })
    }
    for (const q of questions) {
      if (!q.id || !['rating', 'text'].includes(q.type) || !q.label?.trim()) {
        return res.status(400).json({ error: 'Jede Frage braucht eine id, einen Typ (Bewertung/Freitext) und eine Beschriftung' })
      }
    }
    const db = getDb()
    const result = db.prepare(
      "UPDATE feedback_templates SET name=?, questions=?, updated_at=datetime('now') WHERE kind=?"
    ).run(name, JSON.stringify(questions), kind)
    if (result.changes === 0) return res.status(404).json({ error: 'Nicht gefunden' })
    const row = db.prepare('SELECT * FROM feedback_templates WHERE kind = ?').get(kind)
    res.json({ ...row, questions: JSON.parse(row.questions) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
