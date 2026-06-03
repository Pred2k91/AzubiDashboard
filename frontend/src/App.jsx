import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import KioskPage from './pages/KioskPage'
import AdminLayout from './pages/AdminLayout'
import AdminOverview from './pages/admin/AdminOverview'
import CalendarAdmin from './pages/admin/CalendarAdmin'
import TodosAdmin from './pages/admin/TodosAdmin'
import NotesAdmin from './pages/admin/NotesAdmin'
import AzubiAdmin from './pages/admin/AzubiAdmin'
import DepartmentsAdmin from './pages/admin/DepartmentsAdmin'
import SettingsPage from './pages/admin/SettingsPage'

export default function App() {
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
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
