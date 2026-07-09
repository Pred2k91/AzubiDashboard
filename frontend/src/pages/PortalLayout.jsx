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
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#0d0f1a]">
      {/* Sidebar — ab Tablet-Breite (md) aufwärts */}
      <aside className="hidden md:flex md:w-56 shrink-0 flex-col border-r border-[#2a2d4a] bg-[#0d0f1a]">
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

      {/* Kopfzeile — nur unterhalb von md (Smartphone) */}
      <header className="md:hidden shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#2a2d4a] bg-[#0d0f1a]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <LayoutDashboard size={14} className="text-white" />
          </div>
          <span className="text-sm font-bold text-white">Mein Bereich</span>
        </div>
        <button onClick={handleLogout} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-[#1e2035]">
          <LogOut size={18} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Tab-Leiste — nur unterhalb von md (Smartphone) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 flex border-t border-[#2a2d4a] bg-[#0d0f1a]/95 backdrop-blur-sm">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500'}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
