const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { getDb } = require('../db/init')
const { requireRole, hasPermission, scopeLocationIds, idsClause } = require('../middleware/auth')
const { sendMail } = require('../utils/mailer')
const { UPLOADS_DIR } = require('./upload')

router.use(requireRole('ausbilder'))

const PROFILE_FIELDS = [
  'salutation', 'first_name', 'last_name', 'birthday',
  'phone', 'mobile_phone', 'street', 'postal_code', 'city',
  'personnel_number', 'job_title', 'about_me', 'public_note', 'misc_note',
  'name', 'lehrjahr', 'start_date', 'current_department_id',
  'next_department_id', 'next_rotation_date', 'report_period',
]

// Felder, die bei fehlendem Wert NULL statt '' sein müssen (Datum/FK-Spalten)
const NULLABLE_PROFILE_FIELDS = new Set(['birthday', 'start_date', 'current_department_id', 'next_department_id', 'next_rotation_date'])

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
    cb(null, UPLOADS_DIR)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `avatar-${req.params.id}-${Date.now()}${ext}`)
  },
})
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Nur Bilddateien erlaubt')),
})

function generatePassword() {
  return crypto.randomBytes(9).toString('base64url')
}

// Prüft "azubis.edit" bzw. "users.edit" je nach Rolle des Ziel-Kontos, BEVOR z.B.
// ein Datei-Upload überhaupt verarbeitet wird.
function requireTargetEditPermission(req, res, next) {
  const target = getDb().prepare('SELECT role FROM users WHERE id = ?').get(req.params.id)
  if (!target) return res.status(404).json({ error: 'Nicht gefunden' })
  if (!hasPermission(req.user, target.role === 'azubi' ? 'azubis.edit' : 'users.edit')) {
    return res.status(403).json({ error: 'Keine Berechtigung' })
  }
  next()
}

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const locIds = scopeLocationIds(req)
    // Niederlassungs-Scope gilt nur für Azubi-Zeilen -- andere Ausbilder-Konten
    // bleiben für jeden Ausbilder mit Nutzer-Sicht auffindbar.
    const scopeClause = locIds
      ? `AND (role != 'azubi' OR id IN (SELECT user_id FROM user_locations WHERE location_id IN ${idsClause(locIds)}))`
      : ''
    const users = db.prepare(`
      SELECT id, email, role, active, must_change_password, auth_provider,
             name, lehrjahr, last_login_at, created_at
      FROM users
      WHERE 1=1 ${scopeClause}
      ORDER BY role ASC, email ASC
    `).all(...(locIds || []))
    res.json(users)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Volles Profil eines Nutzers für die Admin-Profilseite (/admin/users/:id)
router.get('/:id', (req, res) => {
  try {
    const db = getDb()
    const user = db.prepare(`
      SELECT u.*, d.name as department_name, d.color as department_color,
             nd.name as next_department_name, nd.color as next_department_color
      FROM users u
      LEFT JOIN departments d ON u.current_department_id = d.id
      LEFT JOIN departments nd ON u.next_department_id = nd.id
      WHERE u.id = ?
    `).get(req.params.id)
    if (!user) return res.status(404).json({ error: 'Nicht gefunden' })
    delete user.password_hash
    const locations = db.prepare(`
      SELECT l.id, l.name, l.short_code FROM locations l
      JOIN user_locations ul ON ul.location_id = l.id
      WHERE ul.user_id = ?
      ORDER BY l.name ASC
    `).all(req.params.id)
    const locIds = scopeLocationIds(req)
    if (locIds && user.role === 'azubi' && !locations.some(l => locIds.includes(l.id))) {
      return res.status(404).json({ error: 'Nicht gefunden' })
    }
    res.json({ ...user, locations })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', (req, res) => {
  try {
    const { email, role, name, send_email } = req.body
    if (!email) return res.status(400).json({ error: 'E-Mail ist erforderlich' })
    const finalRole = role === 'ausbilder' ? 'ausbilder' : 'azubi'
    if (!hasPermission(req.user, finalRole === 'azubi' ? 'azubis.create' : 'users.create')) {
      return res.status(403).json({ error: 'Keine Berechtigung' })
    }
    if (finalRole === 'azubi' && !name) return res.status(400).json({ error: 'Name ist erforderlich' })
    const db = getDb()
    const password = generatePassword()
    const hash = bcrypt.hashSync(password, 10)
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, role, name, must_change_password) VALUES (?, ?, ?, ?, 1)'
    ).run(String(email).toLowerCase(), hash, finalRole, finalRole === 'azubi' ? name : '')

    // Ein Niederlassungs-gescopter Ersteller legt einen Azubi automatisch in seiner(n)
    // eigenen Niederlassung(en) an -- sonst wäre der neue Azubi für ihn selbst sofort
    // nicht mehr sichtbar. Super Admin (locIds === null) lässt die Zuordnung frei/leer.
    if (finalRole === 'azubi') {
      const locIds = scopeLocationIds(req)
      if (locIds && locIds.length > 0) {
        const insertLoc = db.prepare('INSERT OR IGNORE INTO user_locations (user_id, location_id) VALUES (?, ?)')
        for (const locId of locIds) insertLoc.run(result.lastInsertRowid, locId)
      }
    }

    if (send_email) {
      sendMail({
        to: email,
        subject: 'Dein Zugang zum Ausbildungsdashboard',
        text: `Hallo,\n\nfür dich wurde ein Konto im Ausbildungsdashboard angelegt.\n\nE-Mail: ${email}\nEinmalpasswort: ${password}\n\nBitte melde dich an und ändere das Passwort bei der ersten Anmeldung.`,
      }).catch(err => console.error('[mailer] Fehler beim Versand:', err.message))
    }

    const user = db.prepare('SELECT id, email, role, name, active FROM users WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json({ ...user, generated_password: password })
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'E-Mail existiert bereits' })
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const { role, active, permission_role_id } = req.body
    const db = getDb()
    const target = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id)
    if (!target) return res.status(404).json({ error: 'Nicht gefunden' })
    const finalRole = role === 'ausbilder' ? 'ausbilder' : 'azubi'
    const editPerm = r => r === 'azubi' ? 'azubis.edit' : 'users.edit'
    // Ändert sich die Konto-Art (azubi <-> ausbilder), braucht es die Bearbeiten-Berechtigung
    // für BEIDE Seiten -- sonst könnte "nur Azubis bearbeiten" ein Konto zum Ausbilder machen.
    if (!hasPermission(req.user, editPerm(target.role)) || (finalRole !== target.role && !hasPermission(req.user, editPerm(finalRole)))) {
      return res.status(403).json({ error: 'Keine Berechtigung' })
    }
    // Wer welche Berechtigungsrolle bekommt ist selbst eine Rechtevergabe -- nur
    // Super Admin darf das ändern, unabhängig von azubis.edit/users.edit.
    if (permission_role_id !== undefined && !req.user.isSuperAdmin) {
      return res.status(403).json({ error: 'Nur Super Admin darf die Berechtigungsrolle ändern' })
    }
    if (permission_role_id !== undefined) {
      db.prepare('UPDATE users SET role=?, active=?, permission_role_id=? WHERE id=?').run(
        finalRole,
        active !== undefined ? (active ? 1 : 0) : 1,
        finalRole === 'ausbilder' ? (permission_role_id || null) : null,
        req.params.id
      )
    } else {
      db.prepare('UPDATE users SET role=?, active=? WHERE id=?').run(
        finalRole,
        active !== undefined ? (active ? 1 : 0) : 1,
        req.params.id
      )
    }
    if (active === false || active === 0) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id)
    }
    const user = db.prepare('SELECT id, email, role, active, permission_role_id FROM users WHERE id = ?').get(req.params.id)
    if (!user) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(user)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Profilfelder + Standort-Zuordnung -- getrennt von PUT /:id (dort nur role/azubi_id/active),
// damit handleToggleActive in UsersAdmin.jsx weiterhin nur diese 3 Felder anfasst.
router.put('/:id/profile', requireTargetEditPermission, (req, res) => {
  try {
    const db = getDb()
    const body = req.body
    const setClauses = PROFILE_FIELDS.map(f => `${f}=?`).join(', ')
    const values = PROFILE_FIELDS.map(f => {
      if (f === 'lehrjahr') return body.lehrjahr != null ? body.lehrjahr : 1
      if (f === 'report_period') return body.report_period === 'day' ? 'day' : 'week'
      if (NULLABLE_PROFILE_FIELDS.has(f)) return body[f] || null
      return body[f] ?? ''
    })

    const run = db.transaction(() => {
      db.prepare(`UPDATE users SET ${setClauses} WHERE id=?`).run(...values, req.params.id)
      if (Array.isArray(body.location_ids)) {
        db.prepare('DELETE FROM user_locations WHERE user_id=?').run(req.params.id)
        const insertLoc = db.prepare('INSERT OR IGNORE INTO user_locations (user_id, location_id) VALUES (?, ?)')
        for (const locId of body.location_ids) insertLoc.run(req.params.id, locId)
      }
    })
    run()

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)
    if (!user) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/:id/avatar', requireTargetEditPermission, avatarUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei' })
  const url = `/uploads/${req.file.filename}`
  getDb().prepare('UPDATE users SET avatar_url=? WHERE id=?').run(url, req.params.id)
  res.json({ avatar_url: url })
})

router.post('/:id/reset-password', requireTargetEditPermission, (req, res) => {
  try {
    const db = getDb()
    const password = generatePassword()
    const hash = bcrypt.hashSync(password, 10)
    db.prepare('UPDATE users SET password_hash=?, must_change_password=1 WHERE id=?').run(hash, req.params.id)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id)
    res.json({ success: true, generated_password: password })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Kontoentfernung ist ein eigener, unumkehrbarer Schritt -- Deaktivieren (PUT /:id) bleibt
// die reversible Standardaktion.
router.delete('/:id', (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Das eigene Konto kann nicht gelöscht werden' })
    }
    const db = getDb()
    const target = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id)
    if (!target) return res.status(404).json({ error: 'Nicht gefunden' })
    if (!hasPermission(req.user, target.role === 'azubi' ? 'azubis.delete' : 'users.delete')) {
      return res.status(403).json({ error: 'Keine Berechtigung' })
    }
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id)
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
