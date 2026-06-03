const express = require('express')
const cors = require('cors')
const { initDb } = require('./db/init')

const calendarRoutes = require('./routes/calendar')
const todosRoutes = require('./routes/todos')
const notesRoutes = require('./routes/notes')
const azubisRoutes = require('./routes/azubis')
const departmentsRoutes = require('./routes/departments')
const settingsRoutes = require('./routes/settings')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

initDb()

app.use('/api/calendar', calendarRoutes)
app.use('/api/todos', todosRoutes)
app.use('/api/notes', notesRoutes)
app.use('/api/azubis', azubisRoutes)
app.use('/api/departments', departmentsRoutes)
app.use('/api/settings', settingsRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard Backend running on port ${PORT}`)
})
