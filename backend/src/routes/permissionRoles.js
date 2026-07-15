const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requireRole } = require('../middleware/auth')
const { PERMISSION_KEYS } = require('../permissions')

router.use(requireRole('ausbilder'))

function requireSuperAdmin(req, res, next) {
  if (!req.user.isSuperAdmin) return res.status(403).json({ error: 'Nur Super Admin darf Rollen verwalten' })
  next()
}

function roleWithPermissions(db, role) {
  const perms = db.prepare('SELECT permission_key FROM role_permissions WHERE role_id = ?').all(role.id)
  return { ...role, permissions: perms.map(p => p.permission_key) }
}

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const roles = db.prepare('SELECT * FROM permission_roles ORDER BY is_super_admin DESC, name ASC').all()
    res.json(roles.map(r => roleWithPermissions(db, r)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', requireSuperAdmin, (req, res) => {
  try {
    const db = getDb()
    const { name, permissions } = req.body
    if (!name) return res.status(400).json({ error: 'name ist erforderlich' })
    const grant = (permissions || []).filter(p => PERMISSION_KEYS.includes(p))

    const roleId = db.transaction(() => {
      const result = db.prepare('INSERT INTO permission_roles (name) VALUES (?)').run(name)
      const insertPerm = db.prepare('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)')
      for (const key of grant) insertPerm.run(result.lastInsertRowid, key)
      return result.lastInsertRowid
    })()

    const role = db.prepare('SELECT * FROM permission_roles WHERE id = ?').get(roleId)
    res.status(201).json(roleWithPermissions(db, role))
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Rolle mit diesem Namen existiert bereits' })
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', requireSuperAdmin, (req, res) => {
  try {
    const db = getDb()
    const role = db.prepare('SELECT * FROM permission_roles WHERE id = ?').get(req.params.id)
    if (!role) return res.status(404).json({ error: 'Nicht gefunden' })
    if (role.is_super_admin) return res.status(400).json({ error: 'Super Admin kann nicht geändert werden' })

    const { name, permissions } = req.body
    if (!name) return res.status(400).json({ error: 'name ist erforderlich' })
    const grant = (permissions || []).filter(p => PERMISSION_KEYS.includes(p))

    db.transaction(() => {
      db.prepare('UPDATE permission_roles SET name = ? WHERE id = ?').run(name, role.id)
      db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(role.id)
      const insertPerm = db.prepare('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)')
      for (const key of grant) insertPerm.run(role.id, key)
    })()

    const updated = db.prepare('SELECT * FROM permission_roles WHERE id = ?').get(role.id)
    res.json(roleWithPermissions(db, updated))
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Rolle mit diesem Namen existiert bereits' })
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', requireSuperAdmin, (req, res) => {
  try {
    const db = getDb()
    const role = db.prepare('SELECT * FROM permission_roles WHERE id = ?').get(req.params.id)
    if (!role) return res.status(404).json({ error: 'Nicht gefunden' })
    if (role.is_super_admin) return res.status(400).json({ error: 'Super Admin kann nicht gelöscht werden' })
    // Nutzer mit dieser Rolle verlieren per ON DELETE SET NULL automatisch alle Rechte (sicherer Standard).
    db.prepare('DELETE FROM permission_roles WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
