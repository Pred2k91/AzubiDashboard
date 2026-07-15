import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck, Crown } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { permissionRolesApi } from '../../api/client'
import { PERMISSIONS } from '../../permissions'

const EMPTY = { name: '', permissions: [] }

export default function RolesAdmin() {
  const [roles, setRoles] = useState([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [deleteId, setDeleteId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = () => permissionRolesApi.getAll().then(setRoles).catch(() => {})

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(EMPTY); setError(''); setModal(true) }
  const openEdit = (r) => {
    setEditing(r)
    setForm({ name: r.name, permissions: [...r.permissions] })
    setError('')
    setModal(true)
  }

  const togglePermission = (key) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(key) ? f.permissions.filter(p => p !== key) : [...f.permissions, key],
    }))
  }

  const handleSave = async () => {
    if (!form.name) return
    setLoading(true)
    setError('')
    try {
      if (editing) await permissionRolesApi.update(editing.id, form)
      else await permissionRolesApi.create(form)
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
            <ShieldCheck size={20} className="text-indigo-400" />
            Rollen
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {roles.length} Rollen — legen fest, was Ausbilder-Konten in ihrer Niederlassung dürfen
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} />
          Neue Rolle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {roles.map(role => (
          <div key={role.id} className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${role.is_super_admin ? 'bg-amber-500/10 text-amber-300' : 'bg-indigo-500/10 text-indigo-300'}`}>
                  {role.is_super_admin ? <Crown size={18} /> : <ShieldCheck size={18} />}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{role.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {role.is_super_admin ? 'Alle Rechte, alle Niederlassungen' : `${role.permissions.length} Berechtigung${role.permissions.length === 1 ? '' : 'en'}`}
                  </p>
                </div>
              </div>
              {!role.is_super_admin && (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(role)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]"><Pencil size={13} /></button>
                  <button onClick={() => setDeleteId(role.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                </div>
              )}
            </div>
            {!role.is_super_admin && role.permissions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {role.permissions.map(key => (
                  <span key={key} className="text-[11px] px-2 py-0.5 rounded-full bg-[#0d0f1a] border border-[#2a2d4a] text-slate-400">
                    {PERMISSIONS.find(p => p.key === key)?.label || key}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Rolle bearbeiten' : 'Neue Rolle'} size="lg">
        <div className="space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
          <div>
            <label className="label">Name *</label>
            <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Niederlassungs-Admin Köln" />
          </div>
          <div>
            <label className="label">Berechtigungen</label>
            <div className="grid sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
              {PERMISSIONS.map(p => (
                <label key={p.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${form.permissions.includes(p.key) ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'border-[#2a2d4a] text-slate-400'}`}>
                  <input type="checkbox" className="accent-indigo-600" checked={form.permissions.includes(p.key)} onChange={() => togglePermission(p.key)} />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Wird eine Rolle einem Ausbilder-Konto zugewiesen, gelten diese Berechtigungen nur innerhalb der Niederlassung(en), die diesem Konto im Profil zugeordnet sind.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setModal(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Speichern...' : 'Speichern'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { permissionRolesApi.delete(deleteId).then(load) }}
        title="Rolle löschen"
        message="Diese Rolle wirklich löschen? Nutzer mit dieser Rolle verlieren dadurch alle zugehörigen Berechtigungen."
      />
    </div>
  )
}
