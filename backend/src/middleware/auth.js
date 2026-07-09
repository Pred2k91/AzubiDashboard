const { getDb } = require('../db/init')

function getSessionUser(req) {
  const sid = req.cookies?.sid
  if (!sid) return null
  const db = getDb()
  const row = db.prepare(`
    SELECT s.expires_at, u.*
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(sid)
  if (!row) return null
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sid)
    return null
  }
  if (!row.active) return null
  return row
}

// Hängt req.user an falls eine gültige Session vorliegt, blockiert aber nichts
// (für Endpunkte, die anonym UND eingeloggt unterschiedliche Daten liefern, z.B. Kiosk-Widgets)
function optionalAuth(req, res, next) {
  req.user = getSessionUser(req)
  next()
}

function requireAuth(req, res, next) {
  const user = getSessionUser(req)
  if (!user) return res.status(401).json({ error: 'Nicht angemeldet' })
  req.user = user
  next()
}

function requireRole(...roles) {
  return (req, res, next) => {
    const user = getSessionUser(req)
    if (!user) return res.status(401).json({ error: 'Nicht angemeldet' })
    if (!roles.includes(user.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
    req.user = user
    next()
  }
}

module.exports = { requireAuth, requireRole, optionalAuth, getSessionUser }
