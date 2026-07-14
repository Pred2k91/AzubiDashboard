import { useState, useRef, useLayoutEffect } from 'react'
import {
  Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight,
  Settings, ArrowRight, RotateCcw, FileText, Mail, AlertOctagon,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { mondayOf, addDays } from '../../utils/reportDates'

const CELL_WIDTH = 44     // Breite je Wochen-Spalte (Button + Padding)
const FUTURE_WEEKS = 8    // wie weit in die Zukunft gerendert wird
const FUTURE_WEEKS_VISIBLE = 4 // wie viele davon initial sichtbar sein sollen
const FALLBACK_WEEKS_BACK = 104 // ~2 Jahre, falls kein Azubi ein start_date hat
const MAX_TOTAL_WEEKS = 300 // Sicherheitsgrenze (~5,7 Jahre) gegen fehlerhafte Datumswerte
const MOBILE_WEEKS_BACK = 20 // Mobile: schmaleres rollierendes Fenster je Azubi-Karte statt der vollen Zeitachse
const MOBILE_CELL_WIDTH = 36 // Breite je Wochen-Button (w-8 + gap) für die Scroll-Berechnung
// Desktop: Info-Spalte links und Wochen-Tabelle rechts sind bewusst zwei getrennte,
// nicht mit position:sticky verbundene Bereiche (siehe unten) — daher feste, exakt
// abgestimmte Zeilenhöhen statt automatischer Tabellen-Zeilensynchronisation.
const HEADER_ROW1_H = 28
const HEADER_ROW2_H = 28
const HEADER_TOTAL_H = HEADER_ROW1_H + HEADER_ROW2_H
const BODY_ROW_H = 84

const TIMELINE_STATUS = {
  not_due:     { label: '',                mark: '',  cls: 'bg-transparent border-transparent' },
  not_started: { label: 'Kein Bericht',    mark: '·', cls: 'bg-[#1e2035] border-[#2a2d4a] text-slate-700' },
  draft:       { label: 'In Erstellung',   mark: '…', cls: 'bg-slate-500/20 border-slate-500/40 text-slate-300' },
  submitted:   { label: 'Eingereicht',     mark: '→', cls: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
  approved:    { label: 'Freigegeben',     mark: '✓', cls: 'bg-green-500/20 border-green-500/40 text-green-300' },
  rejected:    { label: 'Abgelehnt',       mark: '↩', cls: 'bg-red-500/20 border-red-500/40 text-red-300' },
}

function weeksBetween(startMonday, endMonday) {
  const weeks = []
  let cur = startMonday
  while (cur <= endMonday) {
    weeks.push(cur)
    cur = addDays(cur, 7)
  }
  return weeks
}

function computeRangeStart(azubis, todayMonday) {
  const dates = azubis.map(a => a.start_date).filter(Boolean)
  if (!dates.length) return addDays(todayMonday, -7 * FALLBACK_WEEKS_BACK)
  return mondayOf(dates.reduce((min, d) => (d < min ? d : min)))
}

function groupWeeksByMonth(weeks) {
  const groups = []
  for (const w of weeks) {
    const d = parseISO(w)
    const key = format(d, 'yyyy-MM')
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.weeks.push(w)
    else groups.push({ key, year: format(d, 'yyyy'), label: format(d, 'MMMM', { locale: de }), weeks: [w] })
  }
  return groups
}

function groupMonthsByYear(monthGroups) {
  const groups = []
  for (const m of monthGroups) {
    const last = groups[groups.length - 1]
    if (last && last.year === m.year) last.months.push(m)
    else groups.push({ year: m.year, months: [m] })
  }
  return groups
}

export default function ReportsTimeline({ azubis, entries, reportsStatus, onSelectWeek, onSendMail }) {
  const [search, setSearch] = useState('')
  const [filterIssuesOnly, setFilterIssuesOnly] = useState(false)
  const [sortMode, setSortMode] = useState('name') // 'name' | 'issues'
  const scrollRef = useRef(null)
  const hasScrolledInitially = useRef(false)
  const mobileRowRefs = useRef({})

  const todayMonday = mondayOf(new Date().toISOString().slice(0, 10))
  const rangeStart = computeRangeStart(azubis, todayMonday)
  const rangeEnd = addDays(todayMonday, 7 * FUTURE_WEEKS)
  let weeks = weeksBetween(rangeStart, rangeEnd)
  if (weeks.length > MAX_TOTAL_WEEKS) weeks = weeks.slice(-MAX_TOTAL_WEEKS)
  const monthGroups = groupWeeksByMonth(weeks)
  const yearGroups = groupMonthsByYear(monthGroups)

  const todayIdx = weeks.indexOf(todayMonday)
  const mobileWeeks = todayIdx === -1 ? weeks : weeks.slice(Math.max(0, todayIdx - MOBILE_WEEKS_BACK))

  const scrollToToday = (behavior = 'auto') => {
    const el = scrollRef.current
    if (!el) return
    const idx = weeks.indexOf(todayMonday)
    if (idx === -1) return
    const target = (idx + 1) * CELL_WIDTH + FUTURE_WEEKS_VISIBLE * CELL_WIDTH - el.clientWidth
    el.scrollTo({ left: Math.round(Math.max(0, target)), behavior })
  }

  const scrollByScreen = (dir) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  // Einmalig auf "heute" springen, sobald echte Azubi-Daten geladen sind — nicht
  // bei jedem Re-Render, sonst würde jede Aktualisierung die Scroll-Position kappen.
  useLayoutEffect(() => {
    if (hasScrolledInitially.current || azubis.length === 0) return
    hasScrolledInitially.current = true
    scrollToToday('auto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [azubis.length])

  // Index einmal pro Render aufbauen statt bei jeder Zelle das gesamte Array zu filtern
  const byAzubiWeek = {}
  const byAzubi = {}
  for (const e of entries) {
    const weekKey = `${e.azubi_id}|${mondayOf(e.period_start)}`
    ;(byAzubiWeek[weekKey] ||= []).push(e)
    ;(byAzubi[e.azubi_id] ||= []).push(e)
  }

  const entriesFor = (azubiId, weekMonday) => byAzubiWeek[`${azubiId}|${weekMonday}`] || []

  const cellStatus = (azubiId, weekMonday) => {
    const mine = entriesFor(azubiId, weekMonday)
    if (mine.length) {
      if (mine.some(e => e.status === 'rejected')) return 'rejected'
      if (mine.some(e => e.status === 'draft')) return 'draft'
      if (mine.some(e => e.status === 'submitted')) return 'submitted'
      return 'approved'
    }
    return weekMonday > todayMonday ? 'not_due' : 'not_started'
  }

  const countsFor = (azubiId) => {
    const mine = byAzubi[azubiId] || []
    return {
      draft: mine.filter(e => e.status === 'draft').length,
      submitted: mine.filter(e => e.status === 'submitted').length,
      rejected: mine.filter(e => e.status === 'rejected').length,
      total: mine.length,
    }
  }

  const ampelFor = (azubiId) => (reportsStatus || []).find(r => r.id === azubiId)

  let visibleAzubis = azubis.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
  if (filterIssuesOnly) {
    visibleAzubis = visibleAzubis.filter(a => {
      const c = countsFor(a.id)
      return c.draft > 0 || c.submitted > 0 || c.rejected > 0
    })
  }
  visibleAzubis = [...visibleAzubis].sort((a, b) => {
    if (sortMode === 'name') return a.name.localeCompare(b.name)
    const ca = countsFor(a.id), cb = countsFor(b.id)
    return (cb.draft + cb.submitted + cb.rejected) - (ca.draft + ca.submitted + ca.rejected)
  })

  return (
    <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] space-y-3 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-white">Wochenübersicht</h2>
        <div className="hidden md:flex items-center gap-1.5">
          <button onClick={() => scrollByScreen(-1)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => scrollToToday('smooth')} className="btn-secondary text-xs py-1">Heute</button>
          <button onClick={() => scrollByScreen(1)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/*
        Desktop: Info-Spalte links ist eine eigene, NICHT scrollende Spalte — kein
        position:sticky. Ein sticky erster Tabellenspalte zeigte in der Praxis einen
        von Zoomstufe/Browser abhängigen Sub-Pixel-Versatz gegenüber den Wochenzellen
        (sichtbare Lücke zum Rahmen). Stattdessen: zwei unabhängige Bereiche mit exakt
        gleichen, fest definierten Zeilenhöhen (HEADER_*_H / BODY_ROW_H), sodass beide
        Seiten immer bündig sind — unabhängig von Sticky-Rundungsfehlern.
      */}
      <div className="hidden md:flex px-4 pb-4">
        <div className="w-72 min-w-[18rem] shrink-0 border-r border-[#2a2d4a]">
          <div style={{ height: HEADER_TOTAL_H }} className="flex flex-col justify-center gap-1.5 p-1 pr-3">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                className="input-field pl-7 text-xs py-1.5"
                placeholder="Azubi suchen..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFilterIssuesOnly(v => !v)}
                title="Nur Azubis mit offenen Punkten"
                className={`p-1.5 rounded border text-slate-500 hover:text-white ${filterIssuesOnly ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'border-[#2a2d4a]'}`}
              >
                <Filter size={12} />
              </button>
              <button
                onClick={() => setSortMode(m => m === 'name' ? 'issues' : 'name')}
                title={sortMode === 'name' ? 'Sortiert nach Name — klicken für offene Punkte' : 'Sortiert nach offenen Punkten — klicken für Name'}
                className="p-1.5 rounded border border-[#2a2d4a] text-slate-500 hover:text-white"
              >
                <ArrowUpDown size={12} />
              </button>
            </div>
          </div>

          {visibleAzubis.length === 0 ? (
            <div style={{ height: BODY_ROW_H }} className="flex items-center justify-center text-center text-slate-600 text-sm border-t border-[#2a2d4a]/50">
              Keine Azubis gefunden
            </div>
          ) : visibleAzubis.map(a => {
            const counts = countsFor(a.id)
            const ampel = ampelFor(a.id)
            const showMail = ampel && ampel.status !== 'ok' && ampel.email && onSendMail
            return (
              <div key={a.id} style={{ height: BODY_ROW_H }} className="flex items-start gap-2.5 p-2.5 pr-3 border-t border-[#2a2d4a]/50">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold bg-purple-600/20 text-purple-300 shrink-0">
                  {a.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">{a.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {a.start_date && format(parseISO(a.start_date), 'dd.MM.yyyy')}
                    {a.lehrjahr != null && ` (${a.lehrjahr}. AJ)`}
                    {a.department_name && ` · ${a.department_name}`}
                  </div>
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400" title="In Erstellung">
                      <Settings size={11} />{counts.draft}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-amber-400" title="Eingereicht">
                      <ArrowRight size={11} />{counts.submitted}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-red-400" title="Abgelehnt">
                      <RotateCcw size={11} />{counts.rejected}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-indigo-400" title="Gesamt">
                      <FileText size={11} />{counts.total}
                    </span>
                    {showMail && (
                      <span className="flex items-center gap-1 ml-auto shrink-0">
                        <button
                          onClick={() => onSendMail(ampel, 'reminder')}
                          title="Erinnerungsmail öffnen"
                          className="p-1 rounded text-slate-500 hover:text-amber-300 hover:bg-[#2a2d4a]"
                        >
                          <Mail size={12} />
                        </button>
                        <button
                          onClick={() => onSendMail(ampel, 'escalation')}
                          title="Eskalationsmail öffnen"
                          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-[#2a2d4a]"
                        >
                          <AlertOctagon size={12} />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div ref={scrollRef} className="overflow-x-auto flex-1 min-w-0">
          <table className="border-separate border-spacing-0 w-full">
            <thead>
              <tr style={{ height: HEADER_ROW1_H }}>
                {yearGroups.map(yg => (
                  <th
                    key={yg.year}
                    colSpan={yg.months.reduce((s, m) => s + m.weeks.length, 0)}
                    className="text-center text-sm text-slate-500 font-medium border-b border-[#2a2d4a]"
                  >
                    {yg.year}
                  </th>
                ))}
              </tr>
              <tr style={{ height: HEADER_ROW2_H }}>
                {monthGroups.map(mg => (
                  <th key={mg.key} colSpan={mg.weeks.length} className="text-center text-xs text-slate-400 font-medium whitespace-nowrap">
                    {mg.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleAzubis.length === 0 ? (
                <tr style={{ height: BODY_ROW_H }}><td colSpan={weeks.length} className="border-t border-[#2a2d4a]/50" /></tr>
              ) : visibleAzubis.map(a => (
                <tr key={a.id} style={{ height: BODY_ROW_H }}>
                  {weeks.map(w => {
                    const status = cellStatus(a.id, w)
                    const cfg = TIMELINE_STATUS[status]
                    const clickable = status !== 'not_due'
                    const isToday = w === todayMonday
                    return (
                      <td key={w} className={`text-center px-0.5 border-t border-[#2a2d4a]/50 ${isToday ? 'bg-indigo-500/5' : ''}`}>
                        <button
                          onClick={() => clickable && onSelectWeek(a.id, a.name, w)}
                          title={cfg.label}
                          className={`w-9 h-9 rounded-md border text-sm flex items-center justify-center mx-auto transition-opacity ${cfg.cls} ${clickable ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                        >
                          {cfg.mark}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: gestapelte Karten statt breiter Tabelle mit sticky Spalte — unterhalb von md */}
      <div className="md:hidden px-4 pb-4 space-y-1">
        <div className="space-y-1.5 pb-3">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              className="input-field pl-7 text-xs py-1.5"
              placeholder="Azubi suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterIssuesOnly(v => !v)}
              title="Nur Azubis mit offenen Punkten"
              className={`p-1.5 rounded border text-slate-500 hover:text-white ${filterIssuesOnly ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'border-[#2a2d4a]'}`}
            >
              <Filter size={12} />
            </button>
            <button
              onClick={() => setSortMode(m => m === 'name' ? 'issues' : 'name')}
              title={sortMode === 'name' ? 'Sortiert nach Name — tippen für offene Punkte' : 'Sortiert nach offenen Punkten — tippen für Name'}
              className="p-1.5 rounded border border-[#2a2d4a] text-slate-500 hover:text-white"
            >
              <ArrowUpDown size={12} />
            </button>
            <span className="text-[11px] text-slate-600 ml-1">Karten zeigen die letzten {MOBILE_WEEKS_BACK} Wochen, seitlich wischbar</span>
          </div>
        </div>

        {visibleAzubis.length === 0 ? (
          <div className="text-center text-slate-600 py-6 text-sm">Keine Azubis gefunden</div>
        ) : visibleAzubis.map(a => {
          const counts = countsFor(a.id)
          const ampel = ampelFor(a.id)
          const showMail = ampel && ampel.status !== 'ok' && ampel.email && onSendMail
          return (
            <div key={a.id} className="border-t border-[#2a2d4a]/50 py-3 first:border-t-0">
              <div className="flex items-start gap-2.5 mb-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold bg-purple-600/20 text-purple-300 shrink-0">
                  {a.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">{a.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {a.start_date && format(parseISO(a.start_date), 'dd.MM.yyyy')}
                    {a.lehrjahr != null && ` (${a.lehrjahr}. AJ)`}
                    {a.department_name && ` · ${a.department_name}`}
                  </div>
                  <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400" title="In Erstellung">
                      <Settings size={11} />{counts.draft}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-amber-400" title="Eingereicht">
                      <ArrowRight size={11} />{counts.submitted}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-red-400" title="Abgelehnt">
                      <RotateCcw size={11} />{counts.rejected}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-indigo-400" title="Gesamt">
                      <FileText size={11} />{counts.total}
                    </span>
                    {showMail && (
                      <span className="flex items-center gap-1 ml-auto shrink-0">
                        <button
                          onClick={() => onSendMail(ampel, 'reminder')}
                          title="Erinnerungsmail öffnen"
                          className="p-1 rounded text-slate-500 hover:text-amber-300 hover:bg-[#2a2d4a]"
                        >
                          <Mail size={12} />
                        </button>
                        <button
                          onClick={() => onSendMail(ampel, 'escalation')}
                          title="Eskalationsmail öffnen"
                          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-[#2a2d4a]"
                        >
                          <AlertOctagon size={12} />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div
                ref={el => {
                  mobileRowRefs.current[a.id] = el
                  if (el && !el.dataset.scrolled) {
                    el.dataset.scrolled = '1'
                    const idx = mobileWeeks.indexOf(todayMonday)
                    if (idx !== -1) el.scrollLeft = Math.max(0, (idx + 1) * MOBILE_CELL_WIDTH - el.clientWidth / 2)
                  }
                }}
                className="overflow-x-auto -mx-1"
              >
                <div className="flex gap-1 px-1">
                  {mobileWeeks.map(w => {
                    const status = cellStatus(a.id, w)
                    const cfg = TIMELINE_STATUS[status]
                    const clickable = status !== 'not_due'
                    const isToday = w === todayMonday
                    return (
                      <button
                        key={w}
                        onClick={() => clickable && onSelectWeek(a.id, a.name, w)}
                        title={cfg.label}
                        className={`w-8 h-8 shrink-0 rounded-md border text-sm flex items-center justify-center transition-opacity ${cfg.cls} ${isToday ? 'ring-1 ring-indigo-400' : ''} ${clickable ? 'active:opacity-70 cursor-pointer' : 'cursor-default'}`}
                      >
                        {cfg.mark}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 flex-wrap px-4 pb-4">
        {Object.values(TIMELINE_STATUS).filter(cfg => cfg.label).map(cfg => (
          <span key={cfg.label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${cfg.cls}`}>{cfg.mark}</span>
            {cfg.label}
          </span>
        ))}
      </div>
    </div>
  )
}
