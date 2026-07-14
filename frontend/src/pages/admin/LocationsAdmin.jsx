import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Landmark } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { locationsApi } from '../../api/client'

const EMPTY = { name: '', short_code: '' }

export default function LocationsAdmin() {
  const [locations, setLocations] = useState([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [deleteId, setDeleteId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = () => locationsApi.getAll().then(setLocations).catch(() => {})

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(EMPTY); setError(''); setModal(true) }
  const openEdit = (l) => {
    setEditing(l)
    setForm({ name: l.name, short_code: l.short_code || '' })
    setError('')
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.name) return
    setLoading(true)
    setError('')
    try {
      if (editing) await locationsApi.update(editing.id, form)
      else await locationsApi.create(form)
      await load()
      setModal(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern')
    } finally { setLoading(false) }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Landmark size={20} className="text-cyan-400" />
            Niederlassungen
          </h1>
          <p className="text-sm text-slate-500 mt-1">{locations.length} Niederlassungen</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} />
          Neue Niederlassung
        </button>
      </div>

      {locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <Landmark size={40} className="mb-3 opacity-20" />
          <p>Noch keine Niederlassungen angelegt</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {locations.map(loc => (
            <div key={loc.id} className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4 group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold bg-cyan-500/10 text-cyan-300">
                    {loc.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{loc.name}</h3>
                    {loc.short_code && <p className="text-xs text-slate-500 mt-0.5">{loc.short_code}</p>}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(loc)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]"><Pencil size={13} /></button>
                  <button onClick={() => setDeleteId(loc.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Niederlassung bearbeiten' : 'Neue Niederlassung'}>
        <div className="space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
          <div>
            <label className="label">Name *</label>
            <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Hauptsitz" />
          </div>
          <div>
            <label className="label">Kürzel</label>
            <input className="input-field" value={form.short_code} onChange={e => setForm(f => ({ ...f, short_code: e.target.value }))} placeholder="z.B. HS" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setModal(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Speichern...' : 'Speichern'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { locationsApi.delete(deleteId).then(load) }} title="Niederlassung löschen" message="Diese Niederlassung wirklich löschen? Zugeordnete Nutzer verlieren die Zuordnung." />
    </div>
  )
}
