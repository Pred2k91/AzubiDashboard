const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { getDb } = require('../db/init')
const { requireRole } = require('../middleware/auth')
const { sendMail } = require('../utils/mailer')
const { UPLOADS_DIR } = require('./upload')

router.use(requireRole('ausbilder'))

const PROFILE_FIELDS = [
  'salutation', 'first_name', 'last_name', 'birthday',
  'phone', 'mobile_phone', 'street', 'postal_code', 'city',
  'personnel_number', 'job_title', 'about_me', 'public_note', 'misc_note',
]

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

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const users = db.prepare(`
      SELECT u.id, u.email, u.role, u.active, u.must_change_password, u.auth_provider,
             u.azubi_id, u.last_login_at, u.created_at, a.name as azubi_name
      FROM users u
      LEFT JOIN azubis a ON u.azubi_id = a.id
      ORDER BY u.role ASC, u.email ASC
    `).all()
    res.json(users)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Volles Profil eines Nutzers für die Admin-Profilseite (/admin/users/:id)
router.get('/:id', (req, res) => {
  try {
    const db = getDb()
    const user = db.prepare(`
      SELECT u.*, a.name as azubi_name, a.birthday as azubi_birthday, a.lehrjahr as azubi_lehrjahr
      FROM users u
      LEFT JOIN azubis a ON u.azubi_id = a.id
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
    res.json({ ...user, locations })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', (req, res) => {
  try {
    const { email, role, azubi_id, send_email } = req.body
    if (!email) return res.status(400).json({ error: 'E-Mail ist erforderlich' })
    const db = getDb()
    const password = generatePassword()
    const hash = bcrypt.hashSync(password, 10)
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, role, azubi_id, must_change_password) VALUES (?, ?, ?, ?, 1)'
    ).run(String(email).toLowerCase(), hash, role === 'ausbilder' ? 'ausbilder' : 'azubi', azubi_id || null)

    if (send_email) {
      sendMail({
        to: email,
        subject: 'Dein Zugang zum Ausbildungsdashboard',
        text: `Hallo,\n\nfür dich wurde ein Konto im Ausbildungsdashboard angelegt.\n\nE-Mail: ${email}\nEinmalpasswort: ${password}\n\nBitte melde dich an und ändere das Passwort bei der ersten Anmeldung.`,
      }).catch(err => console.error('[mailer] Fehler beim Versand:', err.message))
    }

    const user = db.prepare('SELECT id, email, role, azubi_id, active FROM users WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json({ ...user, generated_password: password })
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'E-Mail existiert bereits' })
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const { role, azubi_id, active } = req.body
    const db = getDb()
    db.prepare('UPDATE users SET role=?, azubi_id=?, active=? WHERE id=?').run(
      role === 'ausbilder' ? 'ausbilder' : 'azubi',
      azubi_id || null,
      active !== undefined ? (active ? 1 : 0) : 1,
      req.params.id
    )
    if (active === false || active === 0) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id)
    }
    const user = db.prepare('SELECT id, email, role, azubi_id, active FROM users WHERE id = ?').get(req.params.id)
    if (!user) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(user)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Profilfelder + Standort-Zuordnung -- getrennt von PUT /:id (dort nur role/azubi_id/active),
// damit handleToggleActive in UsersAdmin.jsx weiterhin nur diese 3 Felder anfasst.
router.put('/:id/profile', (req, res) => {
  try {
    const db = getDb()
    const body = req.body
    const setClauses = PROFILE_FIELDS.map(f => `${f}=?`).join(', ')
    const values = PROFILE_FIELDS.map(f => (f === 'birthday' ? (body.birthday || null) : (body[f] ?? '')))

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

router.post('/:id/avatar', avatarUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei' })
  const url = `/uploads/${req.file.filename}`
  getDb().prepare('UPDATE users SET avatar_url=? WHERE id=?').run(url, req.params.id)
  res.json({ avatar_url: url })
})

router.post('/:id/reset-password', (req, res) => {
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
// die reversible Standardaktion. Der verknüpfte Azubi-Datensatz bleibt erhalten, das Konto
// verschwindet nur als Verknüpfung (zeigt in AzubiAdmin dann wieder "Konto anlegen").
router.delete('/:id', (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Das eigene Konto kann nicht gelöscht werden' })
    }
    const db = getDb()
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id)
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
