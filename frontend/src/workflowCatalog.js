// Muss mit backend/src/workflowCatalog.js übereinstimmen -- rendert das Formular in
// WorkflowsAdmin.jsx generisch aus dem `fields`-Schema jedes Auslösers/jeder Aktion.
export const TRIGGERS = [
  {
    type: 'report_overdue',
    label: 'Berichtsheft überfällig',
    description: 'Feuert pro aktivem Azubi, dessen letzter eingereichter Bericht mindestens so viele Tage zurückliegt (oder der noch nie einen eingereicht hat).',
    fields: [
      { key: 'min_days', label: 'Tage seit letztem Bericht (mindestens)', type: 'number', default: 7, min: 1 },
    ],
  },
]

export const ACTIONS = [
  {
    type: 'email',
    label: 'E-Mail versenden',
    fields: [
      { key: 'to_azubi', label: 'An den betroffenen Azubi senden', type: 'checkbox', default: true },
      { key: 'to_location_ausbilder', label: 'CC an Ausbilder der Niederlassung des Azubis (+ Super Admins)', type: 'checkbox', default: false },
      { key: 'cc', label: 'Zusätzliche feste CC-Adressen (eine pro Zeile)', type: 'email_list', default: [] },
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
          { value: 'ausbilder', label: 'Ausbilder der Niederlassung des Azubis (+ Super Admins)' },
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

export function defaultConfig(fields) {
  const cfg = {}
  fields.forEach(f => { cfg[f.key] = f.default })
  return cfg
}
