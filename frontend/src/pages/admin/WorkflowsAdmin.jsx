import { useState, useEffect } from 'react'
import { Plus, Trash2, Zap, Pencil } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { workflowsApi } from '../../api/client'
import { TRIGGERS, ACTIONS, defaultConfig } from '../../workflowCatalog'

function FieldInput({ field, value, onChange }) {
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm text-slate-400">
        <input type="checkbox" className="accent-indigo-600" checked={!!value} onChange={e => onChange(e.target.checked)} />
        {field.label}
      </label>
    )
  }
  if (field.type === 'select') {
    return (
      <div>
        <label className="label">{field.label}</label>
        <select className="input-field" value={value} onChange={e => onChange(e.target.value)}>
          {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    )
  }
  if (field.type === 'textarea') {
    return (
      <div>
        <label className="label">{field.label}</label>
        <textarea className="input-field resize-none" rows={4} value={value || ''} onChange={e => onChange(e.target.value)} />
      </div>
    )
  }
  if (field.type === 'email_list') {
    return (
      <div>
        <label className="label">{field.label}</label>
        <textarea
          className="input-field resize-none" rows={3}
          value={(value || []).join('\n')}
          onChange={e => onChange(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
        />
      </div>
    )
  }
  if (field.type === 'number') {
    return (
      <div>
        <label className="label">{field.label}</label>
        <input type="number" min={field.min} className="input-field max-w-[140px]" value={value} onChange={e => onChange(Number(e.target.value))} />
      </div>
    )
  }
  return (
    <div>
      <label className="label">{field.label}</label>
      <input className="input-field" value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

const emptyWorkflow = () => ({
  name: '', active: true,
  trigger_type: TRIGGERS[0].type,
  trigger_config: defaultConfig(TRIGGERS[0].fields),
  actions: [],
})

export default function WorkflowsAdmin() {
  const [workflows, setWorkflows] = useState([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyWorkflow())
  const [deleteId, setDeleteId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [runsFor, setRunsFor] = useState(null)
  const [runs, setRuns] = useState([])

  const load = () => workflowsApi.getAll().then(setWorkflows).catch(() => {})
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(emptyWorkflow()); setError(''); setModal(true) }
  const openEdit = (w) => {
    setEditing(w)
    setForm({
      name: w.name, active: !!w.active,
      trigger_type: w.trigger_type, trigger_config: { ...w.trigger_config },
      actions: w.actions.map(a => ({ action_type: a.action_type, action_config: { ...a.action_config } })),
    })
    setError('')
    setModal(true)
  }

  const trigger = TRIGGERS.find(t => t.type === form.trigger_type) || TRIGGERS[0]

  const updateTriggerField = (key, value) => {
    setForm(f => ({ ...f, trigger_config: { ...f.trigger_config, [key]: value } }))
  }

  const addAction = (actionType) => {
    const def = ACTIONS.find(a => a.type === actionType)
    setForm(f => ({ ...f, actions: [...f.actions, { action_type: actionType, action_config: defaultConfig(def.fields) }] }))
  }
  const removeAction = (idx) => {
    setForm(f => ({ ...f, actions: f.actions.filter((_, i) => i !== idx) }))
  }
  const updateActionField = (idx, key, value) => {
    setForm(f => ({
      ...f,
      actions: f.actions.map((a, i) => i === idx ? { ...a, action_config: { ...a.action_config, [key]: value } } : a),
    }))
  }

  const handleSave = async () => {
    if (!form.name) return
    if (form.actions.length === 0) { setError('Mindestens eine Aktion hinzufügen'); return }
    setLoading(true)
    setError('')
    try {
      if (editing) await workflowsApi.update(editing.id, form)
      else await workflowsApi.create(form)
      await load()
      setModal(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Speichern fehlgeschlagen')
    } finally { setLoading(false) }
  }

  const toggleActive = async (w) => {
    await workflowsApi.update(w.id, {
      name: w.name, active: !w.active, trigger_type: w.trigger_type, trigger_config: w.trigger_config,
      actions: w.actions.map(a => ({ action_type: a.action_type, action_config: a.action_config })),
    })
    await load()
  }

  const openRuns = async (w) => {
    setRunsFor(w)
    setRuns(await workflowsApi.getRuns(w.id).catch(() => []))
  }

  const summarizeTrigger = (w) => {
    const t = TRIGGERS.find(x => x.type === w.trigger_type)
    if (!t) return w.trigger_type
    if (w.trigger_config?.min_days != null) return `${t.label} (≥ ${w.trigger_config.min_days} Tage)`
    if (w.trigger_config?.days_before != null) return `${t.label} (${w.trigger_config.days_before} Tage vorher)`
    return t.label
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap size={20} className="text-amber-400" />
            Workflows
          </h1>
          <p className="text-sm text-slate-500 mt-1">{workflows.length} Workflows — automatisierte Aktionen bei wiederkehrenden Ereignissen</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} />
          Neuer Workflow
        </button>
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <Zap size={40} className="mb-3 opacity-20" />
          <p>Noch keine Workflows angelegt</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map(w => (
            <div key={w.id} className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white truncate">{w.name}</h3>
                    {!w.active && <span className="badge bg-slate-500/10 text-slate-400 border border-slate-500/20">Inaktiv</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{summarizeTrigger(w)} · {w.actions.length} Aktion{w.actions.length === 1 ? '' : 'en'}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => toggleActive(w)} className="btn-secondary text-xs py-1 px-2">{w.active ? 'Deaktivieren' : 'Aktivieren'}</button>
                  <button onClick={() => openRuns(w)} className="btn-secondary text-xs py-1 px-2">Verlauf</button>
                  <button onClick={() => openEdit(w)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#2a2d4a]"><Pencil size={13} /></button>
                  <button onClick={() => setDeleteId(w.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Workflow bearbeiten' : 'Neuer Workflow'} size="xl">
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">Name</label>
              <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Berichtsheft überfällig (7 Tage)" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-400 mt-6">
              <input type="checkbox" className="accent-indigo-600" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Aktiv
            </label>
          </div>

          <div className="border-t border-[#2a2d4a] pt-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Auslöser</h3>
            <div>
              <label className="label">Ereignis</label>
              <select
                className="input-field"
                value={form.trigger_type}
                onChange={e => {
                  const t = TRIGGERS.find(x => x.type === e.target.value)
                  setForm(f => ({ ...f, trigger_type: t.type, trigger_config: defaultConfig(t.fields) }))
                }}
              >
                {TRIGGERS.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
              </select>
              {trigger.description && <p className="text-xs text-slate-600 mt-1">{trigger.description}</p>}
            </div>
            {trigger.fields.map(field => (
              <FieldInput key={field.key} field={field} value={form.trigger_config[field.key]} onChange={v => updateTriggerField(field.key, v)} />
            ))}
          </div>

          <div className="border-t border-[#2a2d4a] pt-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Aktionen</h3>
              <div className="flex gap-2">
                {ACTIONS.map(a => (
                  <button key={a.type} type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => addAction(a.type)}>
                    <Plus size={12} /> {a.label}
                  </button>
                ))}
              </div>
            </div>
            {form.actions.length === 0 && <p className="text-xs text-slate-600">Noch keine Aktion hinzugefügt.</p>}
            {form.actions.map((action, idx) => {
              const def = ACTIONS.find(a => a.type === action.action_type)
              return (
                <div key={idx} className="border border-[#2a2d4a] rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{def?.label || action.action_type}</span>
                    <button onClick={() => removeAction(idx)} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                  </div>
                  {def?.fields.map(field => (
                    <FieldInput
                      key={field.key} field={field}
                      value={action.action_config[field.key]}
                      onChange={v => updateActionField(idx, field.key, v)}
                    />
                  ))}
                </div>
              )
            })}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setModal(false)}>Abbrechen</button>
            <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Speichern...' : 'Speichern'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!runsFor} onClose={() => setRunsFor(null)} title={`Verlauf: ${runsFor?.name || ''}`}>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {runs.length === 0 ? (
            <p className="text-sm text-slate-600">Noch keine Ausführung.</p>
          ) : runs.map(r => (
            <div key={r.id} className="flex items-center justify-between text-sm border-b border-[#2a2d4a]/50 py-2 last:border-0">
              <span className="text-slate-300">{r.label}</span>
              <span className="text-xs text-slate-500">{r.fired_at}</span>
            </div>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { workflowsApi.delete(deleteId).then(load) }}
        title="Workflow löschen"
        message="Diesen Workflow wirklich löschen?"
      />
    </div>
  )
}
