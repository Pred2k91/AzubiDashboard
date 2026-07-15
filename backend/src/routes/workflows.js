const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requireRole, requirePermission } = require('../middleware/auth')
const { TRIGGER_TYPES, ACTION_TYPES } = require('../workflowCatalog')

router.use(requireRole('ausbilder'))

function workflowWithActions(db, workflow) {
  const actions = db.prepare('SELECT * FROM workflow_actions WHERE workflow_id = ? ORDER BY position ASC').all(workflow.id)
  return {
    ...workflow,
    trigger_config: JSON.parse(workflow.trigger_config),
    actions: actions.map(a => ({ ...a, action_config: JSON.parse(a.action_config) })),
  }
}

// Wandelt einen entity_key (z.B. "azubi:5", "todo:3", "event:7:azubi:5") in einen
// menschenlesbaren Verlaufs-Eintrag um -- rein für die Anzeige im Admin-UI.
function describeEntityKey(db, entityKey) {
  const parts = String(entityKey).split(':')
  if (parts[0] === 'azubi') {
    const u = db.prepare('SELECT name FROM users WHERE id = ?').get(parts[1])
    return u?.name || `Azubi #${parts[1]}`
  }
  if (parts[0] === 'report_entry') {
    const e = db.prepare(
      'SELECT re.period_start, re.period_end, u.name FROM report_entries re JOIN users u ON u.id = re.azubi_id WHERE re.id = ?'
    ).get(parts[1])
    return e ? `${e.name} (${e.period_start} – ${e.period_end})` : `Bericht #${parts[1]}`
  }
  if (parts[0] === 'todo') {
    const t = db.prepare('SELECT title FROM todos WHERE id = ?').get(parts[1])
    return t?.title || `Aufgabe #${parts[1]}`
  }
  if (parts[0] === 'event') {
    const ev = db.prepare('SELECT title FROM calendar_events WHERE id = ?').get(parts[1])
    let label = ev?.title || `Termin #${parts[1]}`
    if (parts[2] === 'azubi') {
      const u = db.prepare('SELECT name FROM users WHERE id = ?').get(parts[3])
      if (u) label += ` — ${u.name}`
    }
    return label
  }
  return entityKey
}

function validateBody(body) {
  if (!body.name) return 'name ist erforderlich'
  if (!TRIGGER_TYPES.includes(body.trigger_type)) return 'Ungültiger Auslöser-Typ'
  if (!Array.isArray(body.actions) || body.actions.length === 0) return 'Mindestens eine Aktion ist erforderlich'
  for (const a of body.actions) {
    if (!ACTION_TYPES.includes(a.action_type)) return 'Ungültiger Aktions-Typ'
  }
  return null
}

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const workflows = db.prepare('SELECT * FROM workflows ORDER BY created_at DESC').all()
    res.json(workflows.map(w => workflowWithActions(db, w)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Letzte Ausführungen eines Workflows -- rein lesend, für die "Letzte Ausführungen"-Anzeige im Admin-UI.
router.get('/:id/runs', (req, res) => {
  try {
    const db = getDb()
    const runs = db.prepare(
      'SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY fired_at DESC LIMIT 50'
    ).all(req.params.id)
    res.json(runs.map(r => ({ ...r, label: describeEntityKey(db, r.entity_key) })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', requirePermission('workflows.manage'), (req, res) => {
  try {
    const validationError = validateBody(req.body)
    if (validationError) return res.status(400).json({ error: validationError })
    const db = getDb()
    const { name, active, trigger_type, trigger_config, actions } = req.body

    const workflowId = db.transaction(() => {
      const result = db.prepare(
        'INSERT INTO workflows (name, active, trigger_type, trigger_config) VALUES (?, ?, ?, ?)'
      ).run(name, active !== undefined ? (active ? 1 : 0) : 1, trigger_type, JSON.stringify(trigger_config || {}))
      const id = result.lastInsertRowid
      const insertAction = db.prepare(
        'INSERT INTO workflow_actions (workflow_id, position, action_type, action_config) VALUES (?, ?, ?, ?)'
      )
      actions.forEach((a, i) => insertAction.run(id, i, a.action_type, JSON.stringify(a.action_config || {})))
      return id
    })()

    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflowId)
    res.status(201).json(workflowWithActions(db, workflow))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', requirePermission('workflows.manage'), (req, res) => {
  try {
    const validationError = validateBody(req.body)
    if (validationError) return res.status(400).json({ error: validationError })
    const db = getDb()
    const existing = db.prepare('SELECT id FROM workflows WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Nicht gefunden' })

    const { name, active, trigger_type, trigger_config, actions } = req.body
    db.transaction(() => {
      db.prepare(
        "UPDATE workflows SET name=?, active=?, trigger_type=?, trigger_config=?, updated_at=datetime('now') WHERE id=?"
      ).run(name, active !== undefined ? (active ? 1 : 0) : 1, trigger_type, JSON.stringify(trigger_config || {}), req.params.id)
      db.prepare('DELETE FROM workflow_actions WHERE workflow_id = ?').run(req.params.id)
      const insertAction = db.prepare(
        'INSERT INTO workflow_actions (workflow_id, position, action_type, action_config) VALUES (?, ?, ?, ?)'
      )
      actions.forEach((a, i) => insertAction.run(req.params.id, i, a.action_type, JSON.stringify(a.action_config || {})))
    })()

    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id)
    res.json(workflowWithActions(db, workflow))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', requirePermission('workflows.manage'), (req, res) => {
  try {
    const db = getDb()
    const result = db.prepare('DELETE FROM workflows WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
