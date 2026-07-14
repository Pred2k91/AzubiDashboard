import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { settingsApi } from './api/client'
import { applyAccentColor, applyWidgetOpacity } from './utils/theme'
import { AuthProvider } from './contexts/AuthContext'
import RequireRole from './components/RequireRole'
import KioskPage from './pages/KioskPage'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import ProfilePage from './pages/ProfilePage'
import PortalLayout from './pages/PortalLayout'
import PortalDashboard from './pages/portal/PortalDashboard'
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
import UsersAdmin from './pages/admin/UsersAdmin'

export default function App() {
  useEffect(() => {
    settingsApi.getAll().then(s => {
      if (s.theme_accent) applyAccentColor(s.theme_accent)
      if (s.widget_opacity !== undefined) applyWidgetOpacity(s.widget_opacity)
    }).catch(() => {})
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/kiosk" element={<KioskPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/change-password" element={<RequireRole><ChangePasswordPage /></RequireRole>} />
          <Route path="/admin" element={<RequireRole role="ausbilder"><AdminLayout /></RequireRole>}>
            <Route index element={<AdminOverview />} />
            <Route path="calendar" element={<CalendarAdmin />} />
            <Route path="todos" element={<TodosAdmin />} />
            <Route path="notes" element={<NotesAdmin />} />
            <Route path="azubis" element={<AzubiAdmin />} />
            <Route path="departments" element={<DepartmentsAdmin />} />
            <Route path="schools" element={<SchoolsAdmin />} />
            <Route path="announcements" element={<AnnouncementsAdmin />} />
            <Route path="reports" element={<ReportsAdmin />} />
            <Route path="users" element={<UsersAdmin />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="/portal" element={<RequireRole role="azubi"><PortalLayout /></RequireRole>}>
            <Route index element={<PortalDashboard />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
