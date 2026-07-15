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

export const CATEGORIES = [
  { key: 'report', label: 'Berichtsheft' },
  { key: 'rotation', label: 'Abteilungswechsel' },
  { key: 'todo', label: 'Aufgaben' },
  { key: 'event', label: 'Termin' },
]

export const TRIGGERS = [
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

export const ACTIONS = [
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

// Rein informativ fürs Formular (WorkflowsAdmin.jsx zeigt das neben Feldern mit
// showVariables an) -- welche {{platzhalter}} für welchen Auslöser tatsächlich befüllt
// werden und was sie dort bedeuten (z.B. {{date}} ist je nach Auslöser ein anderes Datum).
// Nicht aufgeführte Platzhalter bleiben beim Versand einfach leer (siehe renderTemplate).
export const TRIGGER_VARS = {
  report_overdue: [
    { key: 'name', label: 'Name des Azubis' },
    { key: 'days_overdue', label: 'Tage seit letztem Bericht' },
  ],
  report_submitted: [
    { key: 'name', label: 'Name des Azubis' },
  ],
  report_pending_review: [
    { key: 'name', label: 'Name des Azubis' },
    { key: 'days', label: 'Tage seit Einreichung' },
    { key: 'date', label: 'Datum der Einreichung' },
  ],
  report_approved: [
    { key: 'name', label: 'Name des Azubis' },
  ],
  report_rejected: [
    { key: 'name', label: 'Name des Azubis' },
    { key: 'comment', label: 'Ablehnungsgrund' },
  ],
  rotation_upcoming: [
    { key: 'name', label: 'Name des Azubis' },
    { key: 'title', label: 'Name der neuen Abteilung' },
    { key: 'days', label: 'Tage bis zum Wechsel' },
    { key: 'date', label: 'Datum des Wechsels' },
  ],
  todo_overdue: [
    { key: 'title', label: 'Titel der Aufgabe' },
    { key: 'name', label: 'Name des zugewiesenen Azubis (falls zugewiesen)' },
    { key: 'days', label: 'Tage seit Fälligkeit' },
    { key: 'date', label: 'Fälligkeitsdatum' },
  ],
  todo_assigned: [
    { key: 'title', label: 'Titel der Aufgabe' },
    { key: 'name', label: 'Name des zugewiesenen Azubis' },
    { key: 'date', label: 'Fälligkeitsdatum' },
  ],
  event_created: [
    { key: 'title', label: 'Titel des Termins' },
    { key: 'name', label: 'Name des verknüpften Azubis (falls vorhanden)' },
    { key: 'date', label: 'Termin-Beginn' },
  ],
  event_upcoming: [
    { key: 'title', label: 'Titel des Termins' },
    { key: 'name', label: 'Name des verknüpften Azubis (falls vorhanden)' },
    { key: 'days', label: 'Tage bis zum Termin' },
    { key: 'date', label: 'Termin-Beginn' },
  ],
  event_cancelled: [
    { key: 'title', label: 'Titel des Termins' },
    { key: 'name', label: 'Name des verknüpften Azubis (falls vorhanden)' },
    { key: 'date', label: 'Ursprünglicher Termin-Beginn' },
  ],
}

export function defaultConfig(fields) {
  const cfg = {}
  fields.forEach(f => { cfg[f.key] = f.default })
  return cfg
}
