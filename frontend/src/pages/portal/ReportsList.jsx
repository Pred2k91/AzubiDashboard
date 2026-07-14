import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, CheckCircle, AlertTriangle, Clock, Pencil } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { reportEntriesApi } from '../../api/client'

const STATUS_CONFIG = {
  draft:     { label: 'Entwurf',     icon: Pencil,       cls: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
  submitted: { label: 'Eingereicht', icon: Clock,        cls: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  approved:  { label: 'Freigegeben', icon: CheckCircle,  cls: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  rejected:  { label: 'Abgelehnt',   icon: AlertTriangle, cls: 'text-red-400',  bg: 'bg-red-500/10 border-red-500/20' },
}

// Client-seitig nur zur Anzeige/Vorauswahl — die Berechnung des tatsächlichen
// Zeitraums erfolgt maßgeblich serverseitig beim Anlegen.
function mondayOf(dateStr) {
  const d = new Date(dateStr)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

export default function ReportsList() {
  const navigate = useNavigate()
  const [data, setData] = useState({ linked: true, report_period: 'week', entries: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = () => reportEntriesApi.getMine().then(setData).catch(() => {})

  useEffect(() => { load() }, [])

  const today = new Date().toISOString().slice(0, 10)
  const currentPeriodStart = data.report_period === 'day' ? today : mondayOf(today)
  const currentEntry = data.entries.find(e => e.period_start === currentPeriodStart)

  const handleNew = async () => {
    setError('')
    if (currentEntry) { navigate(`/portal/report/${currentEntry.id}`); return }
    setLoading(true)
    try {
      const entry = await reportEntriesApi.create(today)
      navigate(`/portal/report/${entry.id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Anlegen fehlgeschlagen')
    } finally {
      setLoading(false)
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen size={20} className="text-indigo-400" />
            Mein Berichtsheft
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {data.report_period === 'day' ? 'Tagesbericht' : 'Wochenbericht'}
          </p>
        </div>
        <button className="btn-primary" onClick={handleNew} disabled={loading}>
          <Plus size={16} />
          {currentEntry ? 'Aktuellen Bericht öffnen' : (loading ? 'Anlegen...' : 'Neuer Bericht')}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] divide-y divide-[#2a2d4a]">
        {data.entries.length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-10">Noch keine Berichte angelegt</p>
        ) : data.entries.map(e => {
          const s = STATUS_CONFIG[e.status]
          const Icon = s.icon
          return (
            <button
              key={e.id}
              onClick={() => navigate(`/portal/report/${e.id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1e2035] transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">
                  {e.period_type === 'day'
                    ? format(parseISO(e.period_start), 'EEEE, dd.MM.yyyy', { locale: de })
                    : `${format(parseISO(e.period_start), 'dd.MM.', { locale: de })} – ${format(parseISO(e.period_end), 'dd.MM.yyyy', { locale: de })}`}
                </div>
                {e.status === 'rejected' && e.review_comment && (
                  <div className="text-xs text-red-400 mt-0.5 truncate">Kommentar: {e.review_comment}</div>
                )}
              </div>
              <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border shrink-0 ${s.bg} ${s.cls}`}>
                <Icon size={11} />
                {s.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
