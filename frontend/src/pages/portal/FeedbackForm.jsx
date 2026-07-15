import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { feedbackApi } from '../../api/client'
import FeedbackQuestionForm from '../../components/FeedbackQuestionForm'

export default function FeedbackForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [instance, setInstance] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    feedbackApi.getMineOne(id).then(setInstance).catch(() => setError('Bogen konnte nicht geladen werden'))
  }, [id])

  const handleSubmit = async (answers) => {
    setSubmitting(true)
    setError('')
    try {
      await feedbackApi.submitMine(id, answers)
      navigate('/portal/feedback')
    } catch (err) {
      setError(err.response?.data?.error || 'Absenden fehlgeschlagen')
    } finally { setSubmitting(false) }
  }

  if (!instance) {
    return <div className="p-6 text-slate-500 text-sm">{error || 'Lädt...'}</div>
  }

  if (instance.status !== 'pending') {
    return (
      <div className="p-6">
        <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-6 text-center text-slate-500">
          Dieser Bogen wurde bereits abgegeben.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <Link to="/portal/feedback" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300">
        <ArrowLeft size={13} />
        Zurück zur Übersicht
      </Link>
      <div>
        <h1 className="text-xl font-bold text-white">Feedback: {instance.department_name}</h1>
        <p className="text-sm text-slate-500 mt-1">Wie war dein Einsatz in dieser Abteilung?</p>
      </div>
      <FeedbackQuestionForm
        questions={instance.questions_snapshot}
        onSubmit={handleSubmit}
        submitting={submitting}
        error={error}
      />
    </div>
  )
}
