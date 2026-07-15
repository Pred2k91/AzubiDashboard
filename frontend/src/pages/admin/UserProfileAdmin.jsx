import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, KeyRound, Camera, Phone, Smartphone, Mail, MapPin, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { usersApi, locationsApi, departmentsApi, permissionRolesApi } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const EMPTY_FORM = {
  role: 'azubi', active: true,
  name: '',
  salutation: '', first_name: '', last_name: '', birthday: '',
  phone: '', mobile_phone: '', street: '', postal_code: '', city: '',
  personnel_number: '', job_title: '', about_me: '', public_note: '', misc_note: '',
  location_ids: [],
  // Ausbildungsdaten -- nur relevant/sichtbar wenn role === 'azubi'.
  lehrjahr: 1, start_date: '', current_department_id: '',
  next_department_id: '', next_rotation_date: '', report_period: 'week',
  // Berechtigungsrolle -- nur relevant für role==='ausbilder', nur Super Admin darf sie ändern.
  permission_role_id: '',
}

export default function UserProfileAdmin() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [user, setUser] = useState(null)
  const [locations, setLocations] = useState([])
  const [departments, setDepartments] = useState([])
  const [roles, setRoles] = useState([])
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revealPassword, setRevealPassword] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const load = () => Promise.all([usersApi.getOne(id), locationsApi.getAll(), departmentsApi.getAll(), permissionRolesApi.getAll()])
    .then(([u, locs, depts, rls]) => { setUser(u); setLocations(locs); setDepartments(depts); setRoles(rls) })
    .catch(() => setError('Profil konnte nicht geladen werden'))

  useEffect(() => { load() }, [id])

  const openEdit = () => {
    setForm({
      role: user.role, active: !!user.active,
      name: user.name || '',
      salutation: user.salutation || '', first_name: user.first_name || '', last_name: user.last_name || '',
      birthday: user.birthday || '',
      phone: user.phone || '', mobile_phone: user.mobile_phone || '',
      street: user.street || '', postal_code: user.postal_code || '', city: user.city || '',
      personnel_number: user.personnel_number || '', job_title: user.job_title || '',
      about_me: user.about_me || '', public_note: user.public_note || '', misc_note: user.misc_note || '',
      location_ids: user.locations.map(l => l.id),
      lehrjahr: user.lehrjahr ?? 1, start_date: user.start_date || '', current_department_id: user.current_department_id || '',
      next_department_id: user.next_department_id || '', next_rotation_date: user.next_rotation_date || '',
      report_period: user.report_period || 'week',
      permission_role_id: user.permission_role_id || '',
    })
    setError('')
    setEditOpen(true)
  }

  const toggleLocation = (locId) => {
    setForm(f => ({
      ...f,
      location_ids: f.location_ids.includes(locId) ? f.location_ids.filter(i => i !== locId) : [...f.location_ids, locId],
    }))
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    try {
      const roleUpdate = { role: form.role, active: form.active }
      // Nur Super Admin darf die Berechtigungsrolle ändern (Backend lehnt es sonst ab) --
      // das Feld wird also nur mitgeschickt, wenn der Betrachter selbst Super Admin ist.
      if (currentUser?.is_super_admin) {
        roleUpdate.permission_role_id = form.role === 'ausbilder' ? (form.permission_role_id || null) : null
      }
      await Promise.all([
        usersApi.update(id, roleUpdate),
        usersApi.updateProfile(id, {
          name: form.name,
          salutation: form.salutation, first_name: form.first_name, last_name: form.last_name, birthday: form.birthday || null,
          phone: form.phone, mobile_phone: form.mobile_phone, street: form.street, postal_code: form.postal_code, city: form.city,
          personnel_number: form.personnel_number, job_title: form.job_title,
          about_me: form.about_me, public_note: form.public_note, misc_note: form.misc_note,
          location_ids: form.location_ids,
          lehrjahr: form.lehrjahr, start_date: form.start_date || null, current_department_id: form.current_department_id || null,
          next_department_id: form.next_department_id || null, next_rotation_date: form.next_rotation_date || null,
          report_period: form.report_period,
        }),
      ])
      await load()
      setEditOpen(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Speichern fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await usersApi.uploadAvatar(id, file)
      await load()
    } catch (_) {
      // Avatar-Upload ist nicht kritisch fürs restliche Profil -- kein Blocking-Fehlerzustand nötig
    }
  }

  const handleResetPassword = async () => {
    const res = await usersApi.resetPassword(id)
    setRevealPassword(res.generated_password)
  }

  const handleDelete = async () => {
    await usersApi.delete(id)
    navigate('/admin/users')
  }

  if (!user) {
    return <div className="p-6 text-slate-500 text-sm">{error || 'Lädt...'}</div>
  }

  const isAzubi = user.role === 'azubi'
  const displayName = isAzubi ? user.name : (`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email)

  return (
    <div className="p-6">
      <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-4">
        <ArrowLeft size={13} />
        Zurück zur Nutzerverwaltung
      </Link>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-64 shrink-0 space-y-4">
          <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 text-center">
            <div className="relative inline-block">
              <div className="w-20 h-20 rounded-full bg-purple-600/20 text-purple-300 flex items-center justify-center text-2xl font-bold overflow-hidden mx-auto">
                {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : displayName.charAt(0).toUpperCase()}
              </div>
              <label className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer">
                <Camera size={12} />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            </div>
            <div className="mt-3 text-sm font-semibold text-white">{displayName}</div>
            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
              <span className="badge bg-amber-500/10 text-amber-300 border border-amber-500/20">User ID #{user.id}</span>
              {user.personnel_number && <span className="badge bg-slate-500/10 text-slate-300 border border-slate-500/20">Personal Nr. #{user.personnel_number}</span>}
            </div>
            <div className="mt-3 space-y-1.5 text-left">
              <span className="badge bg-indigo-600/10 text-indigo-300 border border-indigo-500/20">
                {user.role === 'ausbilder' ? 'Ausbilder:in' : 'Azubi'}
              </span>
              {user.job_title && <div className="text-xs text-slate-500 mt-1.5">{user.job_title}</div>}
              {user.locations.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {user.locations.map(l => (
                    <span key={l.id} className="text-[11px] px-2 py-0.5 rounded-full bg-[#0d0f1a] border border-[#2a2d4a] text-slate-400">
                      {l.short_code || l.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4 space-y-2 text-sm">
            {user.phone && <div className="flex items-center gap-2 text-slate-300"><Phone size={13} className="text-slate-500 shrink-0" />{user.phone}</div>}
            {user.mobile_phone && <div className="flex items-center gap-2 text-slate-300"><Smartphone size={13} className="text-slate-500 shrink-0" />{user.mobile_phone}</div>}
            <div className="flex items-center gap-2 text-slate-300"><Mail size={13} className="text-slate-500 shrink-0" />{user.email}</div>
            {(user.street || user.city) && (
              <div className="flex items-start gap-2 text-slate-300">
                <MapPin size={13} className="text-slate-500 shrink-0 mt-0.5" />
                <div>{user.street}<br />{user.postal_code} {user.city}</div>
              </div>
            )}
          </div>

          <button className="btn-primary w-full justify-center" onClick={openEdit}>
            <Pencil size={14} />
            Bearbeiten
          </button>
          <button className="btn-secondary w-full justify-center" onClick={handleResetPassword}>
            <KeyRound size={14} />
            Passwort zurücksetzen
          </button>
          {user.id !== currentUser?.id && (
            <button className="btn-secondary w-full justify-center hover:text-red-400 hover:border-red-500/30" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={14} />
              Konto löschen
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 grid md:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">Persönliche Daten</h2>
              <FieldRow label="Anrede" value={user.salutation} />
              <FieldRow label="Name" value={displayName} />
              <FieldRow label="Geburtsdatum" value={user.birthday ? format(parseISO(user.birthday), 'dd.MM.yyyy', { locale: de }) : ''} />
            </div>
            <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">Kontaktdaten</h2>
              <FieldRow label="Telefon" value={user.phone} />
              <FieldRow label="Mobiltelefon" value={user.mobile_phone} />
              <FieldRow label="E-Mail" value={user.email} />
              <FieldRow label="Adresse" value={user.street ? `${user.street}, ${user.postal_code} ${user.city}` : ''} />
            </div>
            {isAzubi && (
              <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white">Ausbildungsdaten</h2>
                <FieldRow label="Lehrjahr" value={`${user.lehrjahr}. Lehrjahr`} />
                <FieldRow label="Ausbildungsstart" value={user.start_date ? format(parseISO(user.start_date), 'dd.MM.yyyy', { locale: de }) : ''} />
                <FieldRow label="Abteilung" value={user.department_name} />
                <FieldRow label="Berichtsheft-Rhythmus" value={user.report_period === 'day' ? 'Tagesbericht' : 'Wochenbericht'} />
                {user.next_department_name && (
                  <FieldRow
                    label="Geplanter Wechsel"
                    value={`${user.next_department_name}${user.next_rotation_date ? ` ab ${format(parseISO(user.next_rotation_date), 'dd.MM.yyyy', { locale: de })}` : ''}`}
                  />
                )}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">Interne Daten</h2>
              <FieldRow label="User ID" value={`#${user.id}`} />
              <FieldRow label="Personal Nr." value={user.personnel_number} />
              <FieldRow label="Kontotyp" value={user.role === 'ausbilder' ? 'Ausbilder:in' : 'Azubi'} />
              {user.role === 'ausbilder' && (
                <FieldRow label="Berechtigungsrolle" value={roles.find(r => r.id === user.permission_role_id)?.name || 'Keine (keine Berechtigungen)'} />
              )}
              <FieldRow label="Funktion" value={user.job_title} />
              <FieldRow label="Ausbildungsorte" value={user.locations.map(l => l.name).join(', ')} />
            </div>
            <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">Weitere Informationen</h2>
              <FieldRow label="Öffentlicher Text" value={user.public_note} />
              <FieldRow label="Über mich" value={user.about_me} />
              <FieldRow label="Sonstiges" value={user.misc_note} />
            </div>
          </div>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Profil bearbeiten" size="xl">
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Kontotyp</label>
              <select className="input-field" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="azubi">Azubi</option>
                <option value="ausbilder">Ausbilder</option>
              </select>
            </div>
            {form.role === 'ausbilder' && currentUser?.is_super_admin && (
              <div className="col-span-2">
                <label className="label">Berechtigungsrolle</label>
                <select className="input-field" value={form.permission_role_id} onChange={e => setForm(f => ({ ...f, permission_role_id: e.target.value }))}>
                  <option value="">— Keine (keine Berechtigungen) —</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-400 col-span-3">
              <input type="checkbox" className="accent-indigo-600" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Konto aktiv
            </label>
          </div>

          <div className="border-t border-[#2a2d4a] pt-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Persönliche Daten</h3>
            {form.role === 'azubi' ? (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Anrede</label>
                  <select className="input-field" value={form.salutation} onChange={e => setForm(f => ({ ...f, salutation: e.target.value }))}>
                    <option value="">—</option>
                    <option value="Herr">Herr</option>
                    <option value="Frau">Frau</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Name</label>
                  <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Anrede</label>
                  <select className="input-field" value={form.salutation} onChange={e => setForm(f => ({ ...f, salutation: e.target.value }))}>
                    <option value="">—</option>
                    <option value="Herr">Herr</option>
                    <option value="Frau">Frau</option>
                  </select>
                </div>
                <div>
                  <label className="label">Vorname</label>
                  <input className="input-field" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Nachname</label>
                  <input className="input-field" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
                </div>
              </div>
            )}
            <div>
              <label className="label">Geburtsdatum</label>
              <input
                type="date" className="input-field max-w-[200px]"
                value={form.birthday || ''} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))}
              />
            </div>
          </div>

          {form.role === 'azubi' && (
            <div className="border-t border-[#2a2d4a] pt-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Azubi-Stammdaten</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Lehrjahr</label>
                  <select className="input-field" value={form.lehrjahr} onChange={e => setForm(f => ({ ...f, lehrjahr: parseInt(e.target.value) }))}>
                    <option value={0}>0. Lehrjahr (startet noch)</option>
                    <option value={1}>1. Lehrjahr</option>
                    <option value={2}>2. Lehrjahr</option>
                    <option value={3}>3. Lehrjahr</option>
                    <option value={4}>4. Lehrjahr</option>
                  </select>
                </div>
                <div>
                  <label className="label">Ausbildungsstart</label>
                  <input type="date" className="input-field" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Abteilung</label>
                <select className="input-field" value={form.current_department_id} onChange={e => setForm(f => ({ ...f, current_department_id: e.target.value }))}>
                  <option value="">— Nicht zugewiesen —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Berichtsheft-Rhythmus</label>
                <select className="input-field" value={form.report_period} onChange={e => setForm(f => ({ ...f, report_period: e.target.value }))}>
                  <option value="week">Wochenbericht</option>
                  <option value="day">Tagesbericht</option>
                </select>
              </div>
              <div className="pt-1">
                <p className="text-xs text-slate-500 mb-2">Geplanter Abteilungswechsel — erscheint 30 Tage vorher als Vorschau im Dashboard und wird am Stichtag automatisch übernommen.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Nächste Abteilung</label>
                    <select className="input-field" value={form.next_department_id} onChange={e => setForm(f => ({ ...f, next_department_id: e.target.value }))}>
                      <option value="">— Keine —</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Nächster Abteilungswechsel</label>
                    <input type="date" className="input-field" value={form.next_rotation_date} onChange={e => setForm(f => ({ ...f, next_rotation_date: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-[#2a2d4a] pt-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kontaktdaten</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Telefon</label>
                <input className="input-field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">Mobiltelefon</label>
                <input className="input-field" value={form.mobile_phone} onChange={e => setForm(f => ({ ...f, mobile_phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="label">Straße</label>
                <input className="input-field" value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} />
              </div>
              <div>
                <label className="label">PLZ</label>
                <input className="input-field" value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Ort</label>
              <input className="input-field" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
          </div>

          <div className="border-t border-[#2a2d4a] pt-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Interne Daten</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Personalnummer</label>
                <input className="input-field" value={form.personnel_number} onChange={e => setForm(f => ({ ...f, personnel_number: e.target.value }))} />
              </div>
              <div>
                <label className="label">Funktion</label>
                <input className="input-field" value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} placeholder="z.B. Ausbildungsleiter" />
              </div>
            </div>
            <div>
              <label className="label">Ausbildungsorte</label>
              <div className="flex flex-wrap gap-2">
                {locations.length === 0 ? (
                  <span className="text-xs text-slate-600">Keine Niederlassungen angelegt</span>
                ) : locations.map(l => (
                  <label key={l.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${form.location_ids.includes(l.id) ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'border-[#2a2d4a] text-slate-400'}`}>
                    <input type="checkbox" className="accent-indigo-600" checked={form.location_ids.includes(l.id)} onChange={() => toggleLocation(l.id)} />
                    {l.name}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-[#2a2d4a] pt-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Weitere Informationen</h3>
            <div>
              <label className="label">Öffentlicher Text</label>
              <textarea className="input-field resize-none" rows={2} value={form.public_note} onChange={e => setForm(f => ({ ...f, public_note: e.target.value }))} />
            </div>
            <div>
              <label className="label">Über mich</label>
              <textarea className="input-field resize-none" rows={2} value={form.about_me} onChange={e => setForm(f => ({ ...f, about_me: e.target.value }))} />
            </div>
            <div>
              <label className="label">Sonstiges (intern)</label>
              <textarea className="input-field resize-none" rows={2} value={form.misc_note} onChange={e => setForm(f => ({ ...f, misc_note: e.target.value }))} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setEditOpen(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Speichern...' : 'Speichern'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!revealPassword} onClose={() => setRevealPassword(null)} title="Einmalpasswort">
        {revealPassword && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Bitte gib dieses Einmalpasswort an <strong className="text-white">{user.email}</strong> weiter. Es wird nur jetzt einmalig angezeigt.
            </p>
            <div className="bg-[#0d0f1a] border border-[#2a2d4a] rounded-lg px-4 py-3 text-center text-lg font-mono tracking-wider text-white">
              {revealPassword}
            </div>
            <button className="btn-primary w-full justify-center" onClick={() => setRevealPassword(null)}>Verstanden</button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Konto löschen"
        message={`Konto "${user.email}" wirklich unwiderruflich löschen?`}
      />
    </div>
  )
}

function FieldRow({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm text-slate-300">{value || '—'}</div>
    </div>
  )
}
