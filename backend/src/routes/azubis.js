const express = require('express')
const router = express.Router()
const { getDb } = require('../db/init')

function calculateLehrjahr(startDateStr) {
  if (!startDateStr) return null
  const start = new Date(startDateStr)
  const now = new Date()
  let years = now.getFullYear() - start.getFullYear()
  const monthDiff = now.getMonth() - start.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < start.getDate())) {
    years--
  }
  return Math.max(1, years + 1)
}

function syncLehrjahre(db) {
  const azubis = db.prepare(
    'SELECT id, start_date, lehrjahr FROM azubis WHERE active = 1 AND start_date IS NOT NULL'
  ).all()
  const update = db.prepare('UPDATE azubis SET lehrjahr = ? WHERE id = ?')
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

// Get all azubis with department info
router.get('/', (req, res) => {
  try {
    const db = getDb()
    syncLehrjahre(db)
    const azubis = db.prepare(`
      SELECT a.*, d.name as department_name, d.color as department_color, d.location as department_location
      FROM azubis a
      LEFT JOIN departments d ON a.current_department_id = d.id
      WHERE a.active = 1
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

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    // Active events that have azubis assigned
    const activeEvents = db.prepare(`
      SELECT ce.id, ce.title, ce.color, ce.start_datetime, ce.end_datetime
      FROM calendar_events ce
      WHERE ce.start_datetime <= ? AND ce.end_datetime >= ?
        AND EXISTS (SELECT 1 FROM event_azubis ea WHERE ea.event_id = ce.id)
      ORDER BY ce.start_datetime ASC
    `).all(now, now)

    // Collect azubi IDs in active events
    const busyAzubiIds = new Set()
    const activeEventsWithAzubis = activeEvents.map(event => {
      const azubis = db.prepare(`
        SELECT a.id, a.name, a.lehrjahr
        FROM event_azubis ea
        JOIN azubis a ON ea.azubi_id = a.id
        WHERE ea.event_id = ? AND a.active = 1
        ORDER BY a.name ASC
      `).all(event.id)
      azubis.forEach(a => busyAzubiIds.add(a.id))
      return { ...event, azubis }
    })

    const busyList = busyAzubiIds.size > 0
      ? `AND a.id NOT IN (${[...busyAzubiIds].join(',')})`
      : ''

    const departments = db.prepare(`
      SELECT d.id, d.name, d.color, d.location,
        json_group_array(json_object('id', a.id, 'name', a.name, 'lehrjahr', a.lehrjahr)) as azubis
      FROM departments d
      LEFT JOIN azubis a ON a.current_department_id = d.id AND a.active = 1 ${busyList}
      GROUP BY d.id
      ORDER BY d.name ASC
    `).all()

    const unassigned = db.prepare(`
      SELECT id, name, lehrjahr FROM azubis
      WHERE current_department_id IS NULL AND active = 1
      ${busyList}
      ORDER BY name ASC
    `).all()

    res.json({
      departments: departments.map(d => ({
        ...d,
        azubis: JSON.parse(d.azubis).filter(a => a.id !== null)
      })),
      unassigned,
      active_events: activeEventsWithAzubis,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', (req, res) => {
  try {
    const db = getDb()
    const { name, lehrjahr, start_date, current_department_id, email } = req.body
    if (!name) return res.status(400).json({ error: 'name ist erforderlich' })
    const result = db.prepare(
      'INSERT INTO azubis (name, lehrjahr, start_date, current_department_id, email) VALUES (?, ?, ?, ?, ?)'
    ).run(name, lehrjahr || 1, start_date || null, current_department_id || null, email || '')
    const azubi = db.prepare(`
      SELECT a.*, d.name as department_name, d.color as department_color
      FROM azubis a LEFT JOIN departments d ON a.current_department_id = d.id
      WHERE a.id = ?
    `).get(result.lastInsertRowid)
    res.status(201).json(azubi)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const { name, lehrjahr, start_date, current_department_id, email, active } = req.body
    db.prepare(
      'UPDATE azubis SET name=?, lehrjahr=?, start_date=?, current_department_id=?, email=?, active=? WHERE id=?'
    ).run(name, lehrjahr || 1, start_date || null, current_department_id || null, email || '', active !== undefined ? active : 1, req.params.id)
    const azubi = db.prepare(`
      SELECT a.*, d.name as department_name, d.color as department_color
      FROM azubis a LEFT JOIN departments d ON a.current_department_id = d.id
      WHERE a.id = ?
    `).get(req.params.id)
    if (!azubi) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(azubi)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Bulk rotation: assign multiple azubis to departments at once
router.post('/rotation', (req, res) => {
  try {
    const db = getDb()
    const { assignments, rotation_date } = req.body
    // assignments: [{ azubi_id, department_id }]
    if (!Array.isArray(assignments)) return res.status(400).json({ error: 'assignments muss ein Array sein' })

    const updateStmt = db.prepare('UPDATE azubis SET current_department_id=? WHERE id=?')
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

router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    db.prepare('UPDATE azubis SET active = 0 WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
