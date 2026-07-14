import { useState, useEffect } from 'react'
import { CalendarDays, CheckSquare, StickyNote, Users, ArrowRight, UserPlus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { calendarApi, todosApi, notesApi, azubisApi } from '../../api/client'
import { format, parseISO, isAfter, startOfDay } from 'date-fns'
import { de } from 'date-fns/locale'
import Modal from '../../components/ui/Modal'

const EMPTY_AZUBI_FORM = { name: '', email: '', send_email: false }

export default function AdminOverview() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ events: 0, todos: 0, notes: 0, azubis: 0 })
  const [upcoming, setUpcoming] = useState([])
  const [openTodos, setOpenTodos] = useState([])
  const [newAzubiModal, setNewAzubiModal] = useState(false)
  const [azubiForm, setAzubiForm] = useState(EMPTY_AZUBI_FORM)
  const [azubiLoading, setAzubiLoading] = useState(false)
  const [revealPassword, setRevealPassword] = useState(null)

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    Promise.all([
      calendarApi.getAll(),
      todosApi.getAll(),
      notesApi.getAll(),
      azubisApi.getAll(),
    ]).then(([events, todos, notes, azubis]) => {
      setStats({
        events: events.length,
        todos: todos.filter(t => t.status !== 'done').length,
        notes: notes.length,
        azubis: azubis.length,
      })
      setUpcoming(
        events
          .filter(e => e.start_datetime >= today)
          .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))
          .slice(0, 5)
      )
      setOpenTodos(todos.filter(t => t.status !== 'done').slice(0, 5))
    }).catch(() => {})
  }, [])

  const openNewAzubi = () => { setAzubiForm(EMPTY_AZUBI_FORM); setNewAzubiModal(true) }

  const handleSaveAzubi = async () => {
    if (!azubiForm.name || !azubiForm.email) return
    setAzubiLoading(true)
    try {
      const created = await azubisApi.create(azubiForm)
      setNewAzubiModal(false)
      setStats(s => ({ ...s, azubis: s.azubis + 1 }))
      setRevealPassword({ email: created.email, password: created.generated_password, userId: created.user_id })
    } finally { setAzubiLoading(false) }
  }

  const closeRevealPassword = () => {
    const userId = revealPassword?.userId
    setRevealPassword(null)
    if (userId) navigate(`/admin/users/${userId}`)
  }

  const cards = [
    { label: 'Termine', value: stats.events, icon: CalendarDays, to: '/admin/calendar', color: '#6366f1' },
    { label: 'Offene Aufgaben', value: stats.todos, icon: CheckSquare, to: '/admin/todos', color: '#f59e0b' },
    { label: 'Notizen', value: stats.notes, icon: StickyNote, to: '/admin/notes', color: '#10b981' },
    { label: 'Aktive Azubis', value: stats.azubis, icon: Users, to: '/admin/azubis', color: '#8b5cf6' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Übersicht</h1>
          <p className="text-sm text-slate-500 mt-1">
            {format(new Date(), "EEEE, dd. MMMM yyyy", { locale: de })}
          </p>
        </div>
        <button className="btn-primary" onClick={openNewAzubi}>
          <UserPlus size={16} />
          Neuen Azubi anlegen
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, to, color }) => (
          <Link
            key={label}
            to={to}
            className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4 hover:border-indigo-500/30 transition-all group"
          >
            <div className="flex items-start justify-between">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${color}20` }}
              >
                <Icon size={18} style={{ color }} />
              </div>
              <ArrowRight size={14} className="text-slate-700 group-hover:text-slate-400 transition-colors" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <CalendarDays size={14} className="text-indigo-400" />
              Kommende Termine
            </h2>
            <Link to="/admin/calendar" className="text-xs text-indigo-400 hover:text-indigo-300">Alle</Link>
          </div>
          <div className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-4">Keine Termine</p>
            ) : upcoming.map(e => (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-[#2a2d4a]/50 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                <span className="text-xs text-slate-500 shrink-0 w-16">
                  {format(parseISO(e.start_datetime), 'dd.MM. HH:mm')}
                </span>
                <span className="text-sm text-slate-300 truncate">{e.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckSquare size={14} className="text-amber-400" />
              Offene Aufgaben
            </h2>
            <Link to="/admin/todos" className="text-xs text-indigo-400 hover:text-indigo-300">Alle</Link>
          </div>
          <div className="space-y-2">
            {openTodos.length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-4">Keine offenen Aufgaben</p>
            ) : openTodos.map(t => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-[#2a2d4a]/50 last:border-0">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  t.priority === 'high' ? 'bg-red-400' : t.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-500'
                }`} />
                <span className="text-sm text-slate-300 truncate flex-1">{t.title}</span>
                {t.due_date && (
                  <span className="text-xs text-slate-600 shrink-0">
                    {format(parseISO(t.due_date), 'dd.MM.')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={newAzubiModal} onClose={() => setNewAzubiModal(false)} title="Neuen Azubi anlegen">
        <div className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input-field" value={azubiForm.name} onChange={e => setAzubiForm(f => ({ ...f, name: e.target.value }))} placeholder="Vor- und Nachname" />
          </div>
          <div>
            <label className="label">E-Mail *</label>
            <input type="email" className="input-field" value={azubiForm.email} onChange={e => setAzubiForm(f => ({ ...f, email: e.target.value }))} placeholder="azubi@beispiel.de" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" className="accent-indigo-600" checked={azubiForm.send_email} onChange={e => setAzubiForm(f => ({ ...f, send_email: e.target.checked }))} />
            Zugangsdaten per E-Mail versenden (falls Mailversand konfiguriert ist)
          </label>
          <p className="text-xs text-slate-600">
            Azubi-Datensatz und Nutzerkonto werden zusammen angelegt. Anschließend öffnet sich das Profil, um Lehrjahr, Abteilung, Ausbildungsstart u.a. einzutragen.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setNewAzubiModal(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={handleSaveAzubi} disabled={azubiLoading || !azubiForm.name || !azubiForm.email}>
              {azubiLoading ? 'Speichern...' : 'Anlegen'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!revealPassword} onClose={closeRevealPassword} title="Einmalpasswort">
        {revealPassword && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Bitte gib dieses Einmalpasswort an <strong className="text-white">{revealPassword.email}</strong> weiter.
              Es wird nur jetzt einmalig angezeigt und muss beim ersten Login geändert werden.
            </p>
            <div className="bg-[#0d0f1a] border border-[#2a2d4a] rounded-lg px-4 py-3 text-center text-lg font-mono tracking-wider text-white">
              {revealPassword.password}
            </div>
            <button className="btn-primary w-full justify-center" onClick={closeRevealPassword}>
              Weiter zum Profil
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
