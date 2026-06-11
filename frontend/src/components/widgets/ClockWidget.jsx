import { useState, useEffect } from 'react'
import { Droplets, Wind } from 'lucide-react'
import { settingsApi } from '../../api/client'
import axios from 'axios'

const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const DAYS_DE = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag']

// Berechnet den UTC-Offset für Europe/Berlin ohne Intl-API
function getBerlinOffset(date) {
  const y = date.getUTCFullYear()
  const lastSunMar = new Date(Date.UTC(y, 2, 31))
  lastSunMar.setUTCDate(31 - lastSunMar.getUTCDay())
  const lastSunOct = new Date(Date.UTC(y, 9, 31))
  lastSunOct.setUTCDate(31 - lastSunOct.getUTCDay())
  return date >= lastSunMar && date < lastSunOct ? 2 : 1
}

function getISOWeekNum(utcDate) {
  const d = new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

const pad = n => String(n).padStart(2, '0')

export default function ClockWidget() {
  const [now, setNow] = useState(new Date())
  const [showSeconds, setShowSeconds] = useState(true)
  const [weather, setWeather] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
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

  // Berlin-Zeit komplett über UTC berechnen — kein Intl, kein date-fns-tz
  const offset = getBerlinOffset(now)
  const berlin = new Date(now.getTime() + offset * 3600000)
  const kw = getISOWeekNum(berlin)

  const timeStr = `${pad(berlin.getUTCHours())}:${pad(berlin.getUTCMinutes())}`
  const secStr = pad(berlin.getUTCSeconds())
  const weekday = DAYS_DE[berlin.getUTCDay()]
  const dateStr = `${berlin.getUTCDate()}. ${MONTHS_DE[berlin.getUTCMonth()]} ${berlin.getUTCFullYear()}`

  return (
    <div className="widget-card justify-center items-center text-center">
      <div className="flex flex-col items-center justify-center h-full gap-1 p-4">

        {/* Uhrzeit */}
        <div
          className="font-extrabold leading-none tracking-tight text-white"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}
        >
          {timeStr}
          {showSeconds && (
            <span className="text-indigo-400">:{secStr}</span>
          )}
        </div>

        {/* Wochentag + Datum + KW */}
        <div className="text-slate-400 font-medium capitalize mt-1" style={{ fontSize: 'clamp(0.85rem, 1.8vw, 1.15rem)' }}>
          {weekday}
        </div>
        <div className="flex items-center gap-2 text-slate-500" style={{ fontSize: 'clamp(0.75rem, 1.4vw, 0.95rem)' }}>
          <span>{dateStr}</span>
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
