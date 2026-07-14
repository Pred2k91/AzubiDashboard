const DAY_TYPE_LABELS = {
  betrieb: 'Betrieb',
  berufsschule: 'Berufsschule',
  unterweisung: 'Unterweisung',
  urlaub: 'Urlaub',
  krank: 'Krank',
  feiertag: 'Feiertag',
}

function dayTypeLabel(value) {
  return DAY_TYPE_LABELS[value] || value
}

module.exports = { dayTypeLabel, DAY_TYPE_LABELS }
