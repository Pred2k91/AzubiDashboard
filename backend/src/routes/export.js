const express = require('express')
const router = express.Router()
const ExcelJS = require('exceljs')
const PDFDocument = require('pdfkit')
const { getDb } = require('../db/init')
const { requireRole } = require('../middleware/auth')
const { dayTypeLabel } = require('../utils/reportDayTypes')

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

function weekdayOf(dateStr) {
  return WEEKDAYS[new Date(dateStr).getUTCDay()]
}

function periodLabel(entry) {
  return entry.period_type === 'day'
    ? fmtDate(entry.period_start)
    : `${fmtDate(entry.period_start)} – ${fmtDate(entry.period_end)}`
}

// ── Excel: Sammel-Export über mehrere Azubis/Zeiträume (Übersicht/Audit) ────

router.get('/reports.xlsx', requireRole('ausbilder'), async (req, res) => {
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

    const rows = db.prepare(`
      SELECT
        a.name as azubi_name,
        re.id as entry_id, re.period_type, re.lehrjahr, re.status,
        re.submitted_at, re.reviewed_at, re.review_comment,
        d.name as department_name,
        ru.email as reviewed_by_email,
        red.date, red.day_type, red.activities_text, red.hours
      FROM report_entries re
      JOIN azubis a ON a.id = re.azubi_id
      LEFT JOIN departments d ON d.id = re.department_id
      LEFT JOIN users ru ON ru.id = re.reviewed_by
      JOIN report_entry_days red ON red.report_entry_id = re.id
      ${where}
      ORDER BY a.name ASC, red.date ASC
    `).all(...params)

    const statusLabel = { draft: 'In Erstellung', submitted: 'Eingereicht', approved: 'Freigegeben', rejected: 'Abgelehnt' }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'AzubiDashboard'
    workbook.created = new Date()
    const sheet = workbook.addWorksheet('Berichtshefte')

    sheet.columns = [
      { header: 'Azubi', key: 'azubi', width: 24 },
      { header: 'Ausbildungsjahr', key: 'lehrjahr', width: 14 },
      { header: 'Abteilung', key: 'department', width: 20 },
      { header: 'Datum', key: 'date', width: 12 },
      { header: 'Wochentag', key: 'weekday', width: 12 },
      { header: 'Art', key: 'daytype', width: 14 },
      { header: 'Tätigkeiten / Berufsschulthema', key: 'text', width: 45 },
      { header: 'Stunden', key: 'hours', width: 10 },
      { header: 'Berichts-Status', key: 'status', width: 14 },
      { header: 'Eingereicht am', key: 'submitted', width: 14 },
      { header: 'Geprüft am', key: 'reviewed', width: 14 },
      { header: 'Geprüft von', key: 'reviewer', width: 22 },
      { header: 'Kommentar', key: 'comment', width: 30 },
    ]
    sheet.getRow(1).font = { bold: true }
    sheet.autoFilter = { from: 'A1', to: 'M1' }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]

    for (const r of rows) {
      sheet.addRow({
        azubi: r.azubi_name,
        lehrjahr: r.lehrjahr,
        department: r.department_name || '',
        date: fmtDate(r.date),
        weekday: weekdayOf(r.date),
        daytype: dayTypeLabel(r.day_type),
        text: r.activities_text || '',
        hours: r.hours != null ? r.hours : '',
        status: statusLabel[r.status] || r.status,
        submitted: r.submitted_at ? fmtDate(r.submitted_at) : '',
        reviewed: r.reviewed_at ? fmtDate(r.reviewed_at) : '',
        reviewer: r.reviewed_by_email || '',
        comment: r.review_comment || '',
      })
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="berichtshefte_export.xlsx"')
    await workbook.xlsx.write(res)
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PDF: klassischer, unterschreibbarer Ausbildungsnachweis je Azubi/Zeitraum ──

const TABLE_COLS = [
  { key: 'date', label: 'Datum', width: 60 },
  { key: 'weekday', label: 'Tag', width: 60 },
  { key: 'daytype', label: 'Art', width: 70 },
  { key: 'text', label: 'Tätigkeiten / Berufsschulthema', width: 235 },
  { key: 'hours', label: 'Std.', width: 40 },
]
const TABLE_WIDTH = TABLE_COLS.reduce((s, c) => s + c.width, 0)

function ensureSpace(doc, needed) {
  const bottom = doc.page.height - doc.page.margins.bottom
  if (doc.y + needed > bottom) doc.addPage()
}

function drawTableHeader(doc, x) {
  doc.font('Helvetica-Bold').fontSize(8)
  const y = doc.y
  let cx = x
  for (const col of TABLE_COLS) {
    doc.text(col.label, cx + 2, y, { width: col.width - 4 })
    cx += col.width
  }
  doc.y = y + 14
  doc.moveTo(x, doc.y).lineTo(x + TABLE_WIDTH, doc.y).strokeColor('#999999').stroke()
  doc.y += 3
  doc.font('Helvetica').fontSize(8)
}

function drawTableRow(doc, x, cells) {
  const rowHeight = Math.max(14, doc.heightOfString(cells.text || '', { width: TABLE_COLS[3].width - 4 }) + 4)
  ensureSpace(doc, rowHeight + 6)
  const y = doc.y
  let cx = x
  for (const col of TABLE_COLS) {
    doc.text(String(cells[col.key] ?? ''), cx + 2, y, { width: col.width - 4 })
    cx += col.width
  }
  doc.y = y + rowHeight
  doc.moveTo(x, doc.y).lineTo(x + TABLE_WIDTH, doc.y).strokeColor('#e2e2e2').stroke()
  doc.y += 4
}

router.get('/reports/:azubi_id/pdf', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const azubiId = req.params.azubi_id
    const { from, to } = req.query

    const azubi = db.prepare(`
      SELECT a.*, d.name as department_name
      FROM azubis a
      LEFT JOIN departments d ON d.id = a.current_department_id
      WHERE a.id = ?
    `).get(azubiId)
    if (!azubi) return res.status(404).json({ error: 'Azubi nicht gefunden' })

    const clauses = ['re.azubi_id = ?']
    const params = [azubiId]
    if (from) { clauses.push('re.period_end >= ?'); params.push(from) }
    if (to) { clauses.push('re.period_start <= ?'); params.push(to) }

    const entries = db.prepare(`
      SELECT re.*, d.name as department_name, ru.email as reviewed_by_email
      FROM report_entries re
      LEFT JOIN departments d ON d.id = re.department_id
      LEFT JOIN users ru ON ru.id = re.reviewed_by
      WHERE ${clauses.join(' AND ')}
      ORDER BY re.period_start ASC
    `).all(...params)

    if (entries.length === 0) {
      return res.status(400).json({ error: 'Keine Berichte im gewählten Zeitraum gefunden' })
    }

    const dayStmt = db.prepare('SELECT * FROM report_entry_days WHERE report_entry_id = ? ORDER BY date ASC')
    for (const e of entries) e.days = dayStmt.all(e.id)

    const safeName = azubi.name
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
      .replace(/[^a-zA-Z0-9]+/g, '_')
    const filename = `Ausbildungsnachweis_${safeName}_${entries[0].period_start}_${entries[entries.length - 1].period_end}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    doc.pipe(res)

    doc.fontSize(16).font('Helvetica-Bold').text('Ausbildungsnachweis', { align: 'center' })
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica').fillColor('#333333').text(
      `${azubi.name}${azubi.lehrjahr != null ? ` — ${azubi.lehrjahr}. Ausbildungsjahr` : ''}${azubi.department_name ? ` — ${azubi.department_name}` : ''}`,
      { align: 'center' }
    )
    doc.text(`Zeitraum: ${fmtDate(entries[0].period_start)} – ${fmtDate(entries[entries.length - 1].period_end)}`, { align: 'center' })
    doc.moveDown(1)
    doc.fillColor('#000000')

    const startX = doc.page.margins.left

    for (const entry of entries) {
      ensureSpace(doc, 60)
      doc.font('Helvetica-Bold').fontSize(10).text(
        `${entry.period_type === 'day' ? 'Tagesbericht' : 'Wochenbericht'} — ${periodLabel(entry)}${entry.lehrjahr != null ? ` (${entry.lehrjahr}. AJ)` : ''}${entry.department_name ? ` — ${entry.department_name}` : ''}`
      )
      doc.moveDown(0.3)
      drawTableHeader(doc, startX)
      for (const d of entry.days) {
        drawTableRow(doc, startX, {
          date: fmtDate(d.date),
          weekday: weekdayOf(d.date),
          daytype: dayTypeLabel(d.day_type),
          text: d.activities_text || '',
          hours: d.hours != null ? d.hours : '',
        })
      }
      if (entry.status === 'rejected' && entry.review_comment) {
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#b91c1c')
          .text(`Anmerkung Ausbilder: ${entry.review_comment}`, startX, doc.y)
        doc.fillColor('#000000')
      }
      doc.moveDown(0.8)
    }

    // Erklärungsblock: förmliche Bestätigung für die Prüfungsanmeldung (IHK/HWK)
    const lastSubmitted = entries.map(e => e.submitted_at).filter(Boolean).sort().pop()
    const reviewedEntries = entries.filter(e => e.reviewed_at)
    const lastReviewed = reviewedEntries.sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at)).pop()

    ensureSpace(doc, 120)
    doc.moveDown(0.5)
    doc.moveTo(startX, doc.y).lineTo(startX + TABLE_WIDTH, doc.y).strokeColor('#999999').stroke()
    doc.moveDown(0.8)

    doc.font('Helvetica-Bold').fontSize(10).text('Erklärung')
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(9)
    doc.text(
      `Ich, ${azubi.name}, bestätige, dieses Berichtsheft für den oben genannten Zeitraum eigenständig, regelmäßig und wahrheitsgemäß geführt zu haben.` +
      (lastSubmitted ? ` Zuletzt eingereicht am ${fmtDate(lastSubmitted)}.` : '')
    )
    doc.moveDown(1.2)
    doc.text('Datum, Unterschrift Auszubildende(r): ______________________________')
    doc.moveDown(1)

    doc.text(
      `Ich${lastReviewed?.reviewed_by_email ? ` (${lastReviewed.reviewed_by_email})` : ''} bestätige die regelmäßige Kontrolle der obigen Eintragungen.` +
      (lastReviewed ? ` Zuletzt geprüft am ${fmtDate(lastReviewed.reviewed_at)}.` : '')
    )
    doc.moveDown(1.2)
    doc.text('Datum, Unterschrift Ausbildende(r): ______________________________')

    doc.moveDown(1.5)
    doc.font('Helvetica-Oblique').fontSize(7).fillColor('#888888').text(
      'Hinweis: Layout und Wortlaut dieser Erklärung wurden anhand öffentlich zugänglicher IHK-/HWK-/BIBB-Informationen erstellt und ' +
      'stellen keine Rechtsberatung dar. Vor dem Einsatz zur Prüfungsanmeldung bitte mit der zuständigen Kammer abgleichen.'
    )

    doc.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
