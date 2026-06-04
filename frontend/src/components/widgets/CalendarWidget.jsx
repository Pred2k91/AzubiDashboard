import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, parseISO, isSameDay, addMonths, subMonths } from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { calendarApi } from '../../api/client'

export default function CalendarWidget() {
  const [current, setCurrent] = useState(new Date())
  const [events, setEvents] = useState([])

  const loadEvents = () => {
    const start = format(startOfMonth(current), 'yyyy-MM-dd')
    const end = format(endOfMonth(current), 'yyyy-MM-dd')
    calendarApi.getAll(start, end).then(setEvents).catch(() => {})
  }

  useEffect(() => {
    loadEvents()
    const interval = setInterval(loadEvents, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [current])

  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = []
  let d = calStart
  while (d <= calEnd) {
    days.push(d)
    d = addDays(d, 1)
  }

  const getEventsForDay = (day) =>
    events.filter(e => {
      const start = parseISO(e.start_datetime)
      const end = parseISO(e.end_datetime)
      return isSameDay(start, day) || (start <= day && end >= day)
    })

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-indigo-400" />
          <span className="widget-title">Kalender</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrent(subMonths(current, 1))}
            className="p-1 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a] transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-slate-300 font-medium min-w-[110px] text-center capitalize">
            {format(current, 'MMMM yyyy', { locale: de })}
          </span>
          <button
            onClick={() => setCurrent(addMonths(current, 1))}
            className="p-1 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a] transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="widget-body p-2">
        <div className="grid grid-cols-7 mb-1">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-slate-500 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px">
          {days.map((day, i) => {
            const dayEvents = getEventsForDay(day)
            const inMonth = isSameMonth(day, current)
            const today = isToday(day)
            return (
              <div
                key={i}
                className={`relative min-h-[36px] p-1 rounded-lg text-center transition-colors
                  ${inMonth ? 'text-slate-300' : 'text-slate-700'}
                  ${today ? 'bg-indigo-600/20 ring-1 ring-indigo-500/50' : 'hover:bg-[#1e2035]'}
                `}
              >
                <span className={`text-xs font-medium ${today ? 'text-indigo-400' : ''}`}>
                  {format(day, 'd')}
                </span>
                <div className="flex flex-wrap gap-px justify-center mt-0.5">
                  {dayEvents.slice(0, 2).map((e, j) => (
                    <div
                      key={j}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: e.color || '#6366f1' }}
                      title={e.title}
                    />
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600" title={`+${dayEvents.length - 2} mehr`} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {events.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-[#2a2d4a] pt-3">
            {events
              .filter(e => parseISO(e.start_datetime) >= startOfMonth(current))
              .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))
              .slice(0, 5)
              .map(e => {
                const sameDay = format(parseISO(e.start_datetime), 'dd.MM') === format(parseISO(e.end_datetime), 'dd.MM')
                return (
                  <div key={e.id} className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: e.color || '#6366f1' }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white truncate">{e.title}</div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                        <span className="shrink-0">
                          {format(parseISO(e.start_datetime), 'dd.MM HH:mm')}
                        </span>
                        {!sameDay && (
                          <>
                            <span className="text-slate-600">→</span>
                            <span className="shrink-0">{format(parseISO(e.end_datetime), 'dd.MM HH:mm')}</span>
                          </>
                        )}
                        {sameDay && (
                          <>
                            <span className="text-slate-600">–</span>
                            <span className="shrink-0">{format(parseISO(e.end_datetime), 'HH:mm')}</span>
                          </>
                        )}
                        {e.description && (
                          <span className="text-slate-500 truncate">· {e.description}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            }
          </div>
        )}
      </div>
    </div>
  )
}
