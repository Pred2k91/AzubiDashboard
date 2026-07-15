// Bestimmt den Europe/Berlin UTC-Offset (1h Winterzeit, 2h Sommerzeit) für einen
// gegebenen UTC-Zeitpunkt -- ohne Intl-API (Tizen-Kompatibilität). Geteilt zwischen
// ClockWidget (Anzeige) und KioskPage (Nacht-Dimming-Check), damit beide garantiert
// dieselbe Uhrzeit zugrunde legen.
export function getBerlinOffset(utcMs) {
  const d = new Date(utcMs)
  const y = d.getUTCFullYear()
  const lastSunMar = new Date(Date.UTC(y, 2, 31))
  lastSunMar.setUTCDate(31 - lastSunMar.getUTCDay())
  const lastSunOct = new Date(Date.UTC(y, 9, 31))
  lastSunOct.setUTCDate(31 - lastSunOct.getUTCDay())
  return d >= lastSunMar && d < lastSunOct ? 2 : 1
}
