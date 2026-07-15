import { useState, useEffect } from 'react'
import { MessageSquareText, Plus, Trash2, Star, AlignLeft, Send, RotateCcw } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { feedbackTemplatesApi, feedbackApi } from '../../api/client'

const KIND_LABEL = { azubi_to_team: 'Azubi bewertet Team', team_to_azubi: 'Team bewertet Azubi' }
const STATUS_LABEL = { pending: 'Ausstehend', submitted: 'Abgegeben' }
const STATUS_CLS = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  submitted: 'bg-green-500/10 text-green-400 border-green-500/20',
}

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

function InstanceDetail({ instance, onClose, onResend }) {
  if (!instance) return null
  return (
    <Modal open={!!instance} onClose={onClose} title={`${KIND_LABEL[instance.kind]} — ${instance.azubi_name}`} size="lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">{instance.department_name}</span>
          <span className={`badge border ${STATUS_CLS[instance.status]}`}>{STATUS_LABEL[instance.status]}</span>
        </div>
        <div className="space-y-3">
          {instance.questions_snapshot.map(q => (
            <div key={q.id} className="border border-[#2a2d4a] rounded-lg p-3">
              <div className="text-sm text-slate-300 mb-1.5">{q.label}</div>
              {instance.answers ? (
                q.type === 'rating' ? (
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} size={16} className={n <= instance.answers[q.id] ? 'text-amber-400 fill-amber-400' : 'text-slate-700'} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white whitespace-pre-wrap">{instance.answers[q.id]}</p>
                )
              ) : (
                <p className="text-xs text-slate-600 italic">Noch keine Antwort</p>
              )}
            </div>
          ))}
        </div>
        {instance.kind === 'team_to_azubi' && instance.status === 'pending' && (
          <div className="flex justify-end">
            <button className="btn-secondary" onClick={() => onResend(instance)}>
              <RotateCcw size={14} /> Link erneut senden
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function FeedbackAdmin() {
  const [instances, setInstances] = useState([])
  const [filterKind, setFilterKind] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [detail, setDetail] = useState(null)
  const [resendMsg, setResendMsg] = useState('')

  const load = () => feedbackApi.getAll({
    ...(filterKind ? { kind: filterKind } : {}),
    ...(filterStatus ? { status: filterStatus } : {}),
  }).then(setInstances).catch(() => {})
  useEffect(() => { load() }, [filterKind, filterStatus])

  const openDetail = async (i) => {
    const full = await feedbackApi.getOne(i.id).catch(() => null)
    setDetail(full)
  }

  const handleResend = async (instance) => {
    setResendMsg('')
    try {
      await feedbackApi.resend(instance.id)
      setResendMsg('Einladung erneut versendet.')
    } catch (err) {
      setResendMsg(err.response?.data?.error || 'Versand fehlgeschlagen')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageSquareText size={20} className="text-teal-400" />
          Feedback
        </h1>
        <p className="text-sm text-slate-500 mt-1">Bewertungsbögen bei Abteilungswechsel -- Azubi bewertet Team und umgekehrt</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TemplateEditor kind="azubi_to_team" />
        <TemplateEditor kind="team_to_azubi" />
      </div>

      <div className="border-t border-[#2a2d4a] pt-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-white">Übersicht</h2>
          <div className="flex gap-2">
            <select className="input-field text-xs py-1.5 w-auto" value={filterKind} onChange={e => setFilterKind(e.target.value)}>
              <option value="">Alle Arten</option>
              <option value="azubi_to_team">Azubi bewertet Team</option>
              <option value="team_to_azubi">Team bewertet Azubi</option>
            </select>
            <select className="input-field text-xs py-1.5 w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Alle Status</option>
              <option value="pending">Ausstehend</option>
              <option value="submitted">Abgegeben</option>
            </select>
          </div>
        </div>
        {resendMsg && <p className="text-xs text-slate-400">{resendMsg}</p>}

        <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Azubi</th>
                <th>Abteilung</th>
                <th>Art</th>
                <th>Status</th>
                <th>Angelegt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {instances.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-slate-600 py-10">Keine Feedback-Bögen</td></tr>
              ) : instances.map(i => (
                <tr key={i.id} className="cursor-pointer" onClick={() => openDetail(i)}>
                  <td className="text-white">{i.azubi_name}</td>
                  <td>{i.department_name}</td>
                  <td className="text-slate-400 text-xs">{KIND_LABEL[i.kind]}</td>
                  <td><span className={`badge border ${STATUS_CLS[i.status]}`}>{STATUS_LABEL[i.status]}</span></td>
                  <td className="text-slate-500 text-xs">{i.created_at}</td>
                  <td>{i.kind === 'team_to_azubi' && <Send size={13} className="text-slate-600" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <InstanceDetail instance={detail} onClose={() => setDetail(null)} onResend={handleResend} />
    </div>
  )
}
