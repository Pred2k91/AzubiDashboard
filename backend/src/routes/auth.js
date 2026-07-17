const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { getDb } = require('../db/init')
const { requireAuth, attachPermissions } = require('../middleware/auth')
const { sendMail } = require('../utils/mailer')
const { verifyTotpCode, consumeBackupCode } = require('../utils/totp')

const SESSION_DAYS = 30
const COOKIE_NAME = 'sid'
const RESET_TOKEN_HOURS = 1
const PENDING_2FA_MINUTES = 10

function createSession(db, userId, userAgent) {
  const id = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)'
  ).run(id, userId, expires, userAgent || '')
  return { id, expires }
}

function setSessionCookie(res, session) {
  res.cookie(COOKIE_NAME, session.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    expires: new Date(session.expires),
  })
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    must_change_password: !!u.must_change_password,
    is_super_admin: !!u.isSuperAdmin,
    permission_role_id: u.permission_role_id || null,
    permissions: u.permissions ? [...u.permissions] : [],
    location_ids: u.locationIds || [],
    totp_enabled: !!u.totp_enabled,
    avatar_url: u.avatar_url || null,
  }
}

function finishLogin(req, res, db, user) {
  // user.last_login_at ist hier noch der Stand VOR diesem Login (aus dem SELECT weiter oben) --
  // war er noch nie gesetzt, ist das der allererste Login dieses Kontos (z.B. für den
  // automatischen Push-Aktivierungsversuch im Frontend relevant).
  const firstLogin = !user.last_login_at
  const session = createSession(db, user.id, req.headers['user-agent'])
  setSessionCookie(res, session)
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id)
  res.json({ user: publicUser(attachPermissions(db, user)), first_login: firstLogin })
}

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' })
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase())
    if (!user || !user.active || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'E-Mail oder Passwort falsch' })
    }

    if (user.totp_enabled) {
      const pendingToken = crypto.randomBytes(32).toString('hex')
      const expires = new Date(Date.now() + PENDING_2FA_MINUTES * 60 * 1000).toISOString()
      db.prepare('INSERT INTO pending_2fa_logins (token, user_id, expires_at) VALUES (?, ?, ?)')
        .run(pendingToken, user.id, expires)
      return res.json({ requires_2fa: true, pending_token: pendingToken })
    }

    finishLogin(req, res, db, user)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/login/verify-2fa', (req, res) => {
  try {
    const { pending_token, code } = req.body
    if (!pending_token || !code) return res.status(400).json({ error: 'Code erforderlich' })
    const db = getDb()
    const pending = db.prepare('SELECT * FROM pending_2fa_logins WHERE token = ?').get(pending_token)
    if (!pending || new Date(pending.expires_at) < new Date()) {
      if (pending) db.prepare('DELETE FROM pending_2fa_logins WHERE token = ?').run(pending_token)
      return res.status(401).json({ error: 'Anmeldung abgelaufen, bitte erneut mit E-Mail/Passwort anmelden' })
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(pending.user_id)
    if (!user || !user.active || !user.totp_enabled) {
      db.prepare('DELETE FROM pending_2fa_logins WHERE token = ?').run(pending_token)
      return res.status(401).json({ error: 'Ungültige Anfrage' })
    }

    let valid = verifyTotpCode(user.totp_secret, code)
    if (!valid) {
      const remainingBackupCodes = consumeBackupCode(JSON.parse(user.totp_backup_codes || '[]'), code)
      if (remainingBackupCodes) {
        valid = true
        db.prepare('UPDATE users SET totp_backup_codes = ? WHERE id = ?').run(JSON.stringify(remainingBackupCodes), user.id)
      }
    }
    if (!valid) return res.status(401).json({ error: 'Code falsch' })

    db.prepare('DELETE FROM pending_2fa_logins WHERE token = ?').run(pending_token)
    finishLogin(req, res, db, user)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/logout', (req, res) => {
  try {
    const db = getDb()
    const sid = req.cookies?.sid
    if (sid) db.prepare('DELETE FROM sessions WHERE id = ?').run(sid)
    res.clearCookie(COOKIE_NAME)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

router.put('/me', requireAuth, (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'E-Mail ist erforderlich' })
    const db = getDb()
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(String(email).toLowerCase(), req.user.id)
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    res.json({ user: publicUser(attachPermissions(db, user)) })
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'E-Mail wird bereits verwendet' })
    res.status(500).json({ error: err.message })
  }
})

router.post('/change-password', requireAuth, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben' })
    }
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    // Beim erzwungenen Erst-Passwortwechsel (Einmalpasswort) ist das aktuelle Passwort nicht nötig
    if (!user.must_change_password) {
      if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.status(401).json({ error: 'Aktuelles Passwort falsch' })
      }
    }
    const hash = bcrypt.hashSync(newPassword, 10)
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hash, user.id)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/forgot-password', (req, res) => {
  try {
    const { email } = req.body
    const db = getDb()
    const user = email
      ? db.prepare("SELECT * FROM users WHERE email = ? AND active = 1 AND auth_provider = 'local'").get(String(email).toLowerCase())
      : null

    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      const expires = new Date(Date.now() + RESET_TOKEN_HOURS * 60 * 60 * 1000).toISOString()
      db.prepare(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
      ).run(user.id, tokenHash, expires)

      const base = process.env.APP_BASE_URL || 'http://localhost:3000'
      const link = `${base}/reset-password?token=${token}`
      sendMail({
        to: user.email,
        subject: 'Passwort zurücksetzen',
        text: `Zum Zurücksetzen deines Passworts klicke auf folgenden Link (gültig ${RESET_TOKEN_HOURS} Stunde):\n\n${link}\n\nFalls du das nicht angefordert hast, kannst du diese E-Mail ignorieren.`,
      }).catch(err => console.error('[mailer] Fehler beim Versand:', err.message))
    }

    // Immer Erfolg melden, unabhängig davon ob die E-Mail existiert (kein User-Enumeration)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/reset-password', (req, res) => {
  try {
    const { token, newPassword } = req.body
    if (!token || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Ungültige Anfrage' })
    }
    const db = getDb()
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const row = db.prepare(
      'SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL'
    ).get(tokenHash)
    if (!row || new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Link ungültig oder abgelaufen' })
    }
    const hash = bcrypt.hashSync(newPassword, 10)
    const run = db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hash, row.user_id)
      db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").run(row.id)
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id)
    })
    run()
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
