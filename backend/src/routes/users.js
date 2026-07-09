const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { getDb } = require('../db/init')
const { requireRole } = require('../middleware/auth')
const { sendMail } = require('../utils/mailer')

router.use(requireRole('ausbilder'))

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

router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
