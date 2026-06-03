import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, GraduationCap, ChevronDown, ChevronUp, Search, Users } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { schoolsApi, azubisApi } from '../../api/client'

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#64748b']
const SCHOOL_EMPTY = { name: '', color: '#06b6d4', location: '' }
const BLOCK_EMPTY = { start_date: '', end_date: '', notes: '', azubi_ids: [] }

export default function SchoolsAdmin() {
  const [schools, setSchools] = useState([])
  const [blocks, setBlocks] = useState({})
  const [expanded, setExpanded] = useState({})
  const [allAzubis, setAllAzubis] = useState([])
  const [azubiSearch, setAzubiSearch] = useState('')

  const [schoolModal, setSchoolModal] = useState(false)
  const [blockModal, setBlockModal] = useState(false)
  const [editingSchool, setEditingSchool] = useState(null)
  const [editingBlock, setEditingBlock] = useState(null)
  const [activeSchoolId, setActiveSchoolId] = useState(null)
  const [schoolForm, setSchoolForm] = useState(SCHOOL_EMPTY)
  const [blockForm, setBlockForm] = useState(BLOCK_EMPTY)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadSchools()
    azubisApi.getAll().then(setAllAzubis).catch(() => {})
  }, [])

  const loadSchools = async () => {
    const s = await schoolsApi.getAll().catch(() => [])
    setSchools(s)
  }

  const loadBlocks = async (schoolId) => {
    const b = await schoolsApi.getBlocks(schoolId).catch(() => [])
    setBlocks(prev => ({ ...prev, [schoolId]: b }))
  }

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
    if (!blocks[id]) loadBlocks(id)
  }

  // ── Schule ──────────────────────────────────────────────────────────────────
  const openNewSchool = () => { setEditingSchool(null); setSchoolForm(SCHOOL_EMPTY); setError(''); setSchoolModal(true) }
  const openEditSchool = (s) => { setEditingSchool(s); setSchoolForm({ name: s.name, color: s.color, location: s.location || '' }); setError(''); setSchoolModal(true) }

  const saveSchool = async () => {
    if (!schoolForm.name) { setError('Name erforderlich'); return }
    setLoading(true); setError('')
    try {
      if (editingSchool) await schoolsApi.update(editingSchool.id, schoolForm)
      else await schoolsApi.create(schoolForm)
      await loadSchools()
      setSchoolModal(false)
    } catch (err) { setError(err.response?.data?.error || 'Fehler') }
    finally { setLoading(false) }
  }

  // ── Block ───────────────────────────────────────────────────────────────────
  const openNewBlock = (schoolId) => {
    setEditingBlock(null); setActiveSchoolId(schoolId)
    setBlockForm(BLOCK_EMPTY); setAzubiSearch(''); setError('')
    setBlockModal(true)
  }
  const openEditBlock = (block, schoolId) => {
    setEditingBlock(block); setActiveSchoolId(schoolId)
    setBlockForm({ start_date: block.start_date, end_date: block.end_date, notes: block.notes || '', azubi_ids: block.azubi_ids || [] })
    setAzubiSearch(''); setError('')
    setBlockModal(true)
  }

  const saveBlock = async () => {
    if (!blockForm.start_date || !blockForm.end_date) { setError('Start- und Enddatum erforderlich'); return }
    setLoading(true); setError('')
    try {
      if (editingBlock) await schoolsApi.updateBlock(editingBlock.id, blockForm)
      else await schoolsApi.createBlock(activeSchoolId, blockForm)
      await loadBlocks(activeSchoolId)
      setBlockModal(false)
    } catch (err) { setError(err.response?.data?.error || 'Fehler') }
    finally { setLoading(false) }
  }

  const toggleAzubi = (id) => setBlockForm(f => ({
    ...f,
    azubi_ids: f.azubi_ids.includes(id) ? f.azubi_ids.filter(i => i !== id) : [...f.azubi_ids, id]
  }))

  const handleDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'school') {
      await schoolsApi.delete(deleteTarget.id)
      await loadSchools()
    } else {
      await schoolsApi.deleteBlock(deleteTarget.id)
      await loadBlocks(deleteTarget.schoolId)
    }
    setDeleteTarget(null)
  }

  const filteredAzubis = allAzubis.filter(a => a.name.toLowerCase().includes(azubiSearch.toLowerCase()))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <GraduationCap size={20} className="text-cyan-400" />
            Berufsschulen
          </h1>
          <p className="text-sm text-slate-500 mt-1">{schools.length} Schulen · Unterrichtsblöcke verwalten</p>
        </div>
        <button className="btn-primary" onClick={openNewSchool}>
          <Plus size={16} /> Neue Schule
        </button>
      </div>

      {schools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <GraduationCap size={40} className="mb-3 opacity-20" />
          <p>Noch keine Berufsschulen angelegt</p>
        </div>
      ) : schools.map(school => (
        <div key={school.id} className="bg-[#141625] rounded-xl border border-[#2a2d4a]">
          {/* Schul-Header */}
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0"
              style={{ backgroundColor: `${school.color}20`, color: school.color }}>
              <GraduationCap size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white">{school.name}</div>
              {school.location && <div className="text-xs text-slate-500">{school.location}</div>}
            </div>
            <button className="btn-secondary text-xs py-1.5" onClick={() => openNewBlock(school.id)}>
              <Plus size={13} /> Block
            </button>
            <button onClick={() => openEditSchool(school)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]">
              <Pencil size={13} />
            </button>
            <button onClick={() => setDeleteTarget({ type: 'school', id: school.id })} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10">
              <Trash2 size={13} />
            </button>
            <button onClick={() => toggleExpand(school.id)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]">
              {expanded[school.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Blöcke */}
          {expanded[school.id] && (
            <div className="border-t border-[#2a2d4a]">
              {!blocks[school.id] ? (
                <div className="px-4 py-4 text-sm text-slate-600">Lädt...</div>
              ) : blocks[school.id].length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-600 text-center">Noch keine Blöcke für diese Schule</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Zeitraum</th>
                      <th>Azubis</th>
                      <th>Notiz</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocks[school.id].map(block => {
                      const isActive = block.start_date <= new Date().toISOString().slice(0,10) && block.end_date >= new Date().toISOString().slice(0,10)
                      return (
                        <tr key={block.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" title="Aktiv" />}
                              <span className="text-sm font-medium" style={{ color: isActive ? school.color : undefined }}>
                                {format(parseISO(block.start_date), 'dd.MM.yyyy', { locale: de })}
                                <span className="text-slate-500 mx-1">–</span>
                                {format(parseISO(block.end_date), 'dd.MM.yyyy', { locale: de })}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-1 flex-wrap">
                              {block.azubis.slice(0, 4).map(a => (
                                <span key={a.id} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${school.color}20`, color: school.color }}>
                                  {a.name.split(' ')[0]}
                                </span>
                              ))}
                              {block.azubis.length > 4 && (
                                <span className="text-xs text-slate-500">+{block.azubis.length - 4}</span>
                              )}
                              {block.azubis.length === 0 && <span className="text-slate-600 text-xs">—</span>}
                            </div>
                          </td>
                          <td className="text-sm text-slate-500">{block.notes || '—'}</td>
                          <td>
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => openEditBlock(block, school.id)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]"><Pencil size={13} /></button>
                              <button onClick={() => setDeleteTarget({ type: 'block', id: block.id, schoolId: school.id })} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Schul-Modal */}
      <Modal open={schoolModal} onClose={() => setSchoolModal(false)} title={editingSchool ? 'Schule bearbeiten' : 'Neue Berufsschule'}>
        <div className="space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
          <div>
            <label className="label">Name *</label>
            <input className="input-field" value={schoolForm.name} onChange={e => setSchoolForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. BSZ Musterstadt" />
          </div>
          <div>
            <label className="label">Standort</label>
            <input className="input-field" value={schoolForm.location} onChange={e => setSchoolForm(f => ({ ...f, location: e.target.value }))} placeholder="Adresse oder Ort" />
          </div>
          <div>
            <label className="label">Farbe</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setSchoolForm(f => ({ ...f, color: c }))} className={`w-7 h-7 rounded-lg border-2 transition-all ${schoolForm.color === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setSchoolModal(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={saveSchool} disabled={loading}>{loading ? 'Speichern...' : 'Speichern'}</button>
          </div>
        </div>
      </Modal>

      {/* Block-Modal */}
      <Modal open={blockModal} onClose={() => setBlockModal(false)} title={editingBlock ? 'Block bearbeiten' : 'Neuer Unterrichtsblock'} size="lg">
        <div className="space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Startdatum *</label>
              <input type="date" className="input-field" value={blockForm.start_date} onChange={e => setBlockForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Enddatum *</label>
              <input type="date" className="input-field" value={blockForm.end_date} onChange={e => setBlockForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Notiz</label>
            <input className="input-field" value={blockForm.notes} onChange={e => setBlockForm(f => ({ ...f, notes: e.target.value }))} placeholder="z.B. Klasse M23B" />
          </div>
          <div>
            <label className="label flex items-center gap-1">
              <Users size={12} /> Azubis
              {blockForm.azubi_ids.length > 0 && <span className="text-indigo-400 ml-1">({blockForm.azubi_ids.length} ausgewählt)</span>}
            </label>
            <div className="relative mb-2">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input className="input-field pl-7 text-xs py-1.5" placeholder="Azubi suchen..." value={azubiSearch} onChange={e => setAzubiSearch(e.target.value)} />
            </div>
            <div className="max-h-48 overflow-y-auto border border-[#2a2d4a] rounded-lg divide-y divide-[#2a2d4a]/50">
              {filteredAzubis.map(a => (
                <label key={a.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#1e2035] cursor-pointer">
                  <input type="checkbox" className="accent-indigo-600" checked={blockForm.azubi_ids.includes(a.id)} onChange={() => toggleAzubi(a.id)} />
                  <span className="text-sm text-slate-300 flex-1">{a.name}</span>
                  <span className="text-xs text-slate-600">{a.lehrjahr}. Lj.</span>
                </label>
              ))}
            </div>
            {blockForm.azubi_ids.length > 0 && (
              <button className="mt-1.5 text-xs text-slate-600 hover:text-slate-400" onClick={() => setBlockForm(f => ({ ...f, azubi_ids: [] }))}>
                Alle abwählen
              </button>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setBlockModal(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={saveBlock} disabled={loading}>{loading ? 'Speichern...' : 'Speichern'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget?.type === 'school' ? 'Schule löschen' : 'Block löschen'}
        message={deleteTarget?.type === 'school' ? 'Schule und alle Blöcke wirklich löschen?' : 'Diesen Unterrichtsblock wirklich löschen?'}
      />
    </div>
  )
}
