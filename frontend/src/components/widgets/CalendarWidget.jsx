import { useState, useEffect } from 'react'
import {
  format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks,
  startOfMonth, endOfMonth, startOfWeek as sowFn, endOfWeek as eowFn,
  addMonths, subMonths, isSameMonth, isToday, parseISO, isSameDay,
  getISOWeek, isWithinInterval
} from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, AlignLeft } from 'lucide-react'
import { calendarApi } from '../../api/client'

export default function CalendarWidget() {
  const [current, setCurrent] = useState(new Date())
  const [events, setEvents] = useState([])
  const [view, setView] = useState('week') // 'week' | 'month'

  const loadEvents = () => {
    const start = view === 'week'
      ? format(startOfWeek(current, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : format(startOfMonth(current), 'yyyy-MM-dd')
    const end = view === 'week'
      ? format(endOfWeek(current, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : format(endOfMonth(current), 'yyyy-MM-dd')
    calendarApi.getAll(start, end).then(setEvents).catch(() => {})
  }

  useEffect(() => {
    loadEvents()
    const interval = setInterval(loadEvents, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [current, view])

  const prev = () => view === 'week' ? setCurrent(subWeeks(current, 1)) : setCurrent(subMonths(current, 1))
  const next = () => view === 'week' ? setCurrent(addWeeks(current, 1)) : setCurrent(addMonths(current, 1))
  const goToday = () => setCurrent(new Date())

  const getEventsForDay = (day) =>
    events.filter(e => {
      const s = parseISO(e.start_datetime)
      const en = parseISO(e.end_datetime)
      return isSameDay(s, day) || (s <= day && en >= day)
    })

  // ── WOCHENANSICHT ─────────────────────────────────────────────────────────
  const weekStart = startOfWeek(current, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const kw = getISOWeek(current)

  const weekEvents = events
    .filter(e => {
      const s = parseISO(e.start_datetime)
      const en = parseISO(e.end_datetime)
      return weekDays.some(d => isSameDay(s, d) || (s <= d && en >= d))
    })
    .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))

  // Gruppiert nach Tag
  const byDay = weekDays.map(day => ({
    day,
    events: getEventsForDay(day),
  })).filter(d => d.events.length > 0)

  // ── MONATSANSICHT ─────────────────────────────────────────────────────────
  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const calStart = sowFn(monthStart, { weekStartsOn: 1 })
  const calEnd = eowFn(monthEnd, { weekStartsOn: 1 })
  const monthDays = []
  let d = calStart
  while (d <= calEnd) { monthDays.push(d); d = addDays(d, 1) }

  const upcomingEvents = events
    .filter(e => parseISO(e.start_datetime) >= startOfMonth(current))
    .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))
    .slice(0, 6)

  return (
    <div className="widget-card">
      {/* Header */}
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-indigo-400" />
          <span className="widget-title">
            {view === 'week'
              ? `KW ${kw} · ${format(weekStart, 'dd.MM')}–${format(addDays(weekStart, 6), 'dd.MM.yyyy')}`
              : format(current, 'MMMM yyyy', { locale: de })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={goToday} className="text-[10px] px-2 py-0.5 rounded bg-[#1e2035] text-slate-500 hover:text-slate-300 transition-colors">
            Heute
          </button>
          <button onClick={() => setView(v => v === 'week' ? 'month' : 'week')}
            className="p-1 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a] transition-colors" title="Ansicht wechseln">
            {view === 'week' ? <LayoutGrid size={13} /> : <AlignLeft size={13} />}
          </button>
          <button onClick={prev} className="p-1 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a] transition-colors">
            <ChevronLeft size={14} />
          </button>
          <button onClick={next} className="p-1 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a] transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="widget-body">
        {view === 'week' ? (
          <div className="space-y-3">
            {/* Wochentag-Streifen */}
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day, i) => {
                const dayEvents = getEventsForDay(day)
                const today = isToday(day)
                return (
                  <div key={i} className={`flex flex-col items-center p-1.5 rounded-xl transition-colors
                    ${today ? 'bg-indigo-600/20 ring-1 ring-indigo-500/40' : 'hover:bg-[#1e2035]'}`}>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">
                      {format(day, 'EEEEE', { locale: de })}
                    </span>
                    <span className={`text-sm font-bold mt-0.5 ${today ? 'text-indigo-300' : 'text-slate-300'}`}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                      {dayEvents.slice(0, 3).map((e, j) => (
                        <div key={j} className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: e.color || '#6366f1' }} title={e.title} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Termine der Woche */}
            {byDay.length === 0 ? (
              <div className="text-center text-slate-600 text-sm py-4">Keine Termine diese Woche</div>
            ) : (
              <div className="space-y-3">
                {byDay.map(({ day, events: dayEvs }) => (
                  <div key={day.toISOString()}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-semibold ${isToday(day) ? 'text-indigo-400' : 'text-slate-400'}`}>
                        {isToday(day) ? 'Heute' : format(day, 'EEEE, dd.MM.', { locale: de })}
                      </span>
                      <div className="flex-1 h-px bg-[#2a2d4a]" />
                    </div>
                    <div className="space-y-1.5">
                      {dayEvs.map(e => {
                        const sameDay = format(parseISO(e.start_datetime), 'dd.MM') === format(parseISO(e.end_datetime), 'dd.MM')
                        return (
                          <div key={e.id} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                              style={{ backgroundColor: e.color || '#6366f1' }} />
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-white">{e.title}</span>
                              <div className="text-xs text-slate-400 flex items-center gap-1 flex-wrap">
                                <span>{format(parseISO(e.start_datetime), 'HH:mm')}</span>
                                <span className="text-slate-600">–</span>
                                <span>{sameDay ? format(parseISO(e.end_datetime), 'HH:mm') : format(parseISO(e.end_datetime), 'dd.MM HH:mm')}</span>
                                {e.description && <><span className="text-slate-600">·</span><span className="text-slate-500 truncate">{e.description}</span></>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Monatsansicht */
          <div>
            <div className="grid grid-cols-7 mb-1">
              {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-slate-500 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {monthDays.map((day, i) => {
                const dayEvents = getEventsForDay(day)
                const inMonth = isSameMonth(day, current)
                const today = isToday(day)
                return (
                  <div key={i} className={`relative min-h-[36px] p-1 rounded-lg text-center transition-colors
                    ${inMonth ? 'text-slate-300' : 'text-slate-700'}
                    ${today ? 'bg-indigo-600/20 ring-1 ring-indigo-500/50' : 'hover:bg-[#1e2035]'}`}>
                    <span className={`text-xs font-medium ${today ? 'text-indigo-400' : ''}`}>{format(day, 'd')}</span>
                    <div className="flex flex-wrap gap-px justify-center mt-0.5">
                      {dayEvents.slice(0, 2).map((e, j) => (
                        <div key={j} className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: e.color || '#6366f1' }} title={e.title} />
                      ))}
                      {dayEvents.length > 2 && <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
                    </div>
                  </div>
                )
              })}
            </div>

            {upcomingEvents.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-[#2a2d4a] pt-3">
                {upcomingEvents.map(e => {
                  const sameDay = format(parseISO(e.start_datetime), 'dd.MM') === format(parseISO(e.end_datetime), 'dd.MM')
                  return (
                    <div key={e.id} className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: e.color || '#6366f1' }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white">{e.title}</div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 flex-wrap">
                          <span>{format(parseISO(e.start_datetime), 'dd.MM HH:mm')}</span>
                          <span className="text-slate-600">{sameDay ? '–' : '→'}</span>
                          <span>{sameDay ? format(parseISO(e.end_datetime), 'HH:mm') : format(parseISO(e.end_datetime), 'dd.MM HH:mm')}</span>
                          {e.description && <><span className="text-slate-600">·</span><span className="text-slate-500 truncate">{e.description}</span></>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
