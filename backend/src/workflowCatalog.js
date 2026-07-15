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

// Wiederverwendet von allen zeitbasierten (Polling-)Auslösern -- solange die zugrunde
// liegende Bedingung bestehen bleibt (weiterhin überfällig/steht weiterhin bevor), feuert
// der Workflow sonst nur einmalig. Mit gesetztem Wert erinnert derselbe Workflow von allein
// alle X Tage erneut, ohne dass dafür mehrere Workflows mit unterschiedlichen Schwellen
// angelegt werden müssen.
const REPEAT_FIELD = { key: 'repeat_every_days', label: 'Danach alle X Tage erneut erinnern (0 = nur einmal)', type: 'number', default: 0, min: 0 }

const CATEGORIES = [
  { key: 'report', label: 'Berichtsheft' },
  { key: 'rotation', label: 'Abteilungswechsel' },
  { key: 'todo', label: 'Aufgaben' },
  { key: 'event', label: 'Termin' },
  { key: 'feedback', label: 'Feedback' },
]

const TRIGGERS = [
  {
    type: 'report_overdue',
    category: 'report',
    label: 'Berichtsheft überfällig',
    description: 'Feuert pro aktivem Azubi, dessen letzter eingereichter Bericht mindestens so viele Tage zurückliegt (oder der noch nie einen eingereicht hat).',
    fields: [
      { key: 'min_days', label: 'Tage seit letztem Bericht (mindestens)', type: 'number', default: 7, min: 1 },
      REPEAT_FIELD,
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
      REPEAT_FIELD,
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
      REPEAT_FIELD,
    ],
  },
  {
    type: 'todo_overdue',
    category: 'todo',
    label: 'Aufgabe überfällig',
    description: 'Feuert pro offener Aufgabe, deren Fälligkeitsdatum mindestens so viele Tage zurückliegt.',
    fields: [
      { key: 'min_days', label: 'Tage seit Fälligkeit (mindestens)', type: 'number', default: 0, min: 0 },
      REPEAT_FIELD,
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
      REPEAT_FIELD,
    ],
  },
  {
    type: 'event_cancelled',
    category: 'event',
    label: 'Termin abgesagt',
    description: 'Feuert sofort, sobald ein Termin gelöscht wird. Bei Terminen mit verknüpften Azubis feuert es pro Azubi.',
    fields: [],
  },
  {
    type: 'feedback_pending',
    category: 'feedback',
    label: 'Feedback steht noch aus',
    description: 'Feuert pro noch nicht ausgefülltem Azubi-Feedbackbogen (Azubi bewertet Team), der mindestens so viele Tage aussteht. Team->Azubi-Bewertungen laufen über den Ansprechpartner der Abteilung, nicht über einen Systemnutzer, und sind hier nicht enthalten.',
    fields: [
      { key: 'min_days', label: 'Tage seit Anlegen (mindestens)', type: 'number', default: 3, min: 1 },
      REPEAT_FIELD,
    ],
  },
  {
    type: 'feedback_submitted',
    category: 'feedback',
    label: 'Feedback wurde abgegeben',
    description: 'Feuert sofort, sobald ein Azubi- oder Team-Feedbackbogen abgeschickt wurde.',
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
