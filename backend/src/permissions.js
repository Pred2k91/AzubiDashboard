// Fester Berechtigungs-Katalog -- nicht admin-editierbar, nur die Zuordnung zu Rollen
// (role_permissions) ist frei konfigurierbar. Ein Super Admin (permission_roles.is_super_admin)
// umgeht diese Liste komplett und darf immer alles.
const PERMISSIONS = [
  { key: 'azubis.create', label: 'Azubis anlegen' },
  { key: 'azubis.edit', label: 'Azubis bearbeiten (inkl. Abteilungswechsel)' },
  { key: 'azubis.delete', label: 'Azubis deaktivieren' },
  { key: 'reports.review', label: 'Berichtshefte kontrollieren' },
  { key: 'reports.export', label: 'Berichtshefte exportieren (PDF/Excel)' },
  { key: 'schools.manage', label: 'Berufsschulen & Schulblöcke pflegen' },
  { key: 'calendar.manage', label: 'Kalender pflegen' },
  { key: 'announcements.manage', label: 'Schwarzes Brett pflegen' },
  { key: 'departments.manage', label: 'Abteilungen pflegen' },
  { key: 'locations.manage', label: 'Niederlassungen pflegen' },
  { key: 'users.create', label: 'Nutzerkonten anlegen' },
  { key: 'users.edit', label: 'Nutzerkonten bearbeiten' },
  { key: 'users.delete', label: 'Nutzerkonten löschen/deaktivieren' },
  { key: 'settings.manage', label: 'Einstellungen ändern' },
  { key: 'productivity.manage', label: 'Aufgaben & Notizen pflegen' },
]

const PERMISSION_KEYS = PERMISSIONS.map(p => p.key)

module.exports = { PERMISSIONS, PERMISSION_KEYS }
