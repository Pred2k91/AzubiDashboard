// Fester Auslöser-/Aktions-Katalog für das Workflow-System -- nicht admin-editierbar,
// nur welche Trigger/Aktionen ein konkreter Workflow nutzt und wie sie konfiguriert sind.
// Jeder Eintrag beschreibt sein Config-Schema über `fields`, damit das Frontend-Formular
// generisch daraus gerendert werden kann (WorkflowsAdmin.jsx) -- neue Trigger/Aktionen
// später einfach hier ergänzen, ohne das Formular anzufassen.

const TRIGGERS = [
  {
    type: 'report_overdue',
    label: 'Berichtsheft überfällig',
    description: 'Feuert pro aktivem Azubi, dessen letzter eingereichter Bericht mindestens so viele Tage zurückliegt (oder der noch nie einen eingereicht hat).',
    fields: [
      { key: 'min_days', label: 'Tage seit letztem Bericht (mindestens)', type: 'number', default: 7, min: 1 },
    ],
  },
]

const ACTIONS = [
  {
    type: 'email',
    label: 'E-Mail versenden',
    fields: [
      { key: 'to_azubi', label: 'An den betroffenen Azubi senden', type: 'checkbox', default: true },
      { key: 'cc', label: 'CC (weitere E-Mail-Adressen, eine pro Zeile)', type: 'email_list', default: [] },
      { key: 'subject', label: 'Betreff', type: 'text', default: 'Erinnerung: Berichtsheft überfällig' },
      {
        key: 'body', label: 'Text (Platzhalter: {{name}}, {{days_overdue}})', type: 'textarea',
        default: 'Hallo {{name}},\n\ndein Berichtsheft ist seit {{days_overdue}} Tagen überfällig. Bitte trage deine Einträge zeitnah nach.',
      },
    ],
  },
  {
    type: 'push',
    label: 'Push-Benachrichtigung senden',
    fields: [
      {
        key: 'target', label: 'Empfänger', type: 'select', default: 'azubi',
        options: [
          { value: 'azubi', label: 'Betroffener Azubi' },
          { value: 'ausbilder', label: 'Alle Ausbilder mit aktivierten Push-Benachrichtigungen' },
        ],
      },
      { key: 'title', label: 'Titel', type: 'text', default: 'Berichtsheft überfällig' },
      {
        key: 'body', label: 'Text (Platzhalter: {{name}}, {{days_overdue}})', type: 'textarea',
        default: '{{name}} hat das Berichtsheft seit {{days_overdue}} Tagen nicht eingereicht.',
      },
    ],
  },
]

const TRIGGER_TYPES = TRIGGERS.map(t => t.type)
const ACTION_TYPES = ACTIONS.map(a => a.type)

// Ersetzt {{key}}-Platzhalter in Betreff/Text vor dem Versand.
function renderTemplate(str, vars) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''))
}

module.exports = { TRIGGERS, ACTIONS, TRIGGER_TYPES, ACTION_TYPES, renderTemplate }
