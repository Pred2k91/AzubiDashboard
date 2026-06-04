const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')

let cache = { data: null, ts: 0 }
const TTL = 30 * 60 * 1000

const ICON_MAP = {
  '01': '☀️', '02': '⛅', '03': '☁️', '04': '☁️',
  '09': '🌧️', '10': '🌦️', '11': '⛈️', '13': '❄️', '50': '🌫️',
}

router.get('/', async (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('weather_city','weather_api_key')").all()
    const get = (k) => { try { return JSON.parse(rows.find(r => r.key === k)?.value || 'null') } catch { return null } }
    const city = get('weather_city')
    const apiKey = get('weather_api_key')

    if (!city || !apiKey) return res.json({ available: false })

    if (cache.data && Date.now() - cache.ts < TTL) {
      return res.json({ available: true, cached: true, ...cache.data })
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=de`
    const resp = await fetch(url)

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      return res.json({ available: false, error: err.message || `HTTP ${resp.status}` })
    }

    const d = await resp.json()
    const iconCode = d.weather[0].icon.slice(0, 2)
    const result = {
      temp: Math.round(d.main.temp),
      feels_like: Math.round(d.main.feels_like),
      description: d.weather[0].description,
      emoji: ICON_MAP[iconCode] || '🌡️',
      humidity: d.main.humidity,
      wind: Math.round(d.wind.speed * 3.6),
      city: d.name,
    }

    cache = { data: result, ts: Date.now() }
    res.json({ available: true, ...result })
  } catch (err) {
    res.json({ available: false, error: err.message })
  }
})

module.exports = router
