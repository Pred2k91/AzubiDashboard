import { useState, useEffect, useCallback } from 'react'
import { CheckSquare, Circle, Clock, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, parseISO, isPast } from 'date-fns'
import { todosApi, settingsApi } from '../../api/client'

const PRIORITY_CONFIG = {
  high:   { color: 'text-red-400',   bg: 'bg-red-500/10',   label: 'Hoch' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Mittel' },
  low:    { color: 'text-slate-400', bg: 'bg-slate-500/10', label: 'Niedrig' },
}

const PAGE_SIZE = 3

export default function TodoWidget() {
  const [todos, setTodos] = useState([])
  const [pageIdx, setPageIdx] = useState(0)
  const [visible, setVisible] = useState(true)
  const [interval, setIntervalVal] = useState(8000)

  const load = () => todosApi.getAll().then(data => setTodos(data.filter(t => t.status !== 'done'))).catch(() => {})

  useEffect(() => {
    load()
    settingsApi.getAll().then(s => { if (s.announcement_interval) setIntervalVal(s.announcement_interval) }).catch(() => {})
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])

  const pages = []
  for (let i = 0; i < todos.length; i += PAGE_SIZE) pages.push(todos.slice(i, i + PAGE_SIZE))
  const total = pages.length

  const goTo = useCallback((idx) => {
    setVisible(false)
    setTimeout(() => { setPageIdx(idx); setVisible(true) }, 200)
  }, [])

  useEffect(() => {
    if (total <= 1) return
    const t = setInterval(() => goTo((pageIdx + 1) % total), interval)
    return () => clearInterval(t)
  }, [pageIdx, total, interval, goTo])

  useEffect(() => {
    if (pageIdx >= total && total > 0) setPageIdx(0)
  }, [total])

  const handleToggle = async (todo) => {
    const newStatus = todo.status === 'open' ? 'in_progress' : 'done'
    await todosApi.update(todo.id, { ...todo, status: newStatus })
    if (newStatus === 'done') setTodos(prev => prev.filter(t => t.id !== todo.id))
    else setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, status: newStatus } : t))
  }

  const current = pages[pageIdx] || []

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <CheckSquare size={14} className="text-indigo-400" />
          <span className="widget-title">
            Aufgaben
            {total > 1 && <span className="text-slate-600 font-normal ml-1 text-[10px]">{pageIdx + 1}/{total}</span>}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {total > 1 && (
            <div className="flex items-center gap-0.5">
              {pages.map((_, i) => (
                <button key={i} onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all ${i === pageIdx ? 'bg-indigo-400 w-3' : 'bg-slate-600 w-1.5'}`} />
              ))}
            </div>
          )}
          {total > 1 && (
            <div className="flex gap-0.5">
              <button onClick={() => goTo((pageIdx - 1 + total) % total)}
                className="p-1 rounded text-slate-600 hover:text-slate-300 transition-colors">
                <ChevronLeft size={12} />
              </button>
              <button onClick={() => goTo((pageIdx + 1) % total)}
                className="p-1 rounded text-slate-600 hover:text-slate-300 transition-colors">
                <ChevronRight size={12} />
              </button>
            </div>
          )}
          <span className="text-xs text-slate-600 bg-[#1e2035] px-2 py-0.5 rounded-full">
            {todos.length} offen
          </span>
        </div>
      </div>

      <div className="widget-body space-y-2" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease' }}>
        {todos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-600">
            <CheckSquare size={24} className="mb-2 opacity-30" />
            <span className="text-sm">Keine offenen Aufgaben</span>
          </div>
        ) : (
          current.map(todo => {
            const p = PRIORITY_CONFIG[todo.priority] || PRIORITY_CONFIG.medium
            const overdue = todo.due_date && isPast(parseISO(todo.due_date))
            return (
              <div key={todo.id}
                className={`group flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer
                  ${todo.status === 'in_progress'
                    ? 'border-indigo-500/30 bg-indigo-500/5'
                    : 'border-[#2a2d4a] hover:border-indigo-500/30 hover:bg-[#1e2035]'
                  }`}
                onClick={() => handleToggle(todo)}
              >
                <div className="mt-0.5 shrink-0">
                  {todo.status === 'in_progress'
                    ? <Clock size={15} className="text-indigo-400" />
                    : <Circle size={15} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium truncate">{todo.title}</span>
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${p.bg} ${p.color}`}>
                      {p.label}
                    </span>
                  </div>
                  {todo.due_date && (
                    <div className={`flex items-center gap-1 mt-1 text-xs ${overdue ? 'text-red-400' : 'text-slate-400'}`}>
                      {overdue && <AlertCircle size={10} />}
                      {format(parseISO(todo.due_date), 'dd.MM.yyyy')}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
