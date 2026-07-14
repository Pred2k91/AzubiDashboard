const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requireAuth, requireRole } = require('../middleware/auth')

const ABSENCE_TYPES = ['urlaub', 'krank', 'feiertag']

// Reine UTC-Arithmetik: 'YYYY-MM-DD' wird von Date() als UTC-Mitternacht geparst.
// getDay()/setDate() (lokale Zeit) statt getUTCDay()/setUTCDate() zu nutzen würde
// je nach Server-Zeitzone (z.B. Europe/Berlin) den Tag beim Runden verschieben.
function mondayOf(dateStr) {
  const d = new Date(dateStr)
  const day = d.getUTCDay() // 0=So .. 6=Sa
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function getOwnAzubi(req) {
  if (!req.user.azubi_id) return null
  const db = getDb()
  return db.prepare('SELECT * FROM azubis WHERE id = ? AND active = 1').get(req.user.azubi_id)
}

function entryWithDays(db, entry) {
  const days = db.prepare('SELECT * FROM report_entry_days WHERE report_entry_id = ? ORDER BY date ASC').all(entry.id)
  return { ...entry, days }
}

// Leitet last_report_date aus dem tatsächlichen Datenbestand ab, statt es fest zu
// setzen — damit eine nachträglich zurückgenommene Freigabe (approved -> rejected)
// das Datum korrekt auf den nächstjüngeren gültigen Eintrag zurückfallen lässt.
function recomputeLastReportDate(db, azubiId) {
  const row = db.prepare(
    "SELECT MAX(period_end) as maxEnd FROM report_entries WHERE azubi_id = ? AND status IN ('submitted','approved')"
  ).get(azubiId)
  db.prepare('UPDATE azubis SET last_report_date = ? WHERE id = ?').run(row?.maxEnd || null, azubiId)
}

// ── Azubi-Sicht (immer über req.user.azubi_id, nie über Client-Angaben) ──────

router.get('/me/report-entries', requireAuth, (req, res) => {
  try {
    const azubi = getOwnAzubi(req)
    if (!azubi) return res.json({ linked: false, entries: [] })
    const db = getDb()
    const entries = db.prepare(
      'SELECT * FROM report_entries WHERE azubi_id = ? ORDER BY period_start DESC'
    ).all(azubi.id)
    res.json({
      linked: true,
      report_period: azubi.report_period || 'week',
      start_date: azubi.start_date,
      entries: entries.map(e => entryWithDays(db, e)),
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/me/report-entries/:id', requireAuth, (req, res) => {
  try {
    const azubi = getOwnAzubi(req)
    if (!azubi) return res.status(404).json({ error: 'Kein Azubi verknüpft' })
    const db = getDb()
    const entry = db.prepare('SELECT * FROM report_entries WHERE id = ? AND azubi_id = ?').get(req.params.id, azubi.id)
    if (!entry) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(entryWithDays(db, entry))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/me/report-entries', requireAuth, (req, res) => {
  try {
    const azubi = getOwnAzubi(req)
    if (!azubi) return res.status(400).json({ error: 'Kein Azubi verknüpft' })
    const { date } = req.body
    if (!date) return res.status(400).json({ error: 'date ist erforderlich' })
    // Berichte werden oft rückwirkend geschrieben, aber nicht für die Zukunft.
    if (date > new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ error: 'Berichte können nicht für die Zukunft angelegt werden' })
    }

    const db = getDb()
    const periodType = azubi.report_period === 'day' ? 'day' : 'week'
    // Berichte werden immer wochenweise geöffnet/eingereicht -- der Rhythmus
    // (Tages- vs. Wochenbericht) entscheidet nur, WIE die Woche im Editor/Export
    // ausgefüllt bzw. dargestellt wird (pro Tag einzeln vs. ein gemeinsames Feld),
    // nicht WELCHER Zeitraum angelegt wird.
    const periodStart = mondayOf(date)
    const dayCount = 5
    const periodEnd = addDays(periodStart, dayCount - 1)

    const entryId = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO report_entries (azubi_id, period_type, period_start, period_end, lehrjahr, department_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'draft')
      `).run(azubi.id, periodType, periodStart, periodEnd, azubi.lehrjahr, azubi.current_department_id)
      const insertDay = db.prepare('INSERT INTO report_entry_days (report_entry_id, date) VALUES (?, ?)')
      for (let i = 0; i < dayCount; i++) insertDay.run(result.lastInsertRowid, addDays(periodStart, i))
      return result.lastInsertRowid
    })()

    const entry = db.prepare('SELECT * FROM report_entries WHERE id = ?').get(entryId)
    res.status(201).json(entryWithDays(db, entry))
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Für diesen Zeitraum existiert bereits ein Eintrag' })
    res.status(500).json({ error: err.message })
  }
})

router.put('/me/report-entries/:id', requireAuth, (req, res) => {
  try {
    const azubi = getOwnAzubi(req)
    if (!azubi) return res.status(404).json({ error: 'Kein Azubi verknüpft' })
    const db = getDb()
    const entry = db.prepare('SELECT * FROM report_entries WHERE id = ? AND azubi_id = ?').get(req.params.id, azubi.id)
    if (!entry) return res.status(404).json({ error: 'Nicht gefunden' })
    if (!['draft', 'rejected'].includes(entry.status)) {
      return res.status(403).json({ error: 'Eintrag kann nicht mehr bearbeitet werden' })
    }

    const { days, submit } = req.body
    const updateDay = db.prepare(
      'UPDATE report_entry_days SET day_type=?, activities_text=?, hours=? WHERE report_entry_id=? AND date=?'
    )
    db.transaction(() => {
      for (const d of (days || [])) {
        updateDay.run(d.day_type || 'betrieb', d.activities_text || '', d.hours ?? null, entry.id, d.date)
      }
    })()

    if (submit) {
      const freshDays = db.prepare('SELECT * FROM report_entry_days WHERE report_entry_id = ?').all(entry.id)
      // Wochenbericht: EIN gemeinsames Eingabefeld für die ganze Woche (siehe ReportEditor.jsx),
      // dessen Inhalt nur in einem einzelnen Tag ("Träger-Tag") gespeichert wird -- daher
      // Vollständigkeit auf Wochenebene prüfen statt pro Tag. Tagesbericht: unverändert pro Tag.
      const incomplete = entry.period_type === 'week'
        ? (() => {
            const workingDays = freshDays.filter(d => !ABSENCE_TYPES.includes(d.day_type))
            return workingDays.length > 0 && !workingDays.some(d => d.activities_text?.trim() && d.hours != null)
          })()
        : freshDays.some(d => !ABSENCE_TYPES.includes(d.day_type) && (!d.activities_text?.trim() || d.hours == null))
      if (incomplete) {
        return res.status(400).json({ error: 'Bitte die Tätigkeiten eintragen oder alle Tage als Abwesenheit markieren, bevor du einreichst.' })
      }
      db.prepare("UPDATE report_entries SET status='submitted', submitted_at=datetime('now'), updated_at=datetime('now') WHERE id=?").run(entry.id)
      recomputeLastReportDate(db, azubi.id)
    } else {
      db.prepare("UPDATE report_entries SET updated_at=datetime('now') WHERE id=?").run(entry.id)
    }

    const updated = db.prepare('SELECT * FROM report_entries WHERE id = ?').get(entry.id)
    res.json(entryWithDays(db, updated))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Ausbilder-Sicht ───────────────────────────────────────────────────────

router.get('/report-entries', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const { azubi_id, status, from, to } = req.query
    const clauses = []
    const params = []
    if (azubi_id) { clauses.push('re.azubi_id = ?'); params.push(azubi_id) }
    if (status) { clauses.push('re.status = ?'); params.push(status) }
    if (from) { clauses.push('re.period_end >= ?'); params.push(from) }
    if (to) { clauses.push('re.period_start <= ?'); params.push(to) }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const entries = db.prepare(`
      SELECT re.*, a.name as azubi_name
      FROM report_entries re
      JOIN azubis a ON a.id = re.azubi_id
      ${where}
      ORDER BY re.period_start DESC
    `).all(...params)
    res.json(entries.map(e => entryWithDays(db, e)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/report-entries/:id', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const entry = db.prepare(`
      SELECT re.*, a.name as azubi_name
      FROM report_entries re JOIN azubis a ON a.id = re.azubi_id
      WHERE re.id = ?
    `).get(req.params.id)
    if (!entry) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(entryWithDays(db, entry))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/report-entries/:id/review', requireRole('ausbilder'), (req, res) => {
  try {
    const { status, comment } = req.body
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status muss approved oder rejected sein' })
    }
    if (status === 'rejected' && !comment?.trim()) {
      return res.status(400).json({ error: 'Kommentar ist bei Ablehnung erforderlich' })
    }
    const db = getDb()
    const entry = db.prepare('SELECT * FROM report_entries WHERE id = ?').get(req.params.id)
    if (!entry) return res.status(404).json({ error: 'Nicht gefunden' })
    // 'draft' ausgenommen — der Azubi hat den Bericht noch nicht eingereicht.
    // 'submitted'/'approved'/'rejected' dürfen jederzeit korrigiert werden
    // (z.B. eine versehentliche Freigabe nachträglich zurücknehmen).
    if (entry.status === 'draft') {
      return res.status(400).json({ error: 'Nur eingereichte oder bereits geprüfte Berichte können bearbeitet werden' })
    }

    db.prepare(
      "UPDATE report_entries SET status=?, review_comment=?, reviewed_at=datetime('now'), reviewed_by=?, updated_at=datetime('now') WHERE id=?"
    ).run(status, comment || '', req.user.id, entry.id)

    recomputeLastReportDate(db, entry.azubi_id)

    const updated = db.prepare('SELECT * FROM report_entries WHERE id = ?').get(entry.id)
    res.json(entryWithDays(db, updated))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
