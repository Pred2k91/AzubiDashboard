import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Wie RequireRole, aber prüft zusätzlich eine konkrete Einzelberechtigung (oder
// verlangt Super Admin). Nur für Routen innerhalb von /admin gedacht -- der äußere
// RequireRole role="ausbilder" hat den Login/Rollen-Check schon erledigt.
export default function RequirePermission({ permission, superAdminOnly, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (user.role !== 'ausbilder') return <Navigate to="/portal" replace />
  if (!user.is_super_admin) {
    if (superAdminOnly) return <Navigate to="/admin" replace />
    if (permission && !user.permissions?.includes(permission)) return <Navigate to="/admin" replace />
  }
  return children
}
