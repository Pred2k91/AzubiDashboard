import { useState } from 'react'
import { Star, Send } from 'lucide-react'

// Wiederverwendet vom Azubi-Selbstbedienungs-Formular (/portal/feedback/:id) UND vom
// öffentlichen Magic-Link-Formular (/feedback/:token) -- beide sammeln dieselbe Art
// Antworten (Bewertung 1-5 oder Freitext) gegen einen questions_snapshot.
export default function FeedbackQuestionForm({ questions, onSubmit, submitting, error }) {
  const [answers, setAnswers] = useState(() => {
    const initial = {}
    questions.forEach(q => { initial[q.id] = q.type === 'rating' ? 0 : '' })
    return initial
  })

  const setAnswer = (id, value) => setAnswers(a => ({ ...a, [id]: value }))
  const complete = questions.every(q => q.type === 'rating' ? answers[q.id] > 0 : String(answers[q.id] || '').trim())

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
      {questions.map(q => (
        <div key={q.id} className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-4 space-y-2">
          <div className="text-sm font-medium text-white">{q.label}</div>
          {q.type === 'rating' ? (
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n} type="button" onClick={() => setAnswer(q.id, n)}
                  className="p-0.5"
                >
                  <Star size={24} className={n <= answers[q.id] ? 'text-amber-400 fill-amber-400' : 'text-slate-700 hover:text-slate-500'} />
                </button>
              ))}
            </div>
          ) : (
            <textarea
              className="input-field resize-none" rows={3}
              value={answers[q.id]} onChange={e => setAnswer(q.id, e.target.value)}
              placeholder="Deine Antwort..."
            />
          )}
        </div>
      ))}
      <button
        type="button" onClick={() => onSubmit(answers)} disabled={!complete || submitting}
        className="btn-primary w-full justify-center"
      >
        <Send size={14} />
        {submitting ? 'Wird gesendet...' : 'Absenden'}
      </button>
      {!complete && <p className="text-xs text-slate-600 text-center">Bitte alle Fragen beantworten, um abzusenden.</p>}
    </div>
  )
}
