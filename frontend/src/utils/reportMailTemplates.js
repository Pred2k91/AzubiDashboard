import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

// Verfügbare Platzhalter in den Mail-Vorlagen
export const TEMPLATE_PLACEHOLDERS = [
  { key: 'vorname', label: 'Vorname des Azubis' },
  { key: 'name', label: 'Vollständiger Name' },
  { key: 'tage', label: 'Tage überfällig (z. B. "23 Tage")' },
  { key: 'letzterBericht', label: 'Datum des letzten Berichts (oder "bisher noch nicht")' },
  { key: 'frist', label: 'Nachfrist-Datum (nur Eskalation, +7 Tage)' },
  { key: 'ausbilder', label: 'Ausbilder-Name (Signatur)' },
]

export const DEFAULT_REMINDER_SUBJECT = 'Erinnerung: Dein Berichtsheft ist überfällig'
export const DEFAULT_REMINDER_BODY = `Hallo {{vorname}},

eine kurze Erinnerung: Dein Berichtsheft wurde zuletzt am {{letzterBericht}} eingereicht und ist damit aktuell seit {{tage}} überfällig.

Bitte reiche dein Berichtsheft zeitnah nach, damit wir wieder auf dem aktuellen Stand sind.

Bei Fragen oder falls es Schwierigkeiten gibt, melde dich gerne bei mir.

Viele Grüße
{{ausbilder}}`

export const DEFAULT_ESCALATION_SUBJECT = 'Dringend: Ausstehendes Berichtsheft – bitte umgehend nachreichen'
export const DEFAULT_ESCALATION_BODY = `Hallo {{vorname}},

trotz vorheriger Erinnerung wurde dein Berichtsheft weiterhin nicht eingereicht. Zuletzt liegt uns ein Eintrag vom {{letzterBericht}} vor – das entspricht aktuell einem Rückstand von {{tage}}.

Die regelmäßige und vollständige Führung des Berichtshefts ist laut Ausbildungsvertrag und Berufsbildungsgesetz verpflichtender Bestandteil deiner Ausbildung. Solltest du das ausstehende Berichtsheft nicht bis zum {{frist}} nachreichen, müssen wir dies als Pflichtverletzung werten und arbeitsrechtliche Konsequenzen prüfen – bis hin zu einer Abmahnung.

Bitte reiche das Berichtsheft umgehend nach oder melde dich kurzfristig bei mir, falls es nachvollziehbare Gründe für die Verzögerung gibt.

Mit freundlichen, aber bestimmten Grüßen
{{ausbilder}}`

function firstName(fullName) {
  return (fullName || '').trim().split(/\s+/)[0] || fullName
}

function formatLastReport(lastReportDate) {
  return lastReportDate ? format(parseISO(lastReportDate), 'dd.MM.yyyy', { locale: de }) : 'bisher noch nicht'
}

function formatDeadline(daysFromNow) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return format(d, 'dd.MM.yyyy', { locale: de })
}

function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in vars ? vars[key] : match))
}

function buildVars(azubi, trainerName) {
  return {
    vorname: firstName(azubi.name),
    name: azubi.name,
    tage: azubi.days != null ? `${azubi.days} Tagen` : 'einiger Zeit',
    letzterBericht: formatLastReport(azubi.last_report_date),
    frist: formatDeadline(7),
    ausbilder: trainerName || 'Deine Ausbildungsleitung',
  }
}

export function buildReminderMail(azubi, { trainerName, subjectTemplate, bodyTemplate } = {}) {
  const vars = buildVars(azubi, trainerName)
  return {
    subject: renderTemplate(subjectTemplate || DEFAULT_REMINDER_SUBJECT, vars),
    body: renderTemplate(bodyTemplate || DEFAULT_REMINDER_BODY, vars),
  }
}

export function buildEscalationMail(azubi, { trainerName, subjectTemplate, bodyTemplate } = {}) {
  const vars = buildVars(azubi, trainerName)
  return {
    subject: renderTemplate(subjectTemplate || DEFAULT_ESCALATION_SUBJECT, vars),
    body: renderTemplate(bodyTemplate || DEFAULT_ESCALATION_BODY, vars),
  }
}

export function buildMailtoUrl(email, { subject, body }) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
