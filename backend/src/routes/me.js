const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { getDb } = require('../db/init')
const { requireAuth } = require('../middleware/auth')
const { calcStatus, getThresholds } = require('./reports')
const { UPLOADS_DIR } = require('./upload')

// Nutzer dürfen nur eine Teilmenge ihres eigenen Profils selbst ändern -- Rolle,
// Personalnummer, Funktion, Standorte und die interne Notiz bleiben admin-only
// (nur über /api/users/:id/profile, siehe users.js).
const SELF_EDITABLE_FIELDS = ['salutation', 'phone', 'mobile_phone', 'street', 'postal_code', 'city', 'about_me', 'public_note']

const meAvatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
    cb(null, UPLOADS_DIR)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`)
  },
})
const meAvatarUpload = multer({
  storage: meAvatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Nur Bilddateien erlaubt')),
})

// Liefert den mit dem eingeloggten Benutzer verknüpften Azubi-Datensatz —
// die azubi_id kommt IMMER aus der Session (req.user), niemals aus der Anfrage,
// damit ein Azubi niemals Daten eines anderen Azubis abrufen kann.
function getOwnAzubi(req) {
  if (!req.user.azubi_id) return null
  const db = getDb()
  return db.prepare('SELECT * FROM azubis WHERE id = ? AND active = 1').get(req.user.azubi_id)
}

router.get('/', requireAuth, (req, res) => {
  try {
    const azubi = getOwnAzubi(req)
    if (!azubi) return res.json({ linked: false })
    res.json({
      linked: true,
      id: azubi.id,
      name: azubi.name,
      lehrjahr: azubi.lehrjahr,
      start_date: azubi.start_date,
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/team', requireAuth, (req, res) => {
  try {
    const azubi = getOwnAzubi(req)
    if (!azubi) return res.json({ linked: false })
    const db = getDb()
    const current = azubi.current_department_id
      ? db.prepare('SELECT id, name, color, location FROM departments WHERE id = ?').get(azubi.current_department_id)
      : null
    const next = azubi.next_department_id
      ? {
          ...db.prepare('SELECT id, name, color, location FROM departments WHERE id = ?').get(azubi.next_department_id),
          date: azubi.next_rotation_date,
        }
      : null
    res.json({ linked: true, current, next })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/calendar', requireAuth, (req, res) => {
  try {
    const azubi = getOwnAzubi(req)
    if (!azubi) return res.json({ linked: false, events: [] })
    const db = getDb()
    const { start, end } = req.query
    const events = (start && end)
      ? db.prepare(`
          SELECT ce.* FROM calendar_events ce
          JOIN event_azubis ea ON ea.event_id = ce.id
          WHERE ea.azubi_id = ? AND ce.start_datetime <= ? AND ce.end_datetime >= ?
          ORDER BY ce.start_datetime ASC
        `).all(azubi.id, end, start)
      : db.prepare(`
          SELECT ce.* FROM calendar_events ce
          JOIN event_azubis ea ON ea.event_id = ce.id
          WHERE ea.azubi_id = ?
          ORDER BY ce.start_datetime ASC
        `).all(azubi.id)
    res.json({ linked: true, events })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/reports', requireAuth, (req, res) => {
  try {
    const azubi = getOwnAzubi(req)
    if (!azubi) return res.json({ linked: false })
    const db = getDb()
    const { warn, alert } = getThresholds(db)
    res.json({
      linked: true,
      warn,
      alert,
      last_report_date: azubi.last_report_date,
      ...calcStatus(azubi.last_report_date, warn, alert),
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/profile', requireAuth, (req, res) => {
  try {
    const db = getDb()
    const u = req.user
    const azubi = u.azubi_id ? db.prepare('SELECT name, birthday FROM azubis WHERE id=?').get(u.azubi_id) : null
    const locations = db.prepare(`
      SELECT l.id, l.name, l.short_code FROM locations l
      JOIN user_locations ul ON ul.location_id = l.id
      WHERE ul.user_id = ?
      ORDER BY l.name ASC
    `).all(u.id)
    res.json({
      id: u.id,
      email: u.email,
      role: u.role,
      is_azubi_linked: !!u.azubi_id,
      // Name/Geburtsdatum kommen bei verknüpftem Azubi-Konto aus azubis (dort die
      // alleinige Quelle der Wahrheit), sonst aus den eigenen users-Feldern.
      display_name: azubi ? azubi.name : `${u.first_name || ''} ${u.last_name || ''}`.trim(),
      display_birthday: azubi ? azubi.birthday : u.birthday,
      salutation: u.salutation,
      first_name: u.first_name,
      last_name: u.last_name,
      phone: u.phone,
      mobile_phone: u.mobile_phone,
      street: u.street,
      postal_code: u.postal_code,
      city: u.city,
      about_me: u.about_me,
      public_note: u.public_note,
      personnel_number: u.personnel_number,
      job_title: u.job_title,
      avatar_url: u.avatar_url,
      locations,
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/profile', requireAuth, (req, res) => {
  try {
    const db = getDb()
    const body = req.body
    const fields = [...SELF_EDITABLE_FIELDS]
    // Name darf nur selbst geändert werden, wenn kein Azubi-Datensatz verknüpft ist --
    // sonst bleibt azubis.name/birthday maßgeblich (nur über AzubiAdmin.jsx änderbar).
    if (!req.user.azubi_id) fields.push('first_name', 'last_name')
    const setClauses = fields.map(f => `${f}=?`).join(', ')
    const values = fields.map(f => body[f] ?? '')
    db.prepare(`UPDATE users SET ${setClauses} WHERE id=?`).run(...values, req.user.id)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/avatar', requireAuth, meAvatarUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei' })
  const url = `/uploads/${req.file.filename}`
  getDb().prepare('UPDATE users SET avatar_url=? WHERE id=?').run(url, req.user.id)
  res.json({ avatar_url: url })
})

module.exports = router
