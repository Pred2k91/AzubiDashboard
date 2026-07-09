import { useState, useEffect } from 'react'
import { BookOpen, CheckCircle, AlertTriangle, Clock, Calendar, Search, Mail, AlertOctagon } from 'lucide-react'
import { format, parseISO, getISOWeek } from 'date-fns'
import { de } from 'date-fns/locale'
import { reportsApi, settingsApi } from '../../api/client'
import { buildReminderMail, buildEscalationMail, buildMailtoUrl } from '../../utils/reportMailTemplates'

const STATUS_CONFIG = {
  ok:    { label: 'Aktuell',    icon: CheckCircle,  cls: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
  warn:  { label: 'Überfällig', icon: AlertTriangle, cls: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  alert: { label: 'Kritisch',   icon: AlertTriangle, cls: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20' },
}

export default function ReportsAdmin() {
  const [data, setData] = useState({ azubis: [], warn: 14, alert: 28 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState({})
  const [rowDates, setRowDates] = useState({})
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [selected, setSelected] = useState(new Set())
  const [trainerName, setTrainerName] = useState('')
  const [mailTemplates, setMailTemplates] = useState({})

  const today = new Date().toISOString().slice(0, 10)
  const getRowDate = (id) => rowDates[id] ?? today

  const load = () => reportsApi.getStatus().then(setData).catch(() => {})
  useEffect(() => {
    load()
    settingsApi.getAll().then(s => {
      if (s.trainer_name) setTrainerName(s.trainer_name)
      setMailTemplates({
        reminderSubject: s.report_reminder_subject,
        reminderBody: s.report_reminder_body,
        escalationSubject: s.report_escalation_subject,
        escalationBody: s.report_escalation_body,
      })
    }).catch(() => {})
  }, [])

  const handleSendMail = (azubi, type) => {
    if (!azubi.email) return
    const mail = type === 'escalation'
      ? buildEscalationMail(azubi, { trainerName, subjectTemplate: mailTemplates.escalationSubject, bodyTemplate: mailTemplates.escalationBody })
      : buildReminderMail(azubi, { trainerName, subjectTemplate: mailTemplates.reminderSubject, bodyTemplate: mailTemplates.reminderBody })
    window.location.href = buildMailtoUrl(azubi.email, mail)
  }

  const handleMark = async (id) => {
    setLoading(l => ({ ...l, [id]: true }))
    await reportsApi.markSubmitted(id, getRowDate(id))
    await load()
    setLoading(l => ({ ...l, [id]: false }))
  }

  const handleBulk = async () => {
    if (!selected.size) return
    await reportsApi.markBulk([...selected], selectedDate)
    setSelected(new Set())
    await load()
  }

  const toggleSelect = (id) => setSelected(s => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const filtered = data.azubis.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  const counts = {
    ok: data.azubis.filter(a => a.status === 'ok').length,
    warn: data.azubis.filter(a => a.status === 'warn').length,
    alert: data.azubis.filter(a => a.status === 'alert').length,
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen size={20} className="text-indigo-400" />
            Berichtshefte
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Einreichung mindestens alle {data.warn} Tage erwartet
          </p>
        </div>
      </div>

      {/* Statusübersicht */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'ok', label: 'Aktuell', color: 'text-green-400', bg: 'bg-green-500/10' },
          { key: 'warn', label: 'Überfällig', color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { key: 'alert', label: 'Kritisch', color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map(s => (
          <div key={s.key} className={`${s.bg} rounded-xl p-4 text-center border border-[#2a2d4a]`}>
            <div className={`text-3xl font-bold ${s.color}`}>{counts[s.key]}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bulk-Aktion */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input className="input-field pl-8" placeholder="Azubi suchen..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="label mb-0 text-slate-500">Datum:</label>
          <input type="date" className="input-field w-40" value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)} />
        </div>
        {selected.size > 0 && (
          <button className="btn-primary" onClick={handleBulk}>
            <CheckCircle size={14} />
            {selected.size} markieren
          </button>
        )}
        {selected.size > 0 && (
          <button className="btn-secondary text-xs" onClick={() => setSelected(new Set())}>
            Auswahl aufheben
          </button>
        )}
      </div>

      {/* Azubi-Tabelle */}
      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a]">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8">
                <input type="checkbox" className="accent-indigo-600"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={e => setSelected(e.target.checked ? new Set(filtered.map(a => a.id)) : new Set())} />
              </th>
              <th>Azubi</th>
              <th>Letzter Bericht</th>
              <th>Offen seit</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-600 py-10">Keine Azubis gefunden</td></tr>
            ) : filtered.map(a => {
              const s = STATUS_CONFIG[a.status]
              const Icon = s.icon
              return (
                <tr key={a.id} className={selected.has(a.id) ? 'bg-indigo-600/5' : ''}>
                  <td>
                    <input type="checkbox" className="accent-indigo-600"
                      checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-purple-600/20 text-purple-300 shrink-0">
                        {a.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-white">{a.name}</div>
                        <div className="text-xs text-slate-600">{a.lehrjahr}. Lehrjahr</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {a.last_report_date ? (
                      <div>
                        <div className="text-sm text-slate-300">
                          {format(parseISO(a.last_report_date), 'dd.MM.yyyy', { locale: de })}
                        </div>
                        <div className="text-xs text-slate-600">
                          KW {getISOWeek(parseISO(a.last_report_date))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600 text-sm">Noch nicht eingetragen</span>
                    )}
                  </td>
                  <td>
                    {a.days != null ? (
                      <span className={`text-sm font-semibold ${s.cls}`}>
                        {a.days === 0 ? 'Heute' : `${a.days} Tage`}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-sm">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border w-fit ${s.bg} ${s.cls}`}>
                      <Icon size={11} />
                      {s.label}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        className="input-field text-xs py-1 w-32"
                        value={getRowDate(a.id)}
                        onChange={e => setRowDates(d => ({ ...d, [a.id]: e.target.value }))}
                      />
                      <button
                        onClick={() => handleMark(a.id)}
                        disabled={loading[a.id]}
                        className="btn-secondary text-xs py-1.5 shrink-0"
                      >
                        <CheckCircle size={13} />
                        {loading[a.id] ? '...' : 'Eingereicht'}
                      </button>
                      {a.status !== 'ok' && (
                        <>
                          <button
                            onClick={() => handleSendMail(a, 'reminder')}
                            disabled={!a.email}
                            title={a.email ? 'Erinnerungsmail öffnen' : 'Keine E-Mail-Adresse hinterlegt'}
                            className="btn-secondary text-xs py-1.5 px-2 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Mail size={13} />
                          </button>
                          <button
                            onClick={() => handleSendMail(a, 'escalation')}
                            disabled={!a.email}
                            title={a.email ? 'Eskalationsmail öffnen' : 'Keine E-Mail-Adresse hinterlegt'}
                            className="btn-danger text-xs py-1.5 px-2 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <AlertOctagon size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
