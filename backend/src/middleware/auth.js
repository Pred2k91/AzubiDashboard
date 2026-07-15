const { getDb } = require('../db/init')

// Reichert eine Nutzerzeile um die aufgelösten Rechtesystem-Infos an: ob Super Admin
// (umgeht alle Einzelprüfungen), das Set der gewährten Permission-Keys (nur relevant
// für role='ausbilder'), und die zugewiesenen Niederlassungs-IDs (Scope).
function attachPermissions(db, user) {
  user.isSuperAdmin = false
  user.permissions = new Set()
  if (user.role === 'ausbilder' && user.permission_role_id) {
    const role = db.prepare('SELECT is_super_admin FROM permission_roles WHERE id = ?').get(user.permission_role_id)
    if (role?.is_super_admin) {
      user.isSuperAdmin = true
    } else if (role) {
      const perms = db.prepare('SELECT permission_key FROM role_permissions WHERE role_id = ?').all(user.permission_role_id)
      user.permissions = new Set(perms.map(p => p.permission_key))
    }
  }
  const locs = db.prepare('SELECT location_id FROM user_locations WHERE user_id = ?').all(user.id)
  user.locationIds = locs.map(l => l.location_id)
  return user
}

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
  return attachPermissions(db, row)
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

// Verlangt eine konkrete Einzelberechtigung (siehe backend/src/permissions.js).
// Super Admin umgeht die Prüfung immer. Setzt zusätzlich req.user, kann also auch
// direkt statt requireRole('ausbilder') verwendet werden.
function requirePermission(key) {
  return (req, res, next) => {
    const user = getSessionUser(req)
    if (!user) return res.status(401).json({ error: 'Nicht angemeldet' })
    if (user.role !== 'ausbilder') return res.status(403).json({ error: 'Keine Berechtigung' })
    if (!user.isSuperAdmin && !user.permissions.has(key)) {
      return res.status(403).json({ error: 'Keine Berechtigung' })
    }
    req.user = user
    next()
  }
}

// Liefert null (= kein Filter, sieht alles) für Super Admin, sonst die Liste der
// Niederlassungs-IDs des eingeloggten Nutzers (leeres Array = sieht nichts Standortgebundenes).
function scopeLocationIds(req) {
  if (!req.user || req.user.isSuperAdmin) return null
  return req.user.locationIds || []
}

// Baut eine "IN (?,?,...)"-Klausel für eine Liste von IDs -- bei leerem Array eine
// Klausel, die nie matcht (IN (NULL)), damit kein Platzhalter-Mismatch entsteht.
function idsClause(ids) {
  return ids.length ? `(${ids.map(() => '?').join(',')})` : '(NULL)'
}

// Reine Prüf-Funktion (keine Middleware) für Stellen, an denen die benötigte
// Permission erst zur Laufzeit feststeht -- z.B. /api/users, wo je nach Ziel-Rolle
// (azubi vs. ausbilder) unterschiedliche Keys gelten (siehe users.js).
function hasPermission(user, key) {
  if (!user || user.role !== 'ausbilder') return false
  return user.isSuperAdmin || user.permissions.has(key)
}

module.exports = { requireAuth, requireRole, requirePermission, hasPermission, scopeLocationIds, idsClause, optionalAuth, getSessionUser, attachPermissions }
