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
  const body = JSON.stringify(payload)
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
