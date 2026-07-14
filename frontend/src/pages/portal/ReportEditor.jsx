import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Send, Save } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { reportEntriesApi } from '../../api/client'
import { DAY_TYPES, ABSENCE_TYPES } from '../../utils/reportDayTypes'

// Fasst die nicht-abwesenden Tage einer Woche zu EINEM Text/EINER Stundenzahl zusammen --
// Gegenstück zu handleSave's Verteilung auf den "Träger-Tag" beim Speichern.
function mergeWeekFields(days) {
  const working = days.filter(d => !ABSENCE_TYPES.includes(d.day_type))
  const text = working.map(d => d.activities_text).filter(Boolean).join('\n')
  const anyHours = working.some(d => d.hours != null)
  const hours = anyHours ? working.reduce((s, d) => s + (Number(d.hours) || 0), 0) : ''
  return { text, hours: anyHours ? String(hours) : '' }
}

export default function ReportEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [entry, setEntry] = useState(null)
  const [days, setDays] = useState([])
  const [weekText, setWeekText] = useState('')
  const [weekHours, setWeekHours] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = () => reportEntriesApi.getMineOne(id).then(e => {
    setEntry(e)
    setDays(e.days.map(d => ({ ...d })))
    if (e.period_type === 'week') {
      const merged = mergeWeekFields(e.days)
      setWeekText(merged.text)
      setWeekHours(merged.hours)
    }
  }).catch(() => setError('Bericht konnte nicht geladen werden'))

  useEffect(() => { load() }, [id])

  if (!entry) {
    return <div className="p-6 text-slate-500 text-sm">{error || 'Lädt...'}</div>
  }

  const editable = entry.status === 'draft' || entry.status === 'rejected'

  const updateDay = (date, field, value) => {
    setDays(prev => prev.map(d => d.date === date ? { ...d, [field]: value } : d))
  }

  const handleSave = async (submit) => {
    setError('')
    setLoading(true)
    try {
      let payload
      if (entry.period_type === 'week') {
        // EIN gemeinsames Eingabefeld für die ganze Woche -- der Inhalt wird beim
        // Speichern in den ersten nicht-abwesenden Tag geschrieben (die anderen
        // bleiben leer), damit Export/Prüfung weiterhin pro Tag Daten lesen können.
        const workingDates = days.filter(d => !ABSENCE_TYPES.includes(d.day_type)).map(d => d.date)
        const carrierDate = workingDates[0]
        const hoursValue = weekHours === '' || weekHours == null ? null : parseFloat(weekHours)
        payload = days.map(d => {
          if (ABSENCE_TYPES.includes(d.day_type)) return { date: d.date, day_type: d.day_type, activities_text: '', hours: null }
          if (d.date === carrierDate) return { date: d.date, day_type: d.day_type, activities_text: weekText, hours: hoursValue }
          return { date: d.date, day_type: d.day_type, activities_text: '', hours: null }
        })
      } else {
        payload = days.map(d => ({
          date: d.date,
          day_type: d.day_type,
          activities_text: d.activities_text,
          hours: d.hours === '' || d.hours == null ? null : parseFloat(d.hours),
        }))
      }
      const updated = await reportEntriesApi.update(entry.id, payload, submit)
      setEntry(updated)
      setDays(updated.days.map(d => ({ ...d })))
      if (updated.period_type === 'week') {
        const merged = mergeWeekFields(updated.days)
        setWeekText(merged.text)
        setWeekHours(merged.hours)
      }
      if (submit) navigate('/portal/report')
    } catch (err) {
      setError(err.response?.data?.error || 'Speichern fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Link to="/portal/report" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300">
        <ArrowLeft size={13} />
        Zurück zur Übersicht
      </Link>

      <div>
        <h1 className="text-xl font-bold text-white">
          {entry.period_type === 'day'
            ? format(parseISO(entry.period_start), 'EEEE, dd.MM.yyyy', { locale: de })
            : `${format(parseISO(entry.period_start), 'dd.MM.', { locale: de })} – ${format(parseISO(entry.period_end), 'dd.MM.yyyy', { locale: de })}`}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{entry.lehrjahr}. Lehrjahr</p>
      </div>

      {entry.status === 'rejected' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
          <strong className="block mb-1">Abgelehnt — bitte überarbeiten:</strong>
          {entry.review_comment}
        </div>
      )}

      {!editable && (
        <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4 text-sm text-slate-400">
          Dieser Bericht wurde bereits {entry.status === 'submitted' ? 'eingereicht' : 'freigegeben'} und kann nicht mehr bearbeitet werden.
        </div>
      )}

      {entry.period_type === 'week' ? (
        <div className="space-y-3">
          <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4 space-y-3">
            <div className="text-sm font-semibold text-white">Wochentage</div>
            <div className="grid grid-cols-5 gap-2">
              {days.map(d => (
                <div key={d.date}>
                  <label className="label truncate" title={format(parseISO(d.date), 'EEEE, dd.MM.', { locale: de })}>
                    {format(parseISO(d.date), 'EEE dd.MM.', { locale: de })}
                  </label>
                  <select
                    className="input-field text-xs py-1.5 px-1"
                    value={d.day_type}
                    disabled={!editable}
                    onChange={e => updateDay(d.date, 'day_type', e.target.value)}
                  >
                    {DAY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {days.some(d => !ABSENCE_TYPES.includes(d.day_type)) && (
            <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4">
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <div>
                  <label className="label">Tätigkeiten / Berufsschulthemen der Woche</label>
                  <textarea
                    className="input-field text-sm"
                    rows={8}
                    disabled={!editable}
                    value={weekText}
                    onChange={e => setWeekText(e.target.value)}
                    placeholder="Stichwortartig, eine Zeile je Tätigkeit..."
                  />
                </div>
                <div>
                  <label className="label">Stunden (gesamt)</label>
                  <input
                    type="number" step="0.5" min="0" max="60"
                    className="input-field text-sm"
                    disabled={!editable}
                    value={weekHours}
                    onChange={e => setWeekHours(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {days.map(d => (
            <div key={d.date} className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-white">
                  {format(parseISO(d.date), 'EEEE, dd.MM.yyyy', { locale: de })}
                </span>
                <select
                  className="input-field w-40 text-xs py-1.5"
                  value={d.day_type}
                  disabled={!editable}
                  onChange={e => updateDay(d.date, 'day_type', e.target.value)}
                >
                  {DAY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {!ABSENCE_TYPES.includes(d.day_type) && (
                <div className="grid grid-cols-[1fr_100px] gap-3">
                  <div>
                    <label className="label">Tätigkeiten / Berufsschulthema</label>
                    <textarea
                      className="input-field text-sm"
                      rows={2}
                      disabled={!editable}
                      value={d.activities_text || ''}
                      onChange={e => updateDay(d.date, 'activities_text', e.target.value)}
                      placeholder="Stichwortartig..."
                    />
                  </div>
                  <div>
                    <label className="label">Stunden</label>
                    <input
                      type="number" step="0.5" min="0" max="24"
                      className="input-field text-sm"
                      disabled={!editable}
                      value={d.hours ?? ''}
                      onChange={e => updateDay(d.date, 'hours', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {editable && (
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => handleSave(false)} disabled={loading}>
            <Save size={14} />
            Als Entwurf speichern
          </button>
          <button className="btn-primary" onClick={() => handleSave(true)} disabled={loading}>
            <Send size={14} />
            Einreichen
          </button>
        </div>
      )}
    </div>
  )
}
