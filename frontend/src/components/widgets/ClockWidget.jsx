import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

export default function ClockWidget() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="widget-card justify-center items-center text-center">
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
        <div
          className="font-extrabold leading-none tracking-tight text-white"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}
        >
          {format(now, 'HH:mm')}
          <span className="text-indigo-400">:{format(now, 'ss')}</span>
        </div>
        <div className="text-slate-400 font-medium capitalize" style={{ fontSize: 'clamp(0.9rem, 2vw, 1.25rem)' }}>
          {format(now, 'EEEE', { locale: de })}
        </div>
        <div className="text-slate-500 text-sm">
          {format(now, 'dd. MMMM yyyy', { locale: de })}
        </div>
        <div className="mt-2 flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
