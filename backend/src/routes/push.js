const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requireAuth } = require('../middleware/auth')

// Öffentlich -- der Public Key ist per Definition nicht geheim, das Frontend braucht ihn
// vor dem Abonnieren einer Push-Subscription.
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null })
})

router.post('/subscribe', requireAuth, (req, res) => {
  try {
    const { endpoint, keys } = req.body
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Ungültige Subscription' })
    }
    const db = getDb()
    db.prepare(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth
    `).run(req.user.id, endpoint, keys.p256dh, keys.auth)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/subscribe', requireAuth, (req, res) => {
  try {
    const { endpoint } = req.body
    const db = getDb()
    if (endpoint) {
      db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(req.user.id, endpoint)
    } else {
      db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(req.user.id)
    }
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
