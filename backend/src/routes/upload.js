const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { getDb } = require('../db/init')
const { requirePermission } = require('../middleware/auth')

const UPLOADS_DIR = path.join(process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : '/data', 'uploads')

const KEY_MAP = {
  logo: 'logo_url',
  background: 'background_url',
  background2: 'background_url_2',
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
    cb(null, UPLOADS_DIR)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${req.params.type}-${Date.now()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/svg+xml', 'text/xml', 'application/xml', 'application/svg+xml']
    if (file.mimetype.startsWith('image/') || allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Nur Bilddateien erlaubt'))
  },
})

router.post('/:type', requirePermission('settings.manage'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei' })
  const url = `/uploads/${req.file.filename}`
  const key = KEY_MAP[req.params.type] || 'background_url'
  getDb().prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at"
  ).run(key, JSON.stringify(url))
  res.json({ url })
})

router.delete('/:type', requirePermission('settings.manage'), (req, res) => {
  const key = KEY_MAP[req.params.type] || 'background_url'
  getDb().prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at"
  ).run(key, 'null')
  res.json({ success: true })
})

module.exports = { router, UPLOADS_DIR }
