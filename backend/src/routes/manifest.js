const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')

// Dynamisches Web-App-Manifest (PWA) -- liest Titel/Icon aus den Einstellungen (dasselbe
// Push-Icon aus Einstellungen -> Firmen-Branding), damit "Zum Startbildschirm hinzufügen"
// automatisch den aktuell konfigurierten Namen/Icon verwendet, ohne eine feste Icon-Datei
// im Frontend-Build mitliefern zu müssen. Eingebunden über <link rel="manifest"> in
// index.html -- öffentlich (kein requireAuth), ein Manifest muss auch auf dem
// Login-Bildschirm ladbar sein.
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('dashboard_title', 'push_icon_url')").all()
    const settings = {}
    for (const row of rows) {
      try { settings[row.key] = JSON.parse(row.value) } catch { settings[row.key] = row.value }
    }
    const name = settings.dashboard_title || 'HERcademy'
    const iconUrl = settings.push_icon_url || null

    res.set('Content-Type', 'application/manifest+json')
    res.json({
      name,
      short_name: name,
      start_url: '/',
      display: 'standalone',
      background_color: '#0d0f1a',
      theme_color: '#0d0f1a',
      icons: iconUrl ? [
        { src: iconUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: iconUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
      ] : [],
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
