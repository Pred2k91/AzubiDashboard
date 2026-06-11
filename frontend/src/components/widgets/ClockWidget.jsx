import { useState, useEffect, useRef } from 'react'
import { Droplets, Wind } from 'lucide-react'
import { settingsApi } from '../../api/client'
import axios from 'axios'

const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const DAYS_DE = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag']

function getBerlinOffset(utcMs) {
  const d = new Date(utcMs)
  const y = d.getUTCFullYear()
  const lastSunMar = new Date(Date.UTC(y, 2, 31))
  lastSunMar.setUTCDate(31 - lastSunMar.getUTCDay())
  const lastSunOct = new Date(Date.UTC(y, 9, 31))
  lastSunOct.setUTCDate(31 - lastSunOct.getUTCDay())
  return d >= lastSunMar && d < lastSunOct ? 2 : 1
}

function getISOWeekNum(utcMs) {
  const d = new Date(utcMs)
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = day.getUTCDay() || 7
  day.setUTCDate(day.getUTCDate() + 4 - dow)
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1))
  return Math.ceil((((day - yearStart) / 86400000) + 1) / 7)
}

const pad = n => String(n).padStart(2, '0')

export default function ClockWidget() {
  const [serverOffset, setServerOffset] = useState(0)  // Differenz Server-UTC zu Client-Date.now()
  const [now, setNow] = useState(Date.now())
  const [showSeconds, setShowSeconds] = useState(true)
  const [weather, setWeather] = useState(null)
  const syncedRef = useRef(false)

  // Server-Zeit einmalig holen und Offset berechnen, dann jede Stunde neu synchronisieren
  const syncTime = () => {
    const clientBefore = Date.now()
    axios.get('/api/time').then(r => {
      const clientAfter = Date.now()
      const latency = (clientAfter - clientBefore) / 2
      const serverUtc = r.data.utc + latency
      setServerOffset(serverUtc - Date.now())
      syncedRef.current = true
    }).catch(() => {})
  }

  useEffect(() => {
    syncTime()
    const t = setInterval(syncTime, 60 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  // Sekunden-Takt
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    settingsApi.getAll().then(s => {
      if (s.show_seconds !== undefined) setShowSeconds(s.show_seconds)
    }).catch(() => {})
  }, [])

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

  // Korrekte UTC-Zeit = Client + Offset zum Server
  const utcMs = now + serverOffset
  const offsetH = getBerlinOffset(utcMs)
  const berlinMs = utcMs + offsetH * 3600000
  const b = new Date(berlinMs)
  const kw = getISOWeekNum(berlinMs)

  const timeStr = `${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}`
  const secStr = pad(b.getUTCSeconds())
  const weekday = DAYS_DE[b.getUTCDay()]
  const dateStr = `${b.getUTCDate()}. ${MONTHS_DE[b.getUTCMonth()]} ${b.getUTCFullYear()}`

  return (
    <div className="widget-card justify-center items-center text-center">
      <div className="flex flex-col items-center justify-center h-full gap-1 p-4">

        <div
          className="font-extrabold leading-none tracking-tight text-white"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}
        >
          {timeStr}
          {showSeconds && (
            <span className="text-indigo-400">:{secStr}</span>
          )}
        </div>

        <div className="text-slate-400 font-medium capitalize mt-1" style={{ fontSize: 'clamp(0.85rem, 1.8vw, 1.15rem)' }}>
          {weekday}
        </div>
        <div className="flex items-center gap-2 text-slate-500" style={{ fontSize: 'clamp(0.75rem, 1.4vw, 0.95rem)' }}>
          <span>{dateStr}</span>
          <span className="text-slate-600">·</span>
          <span className="text-indigo-400 font-semibold">KW {kw}</span>
        </div>

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
              <span className="flex items-center gap-1"><Droplets size={10} />{weather.humidity}%</span>
              <span className="flex items-center gap-1"><Wind size={10} />{weather.wind} km/h</span>
              <span className="text-slate-600">{weather.city}</span>
            </div>
          </div>
        )}

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
