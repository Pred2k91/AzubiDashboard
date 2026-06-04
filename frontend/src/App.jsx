import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { settingsApi } from './api/client'
import { applyAccentColor, applyWidgetOpacity } from './utils/theme'
import KioskPage from './pages/KioskPage'
import AdminLayout from './pages/AdminLayout'
import AdminOverview from './pages/admin/AdminOverview'
import CalendarAdmin from './pages/admin/CalendarAdmin'
import TodosAdmin from './pages/admin/TodosAdmin'
import NotesAdmin from './pages/admin/NotesAdmin'
import AzubiAdmin from './pages/admin/AzubiAdmin'
import DepartmentsAdmin from './pages/admin/DepartmentsAdmin'
import SchoolsAdmin from './pages/admin/SchoolsAdmin'
import AnnouncementsAdmin from './pages/admin/AnnouncementsAdmin'
import ReportsAdmin from './pages/admin/ReportsAdmin'
import SettingsPage from './pages/admin/SettingsPage'

export default function App() {
  useEffect(() => {
    settingsApi.getAll().then(s => {
      if (s.theme_accent) applyAccentColor(s.theme_accent)
      if (s.widget_opacity !== undefined) applyWidgetOpacity(s.widget_opacity)
    }).catch(() => {})
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<KioskPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="calendar" element={<CalendarAdmin />} />
          <Route path="todos" element={<TodosAdmin />} />
          <Route path="notes" element={<NotesAdmin />} />
          <Route path="azubis" element={<AzubiAdmin />} />
          <Route path="departments" element={<DepartmentsAdmin />} />
          <Route path="schools" element={<SchoolsAdmin />} />
          <Route path="announcements" element={<AnnouncementsAdmin />} />
          <Route path="reports" element={<ReportsAdmin />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
