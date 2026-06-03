import { useState, useEffect } from 'react'
import { StickyNote, Pin } from 'lucide-react'
import { notesApi } from '../../api/client'

export default function NotesWidget() {
  const [notes, setNotes] = useState([])

  useEffect(() => {
    notesApi.getAll().then(setNotes).catch(() => {})
    const interval = setInterval(() => notesApi.getAll().then(setNotes).catch(() => {}), 120000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <StickyNote size={14} className="text-indigo-400" />
          <span className="widget-title">Notizen</span>
        </div>
        <span className="text-xs text-slate-600 bg-[#1e2035] px-2 py-0.5 rounded-full">
          {notes.length}
        </span>
      </div>
      <div className="widget-body space-y-2">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-600">
            <StickyNote size={24} className="mb-2 opacity-30" />
            <span className="text-sm">Keine Notizen</span>
          </div>
        ) : (
          notes.map(note => (
            <div
              key={note.id}
              className="p-3 rounded-lg border border-[#2a2d4a] hover:border-indigo-500/30 transition-colors"
              style={{ borderLeftColor: note.color, borderLeftWidth: 3 }}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-white">{note.title}</span>
                {note.pinned ? <Pin size={12} className="text-amber-400 shrink-0 mt-0.5" /> : null}
              </div>
              {note.content && (
                <p className="text-xs text-slate-300 mt-1.5 line-clamp-3 whitespace-pre-wrap">
                  {note.content}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
