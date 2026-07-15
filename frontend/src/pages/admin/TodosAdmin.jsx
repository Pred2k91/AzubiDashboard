import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, CheckSquare, Circle, Clock, CheckCircle2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { todosApi, azubisApi } from '../../api/client'

const PRIORITY = {
  high: { label: 'Hoch', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  medium: { label: 'Mittel', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  low: { label: 'Niedrig', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
}

const STATUS = {
  open: { label: 'Offen', icon: Circle, cls: 'text-slate-400' },
  in_progress: { label: 'In Bearbeitung', icon: Clock, cls: 'text-indigo-400' },
  done: { label: 'Erledigt', icon: CheckCircle2, cls: 'text-green-400' },
}

const EMPTY = { title: '', description: '', priority: 'medium', status: 'open', due_date: '', assigned_to: '' }

export default function TodosAdmin() {
  const [todos, setTodos] = useState([])
  const [azubis, setAzubis] = useState([])
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [deleteId, setDeleteId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = () => todosApi.getAll().then(setTodos).catch(() => {})
  useEffect(() => {
    load()
    azubisApi.getAll().then(setAzubis).catch(() => {})
  }, [])

  const azubiName = (id) => azubis.find(a => a.id === id)?.name || ''

  const openNew = () => { setEditing(null); setForm(EMPTY); setError(''); setModal(true) }
  const openEdit = (t) => {
    setEditing(t)
    setForm({ title: t.title, description: t.description || '', priority: t.priority, status: t.status, due_date: t.due_date || '', assigned_to: t.assigned_to || '' })
    setError('')
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.title) { setError('Bitte einen Titel eingeben'); return }
    setLoading(true)
    setError('')
    try {
      const payload = { ...form, due_date: form.due_date || null, assigned_to: form.assigned_to || null }
      if (editing) await todosApi.update(editing.id, payload)
      else await todosApi.create(payload)
      await load()
      setModal(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern')
    } finally { setLoading(false) }
  }

  const handleStatus = async (todo, status) => {
    await todosApi.update(todo.id, { ...todo, status })
    await load()
  }

  const filtered = filter === 'all' ? todos : todos.filter(t => t.status === filter)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CheckSquare size={20} className="text-amber-400" />
            Aufgaben
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {todos.filter(t => t.status !== 'done').length} offen · {todos.filter(t => t.status === 'done').length} erledigt
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} />
          Neue Aufgabe
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[['all', 'Alle'], ['open', 'Offen'], ['in_progress', 'In Bearbeitung'], ['done', 'Erledigt']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
              ${filter === val
                ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                : 'bg-[#141625] border-[#2a2d4a] text-slate-500 hover:text-slate-300'
              }`}
          >
            {label}
            <span className="ml-1.5 opacity-60">
              {val === 'all' ? todos.length : todos.filter(t => t.status === val).length}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Aufgabe</th>
              <th>Priorität</th>
              <th>Fällig</th>
              <th>Zugewiesen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-600 py-10">Keine Aufgaben</td></tr>
            ) : filtered.map(t => {
              const S = STATUS[t.status] || STATUS.open
              const P = PRIORITY[t.priority] || PRIORITY.medium
              return (
                <tr key={t.id}>
                  <td>
                    <div className="flex items-center gap-1">
                      {['open', 'in_progress', 'done'].map(s => {
                        const Ic = STATUS[s].icon
                        return (
                          <button
                            key={s}
                            title={STATUS[s].label}
                            onClick={() => handleStatus(t, s)}
                            className={`p-1 rounded transition-colors ${t.status === s ? STATUS[s].cls : 'text-slate-700 hover:text-slate-400'}`}
                          >
                            <Ic size={14} />
                          </button>
                        )
                      })}
                    </div>
                  </td>
                  <td>
                    <div className={`font-medium ${t.status === 'done' ? 'line-through text-slate-600' : 'text-white'}`}>{t.title}</div>
                    {t.description && <div className="text-xs text-slate-600 mt-0.5 truncate max-w-xs">{t.description}</div>}
                  </td>
                  <td>
                    <span className={`badge border ${P.cls}`}>{P.label}</span>
                  </td>
                  <td className="text-sm text-slate-400">
                    {t.due_date ? format(parseISO(t.due_date), 'dd.MM.yyyy') : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="text-sm text-slate-400">
                    {t.assigned_to ? azubiName(t.assigned_to) : <span className="text-slate-700">—</span>}
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}>
        <div className="space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
          <div>
            <label className="label">Titel *</label>
            <input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Was ist zu tun?" />
          </div>
          <div>
            <label className="label">Beschreibung</label>
            <textarea className="input-field resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Priorität</label>
              <select className="input-field" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input-field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="open">Offen</option>
                <option value="in_progress">In Bearbeitung</option>
                <option value="done">Erledigt</option>
              </select>
            </div>
            <div>
              <label className="label">Fälligkeitsdatum</label>
              <input type="date" className="input-field" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Zugewiesen an</label>
            <select className="input-field" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value ? Number(e.target.value) : '' }))}>
              <option value="">Niemand</option>
              {azubis.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setModal(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { todosApi.delete(deleteId).then(load); setDeleteId(null) }} title="Aufgabe löschen" message="Diese Aufgabe wirklich löschen?" />
    </div>
  )
}
