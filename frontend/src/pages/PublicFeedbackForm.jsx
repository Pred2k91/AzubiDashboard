import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { MessageSquareText, CheckCircle2, XCircle } from 'lucide-react'
import { feedbackApi } from '../api/client'
import FeedbackQuestionForm from '../components/FeedbackQuestionForm'

// Öffentliche Seite ohne Login -- Abteilungsleiter haben keinen Systemzugang, der
// Magic-Link aus der E-Mail-Einladung führt direkt hierher. Bewusst im selben dunklen
// Design wie Login/Passwort-Reset gehalten (Seiten außerhalb des angemeldeten Bereichs).
export default function PublicFeedbackForm() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    feedbackApi.getPublic(token).then(setData).catch(err => {
      setLoadError(err.response?.status === 410 ? 'submitted' : 'invalid')
    })
  }, [token])

  const handleSubmit = async (answers) => {
    setSubmitting(true)
    setSubmitError('')
    try {
      await feedbackApi.submitPublic(token, answers)
      setDone(true)
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Absenden fehlgeschlagen')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0f1a] p-4">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-teal-600/20 flex items-center justify-center">
            <MessageSquareText size={24} className="text-teal-400" />
          </div>
          <h1 className="text-lg font-bold text-white">Azubi-Feedback</h1>
        </div>

        {loadError === 'invalid' && (
          <div className="bg-[#141625] border border-[#2a2d4a] rounded-2xl p-8 text-center space-y-2">
            <XCircle size={32} className="text-red-400 mx-auto" />
            <p className="text-white font-medium">Ungültiger Link</p>
            <p className="text-sm text-slate-500">Dieser Feedback-Link ist nicht (mehr) gültig.</p>
          </div>
        )}

        {loadError === 'submitted' && (
          <div className="bg-[#141625] border border-[#2a2d4a] rounded-2xl p-8 text-center space-y-2">
            <CheckCircle2 size={32} className="text-green-400 mx-auto" />
            <p className="text-white font-medium">Bereits abgeschickt</p>
            <p className="text-sm text-slate-500">Dieser Bogen wurde bereits ausgefüllt, vielen Dank.</p>
          </div>
        )}

        {done && (
          <div className="bg-[#141625] border border-[#2a2d4a] rounded-2xl p-8 text-center space-y-2">
            <CheckCircle2 size={32} className="text-green-400 mx-auto" />
            <p className="text-white font-medium">Danke für dein Feedback!</p>
            <p className="text-sm text-slate-500">Deine Antworten wurden übermittelt.</p>
          </div>
        )}

        {data && !done && !loadError && (
          <div className="space-y-4">
            <div className="bg-[#141625] border border-[#2a2d4a] rounded-2xl p-5 text-center">
              <p className="text-sm text-slate-400">Bewertung für</p>
              <p className="text-white font-semibold">{data.azubi_name} — {data.department_name}</p>
            </div>
            <FeedbackQuestionForm
              questions={data.questions}
              onSubmit={handleSubmit}
              submitting={submitting}
              error={submitError}
            />
          </div>
        )}
      </div>
    </div>
  )
}
