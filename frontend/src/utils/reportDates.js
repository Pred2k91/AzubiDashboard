// Reine UTC-Arithmetik — siehe backend/src/routes/reportEntries.js für die
// ausführliche Begründung (lokale Zeitzone würde beim Runden den Tag verschieben).
export function mondayOf(dateStr) {
  const d = new Date(dateStr)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
