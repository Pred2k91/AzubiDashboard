import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Users, RotateCcw, Search } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { azubisApi, departmentsApi } from '../../api/client'
import { format, parseISO } from 'date-fns'

const EMPTY = { name: '', lehrjahr: 1, start_date: '', current_department_id: '', email: '', birthday: '', next_department_id: '', next_rotation_date: '', report_period: 'week' }

export default function AzubiAdmin() {
  const [azubis, setAzubis] = useState([])
  const [departments, setDepartments] = useState([])
  const [modal, setModal] = useState(false)
  const [rotationModal, setRotationModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [deleteId, setDeleteId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [rotationAssignments, setRotationAssignments] = useState({})
  const [rotationDate, setRotationDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const load = async () => {
    const [a, d] = await Promise.all([azubisApi.getAll(), departmentsApi.getAll()]).catch(() => [[], []])
    setAzubis(a)
    setDepartments(d)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(EMPTY); setModal(true) }
  const openEdit = (a) => {
    setEditing(a)
    setForm({
      name: a.name, lehrjahr: a.lehrjahr, start_date: a.start_date || '',
      current_department_id: a.current_department_id || '', email: a.email || '', birthday: a.birthday || '',
      next_department_id: a.next_department_id || '', next_rotation_date: a.next_rotation_date || '',
      report_period: a.report_period || 'week',
    })
    setModal(true)
  }

  const openRotation = () => {
    const init = {}
    azubis.forEach(a => { init[a.id] = a.current_department_id || '' })
    setRotationAssignments(init)
    setRotationModal(true)
  }

  const handleSave = async () => {
    if (!form.name) return
    setLoading(true)
    try {
      const data = {
        ...form,
        current_department_id: form.current_department_id || null,
        start_date: form.start_date || null,
        next_department_id: form.next_department_id || null,
        next_rotation_date: form.next_rotation_date || null,
      }
      if (editing) await azubisApi.update(editing.id, data)
      else await azubisApi.create(data)
      await load()
      setModal(false)
    } finally { setLoading(false) }
  }

  const handleRotationSave = async () => {
    setLoading(true)
    try {
      const assignments = Object.entries(rotationAssignments).map(([azubi_id, department_id]) => ({
        azubi_id: parseInt(azubi_id),
        department_id: department_id ? parseInt(department_id) : null,
      }))
      await azubisApi.bulkRotation(assignments, rotationDate)
      await load()
      setRotationModal(false)
    } finally { setLoading(false) }
  }

  const filtered = azubis.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.department_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const byLehrjahr = [0, 1, 2, 3, 4].filter(y => filtered.some(a => a.lehrjahr === y))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={20} className="text-purple-400" />
            Azubis
          </h1>
          <p className="text-sm text-slate-500 mt-1">{azubis.length} aktive Azubis</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={openRotation}>
            <RotateCcw size={14} />
            Abteilungswechsel
          </button>
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} />
            Neuer Azubi
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          className="input-field pl-8"
          placeholder="Azubi oder Abteilung suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {byLehrjahr.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <Users size={40} className="mb-3 opacity-20" />
          <p>Keine Azubis gefunden</p>
        </div>
      ) : byLehrjahr.map(year => (
        <div key={year} className="bg-[#141625] rounded-xl border border-[#2a2d4a]">
          <div className="px-4 py-3 border-b border-[#2a2d4a] flex items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {year === 0 ? 'Startet noch (0. Lehrjahr)' : `${year}. Lehrjahr`}
            </span>
            <span className="text-xs bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded-full">
              {filtered.filter(a => a.lehrjahr === year).length}
            </span>
          </div>
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Abteilung</th>
                <th>Ausbildungsstart</th>
                <th>E-Mail</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.filter(a => a.lehrjahr === year).map(a => (
                <tr key={a.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-purple-600/20 text-purple-300 shrink-0">
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-white">{a.name}</span>
                    </div>
                  </td>
                  <td>
                    {a.department_name ? (
                      <span className="flex items-center gap-1.5 text-sm">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.department_color }} />
                        {a.department_name}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-sm">Nicht zugewiesen</span>
                    )}
                  </td>
                  <td className="text-sm text-slate-400">
                    {a.start_date ? format(parseISO(a.start_date), 'dd.MM.yyyy') : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="text-sm text-slate-400">{a.email || <span className="text-slate-700">—</span>}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(a)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteId(a.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ))}

      {/* Azubi Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Azubi bearbeiten' : 'Neuer Azubi'}>
        <div className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vor- und Nachname" />
          </div>
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
            <label className="label">E-Mail</label>
            <input type="email" className="input-field" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="azubi@firma.de" />
          </div>
          <div>
            <label className="label">Geburtsdatum</label>
            <input type="date" className="input-field" value={form.birthday} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
          </div>
          <div>
            <label className="label">Berichtsheft-Rhythmus</label>
            <select className="input-field" value={form.report_period} onChange={e => setForm(f => ({ ...f, report_period: e.target.value }))}>
              <option value="week">Wochenbericht</option>
              <option value="day">Tagesbericht</option>
            </select>
            <p className="text-xs text-slate-600 mt-1">Bestimmt, ob der Azubi im Portal einen Tages- oder Wochenbericht ausfüllt (IHK/HWK: nur diese beiden Rhythmen anerkannt).</p>
          </div>
          <div className="pt-2 border-t border-[#2a2d4a]">
            <p className="text-xs text-slate-500 mb-3">
              Geplanter Abteilungswechsel — erscheint 30 Tage vorher als Vorschau im Dashboard und wird am Stichtag automatisch übernommen.
            </p>
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
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setModal(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Speichern...' : 'Speichern'}</button>
          </div>
        </div>
      </Modal>

      {/* Abteilungswechsel Modal */}
      <Modal open={rotationModal} onClose={() => setRotationModal(false)} title="Abteilungswechsel" size="lg">
        <div className="space-y-4">
          <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-lg text-xs text-indigo-300">
            Weise alle Azubis den neuen Abteilungen zu. Typisch: August und Februar. Das Widget "Abteilungswechsel" zeigt die neuen Zuteilungen im Voraus an.
          </div>
          <div>
            <label className="label">Rotationsdatum</label>
            <input type="date" className="input-field max-w-xs" value={rotationDate} onChange={e => setRotationDate(e.target.value)} />
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1 border border-[#2a2d4a] rounded-lg p-2">
            {azubis.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-2 px-2 hover:bg-[#1e2035] rounded-lg">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-purple-600/20 text-purple-300 shrink-0">
                  {a.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-white flex-1" style={{ minWidth: '120px' }}>{a.name}</span>
                <span className="text-xs text-slate-500 shrink-0">{a.lehrjahr}. Lj.</span>
                <select
                  className="input-field w-48 shrink-0 text-xs py-1.5"
                  value={rotationAssignments[a.id] || ''}
                  onChange={e => setRotationAssignments(prev => ({ ...prev, [a.id]: e.target.value }))}
                >
                  <option value="">— Keine —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setRotationModal(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={handleRotationSave} disabled={loading}>
              {loading ? 'Speichern...' : 'Abteilungswechsel speichern'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { azubisApi.delete(deleteId).then(load) }} title="Azubi deaktivieren" message="Diesen Azubi wirklich deaktivieren?" />
    </div>
  )
}
