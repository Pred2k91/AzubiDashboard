// Muss mit backend/src/permissions.js übereinstimmen -- nur für die Anzeige
// (Checkbox-Matrix, Nav-Gating), die Durchsetzung passiert ausschließlich im Backend.
export const PERMISSIONS = [
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
  { key: 'users.create', label: 'Ausbilder-Konten anlegen' },
  { key: 'users.edit', label: 'Ausbilder-Konten bearbeiten' },
  { key: 'users.delete', label: 'Ausbilder-Konten löschen/deaktivieren' },
  { key: 'settings.manage', label: 'Einstellungen ändern' },
  { key: 'productivity.manage', label: 'Aufgaben & Notizen pflegen' },
]
