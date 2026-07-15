const { getDb } = require('./db/init')
const { TRIGGER_TYPES, renderTemplate } = require('./workflowCatalog')
const { sendMail } = require('./utils/mailer')
const { sendPushToUsers } = require('./utils/webpush')

function daysSince(dateStr) {
  if (!dateStr) return Infinity
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000)
}

function loadActiveWorkflows(db) {
  const workflows = db.prepare('SELECT * FROM workflows WHERE active = 1').all()
  const getActions = db.prepare('SELECT * FROM workflow_actions WHERE workflow_id = ? ORDER BY position ASC')
  return workflows.map(w => ({
    ...w,
    trigger_config: JSON.parse(w.trigger_config),
    actions: getActions.all(w.id).map(a => ({ ...a, action_config: JSON.parse(a.action_config) })),
  }))
}

async function runAction(action, azubi, vars) {
  if (action.action_type === 'email') {
    const cfg = action.action_config
    const toAzubi = cfg.to_azubi ? azubi.email : null
    const ccList = Array.isArray(cfg.cc) ? cfg.cc.filter(Boolean) : []
    if (!toAzubi && ccList.length === 0) return
    await sendMail({
      to: toAzubi || ccList.join(', '),
      cc: toAzubi ? ccList : [],
      subject: renderTemplate(cfg.subject, vars),
      text: renderTemplate(cfg.body, vars),
    }).catch(err => console.error('[scheduler] E-Mail-Aktion fehlgeschlagen:', err.message))
  } else if (action.action_type === 'push') {
    const cfg = action.action_config
    const db = getDb()
    const userIds = cfg.target === 'ausbilder'
      ? db.prepare("SELECT id FROM users WHERE role='ausbilder' AND active=1").all().map(r => r.id)
      : [azubi.id]
    await sendPushToUsers(userIds, {
      title: renderTemplate(cfg.title, vars),
      body: renderTemplate(cfg.body, vars),
    }).catch(err => console.error('[scheduler] Push-Aktion fehlgeschlagen:', err.message))
  }
}

// Einmal beim Start und danach stündlich aufgerufen (siehe index.js). Wertet alle aktiven
// Workflows gegen den aktuellen Azubi-Bestand aus und feuert Aktionen für neu eingetretene
// Fälle. workflow_runs verhindert Mehrfach-Auslösung für denselben Datenzustand (siehe
// Kommentar an der Tabelle in db/init.js).
async function runWorkflowsTick() {
  const db = getDb()
  const workflows = loadActiveWorkflows(db)
  const insertRun = db.prepare('INSERT OR IGNORE INTO workflow_runs (workflow_id, azubi_id, trigger_key) VALUES (?, ?, ?)')
  const hasRun = db.prepare('SELECT 1 FROM workflow_runs WHERE workflow_id = ? AND azubi_id = ? AND trigger_key = ?')

  for (const workflow of workflows) {
    if (!TRIGGER_TYPES.includes(workflow.trigger_type)) continue

    if (workflow.trigger_type === 'report_overdue') {
      const minDays = Number(workflow.trigger_config.min_days) || 1
      const azubis = db.prepare(
        "SELECT id, name, email, last_report_date FROM users WHERE role = 'azubi' AND active = 1 AND lehrjahr > 0"
      ).all()

      for (const azubi of azubis) {
        const days = daysSince(azubi.last_report_date)
        if (days < minDays) continue
        const triggerKey = azubi.last_report_date || 'never'
        if (hasRun.get(workflow.id, azubi.id, triggerKey)) continue

        const vars = { name: azubi.name, days_overdue: Number.isFinite(days) ? days : 'vielen' }
        for (const action of workflow.actions) {
          await runAction(action, azubi, vars)
        }
        insertRun.run(workflow.id, azubi.id, triggerKey)
      }
    }
  }
}

function startScheduler() {
  runWorkflowsTick().catch(err => console.error('[scheduler] Fehler:', err.message))
  return setInterval(() => {
    runWorkflowsTick().catch(err => console.error('[scheduler] Fehler:', err.message))
  }, 60 * 60 * 1000)
}

module.exports = { runWorkflowsTick, startScheduler }
