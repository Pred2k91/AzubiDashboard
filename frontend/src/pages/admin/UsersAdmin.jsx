import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, KeyRound, Users as UsersIcon, ShieldCheck, Ban, CheckCircle2, Trash2 } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { usersApi } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const EMPTY = { email: '', role: 'azubi', name: '', send_email: false }

export default function UsersAdmin() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [revealPassword, setRevealPassword] = useState(null)
  const [deleteUser, setDeleteUser] = useState(null)

  const load = async () => {
    const u = await usersApi.getAll().catch(() => [])
    setUsers(u)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setModal(true) }

  const handleSave = async () => {
    if (!form.email || (form.role === 'azubi' && !form.name)) return
    setLoading(true)
    try {
      const created = await usersApi.create(form)
      await load()
      setModal(false)
      if (created.generated_password) {
        setRevealPassword({ email: created.email, password: created.generated_password })
      }
    } finally { setLoading(false) }
  }

  const handleToggleActive = async (u) => {
    await usersApi.update(u.id, { role: u.role, active: !u.active })
    await load()
  }

  const handleResetPassword = async (u) => {
    const res = await usersApi.resetPassword(u.id)
    setRevealPassword({ email: u.email, password: res.generated_password })
  }

  const handleDelete = async () => {
    if (!deleteUser) return
    await usersApi.delete(deleteUser.id)
    await load()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <UsersIcon size={20} className="text-indigo-400" />
            Nutzerverwaltung
          </h1>
          <p className="text-sm text-slate-500 mt-1">{users.length} Konten</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} />
          Neues Konto
        </button>
      </div>

      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>E-Mail</th>
              <th>Rolle</th>
              <th>Status</th>
              <th>Letzter Login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-slate-600 py-10">Keine Konten gefunden</td></tr>
            ) : users.map(u => (
              <tr key={u.id} onClick={() => navigate(`/admin/users/${u.id}`)} className="cursor-pointer hover:bg-[#1e2035]/50">
                <td className="text-white">{u.email}</td>
                <td>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full border ${u.role === 'ausbilder' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                    {u.role === 'ausbilder' ? 'Ausbilder' : 'Azubi'}
                  </span>
                </td>
                <td>
                  {u.active ? (
                    <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 size={12} />Aktiv</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-slate-600"><Ban size={12} />Deaktiviert</span>
                  )}
                </td>
                <td className="text-xs text-slate-500">{u.last_login_at || '—'}</td>
                <td>
                  <div className="flex items-center gap-1.5 justify-end">
                    <button onClick={(e) => { e.stopPropagation(); handleResetPassword(u) }} title="Passwort zurücksetzen" className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]">
                      <KeyRound size={13} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleToggleActive(u) }} title={u.active ? 'Deaktivieren' : 'Aktivieren'} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]">
                      {u.active ? <Ban size={13} /> : <ShieldCheck size={13} />}
                    </button>
                    {u.id !== currentUser?.id && (
                      <button onClick={(e) => { e.stopPropagation(); setDeleteUser(u) }} title="Konto löschen" className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Neues Konto">
        <div className="space-y-4">
          <div>
            <label className="label">E-Mail *</label>
            <input type="email" className="input-field" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Rolle</label>
            <select className="input-field" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="azubi">Azubi</option>
              <option value="ausbilder">Ausbilder</option>
            </select>
          </div>
          {form.role === 'azubi' && (
            <div>
              <label className="label">Name *</label>
              <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vor- und Nachname" />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" className="accent-indigo-600" checked={form.send_email} onChange={e => setForm(f => ({ ...f, send_email: e.target.checked }))} />
            Zugangsdaten per E-Mail versenden (falls Mailversand konfiguriert ist)
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setModal(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Speichern...' : 'Anlegen'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!revealPassword} onClose={() => setRevealPassword(null)} title="Einmalpasswort">
        {revealPassword && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Bitte gib dieses Einmalpasswort an <strong className="text-white">{revealPassword.email}</strong> weiter.
              Es wird nur jetzt einmalig angezeigt und muss beim ersten Login geändert werden.
            </p>
            <div className="bg-[#0d0f1a] border border-[#2a2d4a] rounded-lg px-4 py-3 text-center text-lg font-mono tracking-wider text-white">
              {revealPassword.password}
            </div>
            <button className="btn-primary w-full justify-center" onClick={() => setRevealPassword(null)}>Verstanden</button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDelete}
        title="Konto löschen"
        message={deleteUser ? `Konto "${deleteUser.email}" wirklich unwiderruflich löschen?` : ''}
      />
    </div>
  )
}
