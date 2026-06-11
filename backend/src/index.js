const express = require('express')
const cors = require('cors')
const path = require('path')
const { initDb } = require('./db/init')

const calendarRoutes = require('./routes/calendar')
const todosRoutes = require('./routes/todos')
const notesRoutes = require('./routes/notes')
const azubisRoutes = require('./routes/azubis')
const departmentsRoutes = require('./routes/departments')
const settingsRoutes = require('./routes/settings')
const { router: uploadRoutes, UPLOADS_DIR } = require('./routes/upload')
const schoolsRoutes = require('./routes/schools')
const announcementsRoutes = require('./routes/announcements')
const weatherRoutes = require('./routes/weather')
const reportsRoutes = require('./routes/reports')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(UPLOADS_DIR))

initDb()

app.use('/api/calendar', calendarRoutes)
app.use('/api/todos', todosRoutes)
app.use('/api/notes', notesRoutes)
app.use('/api/azubis', azubisRoutes)
app.use('/api/departments', departmentsRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/schools', schoolsRoutes)
app.use('/api/announcements', announcementsRoutes)
app.use('/api/weather', weatherRoutes)
app.use('/api/reports', reportsRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/time', (req, res) => {
  res.json({ utc: Date.now() })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard Backend running on port ${PORT}`)
})
