import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ArrowRight, BookOpen, CalendarDays, CheckCircle, AlertTriangle, MessageSquareText, GraduationCap } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { meApi, feedbackApi } from '../../api/client'

const STATUS_CONFIG = {
  ok:    { label: 'Aktuell',    icon: CheckCircle,  cls: 'text-green-400',  bg: 'bg-green-500/20 border-green-500/40' },
  warn:  { label: 'Überfällig', icon: AlertTriangle, cls: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/40' },
  alert: { label: 'Kritisch',   icon: AlertTriangle, cls: 'text-red-400',   bg: 'bg-red-500/20 border-red-500/40' },
}

export default function PortalDashboard() {
  const [profile, setProfile] = useState(null)
  const [team, setTeam] = useState(null)
  const [reports, setReports] = useState(null)
  const [events, setEvents] = useState([])
  const [nextSchoolBlock, setNextSchoolBlock] = useState(null)
  const [pendingFeedback, setPendingFeedback] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    Promise.all([
      meApi.getProfile(),
      meApi.getTeam(),
      meApi.getReports(),
      meApi.getCalendar(),
      feedbackApi.getMine().catch(() => []),
    ]).then(([p, t, r, c, feedback]) => {
      setProfile(p)
      setTeam(t)
      setReports(r)
      setEvents((c.events || []).filter(e => e.start_datetime >= today).slice(0, 5))
      setNextSchoolBlock(c.next_school_block || null)
      setPendingFeedback(feedback.filter(f => f.status === 'pending'))
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

      {pendingFeedback.length > 0 && (
        <Link
          to="/portal/feedback"
          className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 hover:bg-amber-500/15 transition-colors"
        >
          <MessageSquareText size={18} className="text-amber-400 shrink-0" />
          <span className="flex-1 text-sm font-medium text-amber-400">
            {pendingFeedback.length === 1
              ? `Feedback zu ${pendingFeedback[0].department_name} steht noch aus`
              : `${pendingFeedback.length} Feedback-Bögen stehen noch aus`}
          </span>
          <ArrowRight size={14} className="text-amber-400 shrink-0" />
        </Link>
      )}

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
        {reports && s ? (
          <Link
            to="/portal/report"
            className={`rounded-xl border p-4 flex flex-col items-center justify-center text-center transition-transform hover:scale-[1.02] ${s.bg}`}
          >
            <span className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${s.cls} mb-2`}>
              <BookOpen size={12} />
              Berichtsheft
            </span>
            <StatusIcon size={26} className={`${s.cls} mb-2`} />
            <div className={`text-2xl font-bold ${s.cls}`}>{s.label}</div>
            <div className="text-sm text-slate-300 mt-2">
              {reports.last_report_date
                ? `Zuletzt eingereicht am ${format(parseISO(reports.last_report_date), 'dd.MM.yyyy', { locale: de })}`
                : 'Bisher nicht eingereicht'}
            </div>
          </Link>
        ) : (
          <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4 flex items-center justify-center">
            <p className="text-sm text-slate-600">Keine Daten</p>
          </div>
        )}
      </div>

      {/* Eigene Termine */}
      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
          <CalendarDays size={14} className="text-indigo-400" />
          Meine nächsten Termine
        </h2>
        {nextSchoolBlock && (
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#2a2d4a]/50">
            <GraduationCap size={14} className="shrink-0" style={{ color: nextSchoolBlock.school_color }} />
            <span className="text-sm">
              <span className="font-medium" style={{ color: nextSchoolBlock.school_color }}>{nextSchoolBlock.school_name}</span>
              <span className="text-slate-400">
                {' '}· {format(parseISO(nextSchoolBlock.start_date), 'dd.MM.', { locale: de })}–{format(parseISO(nextSchoolBlock.end_date), 'dd.MM.yyyy', { locale: de })}
              </span>
            </span>
          </div>
        )}
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
