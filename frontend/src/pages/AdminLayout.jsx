import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, CalendarDays, CheckSquare, StickyNote,
  Users, Building2, Settings, ExternalLink, GraduationCap, Megaphone, BookOpen,
  UserCog, UserCircle, LogOut, Menu, X,
} from 'lucide-react'
import { settingsApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/admin', label: 'Übersicht', icon: LayoutDashboard, end: true },
  { to: '/admin/calendar', label: 'Kalender', icon: CalendarDays },
  { to: '/admin/todos', label: 'Aufgaben', icon: CheckSquare },
  { to: '/admin/notes', label: 'Notizen', icon: StickyNote },
  { to: '/admin/azubis', label: 'Azubis', icon: Users },
  { to: '/admin/departments', label: 'Abteilungen', icon: Building2 },
  { to: '/admin/schools', label: 'Berufsschulen', icon: GraduationCap },
  { to: '/admin/announcements', label: 'Schwarzes Brett', icon: Megaphone },
  { to: '/admin/reports', label: 'Berichtshefte', icon: BookOpen },
  { to: '/admin/users', label: 'Nutzer', icon: UserCog },
  { to: '/admin/profile', label: 'Mein Profil', icon: UserCircle },
  { to: '/admin/settings', label: 'Einstellungen', icon: Settings },
]

export default function AdminLayout() {
  const [logoUrl, setLogoUrl] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    settingsApi.getAll().then(s => {
      if (s.logo_url) setLogoUrl(s.logo_url)
    }).catch(() => {})
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const navLinks = (onNavigate) => (
    <>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" onClick={onNavigate}>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
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
        <Link to="/kiosk" className="nav-item" onClick={onNavigate}>
          <ExternalLink size={16} />
          Kiosk-Ansicht
        </Link>
        <button onClick={() => { onNavigate?.(); handleLogout() }} className="nav-item w-full text-left">
          <LogOut size={16} />
          Abmelden
        </button>
      </div>
    </>
  )

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] overflow-hidden bg-[#0d0f1a]">
      {/* Sidebar — ab Tablet-Breite (md) aufwärts */}
      <aside className="hidden md:flex md:w-56 shrink-0 flex-col border-r border-[#2a2d4a] bg-[#0d0f1a]">
        <div className="px-4 py-5 border-b border-[#2a2d4a]">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain max-w-[120px]" />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <LayoutDashboard size={14} className="text-white" />
              </div>
            )}
            {!logoUrl && (
              <div>
                <div className="text-sm font-bold text-white leading-tight">Ausbildung</div>
                <div className="text-[10px] text-slate-600">Admin-Bereich</div>
              </div>
            )}
          </div>
        </div>
        {navLinks()}
      </aside>

      {/* Kopfzeile mit Menü-Button — nur unterhalb von md (Smartphone/Tablet) */}
      <header className="md:hidden shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#2a2d4a] bg-[#0d0f1a]">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-7 w-auto object-contain max-w-[100px]" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <LayoutDashboard size={14} className="text-white" />
            </div>
          )}
          <span className="text-sm font-bold text-white">Admin-Bereich</span>
        </div>
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-[#1e2035]">
          <Menu size={20} />
        </button>
      </header>

      {/* Slide-in-Menü — nur unterhalb von md */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 max-w-[80vw] h-full bg-[#0d0f1a] border-r border-[#2a2d4a] flex flex-col">
            <div className="px-4 py-4 border-b border-[#2a2d4a] flex items-center justify-between">
              <span className="text-sm font-bold text-white">Menü</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]">
                <X size={18} />
              </button>
            </div>
            {navLinks(() => setMobileMenuOpen(false))}
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
