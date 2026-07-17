const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requireAuth } = require('../middleware/auth')
const { generateSecret, buildQrCode, verifyTotpCode, generateBackupCodes } = require('../utils/totp')

// Legt ein neues (noch unbestätigtes) Secret an -- erst nach POST /confirm mit einem
// gültigen Code wird totp_enabled=1 gesetzt. Ein erneuter Aufruf hier überschreibt ein
// noch unbestätigtes Secret einfach (harmlos, da ohnehin noch nicht aktiv).
router.post('/setup', requireAuth, async (req, res) => {
  try {
    const db = getDb()
    const secret = generateSecret()
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0, totp_backup_codes = NULL WHERE id = ?')
      .run(secret, req.user.id)
    const qr_code_data_url = await buildQrCode(req.user.email, secret)
    res.json({ secret, qr_code_data_url })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/confirm', requireAuth, (req, res) => {
  try {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user.totp_secret) return res.status(400).json({ error: 'Zuerst Einrichtung starten' })
    if (!verifyTotpCode(user.totp_secret, req.body.code)) {
      return res.status(400).json({ error: 'Code falsch' })
    }
    const { plain, hashed } = generateBackupCodes()
    db.prepare('UPDATE users SET totp_enabled = 1, totp_backup_codes = ? WHERE id = ?')
      .run(JSON.stringify(hashed), req.user.id)
    res.json({ success: true, backup_codes: plain })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/disable', requireAuth, (req, res) => {
  try {
    getDb().prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_backup_codes = NULL WHERE id = ?')
      .run(req.user.id)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
