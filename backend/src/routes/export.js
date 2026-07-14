const express = require('express')
const router = express.Router()
const ExcelJS = require('exceljs')
const PDFDocument = require('pdfkit')
const { getDb } = require('../db/init')
const { requireRole } = require('../middleware/auth')
const { dayTypeLabel, ABSENCE_TYPES } = require('../utils/reportDayTypes')

const WEEKDAYS_SO_SA = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

function weekdayOf(dateStr) {
  return WEEKDAYS_SO_SA[new Date(dateStr).getUTCDay()]
}

function addDaysStr(dateStr, n) {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function mondayOf(dateStr) {
  const d = new Date(dateStr)
  const day = d.getUTCDay() // 0=So .. 6=Sa
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

// Standard-ISO-8601-Wochennummer (Montag als Wochenstart, Donnerstag entscheidet das Jahr)
function isoWeek(dateStr) {
  const d = new Date(dateStr)
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNr = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const diff = target - firstThursday
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000))
}

function fmtHoursMinutes(totalHours) {
  const h = Math.floor(totalHours || 0)
  const m = Math.round(((totalHours || 0) - h) * 60)
  return `${h}h ${m}m`
}

function getSetting(db, key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  if (!row) return null
  try { return JSON.parse(row.value) } catch { return row.value }
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
// Layout angelehnt an ein gängiges Vorbild (Deckblatt + eine Seite je Bericht +
// Eigenständigkeitserklärung als letzte, eigene Seite).

const PAGE_MARGIN = 50
const CONTENT_WIDTH = 495 // A4 (595.28pt) abzüglich 2x50pt Rand, leicht abgerundet
const COL_TAG_W = 70
const COL_TAET_W = 350
const COL_STD_W = CONTENT_WIDTH - COL_TAG_W - COL_TAET_W

function ensureSpace(doc, needed) {
  const bottom = doc.page.height - doc.page.margins.bottom
  if (doc.y + needed > bottom) doc.addPage()
}

function drawLabeledLine(doc, x, label, value) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151').text(label, x, doc.y, { width: CONTENT_WIDTH })
  doc.font('Helvetica').fontSize(10).fillColor('#111827').text(value || ' ', x, doc.y, { width: CONTENT_WIDTH })
  doc.moveDown(0.6)
}

function drawCoverPage(doc, azubi, trainerName, appTitle) {
  const x = PAGE_MARGIN
  doc.y = 60
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#1f2937').text('AUSBILDUNGSNACHWEIS', x, doc.y, { width: CONTENT_WIDTH })
  doc.font('Helvetica').fontSize(12).fillColor('#4b5563').text('— Berichtsheft —', x, doc.y, { width: CONTENT_WIDTH })
  doc.moveDown(1)
  doc.moveTo(x, doc.y).lineTo(x + CONTENT_WIDTH, doc.y).strokeColor('#cccccc').stroke()
  doc.moveDown(1.2)

  drawLabeledLine(doc, x, 'Vorname', '')
  drawLabeledLine(doc, x, 'Name', azubi.name)
  drawLabeledLine(doc, x, 'Geb. am', azubi.birthday ? fmtDate(azubi.birthday) : '')
  drawLabeledLine(doc, x, 'Straße', '')
  drawLabeledLine(doc, x, 'Postleitzahl', '')
  drawLabeledLine(doc, x, 'Wohnort', '')
  drawLabeledLine(doc, x, 'Personalnummer', '')

  doc.moveDown(0.3)
  doc.moveTo(x, doc.y).lineTo(x + CONTENT_WIDTH, doc.y).strokeColor('#cccccc').stroke()
  doc.moveDown(1)

  drawLabeledLine(doc, x, 'Ausbildungsberuf ggf. mit Fachrichtung', '')
  drawLabeledLine(doc, x, 'Ausbildungsbetrieb', '')
  drawLabeledLine(doc, x, 'Hauptausbildungsort', '')
  drawLabeledLine(doc, x, 'Ausbildende:r', trainerName || '')
  drawLabeledLine(doc, x, 'Beginn der Ausbildung', azubi.start_date ? fmtDate(azubi.start_date) : '')
  drawLabeledLine(doc, x, 'Ende der Ausbildung', '')

  doc.moveDown(0.3)
  doc.moveTo(x, doc.y).lineTo(x + CONTENT_WIDTH, doc.y).strokeColor('#cccccc').stroke()
  doc.moveDown(1)

  const footerY = doc.y
  const today = new Date().toISOString().slice(0, 10)
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151').text('Erstellt am:', x, footerY)
  doc.font('Helvetica').fontSize(9).fillColor('#111827').text(fmtDate(today), x, footerY + 13)
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151').text('im Ausbildungsjahr:', x + 250, footerY)
  doc.font('Helvetica').fontSize(9).fillColor('#111827').text(String(azubi.lehrjahr ?? ''), x + 250, footerY + 13)

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#9ca3af').text(appTitle || 'AzubiDashboard', x, doc.page.height - 90, { width: CONTENT_WIDTH, align: 'center' })
  doc.fillColor('#000000')
}

function buildDayCellLines(dayRow, entryDeptName) {
  if (!dayRow) return { lines: [], hours: null }
  if (ABSENCE_TYPES.includes(dayRow.day_type)) {
    return { lines: [{ bold: true, text: `Anwesenheit: ${dayTypeLabel(dayRow.day_type)}` }], hours: null }
  }
  const lines = [{ bold: true, text: `Ausbildungsort: ${dayTypeLabel(dayRow.day_type)}` }]
  if (entryDeptName) lines.push({ bold: true, text: `Station: ${entryDeptName}` })
  lines.push({ bold: true, text: 'Anwesenheit: Anwesend' })
  for (const line of (dayRow.activities_text || '').split('\n').map(s => s.trim()).filter(Boolean)) {
    lines.push({ bold: false, text: `•  ${line}` })
  }
  return { lines, hours: dayRow.hours }
}

function drawWeekdayRow(doc, x, weekdayLabel, cellData) {
  const taetX = x + COL_TAG_W
  const stdX = x + COL_TAG_W + COL_TAET_W

  let contentHeight = 0
  for (const line of cellData.lines) {
    doc.font(line.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
    contentHeight += doc.heightOfString(line.text, { width: COL_TAET_W - 8 }) + 1
  }
  const rowHeight = Math.max(20, contentHeight + 8)
  ensureSpace(doc, rowHeight + 6)
  const y = doc.y

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827').text(weekdayLabel, x + 4, y + 4, { width: COL_TAG_W - 8 })

  let cy = y + 4
  for (const line of cellData.lines) {
    doc.font(line.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(line.bold ? '#111827' : '#374151')
    doc.text(line.text, taetX + 4, cy, { width: COL_TAET_W - 8 })
    cy = doc.y + 1
  }

  if (cellData.hours != null) {
    doc.font('Helvetica').fontSize(9).fillColor('#111827').text(String(cellData.hours), stdX, y + 4, { width: COL_STD_W - 8, align: 'right' })
  }

  doc.y = y + rowHeight
  doc.moveTo(x, doc.y).lineTo(x + CONTENT_WIDTH, doc.y).strokeColor('#e5e7eb').stroke()
  doc.y += 2
  doc.fillColor('#000000')
}

function drawSignatureBlock(doc, x, leftLabel, leftName, leftDate, rightLabel, rightName, rightDate, leftCaption, rightCaption) {
  ensureSpace(doc, 90)
  const boxTop = doc.y
  doc.rect(x, boxTop, CONTENT_WIDTH, 90).strokeColor('#cccccc').stroke()
  doc.font('Helvetica').fontSize(8).fillColor('#374151')
    .text('Hiermit bestätige ich, dass die Angaben vollständig und richtig sind.', x, boxTop + 8, { width: CONTENT_WIDTH, align: 'center' })

  const colW = CONTENT_WIDTH / 2
  const leftX = x + 16
  const rightX = x + colW + 16
  let ly = boxTop + 28
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111827').text(leftLabel, leftX, ly)
  doc.font('Helvetica-Bold').fontSize(8).text(rightLabel, rightX, ly)
  ly += 12
  doc.font('Helvetica').fontSize(9).fillColor('#111827').text(leftName || '—', leftX, ly)
  doc.font('Helvetica').fontSize(9).text(rightName || '—', rightX, ly)
  ly += 12
  doc.font('Helvetica-Bold').fontSize(8).text('Datum', leftX, ly)
  doc.font('Helvetica-Bold').fontSize(8).text('Datum', rightX, ly)
  ly += 11
  doc.font('Helvetica').fontSize(9).text(leftDate || '—', leftX, ly)
  doc.font('Helvetica').fontSize(9).text(rightDate || '—', rightX, ly)
  ly += 16
  doc.moveTo(leftX, ly).lineTo(leftX + colW - 40, ly).strokeColor('#999999').stroke()
  doc.moveTo(rightX, ly).lineTo(rightX + colW - 40, ly).strokeColor('#999999').stroke()
  ly += 3
  doc.font('Helvetica').fontSize(6.5).fillColor('#6b7280').text(leftCaption, leftX, ly, { width: colW - 40 })
  doc.font('Helvetica').fontSize(6.5).text(rightCaption, rightX, ly, { width: colW - 40 })

  doc.y = boxTop + 94
  doc.fillColor('#000000')
}

// Gemeinsamer Kopf jeder Berichtsseite: Titelbox (Nummer/Name) + Zeitraumzeile (Ausbildungsjahr).
// Setzt doc.y ans Ende des Kopfbereichs.
function drawReportPageHeader(doc, x, azubi, reportNumber, periodText, lehrjahr) {
  doc.y = PAGE_MARGIN
  const headerTop = doc.y
  doc.rect(x, headerTop, CONTENT_WIDTH, 40).strokeColor('#cccccc').stroke()
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#111827').text('Ausbildungsnachweis', x + 10, headerTop + 13)
  doc.font('Helvetica').fontSize(9).fillColor('#374151').text(`Nummer: ${reportNumber}`, x + 260, headerTop + 8)
  doc.font('Helvetica').fontSize(9).text(`Name: ${azubi.name}`, x + 260, headerTop + 22)
  doc.y = headerTop + 40

  const row2Top = doc.y
  doc.rect(x, row2Top, CONTENT_WIDTH, 22).strokeColor('#cccccc').stroke()
  doc.font('Helvetica').fontSize(9).fillColor('#111827').text(periodText, x + 10, row2Top + 6)
  doc.text(`Ausbildungsjahr: ${lehrjahr ?? ''}`, x + 370, row2Top + 6)
  doc.y = row2Top + 22
  doc.fillColor('#000000')
}

function drawRejectedComments(doc, x, comments) {
  for (const c of comments) {
    ensureSpace(doc, 24)
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#b91c1c').text(c, x, doc.y, { width: CONTENT_WIDTH })
    doc.fillColor('#000000')
    doc.moveDown(0.4)
  }
  if (comments.length) doc.moveDown(0.2)
}

// Wochenbericht-Rhythmus: EIN zusammengefasstes Feld für die ganze Woche, keine
// Aufschlüsselung nach einzelnen Tagen (im Gegensatz zum Tagesbericht-Rhythmus,
// wo jeder Tag ein eigener, separat eingereichter Bericht ist).
function drawWeekEntryPage(doc, azubi, entry, reportNumber) {
  const x = PAGE_MARGIN
  const periodText = `Woche vom ${fmtDate(entry.period_start)} bis ${fmtDate(entry.period_end)} (KW ${isoWeek(entry.period_start)})`
  drawReportPageHeader(doc, x, azubi, reportNumber, periodText, entry.lehrjahr ?? azubi.lehrjahr)

  const taetW = CONTENT_WIDTH - COL_STD_W
  const theadTop = doc.y
  doc.rect(x, theadTop, CONTENT_WIDTH, 18).fillColor('#f3f4f6').fill()
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9)
  doc.text('Tätigkeit', x + 4, theadTop + 5, { width: taetW - 8 })
  doc.text('Stunden', x + taetW + 4, theadTop + 5, { width: COL_STD_W - 8, align: 'right' })
  doc.y = theadTop + 18
  doc.fillColor('#000000')

  // Freie Aufzählung ohne Datums-/Tagesbezug -- Abwesenheitstage fließen nicht mit ein.
  const activityLines = []
  for (const d of entry.days) {
    if (ABSENCE_TYPES.includes(d.day_type)) continue
    for (const line of (d.activities_text || '').split('\n').map(s => s.trim()).filter(Boolean)) {
      activityLines.push(line)
    }
  }
  const bulletLines = (activityLines.length ? activityLines : ['—']).map(l => l === '—' ? l : `•  ${l}`)

  let contentHeight = 0
  doc.font('Helvetica').fontSize(8)
  for (const line of bulletLines) contentHeight += doc.heightOfString(line, { width: taetW - 8 }) + 1
  const rowHeight = Math.max(20, contentHeight + 8)
  ensureSpace(doc, rowHeight + 6)
  const y = doc.y
  let cy = y + 4
  for (const line of bulletLines) {
    doc.font('Helvetica').fontSize(8).fillColor('#374151').text(line, x + 4, cy, { width: taetW - 8 })
    cy = doc.y + 1
  }
  doc.y = y + rowHeight
  doc.moveTo(x, doc.y).lineTo(x + CONTENT_WIDTH, doc.y).strokeColor('#e5e7eb').stroke()
  doc.y += 2
  doc.fillColor('#000000')

  const totalHours = entry.days.reduce((s, d) => s + (d.hours || 0), 0)
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(`Gesamt: ${fmtHoursMinutes(totalHours)}`, x, doc.y + 2, { width: CONTENT_WIDTH, align: 'right' })
  doc.moveDown(1)

  drawRejectedComments(doc, x, entry.status === 'rejected' && entry.review_comment ? [`Anmerkung Ausbilder: ${entry.review_comment}`] : [])

  drawSignatureBlock(
    doc, x,
    'Digital erstellt von', azubi.name, entry.submitted_at ? fmtDate(entry.submitted_at) : '',
    'Digital bestätigt von', (entry.status === 'approved' || entry.status === 'rejected') ? entry.reviewed_by_email : '', entry.reviewed_at ? fmtDate(entry.reviewed_at) : '',
    'Datum, Unterschrift der/des Auszubildenden', 'Datum, Unterschrift der/des Ausbildenden'
  )
}

// Tagesbericht-Rhythmus: eine Kalenderwoche wird auf einer Seite dargestellt, aber JEDER
// Tag stammt aus einem eigenen, einzeln eingereichten Tages-Eintrag (bis zu 7 verschiedene
// report_entries-Zeilen je Seite) -- daher weiterhin nach Wochentagen aufgeschlüsselt.
function drawDayGroupPage(doc, azubi, monday, weekEntries, reportNumber) {
  const x = PAGE_MARGIN
  const sunday = addDaysStr(monday, 6)
  const lehrjahr = weekEntries.find(e => e.lehrjahr != null)?.lehrjahr ?? azubi.lehrjahr
  const periodText = `Woche vom ${fmtDate(monday)} bis ${fmtDate(sunday)} (KW ${isoWeek(monday)})`
  drawReportPageHeader(doc, x, azubi, reportNumber, periodText, lehrjahr)

  const theadTop = doc.y
  doc.rect(x, theadTop, CONTENT_WIDTH, 18).fillColor('#f3f4f6').fill()
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9)
  doc.text('Tag', x + 4, theadTop + 5, { width: COL_TAG_W - 8 })
  doc.text('Tätigkeit', x + COL_TAG_W + 4, theadTop + 5, { width: COL_TAET_W - 8 })
  doc.text('Stunden', x + COL_TAG_W + COL_TAET_W + 4, theadTop + 5, { width: COL_STD_W - 8, align: 'right' })
  doc.y = theadTop + 18

  const kwTop = doc.y
  doc.rect(x, kwTop, CONTENT_WIDTH, 16).fillColor('#f9fafb').fill()
  doc.fillColor('#374151').font('Helvetica').fontSize(8).text(
    `KW ${isoWeek(monday)}  ${fmtDate(monday)}-${fmtDate(sunday)}`,
    x, kwTop + 4, { width: CONTENT_WIDTH, align: 'center' }
  )
  doc.y = kwTop + 16
  doc.fillColor('#000000')

  const byDate = new Map(weekEntries.map(e => [e.period_start, e]))
  for (let i = 0; i < 7; i++) {
    const date = addDaysStr(monday, i)
    const dayEntry = byDate.get(date)
    drawWeekdayRow(doc, x, weekdayOf(date), buildDayCellLines(dayEntry?.days[0], dayEntry?.department_name))
  }

  const totalHours = weekEntries.reduce((s, e) => s + e.days.reduce((s2, d) => s2 + (d.hours || 0), 0), 0)
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(`Gesamt: ${fmtHoursMinutes(totalHours)}`, x, doc.y + 2, { width: CONTENT_WIDTH, align: 'right' })
  doc.moveDown(1)

  drawRejectedComments(
    doc, x,
    weekEntries.filter(e => e.status === 'rejected' && e.review_comment)
      .map(e => `Anmerkung Ausbilder (${weekdayOf(e.period_start)}): ${e.review_comment}`)
  )

  const lastSubmitted = weekEntries.map(e => e.submitted_at).filter(Boolean).sort().pop()
  const reviewedEntries = weekEntries.filter(e => e.reviewed_at)
  const lastReviewed = reviewedEntries.sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at)).pop()

  drawSignatureBlock(
    doc, x,
    'Digital erstellt von', azubi.name, lastSubmitted ? fmtDate(lastSubmitted) : '',
    'Digital bestätigt von', lastReviewed ? lastReviewed.reviewed_by_email : '', lastReviewed ? fmtDate(lastReviewed.reviewed_at) : '',
    'Datum, Unterschrift der/des Auszubildenden', 'Datum, Unterschrift der/des Ausbildenden'
  )
}

function drawDeclarationPage(doc, azubi) {
  const x = PAGE_MARGIN
  doc.y = 90
  doc.font('Helvetica').fontSize(20).fillColor('#374151').text('Eigenständigkeitserklärung', x, doc.y, { width: CONTENT_WIDTH, align: 'center' })
  doc.moveDown(2.5)

  doc.font('Helvetica').fontSize(10).fillColor('#111827').text(
    `Hiermit bestätigen wir, dass der/die Auszubildende ${azubi.name} die gemäß § 43 Berufsbildungsgesetz erforderlichen Ausbildungsnachweise eigenhändig, ohne fremde Hilfe und vollständig erstellt hat.`,
    x, doc.y, { width: CONTENT_WIDTH }
  )
  doc.moveDown(1.2)
  doc.text('Diese Erklärung dient der Vorlage beim zuständigen Prüfungsausschuss.', x, doc.y, { width: CONTENT_WIDTH })
  doc.moveDown(2.5)
  doc.moveTo(x, doc.y).lineTo(x + CONTENT_WIDTH, doc.y).strokeColor('#cccccc').stroke()
  doc.moveDown(3)

  const slots = ['Datum', 'Unterschrift Auszubildende:r', 'Datum', 'Unterschrift Ausbilder:in']
  const slotWidth = CONTENT_WIDTH / 4
  const lineY = doc.y
  slots.forEach((label, i) => {
    const sx = x + i * slotWidth
    doc.moveTo(sx + 5, lineY).lineTo(sx + slotWidth - 15, lineY).strokeColor('#999999').stroke()
    doc.font('Helvetica').fontSize(6.5).fillColor('#6b7280').text(label, sx + 5, lineY + 3, { width: slotWidth - 20, align: 'center' })
  })
  doc.y = lineY + 30

  doc.moveDown(3)
  doc.font('Helvetica-Oblique').fontSize(7).fillColor('#888888').text(
    'Hinweis: Layout und Wortlaut dieser Erklärung wurden anhand öffentlich zugänglicher IHK-/HWK-/BIBB-Informationen erstellt und ' +
    'stellen keine Rechtsberatung dar. Vor dem Einsatz zur Prüfungsanmeldung bitte mit der zuständigen Kammer abgleichen.',
    x, doc.y, { width: CONTENT_WIDTH }
  )
  doc.fillColor('#000000')
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

    // Tagesbericht-Rhythmus: jeder Tag ist ein eigener Eintrag -- für die Seitenansicht
    // (eine Kalenderwoche je Seite) nach Wochenmontag gruppieren. Wochenbericht-Rhythmus:
    // jeder Eintrag ist bereits eine ganze Woche und wird 1:1 zu einer Seite.
    const weekEntries = entries.filter(e => e.period_type === 'week')
    const dayEntries = entries.filter(e => e.period_type === 'day')
    const dayGroupsMap = new Map()
    for (const e of dayEntries) {
      const monday = mondayOf(e.period_start)
      if (!dayGroupsMap.has(monday)) dayGroupsMap.set(monday, [])
      dayGroupsMap.get(monday).push(e)
    }

    const pages = [
      ...weekEntries.map(e => ({ kind: 'week', key: e.period_start, entry: e })),
      ...[...dayGroupsMap.entries()].map(([monday, ents]) => ({ kind: 'dayGroup', key: monday, monday, entries: ents })),
    ].sort((a, b) => a.key.localeCompare(b.key))

    // Fortlaufende Berichtsnummer über die GESAMTE Historie des Azubis, nicht nur den
    // exportierten Zeitraum -- entspricht "die wievielte Seite/Woche seit Ausbildungsbeginn".
    // Zählt Wochenbericht-Einträge und Tagesbericht-Kalenderwochen gemeinsam chronologisch.
    const allEntries = db.prepare(
      'SELECT id, period_type, period_start FROM report_entries WHERE azubi_id = ?'
    ).all(azubiId)
    const allKeys = []
    const numberForWeekEntryId = new Map()
    const numberForDayGroupMonday = new Map()
    const seenDayMondays = new Set()
    for (const e of allEntries) {
      if (e.period_type === 'week') {
        allKeys.push({ key: e.period_start, kind: 'week', id: e.id })
      } else {
        const monday = mondayOf(e.period_start)
        if (!seenDayMondays.has(monday)) {
          seenDayMondays.add(monday)
          allKeys.push({ key: monday, kind: 'dayGroup', monday })
        }
      }
    }
    allKeys.sort((a, b) => a.key.localeCompare(b.key))
    allKeys.forEach((p, idx) => {
      if (p.kind === 'week') numberForWeekEntryId.set(p.id, idx + 1)
      else numberForDayGroupMonday.set(p.monday, idx + 1)
    })

    const trainerName = getSetting(db, 'trainer_name')
    const appTitle = getSetting(db, 'dashboard_title')

    const safeName = azubi.name
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
      .replace(/[^a-zA-Z0-9]+/g, '_')
    const rangeStart = entries.map(e => e.period_start).sort()[0]
    const rangeEnd = entries.map(e => e.period_end).sort().pop()
    const filename = `Ausbildungsnachweis_${safeName}_${rangeStart}_${rangeEnd}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN })
    doc.pipe(res)

    drawCoverPage(doc, azubi, trainerName, appTitle)

    for (const page of pages) {
      doc.addPage()
      if (page.kind === 'week') {
        drawWeekEntryPage(doc, azubi, page.entry, numberForWeekEntryId.get(page.entry.id))
      } else {
        drawDayGroupPage(doc, azubi, page.monday, page.entries, numberForDayGroupMonday.get(page.monday))
      }
    }

    // Eigenständigkeitserklärung IMMER auf einer eigenen, letzten Seite -- unabhängig
    // davon, wie viel Platz auf der letzten Berichtsseite noch frei war.
    doc.addPage()
    drawDeclarationPage(doc, azubi)

    doc.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
