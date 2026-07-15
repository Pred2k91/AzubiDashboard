import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Megaphone, CalendarDays, Search } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { de } from 'date-fns/locale'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { announcementsApi, azubisApi, locationsApi } from '../../api/client'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6']
const EMPTY = {
  title: '', content: '', type: 'announcement', priority: 'normal', date: '', azubi_ids: [], color: '#6366f1',
  notify_push: false, notify_email: false, notify_location_ids: [],
}

const PRIORITY_LABELS = { urgent: 'Dringend', important: 'Wichtig', normal: 'Info' }
const PRIORITY_CLS = {
  urgent:    'bg-red-500/10 text-red-400 border-red-500/20',
  important: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  normal:    'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
}

export default function AnnouncementsAdmin() {
  const [items, setItems] = useState([])
  const [allAzubis, setAllAzubis] = useState([])
  const [locations, setLocations] = useState([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [deleteId, setDeleteId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [azubiSearch, setAzubiSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const load = () => announcementsApi.getAll().then(setItems).catch(() => {})
  useEffect(() => {
    load()
    azubisApi.getAll().then(setAllAzubis).catch(() => {})
    locationsApi.getAll().then(setLocations).catch(() => {})
  }, [])

  const openNew = (defaultType = 'announcement') => {
    setEditing(null)
    setForm({ ...EMPTY, type: defaultType })
    setAzubiSearch('')
    setError('')
    setModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      title: item.title, content: item.content || '', type: item.type,
      priority: item.priority, date: item.date || '',
      azubi_ids: item.azubi_ids || [], color: item.color || '#6366f1',
      notify_push: !!item.notify_push, notify_email: !!item.notify_email,
      notify_location_ids: item.notify_location_ids || [],
    })
    setAzubiSearch('')
    setError('')
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.title) { setError('Titel erforderlich'); return }
    if (form.type === 'exam' && !form.date) { setError('Prüfungsdatum erforderlich'); return }
    setLoading(true); setError('')
    try {
      const data = { ...form, date: form.date || null }
      if (editing) await announcementsApi.update(editing.id, data)
      else await announcementsApi.create(data)
      await load()
      setModal(false)
    } catch (err) { setError(err.response?.data?.error || 'Fehler') }
    finally { setLoading(false) }
  }

  const toggleAzubi = (id) => setForm(f => ({
    ...f,
    azubi_ids: f.azubi_ids.includes(id) ? f.azubi_ids.filter(i => i !== id) : [...f.azubi_ids, id]
  }))

  const toggleNotifyLocation = (id) => setForm(f => ({
    ...f,
    notify_location_ids: f.notify_location_ids.includes(id) ? f.notify_location_ids.filter(i => i !== id) : [...f.notify_location_ids, id]
  }))

  const today = new Date().toISOString().slice(0, 10)
  const filtered = items.filter(i => {
    if (filter === 'exam') return i.type === 'exam'
    if (filter === 'announcement') return i.type === 'announcement'
    return true
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Megaphone size={20} className="text-indigo-400" />
            Schwarzes Brett
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {items.filter(i => i.type === 'exam').length} Prüfungen ·{' '}
            {items.filter(i => i.type === 'announcement').length} Ankündigungen
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => openNew('exam')}>
            <CalendarDays size={14} /> Prüfung
          </button>
          <button className="btn-primary" onClick={() => openNew('announcement')}>
            <Plus size={16} /> Ankündigung
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[['all', 'Alle'], ['exam', 'Prüfungen'], ['announcement', 'Ankündigungen']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filter === v ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                          : 'bg-[#141625] border-[#2a2d4a] text-slate-500 hover:text-slate-300'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <Megaphone size={40} className="mb-3 opacity-20" />
          <p>Keine Einträge</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const isExam = item.type === 'exam'
            const days = isExam && item.date ? differenceInDays(parseISO(item.date), new Date()) : null
            const expired = isExam ? false : (item.date && item.date < today)
            return (
              <div key={item.id}
                className={`bg-[#141625] rounded-xl border p-4 flex items-start gap-4 group ${expired ? 'opacity-50' : ''}`}
                style={{ borderColor: isExam ? `${item.color}40` : undefined }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                  {isExam ? <CalendarDays size={16} /> : <Megaphone size={16} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{item.title}</span>
                    {isExam ? (
                      days !== null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          days < 0 ? 'bg-slate-700 text-slate-500'
                          : days <= 14 ? 'bg-red-500/20 text-red-300'
                          : days <= 30 ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-green-500/20 text-green-400'
                        }`}>
                          {days < 0 ? 'Vergangen' : days === 0 ? 'Heute!' : `${days} Tage`}
                        </span>
                      )
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITY_CLS[item.priority] || PRIORITY_CLS.normal}`}>
                        {PRIORITY_LABELS[item.priority] || 'Info'}
                      </span>
                    )}
                    {expired && <span className="text-xs text-slate-600 italic">abgelaufen</span>}
                  </div>

                  {item.content && <p className="text-sm text-slate-400 mt-1">{item.content}</p>}

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                    {item.date && (
                      <span>{isExam ? '📅' : '⏳'} {format(parseISO(item.date), 'dd.MM.yyyy', { locale: de })}</span>
                    )}
                    {isExam && item.azubi_ids?.length > 0 && (
                      <span>👤 {item.azubi_ids.length} Azubis</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]"><Pencil size={13} /></button>
                  <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? 'Bearbeiten' : form.type === 'exam' ? 'Neue Prüfung' : 'Neue Ankündigung'}
        size="lg">
        <div className="space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

          {/* Typ-Toggle */}
          <div className="flex gap-2">
            {[['announcement', <Megaphone size={13} />, 'Ankündigung'], ['exam', <CalendarDays size={13} />, 'Prüfungstermin']].map(([v, icon, l]) => (
              <button key={v} onClick={() => setForm(f => ({ ...f, type: v }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                  form.type === v ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                                  : 'bg-[#0d0f1a] border-[#2a2d4a] text-slate-500'
                }`}>
                {icon}{l}
              </button>
            ))}
          </div>

          <div>
            <label className="label">Titel *</label>
            <input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={form.type === 'exam' ? 'z.B. Abschlussprüfung Teil 1' : 'z.B. Betriebsausflug am Freitag'} />
          </div>

          <div>
            <label className="label">Beschreibung</label>
            <textarea className="input-field resize-none" rows={3} value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Optional..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{form.type === 'exam' ? 'Prüfungsdatum *' : 'Ablaufdatum'}</label>
              <input type="date" className="input-field" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              {form.type === 'announcement' && <p className="text-xs text-slate-600 mt-1">Leer = kein Ablaufdatum</p>}
            </div>
            {form.type === 'announcement' && (
              <div>
                <label className="label">Priorität</label>
                <select className="input-field" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="normal">Info</option>
                  <option value="important">Wichtig</option>
                  <option value="urgent">Dringend</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="label">Farbe</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-6 h-6 rounded-md border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="border-t border-[#2a2d4a] pt-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Benachrichtigung</h3>
            {editing && (
              <p className="text-xs text-slate-600">Wird nur beim Anlegen versendet, nicht erneut beim Speichern von Änderungen.</p>
            )}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <input type="checkbox" className="accent-indigo-600" checked={form.notify_push}
                  onChange={e => setForm(f => ({ ...f, notify_push: e.target.checked }))} />
                Push-Benachrichtigung senden
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <input type="checkbox" className="accent-indigo-600" checked={form.notify_email}
                  onChange={e => setForm(f => ({ ...f, notify_email: e.target.checked }))} />
                Per E-Mail senden
              </label>
            </div>
            {(form.notify_push || form.notify_email) && (
              <div>
                <label className="label">
                  Niederlassung(en)
                  {form.notify_location_ids.length > 0 && <span className="text-indigo-400 ml-1">({form.notify_location_ids.length})</span>}
                </label>
                <p className="text-xs text-slate-600 mb-1.5">Keine Auswahl = alle Niederlassungen</p>
                {locations.length === 0 ? (
                  <p className="text-xs text-slate-600">Keine Niederlassungen angelegt.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {locations.map(l => (
                      <button key={l.id} type="button" onClick={() => toggleNotifyLocation(l.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          form.notify_location_ids.includes(l.id)
                            ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                            : 'bg-[#0d0f1a] border-[#2a2d4a] text-slate-500 hover:text-slate-300'
                        }`}>
                        {l.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Azubi-Auswahl nur für Prüfungen */}
          {form.type === 'exam' && (
            <div>
              <label className="label">Betroffene Azubis
                {form.azubi_ids.length > 0 && <span className="text-indigo-400 ml-1">({form.azubi_ids.length})</span>}
              </label>
              <div className="relative mb-1.5">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input className="input-field pl-7 text-xs py-1.5" placeholder="Azubi suchen..."
                  value={azubiSearch} onChange={e => setAzubiSearch(e.target.value)} />
              </div>
              <div className="max-h-40 overflow-y-auto border border-[#2a2d4a] rounded-lg divide-y divide-[#2a2d4a]/50">
                {allAzubis.filter(a => a.name.toLowerCase().includes(azubiSearch.toLowerCase())).map(a => (
                  <label key={a.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#1e2035] cursor-pointer">
                    <input type="checkbox" className="accent-indigo-600"
                      checked={form.azubi_ids.includes(a.id)} onChange={() => toggleAzubi(a.id)} />
                    <span className="text-sm text-slate-300 flex-1">{a.name}</span>
                    <span className="text-xs text-slate-600">{a.lehrjahr}. Lj.</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setModal(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { announcementsApi.delete(deleteId).then(load) }}
        title="Eintrag löschen" message="Diesen Eintrag wirklich löschen?" />
    </div>
  )
}
