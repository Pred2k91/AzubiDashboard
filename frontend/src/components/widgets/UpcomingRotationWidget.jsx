import { useState, useEffect } from 'react'
import { ArrowRightLeft, MapPin, CalendarDays } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { azubisApi } from '../../api/client'

export default function UpcomingRotationWidget() {
  const [data, setData] = useState(null)

  const load = () => azubisApi.getNextRotation().then(setData).catch(() => {})

  useEffect(() => {
    load()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (!data || !data.scheduled) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={14} className="text-indigo-400" />
            <span className="widget-title">Abteilungswechsel</span>
          </div>
        </div>
        <div className="widget-body flex flex-col items-center justify-center text-slate-600">
          <ArrowRightLeft size={24} className="mb-2 opacity-30" />
          <span className="text-sm">Kein Wechsel geplant</span>
        </div>
      </div>
    )
  }

  const days = differenceInDays(parseISO(data.date), new Date())
  const urgency = days <= 7 ? 'text-red-400' : days <= 30 ? 'text-amber-400' : 'text-green-400'
  const urgencyBg = days <= 7 ? 'bg-red-500/10 border-red-500/30' : days <= 30 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-green-500/10 border-green-500/30'

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={14} className="text-indigo-400" />
          <span className="widget-title">Abteilungswechsel</span>
        </div>
      </div>

      <div className="widget-body space-y-3">
        {/* Datum + Countdown */}
        <div className={`rounded-xl border p-3 text-center ${urgencyBg}`}>
          <div className="flex items-center justify-center gap-2 mb-1">
            <CalendarDays size={14} className={urgency} />
            <span className="text-sm font-semibold text-white">
              Ab {format(parseISO(data.date), 'dd. MMMM yyyy', { locale: de })}
            </span>
          </div>
          <div className={`text-2xl font-extrabold ${urgency}`}>
            {days === 0 ? 'Heute!' : days === 1 ? 'Morgen!' : `${days} Tage`}
          </div>
        </div>

        {/* Neue Abteilungen */}
        <div className="space-y-2">
          {data.departments.map(dept => (
            <div key={dept.id} className="p-2.5 rounded-xl border bg-[#1e2035]/50"
              style={{ borderColor: `${dept.color}40` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dept.color }} />
                <span className="text-sm font-bold text-white truncate">{dept.name}</span>
                <span className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: `${dept.color}20`, color: dept.color }}>
                  {dept.azubis.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {dept.azubis.map(a => (
                  <span key={a.id} className="text-[10px] px-1.5 py-0.5 rounded-full text-slate-300"
                    style={{ backgroundColor: `${dept.color}15` }}>
                    {a.name.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
