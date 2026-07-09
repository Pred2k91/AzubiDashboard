import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, UserCircle, LogOut, ExternalLink } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/portal', label: 'Übersicht', icon: LayoutDashboard, end: true },
  { to: '/portal/profile', label: 'Mein Profil', icon: UserCircle },
]

export default function PortalLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0f1a]">
      <aside className="w-56 shrink-0 flex flex-col border-r border-[#2a2d4a] bg-[#0d0f1a]">
        <div className="px-4 py-5 border-b border-[#2a2d4a]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <LayoutDashboard size={14} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">Mein Bereich</div>
              <div className="text-[10px] text-slate-600">Azubi-Portal</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-[#2a2d4a] space-y-1">
          {user && (
            <div className="px-3 py-1.5 text-xs text-slate-600 truncate">{user.email}</div>
          )}
          <Link to="/" className="nav-item">
            <ExternalLink size={16} />
            Kiosk-Ansicht
          </Link>
          <button onClick={handleLogout} className="nav-item w-full text-left">
            <LogOut size={16} />
            Abmelden
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
