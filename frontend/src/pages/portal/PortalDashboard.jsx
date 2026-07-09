import { useState, useEffect } from 'react'
import { Building2, ArrowRight, BookOpen, CalendarDays, CheckCircle, AlertTriangle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { meApi } from '../../api/client'

const STATUS_CONFIG = {
  ok:    { label: 'Aktuell',    icon: CheckCircle,  cls: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
  warn:  { label: 'Überfällig', icon: AlertTriangle, cls: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  alert: { label: 'Kritisch',   icon: AlertTriangle, cls: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20' },
}

export default function PortalDashboard() {
  const [profile, setProfile] = useState(null)
  const [team, setTeam] = useState(null)
  const [reports, setReports] = useState(null)
  const [events, setEvents] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    Promise.all([
      meApi.getProfile(),
      meApi.getTeam(),
      meApi.getReports(),
      meApi.getCalendar(),
    ]).then(([p, t, r, c]) => {
      setProfile(p)
      setTeam(t)
      setReports(r)
      setEvents((c.events || []).filter(e => e.start_datetime >= today).slice(0, 5))
    }).catch(() => {}).finally(() => setLoaded(true))
  }, [])

  if (loaded && profile && !profile.linked) {
    return (
      <div className="p-6">
        <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-6 text-center text-slate-500">
          Dein Konto ist noch keinem Azubi-Datensatz zugeordnet. Bitte wende dich an deinen Ausbilder.
        </div>
      </div>
    )
  }

  const s = reports ? STATUS_CONFIG[reports.status] : null
  const StatusIcon = s?.icon

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">
          {profile ? `Hallo, ${profile.name.split(' ')[0]}` : 'Übersicht'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {format(new Date(), "EEEE, dd. MMMM yyyy", { locale: de })}
          {profile && ` · ${profile.lehrjahr}. Lehrjahr`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Aktuelles/nächstes Team */}
        <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <Building2 size={14} className="text-indigo-400" />
            Mein Team
          </h2>
          {team?.current ? (
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.current.color }} />
              <span className="text-white font-medium">{team.current.name}</span>
              {team.current.location && <span className="text-xs text-slate-500 ml-auto">{team.current.location}</span>}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Noch nicht zugewiesen</p>
          )}

          {team?.next && (
            <div className="mt-3 pt-3 border-t border-[#2a2d4a] flex items-center gap-2 text-sm font-medium" style={{ color: team.next.color }}>
              <ArrowRight size={12} className="shrink-0" />
              <span>ab {format(parseISO(team.next.date), 'dd.MM.yyyy', { locale: de })} → {team.next.name}</span>
            </div>
          )}
        </div>

        {/* Berichtsheft-Status */}
        <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <BookOpen size={14} className="text-indigo-400" />
            Berichtsheft
          </h2>
          {reports && s ? (
            <div className="flex items-center justify-between gap-3">
              <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border shrink-0 ${s.bg} ${s.cls}`}>
                <StatusIcon size={11} />
                {s.label}
              </span>
              <span className="text-sm text-slate-400 text-right">
                {reports.last_report_date
                  ? `zuletzt am ${format(parseISO(reports.last_report_date), 'dd.MM.yyyy', { locale: de })}`
                  : 'bisher nicht eingereicht'}
              </span>
            </div>
          ) : (
            <p className="text-sm text-slate-600">Keine Daten</p>
          )}
        </div>
      </div>

      {/* Eigene Termine */}
      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
          <CalendarDays size={14} className="text-indigo-400" />
          Meine nächsten Termine
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-4">Keine anstehenden Termine</p>
        ) : (
          <div className="space-y-2">
            {events.map(e => (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-[#2a2d4a]/50 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                <span className="text-xs text-slate-500 shrink-0 w-28">
                  {format(parseISO(e.start_datetime), 'dd.MM. HH:mm', { locale: de })}
                </span>
                <span className="text-sm text-slate-300 truncate">{e.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
