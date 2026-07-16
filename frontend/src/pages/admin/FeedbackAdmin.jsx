import { useState, useEffect } from 'react'
import { MessageSquareText, Plus, Trash2, Star, AlignLeft, FlaskConical, Copy, Check } from 'lucide-react'
import { feedbackTemplatesApi, feedbackApi, azubisApi, departmentsApi } from '../../api/client'

const KIND_LABEL = { azubi_to_team: 'Azubi bewertet Team', team_to_azubi: 'Team bewertet Azubi' }

function TemplateEditor({ kind }) {
  const [template, setTemplate] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const load = () => feedbackTemplatesApi.getAll().then(all => {
    setTemplate(all.find(t => t.kind === kind) || { kind, name: KIND_LABEL[kind], questions: [] })
  })
  useEffect(() => { load() }, [kind])

  if (!template) return <p className="text-sm text-slate-600">Lädt...</p>

  const updateQuestion = (idx, patch) => {
    setSaved(false)
    setTemplate(t => ({ ...t, questions: t.questions.map((q, i) => i === idx ? { ...q, ...patch } : q) }))
  }
  const addQuestion = () => {
    setSaved(false)
    const id = `q${Date.now()}`
    setTemplate(t => ({ ...t, questions: [...t.questions, { id, type: 'rating', label: '' }] }))
  }
  const removeQuestion = (idx) => {
    setSaved(false)
    setTemplate(t => ({ ...t, questions: t.questions.filter((_, i) => i !== idx) }))
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await feedbackTemplatesApi.update(kind, { name: template.name, questions: template.questions })
      setSaved(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Speichern fehlgeschlagen')
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white">{KIND_LABEL[kind]}</h2>
      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
      <div className="space-y-3">
        {template.questions.map((q, idx) => (
          <div key={q.id} className="border border-[#2a2d4a] rounded-lg p-3 flex items-start gap-3">
            <div className="flex gap-1 shrink-0 mt-1.5">
              <button
                type="button" title="Bewertung (1-5)"
                onClick={() => updateQuestion(idx, { type: 'rating' })}
                className={`p-1.5 rounded ${q.type === 'rating' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-600 hover:text-slate-400'}`}
              ><Star size={14} /></button>
              <button
                type="button" title="Freitext"
                onClick={() => updateQuestion(idx, { type: 'text' })}
                className={`p-1.5 rounded ${q.type === 'text' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-600 hover:text-slate-400'}`}
              ><AlignLeft size={14} /></button>
            </div>
            <input
              className="input-field flex-1" placeholder="Frage..."
              value={q.label} onChange={e => updateQuestion(idx, { label: e.target.value })}
            />
            <button onClick={() => removeQuestion(idx)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 shrink-0 mt-1"><Trash2 size={13} /></button>
          </div>
        ))}
        {template.questions.length === 0 && <p className="text-xs text-slate-600">Noch keine Fragen.</p>}
      </div>
      <div className="flex items-center justify-between">
        <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={addQuestion}>
          <Plus size={12} /> Frage hinzufügen
        </button>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-400">Gespeichert.</span>}
          <button className="btn-primary" onClick={save} disabled={saving || template.questions.length === 0}>
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TestRunner() {
  const [azubis, setAzubis] = useState([])
  const [departments, setDepartments] = useState([])
  const [azubiId, setAzubiId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    azubisApi.getAll().then(setAzubis).catch(() => {})
    departmentsApi.getAll().then(setDepartments).catch(() => {})
  }, [])

  const create = async () => {
    if (!azubiId || !departmentId) return
    setLoading(true)
    setError('')
    setResult(null)
    setCopied(false)
    try {
      const created = await feedbackApi.createTest(Number(azubiId), Number(departmentId))
      setResult(created)
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Erstellen')
    } finally { setLoading(false) }
  }

  const copyLink = () => {
    navigator.clipboard?.writeText(result.team_link)
    setCopied(true)
  }

  const selectedAzubi = azubis.find(a => a.id === Number(azubiId))

  return (
    <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-3">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <FlaskConical size={15} className="text-teal-400" />
        Testlauf (kein SMTP nötig)
      </h2>
      <p className="text-xs text-slate-500">
        Legt für einen frei gewählten Azubi/Abteilung dasselbe Bogen-Paar an wie bei einem echten Abteilungswechsel.
        Der Azubi-Bogen erscheint sofort auf der Profilseite des Azubis, den Team-Link bekommst du hier direkt zum
        Kopieren (statt per Mail, falls noch kein SMTP eingerichtet ist).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Azubi</label>
          <select className="input-field" value={azubiId} onChange={e => setAzubiId(e.target.value)}>
            <option value="">Auswählen...</option>
            {azubis.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Abteilung</label>
          <select className="input-field" value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
            <option value="">Auswählen...</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="btn-primary" onClick={create} disabled={loading || !azubiId || !departmentId}>
        {loading ? 'Erzeuge...' : 'Test-Feedback erzeugen'}
      </button>
      {result && (
        <div className="border border-[#2a2d4a] rounded-lg p-3 space-y-2">
          {result.azubi_instance_id && selectedAzubi && (
            <p className="text-xs text-green-400">
              Azubi-Bogen angelegt -- jetzt auf der Profilseite von {selectedAzubi.name} sichtbar.
            </p>
          )}
          {result.team_link ? (
            <div>
              <label className="label">Team-Link (Magic Link)</label>
              <div className="flex gap-2">
                <input readOnly className="input-field text-xs" value={result.team_link} onClick={e => e.target.select()} />
                <button type="button" className="btn-secondary shrink-0" onClick={copyLink}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Kopiert' : 'Kopieren'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600">Kein Team-Bogen angelegt (kein Bogen für "Team bewertet Azubi" gefunden).</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function FeedbackAdmin() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageSquareText size={20} className="text-teal-400" />
          Feedback
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Bewertungsbögen bei Abteilungswechsel -- Azubi bewertet Team und umgekehrt.
          Eingereichte Bewertungen findest du aus Datenschutzgründen auf der jeweiligen Azubi-Profilseite, nicht hier.
        </p>
      </div>

      <TestRunner />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TemplateEditor kind="azubi_to_team" />
        <TemplateEditor kind="team_to_azubi" />
      </div>
    </div>
  )
}
