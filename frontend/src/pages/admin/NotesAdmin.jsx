import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, StickyNote, Pin, PinOff } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { notesApi } from '../../api/client'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#64748b']
const EMPTY = { title: '', content: '', color: '#6366f1', pinned: false }

export default function NotesAdmin() {
  const [notes, setNotes] = useState([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [deleteId, setDeleteId] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = () => notesApi.getAll().then(setNotes).catch(() => {})
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(EMPTY); setModal(true) }
  const openEdit = (n) => {
    setEditing(n)
    setForm({ title: n.title, content: n.content || '', color: n.color || '#6366f1', pinned: !!n.pinned })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.title) return
    setLoading(true)
    try {
      if (editing) await notesApi.update(editing.id, form)
      else await notesApi.create(form)
      await load()
      setModal(false)
    } finally { setLoading(false) }
  }

  const handlePin = async (note) => {
    await notesApi.update(note.id, { ...note, pinned: !note.pinned })
    await load()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <StickyNote size={20} className="text-green-400" />
            Notizen
          </h1>
          <p className="text-sm text-slate-500 mt-1">{notes.length} Notizen</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} />
          Neue Notiz
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <StickyNote size={40} className="mb-3 opacity-20" />
          <p>Noch keine Notizen vorhanden</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {notes.map(note => (
            <div
              key={note.id}
              className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4 hover:border-indigo-500/30 transition-all group"
              style={{ borderLeftColor: note.color, borderLeftWidth: 3 }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-white leading-tight">{note.title}</h3>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handlePin(note)}
                    className={`p-1.5 rounded transition-colors ${note.pinned ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'}`}
                    title={note.pinned ? 'Anheften aufheben' : 'Anheften'}
                  >
                    {note.pinned ? <Pin size={12} /> : <PinOff size={12} />}
                  </button>
                  <button onClick={() => openEdit(note)} className="p-1.5 rounded text-slate-600 hover:text-white hover:bg-[#2a2d4a]"><Pencil size={12} /></button>
                  <button onClick={() => setDeleteId(note.id)} className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={12} /></button>
                </div>
              </div>
              {note.content ? (
                <p className="text-xs text-slate-400 whitespace-pre-wrap line-clamp-6">{note.content}</p>
              ) : (
                <p className="text-xs text-slate-600 italic">Kein Inhalt</p>
              )}
              {note.pinned && (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-500">
                  <Pin size={9} /> Angeheftet
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Notiz bearbeiten' : 'Neue Notiz'}>
        <div className="space-y-4">
          <div>
            <label className="label">Titel *</label>
            <input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titel der Notiz" />
          </div>
          <div>
            <label className="label">Inhalt</label>
            <textarea className="input-field resize-none" rows={6} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Notizinhalt..." />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="label">Farbe</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className={`w-6 h-6 rounded-full border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} />
              Anheften
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setModal(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Speichern...' : 'Speichern'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { notesApi.delete(deleteId).then(load) }} title="Notiz löschen" message="Diese Notiz wirklich löschen?" />
    </div>
  )
}
