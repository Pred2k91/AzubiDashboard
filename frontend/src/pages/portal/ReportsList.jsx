import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, CheckCircle, AlertTriangle, Clock, Pencil, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { reportEntriesApi } from '../../api/client'
import { mondayOf, addDays } from '../../utils/reportDates'

const STATUS_CONFIG = {
  draft:     { label: 'In Erstellung', icon: Pencil,       cls: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
  submitted: { label: 'Eingereicht',   icon: Clock,        cls: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  approved:  { label: 'Freigegeben',   icon: CheckCircle,  cls: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  rejected:  { label: 'Abgelehnt',     icon: AlertTriangle, cls: 'text-red-400',  bg: 'bg-red-500/10 border-red-500/20' },
}

const CAL_STATUS_STYLE = {
  draft:        { cls: 'bg-slate-500/15 border-slate-500/40 text-slate-300',  label: 'In Erstellung' },
  submitted:    { cls: 'bg-amber-500/15 border-amber-500/40 text-amber-300',  label: 'Eingereicht' },
  approved:     { cls: 'bg-green-500/15 border-green-500/40 text-green-300', label: 'Freigegeben' },
  rejected:     { cls: 'bg-red-500/15 border-red-500/40 text-red-300',      label: 'Abgelehnt' },
  missing:      { cls: 'bg-transparent border-dashed border-slate-600 text-slate-500', label: 'Fehlt noch' },
  future:       { cls: 'bg-transparent border-transparent text-slate-800', label: '' },
  before_start: { cls: 'bg-transparent border-transparent text-slate-800', label: '' },
}

const MAX_MISSING_WEEKS = 400 // Sicherheitsgrenze (~7,7 Jahre) gegen einen fehlerhaften start_date

// Alle Wochen (Montage) von Ausbildungsbeginn bis einschließlich der aktuellen Woche.
function weeksSince(startDate, today) {
  if (!startDate) return []
  const weeks = []
  let cur = mondayOf(startDate)
  const end = mondayOf(today)
  while (cur <= end && weeks.length < MAX_MISSING_WEEKS) {
    weeks.push(cur)
    cur = addDays(cur, 7)
  }
  return weeks
}

function firstOfMonthStr(dateStr) {
  return dateStr.slice(0, 7) + '-01'
}

function addMonthsStr(monthStart, n) {
  const [y, m] = monthStart.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 10)
}

// Reihen (je eine Kalenderwoche) für die Monatsansicht: von Montag der Woche des
// Monatsersten bis Montag der Woche des Monatsletzten.
function buildCalendarWeeks(monthStart) {
  const [y, m] = monthStart.split('-').map(Number)
  const lastOfMonth = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const gridStart = mondayOf(monthStart)
  const gridEnd = mondayOf(lastOfMonth)
  const rows = []
  let cur = gridStart
  while (cur <= gridEnd) {
    rows.push(cur)
    cur = addDays(cur, 7)
  }
  return rows
}

function weekStatusFor(weekMonday, entryByWeek, rangeStartMonday, todayMonday) {
  const entry = entryByWeek.get(weekMonday)
  if (entry) return entry.status
  if (weekMonday > todayMonday) return 'future'
  if (rangeStartMonday && weekMonday < rangeStartMonday) return 'before_start'
  return 'missing'
}

export default function ReportsList() {
  const navigate = useNavigate()
  const [data, setData] = useState({ linked: true, report_period: 'week', start_date: null, entries: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openSections, setOpenSections] = useState({ missing: true, progress: true, done: false })
  const today = new Date().toISOString().slice(0, 10)
  const [calMonth, setCalMonth] = useState(firstOfMonthStr(today))

  const load = () => reportEntriesApi.getMine().then(setData).catch(() => {})

  useEffect(() => { load() }, [])

  // Übersicht in 3 Abschnitte: fehlende Wochen (noch kein Eintrag angelegt), Berichte
  // die noch Aktion brauchen (in Erstellung/eingereicht/abgelehnt) und fertige (freigegeben).
  const entryByWeek = new Map(data.entries.map(e => [e.period_start, e]))
  const missingWeeks = weeksSince(data.start_date, today).filter(w => !entryByWeek.has(w))
  const inProgressEntries = data.entries.filter(e => e.status !== 'approved')
  const doneEntries = data.entries.filter(e => e.status === 'approved')

  const toggleSection = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }))

  const createEntryFor = async (dateForWeek) => {
    setError('')
    setLoading(true)
    try {
      const entry = await reportEntriesApi.create(dateForWeek)
      navigate(`/portal/report/${entry.id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Anlegen fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  const selectWeek = (weekMonday) => {
    const existing = entryByWeek.get(weekMonday)
    if (existing) { navigate(`/portal/report/${existing.id}`); return }
    createEntryFor(weekMonday)
  }

  if (!data.linked) {
    return (
      <div className="p-6">
        <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-6 text-center text-slate-500">
          Dein Konto ist noch keinem Azubi-Datensatz zugeordnet. Bitte wende dich an deinen Ausbilder.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BookOpen size={20} className="text-indigo-400" />
          Mein Berichtsheft
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {data.report_period === 'day' ? 'Tagesbericht' : 'Wochenbericht'}
        </p>
      </div>

      <WeekCalendar
        calMonth={calMonth}
        onChangeMonth={setCalMonth}
        onToday={() => setCalMonth(firstOfMonthStr(today))}
        entryByWeek={entryByWeek}
        rangeStartMonday={data.start_date ? mondayOf(data.start_date) : null}
        todayMonday={mondayOf(today)}
        minYear={data.start_date ? Number(data.start_date.slice(0, 4)) : Number(today.slice(0, 4)) - 3}
        onSelectWeek={selectWeek}
        loading={loading}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}

      <ReportSection
        title="Fehlende Berichte"
        count={missingWeeks.length}
        open={openSections.missing}
        onToggle={() => toggleSection('missing')}
        emptyLabel="Keine fehlenden Berichte"
      >
        {missingWeeks.map(w => (
          <button
            key={w}
            onClick={() => createEntryFor(w)}
            disabled={loading}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1e2035] transition-colors text-left"
          >
            <div className="flex-1 min-w-0 text-sm font-medium text-white">
              {format(parseISO(w), 'dd.MM.', { locale: de })} – {format(parseISO(addDays(w, 4)), 'dd.MM.yyyy', { locale: de })}
            </div>
            <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border shrink-0 bg-red-500/10 border-red-500/20 text-red-400">
              <Plus size={11} />
              Anlegen
            </span>
          </button>
        ))}
      </ReportSection>

      <ReportSection
        title="In Erstellung"
        count={inProgressEntries.length}
        open={openSections.progress}
        onToggle={() => toggleSection('progress')}
        emptyLabel="Keine Berichte in Erstellung"
      >
        {inProgressEntries.map(e => <EntryRow key={e.id} entry={e} onClick={() => navigate(`/portal/report/${e.id}`)} />)}
      </ReportSection>

      <ReportSection
        title="Fertige Berichte"
        count={doneEntries.length}
        open={openSections.done}
        onToggle={() => toggleSection('done')}
        emptyLabel="Noch keine freigegebenen Berichte"
      >
        {doneEntries.map(e => <EntryRow key={e.id} entry={e} onClick={() => navigate(`/portal/report/${e.id}`)} />)}
      </ReportSection>
    </div>
  )
}

function ReportSection({ title, count, open, onToggle, emptyLabel, children }) {
  return (
    <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white hover:bg-[#1e2035] transition-colors"
      >
        <span className="flex items-center gap-2">
          {title}
          <span className="text-xs font-medium text-slate-500 bg-[#0d0f1a] border border-[#2a2d4a] rounded-full px-2 py-0.5">{count}</span>
        </span>
        {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>
      {open && (
        <div className="divide-y divide-[#2a2d4a] border-t border-[#2a2d4a]">
          {count === 0 ? (
            <p className="text-sm text-slate-600 text-center py-8">{emptyLabel}</p>
          ) : children}
        </div>
      )}
    </div>
  )
}

function EntryRow({ entry, onClick }) {
  const s = STATUS_CONFIG[entry.status]
  const Icon = s.icon
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1e2035] transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">
          {format(parseISO(entry.period_start), 'dd.MM.', { locale: de })} – {format(parseISO(entry.period_end), 'dd.MM.yyyy', { locale: de })}
        </div>
        {entry.status === 'rejected' && entry.review_comment && (
          <div className="text-xs text-red-400 mt-0.5 truncate">Kommentar: {entry.review_comment}</div>
        )}
      </div>
      <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border shrink-0 ${s.bg} ${s.cls}`}>
        <Icon size={11} />
        {s.label}
      </span>
    </button>
  )
}

const WEEKDAY_HEADERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

function WeekCalendar({ calMonth, onChangeMonth, onToday, entryByWeek, rangeStartMonday, todayMonday, minYear, onSelectWeek, loading }) {
  const weekRows = buildCalendarWeeks(calMonth)
  const monthKey = calMonth.slice(0, 7)
  const todayStr = new Date().toISOString().slice(0, 10)
  const calYear = Number(calMonth.slice(0, 4))
  const calMonthNum = Number(calMonth.slice(5, 7))
  const maxYear = Number(todayStr.slice(0, 4))
  const yearOptions = []
  for (let y = Math.min(minYear, maxYear); y <= maxYear; y++) yearOptions.push(y)

  const jumpTo = (year, monthNum) => onChangeMonth(`${year}-${String(monthNum).padStart(2, '0')}-01`)

  return (
    <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-3 max-w-md space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white shrink-0">Woche auswählen</h2>
        <button onClick={onToday} className="btn-secondary text-xs py-1 px-2">Heute</button>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={() => onChangeMonth(addMonthsStr(calMonth, -1))} className="p-1 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a] shrink-0">
          <ChevronLeft size={14} />
        </button>
        <select
          className="input-field text-xs py-1 flex-1"
          value={calMonthNum}
          onChange={e => jumpTo(calYear, Number(e.target.value))}
        >
          {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
        </select>
        <select
          className="input-field text-xs py-1 w-20"
          value={calYear}
          onChange={e => jumpTo(Number(e.target.value), calMonthNum)}
        >
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => onChangeMonth(addMonthsStr(calMonth, 1))} className="p-1 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a] shrink-0">
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
        {WEEKDAY_HEADERS.map(d => <div key={d}>{d}</div>)}
      </div>

      <div className="space-y-1">
        {weekRows.map(weekMonday => {
          const status = weekStatusFor(weekMonday, entryByWeek, rangeStartMonday, todayMonday)
          const style = CAL_STATUS_STYLE[status]
          const clickable = status !== 'future' && status !== 'before_start' && !loading
          return (
            <div key={weekMonday} className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i)).map(date => {
                const inMonth = date.slice(0, 7) === monthKey
                const isToday = date === todayStr
                return (
                  <button
                    key={date}
                    disabled={!clickable}
                    onClick={() => onSelectWeek(weekMonday)}
                    title={style.label}
                    className={`aspect-square rounded border text-[11px] flex items-center justify-center transition-opacity ${style.cls} ${!inMonth ? 'opacity-30' : ''} ${isToday ? 'ring-1 ring-indigo-400' : ''} ${clickable ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                  >
                    {Number(date.slice(8, 10))}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap pt-2 border-t border-[#2a2d4a] text-[11px] text-slate-500">
        {['missing', 'draft', 'submitted', 'approved', 'rejected'].map(key => (
          <span key={key} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded border ${CAL_STATUS_STYLE[key].cls}`} />
            {CAL_STATUS_STYLE[key].label}
          </span>
        ))}
      </div>
    </div>
  )
}
