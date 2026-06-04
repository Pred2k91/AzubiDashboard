import { useState, useEffect, useCallback } from 'react'
import { Megaphone, CalendarDays, AlertTriangle, Info, Clock, ArrowRightLeft, ChevronLeft, ChevronRight, Cake } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { announcementsApi, azubisApi, settingsApi } from '../../api/client'

const BIRTHDAY_WINDOW = 30 // Tage im Voraus anzeigen

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
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{days === 0 ? 'Heute!' : `${days} Tage`}</span>
}

export default function AnnouncementsWidget() {
  const [items, setItems] = useState([])
  const [rotation, setRotation] = useState(null)
  const [birthdays, setBirthdays] = useState([])
  const [sectionIdx, setSectionIdx] = useState(0)
  const [visible, setVisible] = useState(true)
  const [sectionInterval, setSectionInterval] = useState(8000)

  const loadData = () => {
    announcementsApi.getActive().then(setItems).catch(() => {})
    azubisApi.getNextRotation().then(setRotation).catch(() => {})
    azubisApi.getBirthdays().then(setBirthdays).catch(() => {})
  }

  useEffect(() => {
    settingsApi.getAll().then(s => {
      if (s.announcement_interval) setSectionInterval(s.announcement_interval)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const exams = items.filter(i => i.type === 'exam')
  const announcements = items.filter(i => i.type === 'announcement')
  const hasRotation = rotation?.scheduled

  const PAGE_SIZE = 3

  const chunk = (arr, size) => {
    const pages = []
    for (let i = 0; i < arr.length; i += size) pages.push(arr.slice(i, i + size))
    return pages
  }

  const examPages = chunk(exams, PAGE_SIZE)
  const announcementPages = chunk(announcements, PAGE_SIZE)
  const birthdayPages = chunk(birthdays, PAGE_SIZE)

  const sections = [
    ...examPages.map((page, i) => ({
      key: 'exams',
      label: examPages.length > 1 ? `Prüfungen ${i + 1}/${examPages.length}` : 'Prüfungen',
      icon: CalendarDays,
      content: page,
    })),
    ...announcementPages.map((page, i) => ({
      key: 'announcements',
      label: announcementPages.length > 1 ? `Ankündigungen ${i + 1}/${announcementPages.length}` : 'Ankündigungen',
      icon: Megaphone,
      content: page,
    })),
    ...birthdayPages.map((page, i) => ({
      key: 'birthdays',
      label: birthdayPages.length > 1 ? `Geburtstage ${i + 1}/${birthdayPages.length}` : 'Geburtstage',
      icon: Cake,
      content: page,
    })),
    hasRotation && { key: 'rotation', label: 'Abteilungswechsel', icon: ArrowRightLeft, rotation },
  ].filter(Boolean)

  const total = sections.length

  const goTo = useCallback((idx) => {
    setVisible(false)
    setTimeout(() => {
      setSectionIdx(idx)
      setVisible(true)
    }, 200)
  }, [])

  // Auto-rotate
  useEffect(() => {
    if (total <= 1) return
    const interval = setInterval(() => {
      goTo((sectionIdx + 1) % total)
    }, sectionInterval)
    return () => clearInterval(interval)
  }, [sectionIdx, total, goTo])

  // Reset index if sections change
  useEffect(() => {
    if (sectionIdx >= total && total > 0) setSectionIdx(0)
  }, [total])

  const current = sections[sectionIdx]

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div className="flex items-center gap-2">
          {current ? <current.icon size={14} className="text-indigo-400" /> : <Megaphone size={14} className="text-indigo-400" />}
          <span className="widget-title">{current?.label || 'Schwarzes Brett'}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Dots */}
          {total > 1 && (
            <div className="flex items-center gap-1">
              {sections.map((_, i) => (
                <button key={i} onClick={() => goTo(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === sectionIdx ? 'bg-indigo-400 w-3' : 'bg-slate-600 hover:bg-slate-400'}`}
                />
              ))}
            </div>
          )}
          {/* Prev/Next */}
          {total > 1 && (
            <div className="flex gap-0.5">
              <button onClick={() => goTo((sectionIdx - 1 + total) % total)}
                className="p-1 rounded text-slate-600 hover:text-slate-300 transition-colors">
                <ChevronLeft size={12} />
              </button>
              <button onClick={() => goTo((sectionIdx + 1) % total)}
                className="p-1 rounded text-slate-600 hover:text-slate-300 transition-colors">
                <ChevronRight size={12} />
              </button>
            </div>
          )}
          <span className="text-xs text-slate-500 bg-[#1e2035]/60 px-2 py-0.5 rounded-full">
            {total === 0 ? 0 : current?.key === 'rotation' ? rotation.departments.length : current.content?.length ?? 0}
          </span>
        </div>
      </div>

      <div className="widget-body" style={{ transition: 'opacity 0.2s ease', opacity: visible ? 1 : 0 }}>
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-600 h-full">
            <Megaphone size={24} className="mb-2 opacity-30" />
            <span className="text-sm">Keine Einträge</span>
          </div>
        ) : current?.key === 'exams' ? (
          <div className="space-y-2">
            {current.content.map(item => (
              <div key={item.id} className="p-3 rounded-xl border bg-[#1e2035]/50" style={{ borderColor: `${item.color}40` }}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-white leading-tight">{item.title}</span>
                  {item.date && <CountdownBadge date={item.date} />}
                </div>
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
                {item.content && <p className="text-xs text-slate-400 mt-1">{item.content}</p>}
              </div>
            ))}
          </div>
        ) : current?.key === 'announcements' ? (
          <div className="space-y-2">
            {current.content.map(item => {
              const p = PRIORITY[item.priority] || PRIORITY.normal
              const Icon = p.icon
              return (
                <div key={item.id} className={`p-3 rounded-xl border ${p.bg} ${p.border}`}>
                  <div className="flex items-start gap-2">
                    <Icon size={14} className={`${p.text} shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{item.title}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${p.text} ${p.bg}`}>{p.label}</span>
                      </div>
                      {item.content && <p className="text-xs text-slate-400 mt-1">{item.content}</p>}
                      {item.date && <p className="text-[10px] text-slate-600 mt-1">bis {format(parseISO(item.date), 'dd.MM.yyyy', { locale: de })}</p>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : current?.key === 'birthdays' ? (
          <div className="space-y-2">
            {current.content.map(b => {
              const isToday = b.days_until === 0
              const isTomorrow = b.days_until === 1
              const isSoon = b.days_until <= 7
              return (
                <div key={b.id} className={`p-3 rounded-xl border flex items-center gap-3 ${
                  isToday ? 'bg-yellow-500/15 border-yellow-500/40' :
                  isSoon  ? 'bg-indigo-500/10 border-indigo-500/20' :
                            'bg-[#1e2035]/50 border-[#2a2d4a]'
                }`}>
                  <div className={`text-2xl ${isToday ? '' : 'opacity-70'}`}>🎂</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{b.name}</span>
                      {isToday && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">Heute! 🎉</span>}
                      {isTomorrow && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Morgen</span>}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{format(new Date(new Date().getFullYear() + (b.days_until < 0 ? 1 : 0), new Date(b.birthday).getMonth(), new Date(b.birthday).getDate()), 'dd. MMMM', { locale: de })}</span>
                      {!isToday && !isTomorrow && <><span className="text-slate-600">·</span><span className="text-slate-500">in {b.days_until} Tagen</span></>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : current?.key === 'rotation' ? (
          <div className="space-y-3">
            {/* Countdown */}
            {(() => {
              const days = differenceInDays(parseISO(rotation.date), new Date())
              const cls = days <= 7 ? 'text-red-400 bg-red-500/10 border-red-500/30'
                        : days <= 30 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                        : 'text-green-400 bg-green-500/10 border-green-500/30'
              return (
                <div className={`rounded-xl border p-3 text-center ${cls}`}>
                  <div className="flex items-center justify-center gap-2 mb-0.5">
                    <CalendarDays size={13} />
                    <span className="text-sm font-semibold text-white">
                      Ab {format(parseISO(rotation.date), 'dd. MMMM yyyy', { locale: de })}
                    </span>
                  </div>
                  <div className={`text-2xl font-extrabold`}>
                    {days === 0 ? 'Heute!' : days === 1 ? 'Morgen!' : `${days} Tage`}
                  </div>
                </div>
              )
            })()}
            {/* Abteilungen */}
            <div className="space-y-1.5">
              {rotation.departments.map(dept => (
                <div key={dept.id} className="p-2.5 rounded-xl border bg-[#1e2035]/50" style={{ borderColor: `${dept.color}40` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dept.color }} />
                    <span className="text-sm font-bold text-white truncate">{dept.name}</span>
                    <span className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: `${dept.color}20`, color: dept.color }}>{dept.azubis.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {dept.azubis.map(a => (
                      <span key={a.id} className="text-[10px] px-1.5 py-0.5 rounded-full text-slate-300"
                        style={{ backgroundColor: `${dept.color}15` }}>
                        {a.name.split(' ')[0]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
