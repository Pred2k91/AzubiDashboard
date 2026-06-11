import { useState, useEffect, useCallback } from 'react'
import { BookOpen, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { reportsApi, settingsApi } from '../../api/client'

const PAGE_SIZE = 3

export default function ReportsWidget() {
  const [data, setData] = useState({ azubis: [], warn: 14, alert: 28 })
  const [pageIdx, setPageIdx] = useState(0)
  const [visible, setVisible] = useState(true)
  const [interval, setIntervalVal] = useState(8000)

  const load = () => reportsApi.getStatus().then(setData).catch(() => {})

  useEffect(() => {
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    settingsApi.getAll().then(s => {
      if (s.announcement_interval) setIntervalVal(s.announcement_interval)
    }).catch(() => {})
  }, [])

  const notOk = [...data.azubis.filter(a => a.status === 'alert'), ...data.azubis.filter(a => a.status === 'warn')]
  const okCount = data.azubis.filter(a => a.status === 'ok').length

  const pages = []
  for (let i = 0; i < notOk.length; i += PAGE_SIZE) pages.push(notOk.slice(i, i + PAGE_SIZE))
  const total = pages.length

  const goTo = useCallback((idx) => {
    setVisible(false)
    setTimeout(() => { setPageIdx(idx); setVisible(true) }, 350)
  }, [])

  useEffect(() => {
    if (total <= 1) return
    const t = setInterval(() => goTo((pageIdx + 1) % total), interval)
    return () => clearInterval(t)
  }, [pageIdx, total, interval, goTo])

  useEffect(() => {
    if (pageIdx >= total && total > 0) setPageIdx(0)
  }, [total])

  const current = pages[pageIdx] || []

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-indigo-400" />
          <span className="widget-title">
            Berichtshefte
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
          {notOk.filter(a => a.status === 'alert').length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">
              {notOk.filter(a => a.status === 'alert').length} kritisch
            </span>
          )}
          {notOk.filter(a => a.status === 'warn').length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
              {notOk.filter(a => a.status === 'warn').length} überfällig
            </span>
          )}
          {notOk.length === 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
              Alle aktuell ✓
            </span>
          )}
        </div>
      </div>

      <div className="widget-body space-y-1.5" style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}>
        {notOk.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-green-500">
            <CheckCircle size={28} className="mb-2 opacity-60" />
            <span className="text-sm font-medium">Alle {okCount} Azubis aktuell</span>
            <span className="text-xs text-slate-600 mt-1">Einreichung innerhalb {data.warn} Tage</span>
          </div>
        ) : (
          <>
            {current.map(a => (
              <div key={a.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                  a.status === 'alert' ? 'bg-red-500/10 border-red-500/25' : 'bg-amber-500/10 border-amber-500/25'
                }`}>
                <AlertTriangle size={14} className={`shrink-0 ${a.status === 'alert' ? 'text-red-400' : 'text-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-white truncate block">{a.name}</span>
                  <span className="text-xs text-slate-400">
                    {a.last_report_date
                      ? `Zuletzt ${format(parseISO(a.last_report_date), 'dd.MM.yyyy', { locale: de })}`
                      : 'Noch nie eingereicht'}
                  </span>
                </div>
                <span className={`text-sm font-bold shrink-0 ${a.status === 'alert' ? 'text-red-400' : 'text-amber-400'}`}>
                  {a.days != null ? `${a.days}T` : '—'}
                </span>
              </div>
            ))}
            {okCount > 0 && (
              <div className="text-xs text-slate-600 text-center pt-1">
                + {okCount} Azubis aktuell
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
