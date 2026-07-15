// Fester Auslöser-/Aktions-Katalog für das Workflow-System -- nicht admin-editierbar,
// nur welche Trigger/Aktionen ein konkreter Workflow nutzt und wie sie konfiguriert sind.
// Jeder Eintrag beschreibt sein Config-Schema über `fields`, damit das Frontend-Formular
// generisch daraus gerendert werden kann (WorkflowsAdmin.jsx) -- neue Trigger/Aktionen
// später einfach hier ergänzen, ohne das Formular anzufassen. Trigger sind zusätzlich
// einer `category` zugeordnet, damit die Auswahl im Editor zweistufig läuft (Kategorie
// -> Auslöser) statt einer einzigen langen Liste.
//
// Nicht jeder Auslöser hat einen Azubi als Betroffenen (z.B. eine unzugewiesene Aufgabe
// oder ein Termin ohne verknüpfte Azubis). Die "subject_*"-Empfänger-Optionen laufen dann
// ins Leere -- "Alle Ausbilder", einzelne Nutzer und Gruppen sind azubi-unabhängig.

const CATEGORIES = [
  { key: 'report', label: 'Berichtsheft' },
  { key: 'rotation', label: 'Abteilungswechsel' },
  { key: 'todo', label: 'Aufgaben' },
  { key: 'event', label: 'Termin' },
]

const TRIGGERS = [
  {
    type: 'report_overdue',
    category: 'report',
    label: 'Berichtsheft überfällig',
    description: 'Feuert pro aktivem Azubi, dessen letzter eingereichter Bericht mindestens so viele Tage zurückliegt (oder der noch nie einen eingereicht hat).',
    fields: [
      { key: 'min_days', label: 'Tage seit letztem Bericht (mindestens)', type: 'number', default: 7, min: 1 },
    ],
  },
  {
    type: 'report_submitted',
    category: 'report',
    label: 'Berichtsheft eingereicht',
    description: 'Feuert sofort, sobald ein Azubi einen Bericht einreicht.',
    fields: [],
  },
  {
    type: 'report_pending_review',
    category: 'report',
    label: 'Berichtsheft wartet auf Prüfung',
    description: 'Feuert, wenn ein eingereichter Bericht mindestens so viele Tage unbearbeitet auf eine Ausbilder-Prüfung wartet.',
    fields: [
      { key: 'min_days', label: 'Tage seit Einreichung (mindestens)', type: 'number', default: 3, min: 1 },
    ],
  },
  {
    type: 'report_approved',
    category: 'report',
    label: 'Berichtsheft angenommen',
    description: 'Feuert sofort, sobald ein Ausbilder einen eingereichten Bericht genehmigt.',
    fields: [],
  },
  {
    type: 'report_rejected',
    category: 'report',
    label: 'Berichtsheft abgelehnt',
    description: 'Feuert sofort, sobald ein Ausbilder einen eingereichten Bericht ablehnt. Der Ablehnungsgrund steht als Platzhalter zur Verfügung.',
    fields: [],
  },
  {
    type: 'rotation_upcoming',
    category: 'rotation',
    label: 'Abteilungswechsel steht bevor',
    description: 'Feuert einmalig pro Azubi, sobald der geplante Wechsel-Stichtag höchstens so viele Tage entfernt ist.',
    fields: [
      { key: 'days_before', label: 'Tage vor dem Wechsel', type: 'number', default: 7, min: 0 },
    ],
  },
  {
    type: 'todo_overdue',
    category: 'todo',
    label: 'Aufgabe überfällig',
    description: 'Feuert pro offener Aufgabe, deren Fälligkeitsdatum mindestens so viele Tage zurückliegt.',
    fields: [
      { key: 'min_days', label: 'Tage seit Fälligkeit (mindestens)', type: 'number', default: 0, min: 0 },
    ],
  },
  {
    type: 'todo_assigned',
    category: 'todo',
    label: 'Aufgabe wurde zugewiesen',
    description: 'Feuert sofort, sobald eine Aufgabe einem Azubi zugewiesen wird.',
    fields: [],
  },
  {
    type: 'event_created',
    category: 'event',
    label: 'Termin angelegt',
    description: 'Feuert sofort, sobald ein neuer Termin angelegt wird. Bei Terminen mit verknüpften Azubis feuert es pro Azubi.',
    fields: [],
  },
  {
    type: 'event_upcoming',
    category: 'event',
    label: 'Termin-Erinnerung',
    description: 'Feuert einmalig pro Termin, sobald dessen Beginn höchstens so viele Tage entfernt ist. Bei Terminen mit verknüpften Azubis feuert es pro Azubi.',
    fields: [
      { key: 'days_before', label: 'Tage vor Termin-Beginn', type: 'number', default: 1, min: 0 },
    ],
  },
  {
    type: 'event_cancelled',
    category: 'event',
    label: 'Termin abgesagt',
    description: 'Feuert sofort, sobald ein Termin gelöscht wird. Bei Terminen mit verknüpften Azubis feuert es pro Azubi.',
    fields: [],
  },
]

const ACTIONS = [
  {
    type: 'email',
    label: 'E-Mail versenden',
    fields: [
      { key: 'recipients', label: 'Empfänger', type: 'recipients', default: [] },
      { key: 'cc', label: 'Zusätzliche feste E-Mail-Adressen (eine pro Zeile, z.B. externe Kontakte)', type: 'email_list', default: [] },
      { key: 'subject', label: 'Betreff', type: 'text', default: 'Erinnerung: Berichtsheft überfällig', showVariables: true },
      {
        key: 'body', label: 'Text', type: 'textarea', showVariables: true,
        default: 'Hallo {{name}},\n\ndein Berichtsheft ist seit {{days_overdue}} Tagen überfällig. Bitte trage deine Einträge zeitnah nach.',
      },
    ],
  },
  {
    type: 'push',
    label: 'Push-Benachrichtigung senden',
    fields: [
      { key: 'recipients', label: 'Empfänger', type: 'recipients', default: [] },
      { key: 'title', label: 'Titel', type: 'text', default: 'Berichtsheft überfällig', showVariables: true },
      {
        key: 'body', label: 'Text', type: 'textarea', showVariables: true,
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

module.exports = { CATEGORIES, TRIGGERS, ACTIONS, TRIGGER_TYPES, ACTION_TYPES, renderTemplate }
