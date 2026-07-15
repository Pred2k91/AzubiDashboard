const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requirePermission } = require('../middleware/auth')

router.use(requirePermission('workflows.manage'))

function groupWithMembers(db, group) {
  const rows = db.prepare('SELECT member_type, member_id FROM notification_group_members WHERE group_id = ?').all(group.id)
  const members = rows.map(r => {
    if (r.member_type === 'user') {
      const u = db.prepare('SELECT name, email FROM users WHERE id = ?').get(r.member_id)
      return { type: 'user', id: r.member_id, label: u?.name || u?.email || `Nutzer #${r.member_id}` }
    }
    const role = db.prepare('SELECT name FROM permission_roles WHERE id = ?').get(r.member_id)
    return { type: 'permission_role', id: r.member_id, label: role?.name || `Rolle #${r.member_id}` }
  })
  return { ...group, members }
}

function saveMembers(db, groupId, members) {
  db.prepare('DELETE FROM notification_group_members WHERE group_id = ?').run(groupId)
  const insert = db.prepare('INSERT OR IGNORE INTO notification_group_members (group_id, member_type, member_id) VALUES (?, ?, ?)')
  for (const m of (members || [])) {
    if (m.type === 'user' || m.type === 'permission_role') insert.run(groupId, m.type, m.id)
  }
}

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const groups = db.prepare('SELECT * FROM notification_groups ORDER BY name ASC').all()
    res.json(groups.map(g => groupWithMembers(db, g)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', (req, res) => {
  try {
    const { name, members } = req.body
    if (!name) return res.status(400).json({ error: 'name ist erforderlich' })
    const db = getDb()
    const groupId = db.transaction(() => {
      const result = db.prepare('INSERT INTO notification_groups (name) VALUES (?)').run(name)
      saveMembers(db, result.lastInsertRowid, members)
      return result.lastInsertRowid
    })()
    const group = db.prepare('SELECT * FROM notification_groups WHERE id = ?').get(groupId)
    res.status(201).json(groupWithMembers(db, group))
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Gruppe mit diesem Namen existiert bereits' })
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT id FROM notification_groups WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Nicht gefunden' })
    const { name, members } = req.body
    if (!name) return res.status(400).json({ error: 'name ist erforderlich' })
    db.transaction(() => {
      db.prepare('UPDATE notification_groups SET name = ? WHERE id = ?').run(name, req.params.id)
      saveMembers(db, req.params.id, members)
    })()
    const group = db.prepare('SELECT * FROM notification_groups WHERE id = ?').get(req.params.id)
    res.json(groupWithMembers(db, group))
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Gruppe mit diesem Namen existiert bereits' })
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    const result = db.prepare('DELETE FROM notification_groups WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
