const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { authenticator } = require('otplib')
const QRCode = require('qrcode')

// Erlaubt ±30s Uhrabweichung zwischen Server und Handy, sonst sind TOTP-Codes
// unnötig oft "falsch", obwohl das Handy nur ein paar Sekunden nachgeht.
authenticator.options = { window: 1 }

const ISSUER = 'HERcademy'
const BACKUP_CODE_COUNT = 8

function generateSecret() {
  return authenticator.generateSecret()
}

async function buildQrCode(email, secret) {
  const otpauthUrl = authenticator.keyuri(email, ISSUER, secret)
  return QRCode.toDataURL(otpauthUrl)
}

function verifyTotpCode(secret, code) {
  if (!secret || !code) return false
  try { return authenticator.verify({ token: String(code).trim(), secret }) } catch { return false }
}

// 8 Codes im Format XXXX-XXXX (gut abzulesen/abzutippen), gehasht gespeichert wie Passwörter --
// Klartext wird dem Nutzer nur EINMAL direkt nach dem Aktivieren angezeigt.
function generateBackupCodes() {
  const plain = []
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase()
    plain.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`)
  }
  const hashed = plain.map(code => bcrypt.hashSync(code, 10))
  return { plain, hashed }
}

// Bei Treffer wird der verbrauchte Code aus der Liste entfernt (Einmalgebrauch) --
// Rückgabewert ist die aktualisierte Hash-Liste, oder null bei keinem Treffer.
function consumeBackupCode(hashedCodes, code) {
  const normalized = String(code).trim().toUpperCase()
  const idx = hashedCodes.findIndex(hash => bcrypt.compareSync(normalized, hash))
  if (idx === -1) return null
  return hashedCodes.filter((_, i) => i !== idx)
}

module.exports = { generateSecret, buildQrCode, verifyTotpCode, generateBackupCodes, consumeBackupCode }
