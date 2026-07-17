const webpush = require('web-push')
const { getDb } = require('../db/init')

function isConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

let configured = false
function ensureConfigured() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
  configured = true
}

// Liest die admin-konfigurierbare Icon-Einstellung (siehe SettingsPage "Push-/App-Icon",
// Upload über POST /api/upload/push_icon) -- wird für ALLE Push-Aufrufe automatisch als
// badge (kleines Icon) mit eingeblendet, Aufrufer müssen sich darum nicht kümmern.
// Bewusst KEIN "icon" (großes Bild in der Benachrichtigung) -- als installierte PWA zeigt
// Android ohnehin schon das App-Icon zur Identifikation an, ein zusätzliches großes Bild
// wirkte doppelt gemoppelt.
function getPushIconUrl(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'push_icon_url'").get()
  if (!row) return null
  try { return JSON.parse(row.value) } catch { return null }
}

// Sendet eine Push-Nachricht an alle gespeicherten Subscriptions der angegebenen User-IDs.
// Abgelaufene/ungültige Subscriptions (HTTP 404/410 vom Push-Dienst) werden dabei
// automatisch aus push_subscriptions entfernt.
async function sendPushToUsers(userIds, payload) {
  if (!userIds.length) return { sent: 0 }
  if (!isConfigured()) {
    console.log('[webpush] VAPID-Keys nicht konfiguriert — Push wurde NICHT versendet.')
    return { sent: 0 }
  }
  ensureConfigured()
  const db = getDb()
  const placeholders = userIds.map(() => '?').join(',')
  const subs = db.prepare(`SELECT * FROM push_subscriptions WHERE user_id IN (${placeholders})`).all(...userIds)
  const iconUrl = getPushIconUrl(db)
  const body = JSON.stringify(iconUrl ? { badge: iconUrl, ...payload } : payload)
  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      )
      sent++
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id)
      } else {
        console.error('[webpush] Fehler beim Senden:', err.message)
      }
    }
  }
  return { sent }
}

module.exports = { sendPushToUsers, isConfigured }
