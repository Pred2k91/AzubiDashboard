import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

function formatLastReport(lastReportDate) {
  return lastReportDate ? format(parseISO(lastReportDate), 'dd.MM.yyyy', { locale: de }) : 'bisher noch nicht'
}

function formatDeadline(daysFromNow) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return format(d, 'dd.MM.yyyy', { locale: de })
}

export function buildReminderMail(azubi, { trainerName } = {}) {
  const signature = trainerName || 'Deine Ausbildungsleitung'
  const lastReport = formatLastReport(azubi.last_report_date)
  const daysText = azubi.days != null ? `seit ${azubi.days} Tagen` : 'seit einiger Zeit'

  const subject = 'Erinnerung: Dein Berichtsheft ist überfällig'
  const body = `Hallo ${azubi.name},

eine kurze Erinnerung: Dein Berichtsheft wurde zuletzt am ${lastReport} eingereicht und ist damit aktuell ${daysText} überfällig.

Bitte reiche dein Berichtsheft zeitnah nach, damit wir wieder auf dem aktuellen Stand sind.

Bei Fragen oder falls es Schwierigkeiten gibt, melde dich gerne bei mir.

Viele Grüße
${signature}`

  return { subject, body }
}

export function buildEscalationMail(azubi, { trainerName } = {}) {
  const signature = trainerName || 'Deine Ausbildungsleitung'
  const lastReport = formatLastReport(azubi.last_report_date)
  const daysText = azubi.days != null ? `einem Rückstand von ${azubi.days} Tagen` : 'einem erheblichen Rückstand'
  const deadline = formatDeadline(7)

  const subject = 'Dringend: Ausstehendes Berichtsheft – bitte umgehend nachreichen'
  const body = `Hallo ${azubi.name},

trotz vorheriger Erinnerung wurde dein Berichtsheft weiterhin nicht eingereicht. Zuletzt liegt uns ein Eintrag vom ${lastReport} vor – das entspricht aktuell ${daysText}.

Die regelmäßige und vollständige Führung des Berichtshefts ist laut Ausbildungsvertrag und Berufsbildungsgesetz verpflichtender Bestandteil deiner Ausbildung. Solltest du das ausstehende Berichtsheft nicht bis zum ${deadline} nachreichen, müssen wir dies als Pflichtverletzung werten und arbeitsrechtliche Konsequenzen prüfen – bis hin zu einer Abmahnung.

Bitte reiche das Berichtsheft umgehend nach oder melde dich kurzfristig bei mir, falls es nachvollziehbare Gründe für die Verzögerung gibt.

Mit freundlichen, aber bestimmten Grüßen
${signature}`

  return { subject, body }
}

export function buildMailtoUrl(email, { subject, body }) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
