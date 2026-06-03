import { NavLink, Outlet, Link } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, CheckSquare, StickyNote,
  Users, Building2, Settings, ExternalLink, ChevronRight
} from 'lucide-react'

const NAV = [
  { to: '/admin', label: 'Übersicht', icon: LayoutDashboard, end: true },
  { to: '/admin/calendar', label: 'Kalender', icon: CalendarDays },
  { to: '/admin/todos', label: 'Aufgaben', icon: CheckSquare },
  { to: '/admin/notes', label: 'Notizen', icon: StickyNote },
  { to: '/admin/azubis', label: 'Azubis', icon: Users },
  { to: '/admin/departments', label: 'Abteilungen', icon: Building2 },
  { to: '/admin/settings', label: 'Einstellungen', icon: Settings },
]

export default function AdminLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0f1a]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-[#2a2d4a] bg-[#0d0f1a]">
        <div className="px-4 py-5 border-b border-[#2a2d4a]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <LayoutDashboard size={14} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">Ausbildung</div>
              <div className="text-[10px] text-slate-600">Admin-Bereich</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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

        <div className="p-3 border-t border-[#2a2d4a]">
          <Link
            to="/"
            className="nav-item"
          >
            <ExternalLink size={16} />
            Kiosk-Ansicht
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
