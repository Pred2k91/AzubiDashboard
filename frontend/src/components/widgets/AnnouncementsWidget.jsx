import { useState, useEffect } from 'react'
import { Megaphone, CalendarDays, AlertTriangle, Info, Clock } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { announcementsApi } from '../../api/client'

const PRIORITY = {
  urgent:    { label: 'Dringend',  bg: 'bg-red-500/15',    border: 'border-red-500/40',    text: 'text-red-400',    icon: AlertTriangle },
  important: { label: 'Wichtig',   bg: 'bg-amber-500/15',  border: 'border-amber-500/40',  text: 'text-amber-400',  icon: AlertTriangle },
  normal:    { label: 'Info',      bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400', icon: Info },
}

function CountdownBadge({ date }) {
  const days = differenceInDays(parseISO(date), new Date())
  if (days < 0) return <span className="text-xs text-slate-600">Vergangen</span>
  const cls = days <= 14 ? 'bg-red-500/20 text-red-300'
            : days <= 30 ? 'bg-amber-500/20 text-amber-300'
            : 'bg-green-500/20 text-green-400'
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {days === 0 ? 'Heute!' : `${days} Tage`}
    </span>
  )
}

export default function AnnouncementsWidget() {
  const [items, setItems] = useState([])

  const load = () => announcementsApi.getActive().then(setItems).catch(() => {})

  useEffect(() => {
    load()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const exams = items.filter(i => i.type === 'exam')
  const announcements = items.filter(i => i.type === 'announcement')

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <Megaphone size={14} className="text-indigo-400" />
          <span className="widget-title">Schwarzes Brett</span>
        </div>
        <span className="text-xs text-slate-500 bg-[#1e2035]/60 px-2 py-0.5 rounded-full">{items.length}</span>
      </div>

      <div className="widget-body space-y-2">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-slate-600">
            <Megaphone size={24} className="mb-2 opacity-30" />
            <span className="text-sm">Keine Einträge</span>
          </div>
        )}

        {/* Prüfungstermine */}
        {exams.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-[#2a2d4a]" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <CalendarDays size={9} /> Prüfungen
              </span>
              <div className="flex-1 h-px bg-[#2a2d4a]" />
            </div>
            {exams.map(item => (
              <div key={item.id} className="p-3 rounded-xl border bg-[#1e2035]/50"
                style={{ borderColor: `${item.color}40` }}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-white leading-tight">{item.title}</span>
                  {item.date && <CountdownBadge date={item.date} />}
                </div>
                {item.content && <p className="text-xs text-slate-400">{item.content}</p>}
                {item.date && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={10} />
                      {format(parseISO(item.date), 'dd. MMMM yyyy', { locale: de })}
                    </div>
                    {item.azubis?.length > 0 && (
                      <>
                        <span className="text-slate-600">·</span>
                        {item.azubis.map(a => (
                          <span key={a.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2a2d4a] text-slate-300">
                            {a.name.split(' ')[0]}
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Ankündigungen */}
        {announcements.length > 0 && (
          <>
            {exams.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-px bg-[#2a2d4a]" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Megaphone size={9} /> Ankündigungen
                </span>
                <div className="flex-1 h-px bg-[#2a2d4a]" />
              </div>
            )}
            {announcements.map(item => {
              const p = PRIORITY[item.priority] || PRIORITY.normal
              const Icon = p.icon
              return (
                <div key={item.id} className={`p-3 rounded-xl border ${p.bg} ${p.border}`}>
                  <div className="flex items-start gap-2">
                    <Icon size={14} className={`${p.text} shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{item.title}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${p.text} ${p.bg}`}>
                          {p.label}
                        </span>
                      </div>
                      {item.content && <p className="text-xs text-slate-400 mt-1">{item.content}</p>}
                      {item.date && (
                        <p className="text-[10px] text-slate-600 mt-1">
                          bis {format(parseISO(item.date), 'dd.MM.yyyy', { locale: de })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
