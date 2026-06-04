import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { getISOWeek } from 'date-fns'
import { Droplets, Wind } from 'lucide-react'
import { settingsApi } from '../../api/client'
import axios from 'axios'

export default function ClockWidget() {
  const [now, setNow] = useState(new Date())
  const [showSeconds, setShowSeconds] = useState(true)
  const [weather, setWeather] = useState(null)

  // Uhr
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Einstellungen laden
  useEffect(() => {
    settingsApi.getAll().then(s => {
      if (s.show_seconds !== undefined) setShowSeconds(s.show_seconds)
    }).catch(() => {})
  }, [])

  // Wetter laden
  const loadWeather = () => {
    axios.get('/api/weather').then(r => {
      if (r.data.available) setWeather(r.data)
    }).catch(() => {})
  }

  useEffect(() => {
    loadWeather()
    const interval = setInterval(loadWeather, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const kw = getISOWeek(now)

  return (
    <div className="widget-card justify-center items-center text-center">
      <div className="flex flex-col items-center justify-center h-full gap-1 p-4">

        {/* Uhrzeit */}
        <div
          className="font-extrabold leading-none tracking-tight text-white"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}
        >
          {format(now, 'HH:mm')}
          {showSeconds && (
            <span className="text-indigo-400">:{format(now, 'ss')}</span>
          )}
        </div>

        {/* Wochentag + Datum + KW */}
        <div className="text-slate-400 font-medium capitalize mt-1" style={{ fontSize: 'clamp(0.85rem, 1.8vw, 1.15rem)' }}>
          {format(now, 'EEEE', { locale: de })}
        </div>
        <div className="flex items-center gap-2 text-slate-500" style={{ fontSize: 'clamp(0.75rem, 1.4vw, 0.95rem)' }}>
          <span>{format(now, 'dd. MMMM yyyy', { locale: de })}</span>
          <span className="text-slate-600">·</span>
          <span className="text-indigo-400 font-semibold">KW {kw}</span>
        </div>

        {/* Wetter */}
        {weather && (
          <div className="mt-3 pt-3 border-t border-[#2a2d4a] w-full">
            <div className="flex items-center justify-center gap-2">
              <span style={{ fontSize: 'clamp(1.2rem, 2.5vw, 2rem)' }}>{weather.emoji}</span>
              <span className="font-bold text-white" style={{ fontSize: 'clamp(1.2rem, 2.5vw, 1.8rem)' }}>
                {weather.temp}°C
              </span>
            </div>
            <div className="text-slate-400 capitalize mt-0.5" style={{ fontSize: 'clamp(0.7rem, 1.2vw, 0.85rem)' }}>
              {weather.description}
            </div>
            <div className="flex items-center justify-center gap-3 mt-1 text-slate-500"
              style={{ fontSize: 'clamp(0.65rem, 1.1vw, 0.8rem)' }}>
              <span className="flex items-center gap-1">
                <Droplets size={10} />{weather.humidity}%
              </span>
              <span className="flex items-center gap-1">
                <Wind size={10} />{weather.wind} km/h
              </span>
              <span className="text-slate-600">{weather.city}</span>
            </div>
          </div>
        )}

        {/* Punkte */}
        {!weather && (
          <div className="mt-2 flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"
                style={{ animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
