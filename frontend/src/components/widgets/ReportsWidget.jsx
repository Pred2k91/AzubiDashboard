import { useState, useEffect } from 'react'
import { BookOpen, CheckCircle, AlertTriangle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { reportsApi } from '../../api/client'

export default function ReportsWidget() {
  const [data, setData] = useState({ azubis: [], warn: 14, alert: 28 })

  const load = () => reportsApi.getStatus().then(setData).catch(() => {})

  useEffect(() => {
    load()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const notOk = data.azubis.filter(a => a.status !== 'ok')
  const alerts = notOk.filter(a => a.status === 'alert')
  const warns = notOk.filter(a => a.status === 'warn')
  const okCount = data.azubis.filter(a => a.status === 'ok').length

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-indigo-400" />
          <span className="widget-title">Berichtshefte</span>
        </div>
        <div className="flex items-center gap-1.5">
          {alerts.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">
              {alerts.length} kritisch
            </span>
          )}
          {warns.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
              {warns.length} überfällig
            </span>
          )}
          {notOk.length === 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
              Alle aktuell ✓
            </span>
          )}
        </div>
      </div>

      <div className="widget-body space-y-1">
        {notOk.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-green-500">
            <CheckCircle size={28} className="mb-2 opacity-60" />
            <span className="text-sm font-medium">Alle {okCount} Azubis aktuell</span>
            <span className="text-xs text-slate-600 mt-1">Letzte Einreichung innerhalb {data.warn} Tage</span>
          </div>
        ) : (
          <>
            {/* Kritisch zuerst */}
            {[...alerts, ...warns].map(a => (
              <div key={a.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                  a.status === 'alert'
                    ? 'bg-red-500/10 border-red-500/25'
                    : 'bg-amber-500/10 border-amber-500/25'
                }`}>
                <AlertTriangle size={14} className={a.status === 'alert' ? 'text-red-400 shrink-0' : 'text-amber-400 shrink-0'} />
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

            {/* Zusammenfassung */}
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
