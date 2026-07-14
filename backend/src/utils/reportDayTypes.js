const DAY_TYPE_LABELS = {
  betrieb: 'Betrieb',
  berufsschule: 'Berufsschule',
  unterweisung: 'Unterweisung',
  urlaub: 'Urlaub',
  krank: 'Krank',
  feiertag: 'Feiertag',
}

const ABSENCE_TYPES = ['urlaub', 'krank', 'feiertag']

function dayTypeLabel(value) {
  return DAY_TYPE_LABELS[value] || value
}

module.exports = { dayTypeLabel, DAY_TYPE_LABELS, ABSENCE_TYPES }
