export const DAY_TYPES = [
  { value: 'betrieb', label: 'Betrieb' },
  { value: 'berufsschule', label: 'Berufsschule' },
  { value: 'unterweisung', label: 'Unterweisung' },
  { value: 'urlaub', label: 'Urlaub' },
  { value: 'krank', label: 'Krank' },
  { value: 'feiertag', label: 'Feiertag' },
]

export const ABSENCE_TYPES = ['urlaub', 'krank', 'feiertag']

export function dayTypeLabel(value) {
  return DAY_TYPES.find(t => t.value === value)?.label || value
}
