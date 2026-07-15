// Fester Auslöser-/Aktions-Katalog für das Workflow-System -- nicht admin-editierbar,
// nur welche Trigger/Aktionen ein konkreter Workflow nutzt und wie sie konfiguriert sind.
// Jeder Eintrag beschreibt sein Config-Schema über `fields`, damit das Frontend-Formular
// generisch daraus gerendert werden kann (WorkflowsAdmin.jsx) -- neue Trigger/Aktionen
// später einfach hier ergänzen, ohne das Formular anzufassen.
//
// Nicht jeder Auslöser hat einen Azubi als Betroffenen (z.B. eine unzugewiesene Aufgabe
// oder ein Termin ohne verknüpfte Azubis). Die Aktionen berücksichtigen das: "An Azubi"/
// "Ausbilder der Niederlassung" laufen ins Leere, wenn kein Azubi vorhanden ist -- dafür
// gibt es "An alle Ausbilder" als azubi-unabhängige Option.

const TRIGGERS = [
  {
    type: 'report_overdue',
    label: 'Berichtsheft überfällig',
    description: 'Feuert pro aktivem Azubi, dessen letzter eingereichter Bericht mindestens so viele Tage zurückliegt (oder der noch nie einen eingereicht hat).',
    fields: [
      { key: 'min_days', label: 'Tage seit letztem Bericht (mindestens)', type: 'number', default: 7, min: 1 },
    ],
  },
  {
    type: 'rotation_upcoming',
    label: 'Abteilungswechsel steht bevor',
    description: 'Feuert einmalig pro Azubi, sobald der geplante Wechsel-Stichtag höchstens so viele Tage entfernt ist.',
    fields: [
      { key: 'days_before', label: 'Tage vor dem Wechsel', type: 'number', default: 7, min: 0 },
    ],
  },
  {
    type: 'report_pending_review',
    label: 'Berichtsheft wartet auf Prüfung',
    description: 'Feuert, wenn ein eingereichter Bericht mindestens so viele Tage unbearbeitet auf eine Ausbilder-Prüfung wartet.',
    fields: [
      { key: 'min_days', label: 'Tage seit Einreichung (mindestens)', type: 'number', default: 3, min: 1 },
    ],
  },
  {
    type: 'report_rejected',
    label: 'Berichtsheft wurde abgelehnt',
    description: 'Feuert sofort, sobald ein Ausbilder einen eingereichten Bericht ablehnt. Der Ablehnungsgrund steht als Platzhalter zur Verfügung.',
    fields: [],
  },
  {
    type: 'report_approved',
    label: 'Berichtsheft wurde genehmigt',
    description: 'Feuert sofort, sobald ein Ausbilder einen eingereichten Bericht genehmigt.',
    fields: [],
  },
  {
    type: 'todo_overdue',
    label: 'Aufgabe überfällig',
    description: 'Feuert pro offener Aufgabe, deren Fälligkeitsdatum mindestens so viele Tage zurückliegt.',
    fields: [
      { key: 'min_days', label: 'Tage seit Fälligkeit (mindestens)', type: 'number', default: 0, min: 0 },
    ],
  },
  {
    type: 'todo_assigned',
    label: 'Aufgabe wurde zugewiesen',
    description: 'Feuert sofort, sobald eine Aufgabe einem Azubi zugewiesen wird.',
    fields: [],
  },
  {
    type: 'event_upcoming',
    label: 'Termin steht bevor',
    description: 'Feuert einmalig pro Termin, sobald dessen Beginn höchstens so viele Tage entfernt ist. Bei Terminen mit verknüpften Azubis feuert es pro Azubi.',
    fields: [
      { key: 'days_before', label: 'Tage vor Termin-Beginn', type: 'number', default: 1, min: 0 },
    ],
  },
  {
    type: 'event_created',
    label: 'Termin wurde angelegt',
    description: 'Feuert sofort, sobald ein neuer Termin angelegt wird. Bei Terminen mit verknüpften Azubis feuert es pro Azubi.',
    fields: [],
  },
]

const ACTIONS = [
  {
    type: 'email',
    label: 'E-Mail versenden',
    fields: [
      { key: 'to_azubi', label: 'An den betroffenen Azubi senden (falls vorhanden)', type: 'checkbox', default: true },
      { key: 'to_location_ausbilder', label: 'CC an Ausbilder der Niederlassung des Azubis (+ Super Admins)', type: 'checkbox', default: false },
      { key: 'to_all_ausbilder', label: 'CC an alle Ausbilder (unabhängig von Niederlassung)', type: 'checkbox', default: false },
      { key: 'cc', label: 'Zusätzliche feste CC-Adressen (eine pro Zeile)', type: 'email_list', default: [] },
      { key: 'subject', label: 'Betreff', type: 'text', default: 'Erinnerung: Berichtsheft überfällig' },
      {
        key: 'body', label: 'Text (Platzhalter je nach Auslöser: {{name}}, {{title}}, {{days_overdue}}, {{comment}}, {{date}} — nicht verfügbare bleiben leer)', type: 'textarea',
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
          { value: 'azubi', label: 'Betroffener Azubi (falls vorhanden)' },
          { value: 'ausbilder', label: 'Ausbilder der Niederlassung des Azubis (+ Super Admins)' },
          { value: 'all_ausbilder', label: 'Alle Ausbilder (unabhängig von Niederlassung)' },
        ],
      },
      { key: 'title', label: 'Titel', type: 'text', default: 'Berichtsheft überfällig' },
      {
        key: 'body', label: 'Text (Platzhalter je nach Auslöser: {{name}}, {{title}}, {{days_overdue}}, {{comment}}, {{date}})', type: 'textarea',
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
