import { useState, useEffect, useRef } from 'react'
import { Building2, Users, MapPin, CalendarDays, GraduationCap } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { azubisApi } from '../../api/client'

export default function DepartmentWidget() {
  const [data, setData] = useState({ departments: [], unassigned: [], active_events: [], active_schools: [] })
  const [hasMore, setHasMore] = useState(false)
  const bodyRef = useRef(null)

  const load = () => azubisApi.getByDepartment().then(setData).catch(() => {})

  useEffect(() => {
    load()
    const interval = setInterval(load, 120000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const check = () => setHasMore(el.scrollTop + el.clientHeight < el.scrollHeight - 10)
    check()
    el.addEventListener('scroll', check)
    return () => el.removeEventListener('scroll', check)
  }, [data])

  const activeDepts = data.departments.filter(d => d.azubis.length > 0)
  const activeEvents = data.active_events || []
  const activeSchools = data.active_schools || []
  const total =
    data.departments.reduce((s, d) => s + d.azubis.length, 0) +
    data.unassigned.length +
    activeEvents.reduce((s, e) => s + e.azubis.length, 0) +
    activeSchools.reduce((s, b) => s + b.azubis.length, 0)

  const hasContent = activeDepts.length > 0 || data.unassigned.length > 0 || activeEvents.length > 0 || activeSchools.length > 0

  const AzubiRow = ({ a, color }) => (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
        style={{ backgroundColor: `${color}25`, color }}>
        {a.name.charAt(0).toUpperCase()}
      </div>
      <span className="text-xs text-slate-300 truncate">{a.name}</span>
      <span className="ml-auto text-[9px] text-slate-400 shrink-0">{a.lehrjahr}. Lj.</span>
    </div>
  )

  const Divider = ({ icon: Icon, label }) => (
    <div className="flex items-center gap-2 pt-1">
      <div className="flex-1 h-px bg-[#2a2d4a]" />
      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        <Icon size={10} />{label}
      </span>
      <div className="flex-1 h-px bg-[#2a2d4a]" />
    </div>
  )

  const GRID = { gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))' }

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <Building2 size={14} className="text-indigo-400" />
          <span className="widget-title">Abteilungsübersicht</span>
        </div>
        <span className="text-xs text-slate-500 bg-[#1e2035]/60 px-2 py-0.5 rounded-full flex items-center gap-1">
          <Users size={10} />{total}
        </span>
      </div>

      {/* scrollbarer Bereich */}
      <div
        ref={bodyRef}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', minHeight: 0, padding: '1rem' }}
      >
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-600">
            <Building2 size={24} className="mb-2 opacity-30" />
            <span className="text-sm">Keine Azubis eingepflegt</span>
          </div>
        ) : (
          <div className="space-y-3">

            {/* Abteilungen */}
            {(activeDepts.length > 0 || data.unassigned.length > 0) && (
              <div className="grid gap-3" style={GRID}>
                {activeDepts.map(dept => (
                  <div key={dept.id} className="p-2.5 rounded-xl border bg-[#1e2035]/50"
                    style={{ borderColor: `${dept.color}40` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dept.color }} />
                      <span className="text-xs font-bold text-white truncate">{dept.name}</span>
                      <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ backgroundColor: `${dept.color}20`, color: dept.color }}>
                        {dept.azubis.length}
                      </span>
                    </div>
                    {dept.location && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-2">
                        <MapPin size={9} />{dept.location}
                      </div>
                    )}
                    <div className="space-y-1">
                      {dept.azubis.map(a => <AzubiRow key={a.id} a={a} color={dept.color} />)}
                    </div>
                  </div>
                ))}

                {data.unassigned.length > 0 && (
                  <div className="p-2.5 rounded-xl border border-[#2a2d4a] bg-[#1e2035]/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-500">Nicht zugewiesen</span>
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 shrink-0">
                        {data.unassigned.length}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {data.unassigned.map(a => (
                        <div key={a.id} className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold bg-slate-700 text-slate-400 shrink-0">
                            {a.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-slate-500 truncate">{a.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Berufsschule */}
            {activeSchools.length > 0 && (
              <>
                <Divider icon={GraduationCap} label="Berufsschule" />
                <div className="grid gap-3" style={GRID}>
                  {activeSchools.map(block => (
                    <div key={`school-${block.id}`} className="p-2.5 rounded-xl border bg-[#1e2035]/50"
                      style={{ borderColor: `${block.color}50`, borderStyle: 'dashed' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <GraduationCap size={12} style={{ color: block.color }} className="shrink-0" />
                        <span className="text-xs font-bold text-white truncate">{block.school_name}</span>
                        <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ backgroundColor: `${block.color}20`, color: block.color }}>
                          {block.azubis.length}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mb-2">
                        bis {format(parseISO(block.end_date), 'dd.MM.yyyy', { locale: de })}
                      </div>
                      <div className="space-y-1">
                        {block.azubis.map(a => <AzubiRow key={a.id} a={a} color={block.color} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Termine */}
            {activeEvents.length > 0 && (
              <>
                <Divider icon={CalendarDays} label="Aktive Termine" />
                <div className="grid gap-3" style={GRID}>
                  {activeEvents.map(event => (
                    <div key={`event-${event.id}`} className="p-2.5 rounded-xl border bg-[#1e2035]/50"
                      style={{ borderColor: `${event.color}50`, borderStyle: 'dashed' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarDays size={12} style={{ color: event.color }} className="shrink-0" />
                        <span className="text-xs font-bold text-white truncate">{event.title}</span>
                        <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ backgroundColor: `${event.color}20`, color: event.color }}>
                          {event.azubis.length}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mb-2">
                        bis {format(parseISO(event.end_datetime), 'dd.MM. HH:mm', { locale: de })}
                      </div>
                      <div className="space-y-1">
                        {event.azubis.map(a => <AzubiRow key={a.id} a={a} color={event.color} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Scroll-Indikator */}
      {hasMore && (
        <div className="shrink-0 flex justify-center gap-1 py-1.5 pointer-events-none">
          {[0, 150, 300].map(d => (
            <div key={d} className="w-1 h-1 rounded-full bg-slate-600 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      )}
    </div>
  )
}
