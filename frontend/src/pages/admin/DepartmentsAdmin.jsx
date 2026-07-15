import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { departmentsApi, azubisApi } from '../../api/client'

const COLORS = [
  // Bunt
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
  // Pastell / Hell
  '#fca5a5', '#fdba74', '#fde68a', '#bbf7d0', '#99f6e4',
  '#bae6fd', '#c7d2fe', '#e9d5ff', '#fbcfe8',
  // Neutral
  '#ffffff', '#e2e8f0', '#94a3b8', '#64748b', '#334155',
]
const EMPTY = { name: '', color: '#6366f1', description: '', location: '', contact_name: '', contact_email: '' }

export default function DepartmentsAdmin() {
  const [departments, setDepartments] = useState([])
  const [azubiCounts, setAzubiCounts] = useState({})
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [deleteId, setDeleteId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const [depts, azubiData] = await Promise.all([
      departmentsApi.getAll(),
      azubisApi.getByDepartment(),
    ]).catch(() => [[], { departments: [] }])
    setDepartments(depts)
    const counts = {}
    if (azubiData.departments) {
      azubiData.departments.forEach(d => { counts[d.id] = d.azubis.length })
    }
    setAzubiCounts(counts)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(EMPTY); setError(''); setModal(true) }
  const openEdit = (d) => {
    setEditing(d)
    setForm({
      name: d.name, color: d.color || '#6366f1', description: d.description || '', location: d.location || '',
      contact_name: d.contact_name || '', contact_email: d.contact_email || '',
    })
    setError('')
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.name) return
    setLoading(true)
    setError('')
    try {
      if (editing) await departmentsApi.update(editing.id, form)
      else await departmentsApi.create(form)
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
            <Building2 size={20} className="text-blue-400" />
            Abteilungen
          </h1>
          <p className="text-sm text-slate-500 mt-1">{departments.length} Abteilungen</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} />
          Neue Abteilung
        </button>
      </div>

      {departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <Building2 size={40} className="mb-3 opacity-20" />
          <p>Noch keine Abteilungen angelegt</p>
          <p className="text-sm mt-1">Erstelle zuerst Abteilungen, dann kannst du Azubis zuweisen</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {departments.map(dept => (
            <div
              key={dept.id}
              className="bg-[#141625] rounded-xl border p-4 group hover:border-opacity-60 transition-all"
              style={{ borderColor: `${dept.color}40` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold" style={{ backgroundColor: `${dept.color}20`, color: dept.color }}>
                    {dept.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{dept.name}</h3>
                    {dept.location && <p className="text-xs text-slate-500 mt-0.5">{dept.location}</p>}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(dept)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]"><Pencil size={13} /></button>
                  <button onClick={() => setDeleteId(dept.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                </div>
              </div>
              {dept.description && (
                <p className="text-xs text-slate-500 mt-3">{dept.description}</p>
              )}
              <div className="mt-3 pt-3 border-t border-[#2a2d4a] flex items-center justify-between">
                <span className="text-xs text-slate-600">Azubis</span>
                <span className="text-sm font-semibold" style={{ color: dept.color }}>
                  {azubiCounts[dept.id] || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Abteilung bearbeiten' : 'Neue Abteilung'}>
        <div className="space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
          <div>
            <label className="label">Name *</label>
            <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. IT-Abteilung" />
          </div>
          <div>
            <label className="label">Standort / Raum</label>
            <input className="input-field" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="z.B. Gebäude A, Raum 201" />
          </div>
          <div>
            <label className="label">Beschreibung</label>
            <textarea className="input-field resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional..." />
          </div>
          <div className="border-t border-[#2a2d4a] pt-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Ansprechpartner (für Feedback-Einladungen)</label>
            </div>
            <div>
              <label className="label">Name</label>
              <input className="input-field" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="z.B. Max Mustermann" />
            </div>
            <div>
              <label className="label">E-Mail</label>
              <input type="email" className="input-field" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="max@firma.example" />
            </div>
          </div>
          <div>
            <label className="label">Farbe</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className={`w-6 h-6 rounded-md border-2 transition-all ${form.color === c ? 'border-white scale-125' : 'border-transparent hover:scale-110'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setModal(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Speichern...' : 'Speichern'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { departmentsApi.delete(deleteId).then(load) }} title="Abteilung löschen" message="Diese Abteilung wirklich löschen? Azubis verlieren ihre Zuweisung." />
    </div>
  )
}
