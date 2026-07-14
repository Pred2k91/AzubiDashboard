import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, CheckCircle, AlertTriangle, Clock, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
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

export default function ReportsList() {
  const navigate = useNavigate()
  const [data, setData] = useState({ linked: true, report_period: 'week', start_date: null, entries: [] })
  const [pickDate, setPickDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openSections, setOpenSections] = useState({ missing: true, progress: true, done: false })

  const load = () => reportEntriesApi.getMine().then(setData).catch(() => {})

  useEffect(() => { load() }, [])

  const today = new Date().toISOString().slice(0, 10)
  // Berichte werden immer wochenweise geöffnet -- der Rhythmus entscheidet nur, wie
  // die Woche im Editor ausgefüllt wird (pro Tag einzeln vs. ein gemeinsames Feld).
  // <input type="date"> liefert beim Tippen zwischenzeitlich einen leeren String,
  // solange das Datum noch unvollständig ist -- erst validieren, sonst wirft
  // new Date('').toISOString() eine Exception und React blendet die ganze Seite aus.
  const hasValidPickDate = /^\d{4}-\d{2}-\d{2}$/.test(pickDate)
  const pickPeriodStart = hasValidPickDate ? mondayOf(pickDate) : null
  const pickPeriodEnd = pickPeriodStart ? addDays(pickPeriodStart, 4) : null
  const existingForPick = pickPeriodStart ? data.entries.find(e => e.period_start === pickPeriodStart) : null

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

  const handleCreateOrOpen = () => {
    if (!hasValidPickDate) return
    if (existingForPick) { navigate(`/portal/report/${existingForPick.id}`); return }
    createEntryFor(pickDate)
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

      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="label">Woche auswählen</label>
            <input
              type="date"
              className="input-field w-44"
              value={pickDate}
              max={today}
              min={data.start_date || undefined}
              onChange={e => setPickDate(e.target.value)}
            />
          </div>
          {pickPeriodStart && (
            <p className="text-xs text-slate-500 pb-2.5">
              → Woche vom {format(parseISO(pickPeriodStart), 'dd.MM.', { locale: de })} bis {format(parseISO(pickPeriodEnd), 'dd.MM.yyyy', { locale: de })}
            </p>
          )}
          <button className="btn-primary" onClick={handleCreateOrOpen} disabled={loading || !hasValidPickDate}>
            <Plus size={16} />
            {existingForPick ? 'Bericht öffnen' : (loading ? 'Anlegen...' : 'Bericht anlegen')}
          </button>
        </div>
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      </div>

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
