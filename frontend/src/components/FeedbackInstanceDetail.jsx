import { Star, RotateCcw } from 'lucide-react'
import Modal from './ui/Modal'

const KIND_LABEL = { azubi_to_team: 'Azubi bewertet Team', team_to_azubi: 'Team bewertet Azubi' }
const STATUS_LABEL = { pending: 'Ausstehend', submitted: 'Abgegeben' }
const STATUS_CLS = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  submitted: 'bg-green-500/10 text-green-400 border-green-500/20',
}

// Wiederverwendet von der Admin-Feedback-Übersicht auf der Azubi-Profilseite (dort landet
// sie aus Datenschutzgründen -- kontextgebunden pro Azubi statt in einer durchsuchbaren
// Gesamtliste aller Bewertungen).
export default function FeedbackInstanceDetail({ instance, onClose, onResend }) {
  if (!instance) return null
  return (
    <Modal open={!!instance} onClose={onClose} title={`${KIND_LABEL[instance.kind]} — ${instance.azubi_name || ''}`} size="lg">
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
        {instance.kind === 'team_to_azubi' && instance.status === 'pending' && onResend && (
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

export { KIND_LABEL, STATUS_LABEL, STATUS_CLS }
