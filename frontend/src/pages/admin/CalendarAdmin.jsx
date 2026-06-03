import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, CalendarDays, Users, Search, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { calendarApi, azubisApi } from '../../api/client'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6']

const EMPTY = { title: '', description: '', start_datetime: '', end_datetime: '', all_day: false, color: '#6366f1', azubi_ids: [] }

export default function CalendarAdmin() {
  const [events, setEvents] = useState([])
  const [allAzubis, setAllAzubis] = useState([])
  const [azubiSearch, setAzubiSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [deleteId, setDeleteId] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = () => calendarApi.getAll().then(setEvents).catch(() => {})

  useEffect(() => {
    load()
    azubisApi.getAll().then(setAllAzubis).catch(() => {})
  }, [])

  const openNew = () => { setEditing(null); setForm(EMPTY); setAzubiSearch(''); setModal(true) }
  const openEdit = (e) => {
    setEditing(e)
    setForm({
      title: e.title,
      description: e.description || '',
      start_datetime: e.start_datetime.slice(0, 16),
      end_datetime: e.end_datetime.slice(0, 16),
      all_day: !!e.all_day,
      color: e.color || '#6366f1',
      azubi_ids: e.azubi_ids || [],
    })
    setAzubiSearch('')
    setModal(true)
  }

  const toggleAzubi = (id) => {
    setForm(f => ({
      ...f,
      azubi_ids: f.azubi_ids.includes(id)
        ? f.azubi_ids.filter(i => i !== id)
        : [...f.azubi_ids, id]
    }))
  }

  const handleSave = async () => {
    if (!form.title || !form.start_datetime || !form.end_datetime) return
    setLoading(true)
    try {
      if (editing) {
        await calendarApi.update(editing.id, form)
      } else {
        await calendarApi.create(form)
      }
      await load()
      setModal(false)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    await calendarApi.delete(id)
    await load()
  }

  const upcoming = events.filter(e => e.start_datetime >= new Date().toISOString().slice(0, 10))
  const past = events.filter(e => e.start_datetime < new Date().toISOString().slice(0, 10))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CalendarDays size={20} className="text-indigo-400" />
            Kalender
          </h1>
          <p className="text-sm text-slate-500 mt-1">{events.length} Termine gesamt</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} />
          Neuer Termin
        </button>
      </div>

      {/* Upcoming */}
      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a]">
        <div className="px-4 py-3 border-b border-[#2a2d4a] flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Kommende Termine</span>
          <span className="text-xs bg-indigo-600/20 text-indigo-300 px-2 py-0.5 rounded-full">{upcoming.length}</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Titel</th>
              <th>Start</th>
              <th>Ende</th>
              <th>Ganztag</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {upcoming.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-slate-600 py-8">Keine kommenden Termine</td></tr>
            ) : upcoming.map(e => (
              <tr key={e.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                    <span className="font-medium text-white">{e.title}</span>
                  </div>
                  {e.description && <div className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{e.description}</div>}
                  {e.azubis?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                      <Users size={10} />
                      {e.azubis.map(a => a.name).join(', ')}
                    </div>
                  )}
                </td>
                <td className="text-sm">{format(parseISO(e.start_datetime), 'dd.MM.yyyy HH:mm')}</td>
                <td className="text-sm">{format(parseISO(e.end_datetime), 'dd.MM.yyyy HH:mm')}</td>
                <td>{e.all_day ? <span className="badge bg-green-500/10 text-green-400">Ja</span> : <span className="text-slate-600">—</span>}</td>
                <td>
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(e)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a] transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => setDeleteId(e.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {past.length > 0 && (
        <div className="bg-[#141625] rounded-xl border border-[#2a2d4a]">
          <div className="px-4 py-3 border-b border-[#2a2d4a]">
            <span className="text-sm font-semibold text-slate-500">Vergangene Termine</span>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Titel</th><th>Datum</th><th></th></tr>
            </thead>
            <tbody>
              {past.slice().reverse().map(e => (
                <tr key={e.id} className="opacity-50">
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
                      {e.title}
                    </div>
                  </td>
                  <td className="text-sm">{format(parseISO(e.start_datetime), 'dd.MM.yyyy')}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(e)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteId(e.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Termin bearbeiten' : 'Neuer Termin'}>
        <div className="space-y-4">
          <div>
            <label className="label">Titel *</label>
            <input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Terminbezeichnung" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Startzeit *</label>
              <input type="datetime-local" className="input-field" value={form.start_datetime} onChange={e => setForm(f => ({ ...f, start_datetime: e.target.value, end_datetime: f.end_datetime || e.target.value }))} />
            </div>
            <div>
              <label className="label">Endzeit *</label>
              <input type="datetime-local" className="input-field" value={form.end_datetime} onChange={e => setForm(f => ({ ...f, end_datetime: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Beschreibung</label>
            <textarea className="input-field resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional..." />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="label">Farbe</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={form.all_day} onChange={e => setForm(f => ({ ...f, all_day: e.target.checked }))} />
              Ganztag
            </label>
          </div>
          {/* Azubi-Auswahl */}
          <div>
            <label className="label flex items-center gap-1">
              <Users size={12} />
              Azubis bei diesem Termin
              {form.azubi_ids.length > 0 && (
                <span className="ml-1 text-indigo-400">({form.azubi_ids.length} ausgewählt)</span>
              )}
            </label>
            <div className="relative mb-2">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                className="input-field pl-7 text-xs py-1.5"
                placeholder="Azubi suchen..."
                value={azubiSearch}
                onChange={e => setAzubiSearch(e.target.value)}
              />
            </div>
            <div className="max-h-40 overflow-y-auto border border-[#2a2d4a] rounded-lg divide-y divide-[#2a2d4a]/50">
              {allAzubis
                .filter(a => a.name.toLowerCase().includes(azubiSearch.toLowerCase()))
                .map(a => (
                  <label key={a.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#1e2035] cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-indigo-600"
                      checked={form.azubi_ids.includes(a.id)}
                      onChange={() => toggleAzubi(a.id)}
                    />
                    <span className="text-sm text-slate-300 flex-1">{a.name}</span>
                    <span className="text-xs text-slate-600">{a.lehrjahr}. Lj.</span>
                  </label>
                ))}
            </div>
            {form.azubi_ids.length > 0 && (
              <button
                className="mt-1.5 text-xs text-slate-600 hover:text-slate-400"
                onClick={() => setForm(f => ({ ...f, azubi_ids: [] }))}
              >
                Alle abwählen
              </button>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setModal(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
        title="Termin löschen"
        message="Diesen Termin wirklich löschen?"
      />
    </div>
  )
}
