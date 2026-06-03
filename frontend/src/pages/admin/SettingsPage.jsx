import { useState, useEffect } from 'react'
import { Settings, Save, RotateCcw } from 'lucide-react'
import { settingsApi } from '../../api/client'

const ACCENT_COLORS = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Blau', value: '#3b82f6' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Grün', value: '#10b981' },
  { label: 'Orange', value: '#f59e0b' },
  { label: 'Rot', value: '#ef4444' },
]

export default function SettingsPage() {
  const [title, setTitle] = useState('Ausbildungsdashboard')
  const [accent, setAccent] = useState('#6366f1')
  const [refreshInterval, setRefreshInterval] = useState(300000)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    settingsApi.getAll().then(s => {
      if (s.dashboard_title) setTitle(s.dashboard_title)
      if (s.theme_accent) setAccent(s.theme_accent)
      if (s.refresh_interval) setRefreshInterval(s.refresh_interval)
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    setLoading(true)
    try {
      await Promise.all([
        settingsApi.update('dashboard_title', title),
        settingsApi.update('theme_accent', accent),
        settingsApi.update('refresh_interval', refreshInterval),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setLoading(false) }
  }

  const handleResetLayout = async () => {
    await settingsApi.update('kiosk_layout', [])
    alert('Layout zurückgesetzt. Kiosk-Ansicht neu laden.')
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings size={20} className="text-slate-400" />
          Einstellungen
        </h1>
      </div>

      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-5">
        <h2 className="text-sm font-semibold text-white">Allgemein</h2>

        <div>
          <label className="label">Dashboard-Titel</label>
          <input
            className="input-field"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ausbildungsdashboard"
          />
          <p className="text-xs text-slate-600 mt-1">Wird im Header der Kiosk-Ansicht angezeigt</p>
        </div>

        <div>
          <label className="label">Akzentfarbe</label>
          <div className="flex gap-3 flex-wrap mt-2">
            {ACCENT_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setAccent(c.value)}
                className={`flex flex-col items-center gap-1.5 group`}
              >
                <div
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${accent === c.value ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c.value }}
                />
                <span className="text-[10px] text-slate-600 group-hover:text-slate-400">{c.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-2">Akzentfarbe des Dashboards (nach Seitenneuladung aktiv)</p>
        </div>

        <div>
          <label className="label">Auto-Refresh Intervall</label>
          <select
            className="input-field max-w-xs"
            value={refreshInterval}
            onChange={e => setRefreshInterval(parseInt(e.target.value))}
          >
            <option value={60000}>1 Minute</option>
            <option value={120000}>2 Minuten</option>
            <option value={300000}>5 Minuten</option>
            <option value={600000}>10 Minuten</option>
            <option value={1800000}>30 Minuten</option>
          </select>
          <p className="text-xs text-slate-600 mt-1">Wie oft die Kiosk-Ansicht Daten neu lädt</p>
        </div>
      </div>

      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Layout</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300">Kiosk-Layout zurücksetzen</p>
            <p className="text-xs text-slate-600 mt-0.5">Setzt alle Widgets auf die Standardpositionen zurück</p>
          </div>
          <button className="btn-secondary" onClick={handleResetLayout}>
            <RotateCcw size={14} />
            Zurücksetzen
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={handleSave} disabled={loading}>
          {saved ? (
            <>
              <span className="text-green-400">✓</span>
              Gespeichert!
            </>
          ) : (
            <>
              <Save size={15} />
              {loading ? 'Speichern...' : 'Einstellungen speichern'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
