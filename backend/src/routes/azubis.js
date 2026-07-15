const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')
const { requireRole } = require('../middleware/auth')

// Anzahl Tage vor dem Wechseldatum, ab der die Vorschau im Dashboard erscheint
const ROTATION_PREVIEW_DAYS = 30

function calculateLehrjahr(startDateStr) {
  if (!startDateStr) return null
  const start = new Date(startDateStr)
  const now = new Date()
  // Noch nicht gestartet → nicht automatisch ändern
  if (start > now) return null
  let years = now.getFullYear() - start.getFullYear()
  const monthDiff = now.getMonth() - start.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < start.getDate())) {
    years--
  }
  return Math.max(1, years + 1)
}

function syncLehrjahre(db) {
  const azubis = db.prepare(
    "SELECT id, start_date, lehrjahr FROM users WHERE role = 'azubi' AND active = 1 AND start_date IS NOT NULL"
  ).all()
  const update = db.prepare('UPDATE users SET lehrjahr = ? WHERE id = ?')
  const run = db.transaction(() => {
    for (const a of azubis) {
      const expected = calculateLehrjahr(a.start_date)
      if (expected !== null && expected !== a.lehrjahr) {
        update.run(expected, a.id)
        console.log(`Lehrjahr aktualisiert: Azubi ${a.id} → ${a.lehrjahr} → ${expected}`)
      }
    }
  })
  run()
}

// Geplante Abteilungswechsel ausführen, deren Stichtag erreicht ist
function syncNextRotation(db) {
  const today = new Date().toISOString().slice(0, 10)
  const pending = db.prepare(
    "SELECT id, next_department_id, next_rotation_date FROM users WHERE role = 'azubi' AND active = 1 AND next_rotation_date IS NOT NULL AND next_rotation_date <= ?"
  ).all(today)
  if (pending.length === 0) return
  const update = db.prepare(
    'UPDATE users SET current_department_id = ?, next_department_id = NULL, next_rotation_date = NULL WHERE id = ?'
  )
  const insertRotation = db.prepare(
    'INSERT INTO rotations (azubi_id, department_id, start_date) VALUES (?, ?, ?)'
  )
  const run = db.transaction(() => {
    for (const a of pending) {
      update.run(a.next_department_id || null, a.id)
      if (a.next_department_id) insertRotation.run(a.id, a.next_department_id, a.next_rotation_date)
      console.log(`Abteilungswechsel automatisch ausgeführt: Azubi ${a.id} → Abteilung ${a.next_department_id}`)
    }
  })
  run()
}

// Get all azubis with department info -- Azubi-Erstellung/-Bearbeitung/-Löschung läuft
// über /api/users (role='azubi'), diese Datei bündelt nur noch die Azubi-spezifischen
// Listen-/Auswertungs-Endpunkte, die von Kiosk-Widgets und Admin-Pickern genutzt werden.
router.get('/', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    syncLehrjahre(db)
    syncNextRotation(db)
    const azubis = db.prepare(`
      SELECT a.*, d.name as department_name, d.color as department_color, d.location as department_location,
             nd.name as next_department_name, nd.color as next_department_color
      FROM users a
      LEFT JOIN departments d ON a.current_department_id = d.id
      LEFT JOIN departments nd ON a.next_department_id = nd.id
      WHERE a.role = 'azubi' AND a.active = 1
      ORDER BY a.lehrjahr ASC, a.name ASC
    `).all()
    res.json(azubis)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get department overview: grouped by department
router.get('/by-department', (req, res) => {
  try {
    const db = getDb()
    syncLehrjahre(db)
    syncNextRotation(db)

    // Nur Datum vergleichen — vermeidet UTC vs. lokale Zeitzone Probleme
    const today = new Date().toISOString().slice(0, 10)

    // Active events that have azubis assigned (Datumsvergleich, nicht Uhrzeit)
    const activeEvents = db.prepare(`
      SELECT ce.id, ce.title, ce.color, ce.start_datetime, ce.end_datetime
      FROM calendar_events ce
      WHERE DATE(ce.start_datetime) <= ? AND DATE(ce.end_datetime) >= ?
        AND EXISTS (SELECT 1 FROM event_azubis ea WHERE ea.event_id = ce.id)
      ORDER BY ce.start_datetime ASC
    `).all(today, today)

    // ── Aktive Termine (höchste Priorität) ────────────────────────────────────
    // Erst alle Events mit Azubis aufbauen, DANN busyAzubiIds sammeln
    // so dass Azubis in mehreren gleichzeitigen Terminen in allen angezeigt werden
    const activeEventsWithAzubis = activeEvents.map(event => {
      const azubis = db.prepare(`
        SELECT a.id, a.name, a.lehrjahr
        FROM event_azubis ea
        JOIN users a ON ea.azubi_id = a.id
        WHERE ea.event_id = ? AND a.active = 1
        ORDER BY a.name ASC
      `).all(event.id)
      return { ...event, azubis }
    })
    const busyAzubiIds = new Set()
    activeEventsWithAzubis.forEach(e => e.azubis.forEach(a => busyAzubiIds.add(a.id)))

    // ── Aktive Schulblöcke (mittlere Priorität) ───────────────────────────────
    const schoolBusyIds = new Set()
    const activeSchoolBlocks = db.prepare(`
      SELECT sb.id, sb.start_date, sb.end_date, sb.notes,
             vs.id as school_id, vs.name as school_name, vs.color, vs.location
      FROM school_blocks sb
      JOIN vocational_schools vs ON sb.school_id = vs.id
      WHERE sb.start_date <= ? AND sb.end_date >= ?
        AND EXISTS (SELECT 1 FROM school_block_azubis sba WHERE sba.block_id = sb.id)
      ORDER BY vs.name ASC
    `).all(today, today)

    const activeSchoolBlocksWithAzubis = activeSchoolBlocks.map(block => {
      const excluded = busyAzubiIds.size > 0 ? `AND a.id NOT IN (${[...busyAzubiIds].join(',')})` : ''
      const azubis = db.prepare(`
        SELECT a.id, a.name, a.lehrjahr FROM school_block_azubis sba
        JOIN users a ON sba.azubi_id = a.id
        WHERE sba.block_id = ? AND a.active = 1 ${excluded}
        ORDER BY a.lehrjahr, a.name ASC
      `).all(block.id)
      azubis.forEach(a => schoolBusyIds.add(a.id))
      return { ...block, azubis }
    }).filter(b => b.azubis.length > 0)

    // ── Anstehende Abteilungswechsel (Vorschau-Fenster) ───────────────────────
    // Azubis mit Wechsel in den nächsten ROTATION_PREVIEW_DAYS Tagen werden aus der
    // normalen Abteilungsübersicht herausgenommen und stattdessen unter ihrer
    // künftigen Abteilung gruppiert nach Wechseldatum ausgegeben.
    const previewLimit = new Date()
    previewLimit.setDate(previewLimit.getDate() + ROTATION_PREVIEW_DAYS)
    const previewLimitStr = previewLimit.toISOString().slice(0, 10)

    const previewRows = db.prepare(`
      SELECT a.id, a.name, a.lehrjahr, a.next_rotation_date,
             nd.id as next_department_id, nd.name as next_department_name, nd.color as next_department_color
      FROM users a
      JOIN departments nd ON a.next_department_id = nd.id
      WHERE a.role = 'azubi' AND a.active = 1 AND a.next_rotation_date IS NOT NULL AND a.next_rotation_date <= ?
      ORDER BY a.next_rotation_date ASC, nd.name ASC, a.name ASC
    `).all(previewLimitStr)

    const previewIds = new Set(previewRows.map(r => r.id))

    const rotationGroups = {}
    for (const row of previewRows) {
      if (!rotationGroups[row.next_rotation_date]) rotationGroups[row.next_rotation_date] = {}
      const deptGroup = rotationGroups[row.next_rotation_date]
      if (!deptGroup[row.next_department_id]) {
        deptGroup[row.next_department_id] = { id: row.next_department_id, name: row.next_department_name, color: row.next_department_color, azubis: [] }
      }
      deptGroup[row.next_department_id].azubis.push({ id: row.id, name: row.name, lehrjahr: row.lehrjahr })
    }
    const upcomingRotations = Object.keys(rotationGroups).sort().map(date => ({
      date,
      departments: Object.values(rotationGroups[date]),
    }))

    // Alle beschäftigten Azubis (Termin + Schule + anstehender Wechsel)
    const allBusyIds = new Set([...busyAzubiIds, ...schoolBusyIds])
    const excludeIds = new Set([...allBusyIds, ...previewIds])

    const busyJoin = excludeIds.size > 0
      ? `AND a.id NOT IN (${[...excludeIds].join(',')})`
      : ''
    const busyWhere = excludeIds.size > 0
      ? `AND a.id NOT IN (${[...excludeIds].join(',')})`
      : ''

    const departments = db.prepare(`
      SELECT d.id, d.name, d.color, d.location,
        json_group_array(json_object('id', a.id, 'name', a.name, 'lehrjahr', a.lehrjahr)) as azubis
      FROM departments d
      LEFT JOIN users a ON a.current_department_id = d.id AND a.role = 'azubi' AND a.active = 1 ${busyJoin}
      GROUP BY d.id
      ORDER BY d.name ASC
    `).all()

    const unassigned = db.prepare(`
      SELECT a.id, a.name, a.lehrjahr FROM users a
      WHERE a.role = 'azubi' AND a.current_department_id IS NULL AND a.active = 1 ${busyWhere}
      ORDER BY a.name ASC
    `).all()

    res.json({
      departments: departments.map(d => ({
        ...d,
        azubis: JSON.parse(d.azubis).filter(a => a.id !== null)
      })),
      unassigned,
      active_events: activeEventsWithAzubis,
      active_schools: activeSchoolBlocksWithAzubis,
      upcoming_rotations: upcomingRotations,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Kommende Geburtstage (nächste 30 Tage)
router.get('/birthdays', (req, res) => {
  try {
    const db = getDb()
    const azubis = db.prepare(
      "SELECT id, name, birthday, lehrjahr FROM users WHERE role = 'azubi' AND active = 1 AND birthday IS NOT NULL AND birthday != ''"
    ).all()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const results = []

    for (const a of azubis) {
      const bday = new Date(a.birthday)
      // Nächsten Geburtstag im laufenden oder nächsten Jahr berechnen
      let next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate())
      if (next < today) next.setFullYear(today.getFullYear() + 1)

      const daysUntil = Math.round((next - today) / 86400000)
      const age = next.getFullYear() - bday.getFullYear()

      if (daysUntil <= 30) {
        results.push({ id: a.id, name: a.name, lehrjahr: a.lehrjahr, birthday: a.birthday, days_until: daysUntil, age })
      }
    }

    results.sort((a, b) => a.days_until - b.days_until)
    res.json(results)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Nächsten geplanten Abteilungswechsel abrufen
router.get('/next-rotation', (req, res) => {
  try {
    const db = getDb()
    const today = new Date().toISOString().slice(0, 10)

    const nextDate = db.prepare(
      'SELECT start_date FROM rotations WHERE start_date > ? ORDER BY start_date ASC LIMIT 1'
    ).get(today)

    if (!nextDate) return res.json({ scheduled: false })

    const assignments = db.prepare(`
      SELECT r.start_date, a.id as azubi_id, a.name, a.lehrjahr,
             d.id as dept_id, d.name as dept_name, d.color
      FROM rotations r
      JOIN users a ON r.azubi_id = a.id AND a.active = 1
      JOIN departments d ON r.department_id = d.id
      WHERE r.start_date = ?
      ORDER BY d.name ASC, a.name ASC
    `).all(nextDate.start_date)

    // Nach Abteilung gruppieren
    const grouped = {}
    for (const row of assignments) {
      if (!grouped[row.dept_id]) {
        grouped[row.dept_id] = { id: row.dept_id, name: row.dept_name, color: row.color, azubis: [] }
      }
      grouped[row.dept_id].azubis.push({ id: row.azubi_id, name: row.name, lehrjahr: row.lehrjahr })
    }

    res.json({
      scheduled: true,
      date: nextDate.start_date,
      departments: Object.values(grouped),
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Bulk Abteilungswechsel: mehrere Azubis auf einmal zuweisen
router.post('/rotation', requireRole('ausbilder'), (req, res) => {
  try {
    const db = getDb()
    const { assignments, rotation_date } = req.body
    // assignments: [{ azubi_id, department_id }]
    if (!Array.isArray(assignments)) return res.status(400).json({ error: 'assignments muss ein Array sein' })

    const updateStmt = db.prepare('UPDATE users SET current_department_id=? WHERE id=?')
    const insertRotation = db.prepare(
      'INSERT INTO rotations (azubi_id, department_id, start_date) VALUES (?, ?, ?)'
    )

    const runAll = db.transaction(() => {
      for (const { azubi_id, department_id } of assignments) {
        updateStmt.run(department_id || null, azubi_id)
        if (department_id) {
          insertRotation.run(azubi_id, department_id, rotation_date || new Date().toISOString().split('T')[0])
        }
      }
    })

    runAll()
    res.json({ success: true, count: assignments.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
