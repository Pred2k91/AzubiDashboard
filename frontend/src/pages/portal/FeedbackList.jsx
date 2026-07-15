import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquareText, Clock, CheckCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { feedbackApi } from '../../api/client'

export default function FeedbackList() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])

  useEffect(() => { feedbackApi.getMine().then(setItems).catch(() => {}) }, [])

  const pending = items.filter(i => i.status === 'pending')
  const submitted = items.filter(i => i.status === 'submitted')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageSquareText size={20} className="text-teal-400" />
          Feedback zu deinen Abteilungen
        </h1>
        <p className="text-sm text-slate-500 mt-1">Nach jedem Abteilungswechsel darfst du das Team bewerten</p>
      </div>

      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2a2d4a] text-sm font-semibold text-white">
          Ausstehend {pending.length > 0 && <span className="text-slate-500 font-normal">({pending.length})</span>}
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-8">Nichts offen</p>
        ) : (
          <div className="divide-y divide-[#2a2d4a]">
            {pending.map(i => (
              <button
                key={i.id}
                onClick={() => navigate(`/portal/feedback/${i.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1e2035] transition-colors text-left"
              >
                <Clock size={14} className="text-amber-400 shrink-0" />
                <span className="flex-1 text-sm font-medium text-white">{i.department_name}</span>
                <span className="text-xs text-amber-400">Ausfüllen</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {submitted.length > 0 && (
        <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2d4a] text-sm font-semibold text-white">Abgegeben</div>
          <div className="divide-y divide-[#2a2d4a]">
            {submitted.map(i => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                <CheckCircle size={14} className="text-green-400 shrink-0" />
                <span className="flex-1 text-sm text-slate-300">{i.department_name}</span>
                <span className="text-xs text-slate-500">
                  {i.submitted_at && format(parseISO(i.submitted_at), 'dd.MM.yyyy', { locale: de })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
