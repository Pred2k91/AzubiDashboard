import { useState, useEffect, useRef } from 'react'
import { Settings, Save, RotateCcw, Upload, X, Image, Building2 } from 'lucide-react'
import { settingsApi } from '../../api/client'
import { applyAccentColor } from '../../utils/theme'
import axios from 'axios'

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

function ImageUpload({ label, description, settingKey, currentUrl, onUpdate }) {
  const inputRef = useRef()
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await axios.post(`/api/upload/${settingKey}`, form)
      onUpdate(res.data.url)
    } catch (err) {
      alert('Upload fehlgeschlagen')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemove = async () => {
    await axios.delete(`/api/upload/${settingKey}`)
    onUpdate(null)
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        {currentUrl ? (
          <div className="relative group">
            <img
              src={currentUrl}
              alt={label}
              className="h-16 w-auto max-w-[200px] object-contain rounded-lg border border-[#2a2d4a] bg-[#0d0f1a] p-1"
            />
            <button
              onClick={handleRemove}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <div className="h-16 w-32 rounded-lg border-2 border-dashed border-[#2a2d4a] flex items-center justify-center text-slate-700">
            <Image size={20} />
          </div>
        )}
        <div>
          <button
            className="btn-secondary text-xs py-1.5"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={13} />
            {uploading ? 'Lädt...' : 'Bild hochladen'}
          </button>
          <p className="text-xs text-slate-600 mt-1">{description}</p>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*,.svg" className="hidden" onChange={handleUpload} />
    </div>
  )
}

export default function SettingsPage() {
  const [title, setTitle] = useState('Ausbildungsdashboard')
  const [accent, setAccent] = useState('#6366f1')
  const [refreshInterval, setRefreshInterval] = useState(300000)
  const [logoUrl, setLogoUrl] = useState(null)
  const [backgroundUrl, setBackgroundUrl] = useState(null)
  const [bgOpacity, setBgOpacity] = useState(0.5)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    settingsApi.getAll().then(s => {
      if (s.dashboard_title) setTitle(s.dashboard_title)
      if (s.theme_accent) setAccent(s.theme_accent)
      if (s.refresh_interval) setRefreshInterval(s.refresh_interval)
      if (s.logo_url) setLogoUrl(s.logo_url)
      if (s.background_url) setBackgroundUrl(s.background_url)
      if (s.background_opacity !== undefined) setBgOpacity(s.background_opacity)
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    setLoading(true)
    try {
      await Promise.all([
        settingsApi.update('dashboard_title', title),
        settingsApi.update('theme_accent', accent),
        settingsApi.update('refresh_interval', refreshInterval),
        settingsApi.update('background_opacity', bgOpacity),
      ])
      applyAccentColor(accent)
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

      {/* Allgemein */}
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
              <button key={c.value} onClick={() => setAccent(c.value)} className="flex flex-col items-center gap-1.5 group">
                <div className={`w-8 h-8 rounded-lg border-2 transition-all ${accent === c.value ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c.value }} />
                <span className="text-[10px] text-slate-600 group-hover:text-slate-400">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Auto-Refresh Intervall</label>
          <select className="input-field max-w-xs" value={refreshInterval} onChange={e => setRefreshInterval(parseInt(e.target.value))}>
            <option value={60000}>1 Minute</option>
            <option value={120000}>2 Minuten</option>
            <option value={300000}>5 Minuten</option>
            <option value={600000}>10 Minuten</option>
            <option value={1800000}>30 Minuten</option>
          </select>
        </div>
      </div>

      {/* Branding */}
      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-5">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Building2 size={14} className="text-slate-400" />
          Firmen-Branding
        </h2>

        <ImageUpload
          label="Firmenlogo"
          description="PNG mit Transparenz empfohlen · wird im Header angezeigt"
          settingKey="logo"
          currentUrl={logoUrl}
          onUpdate={setLogoUrl}
        />

        <ImageUpload
          label="Hintergrundbild"
          description="Wird hinter den Widgets in der Kiosk-Ansicht angezeigt"
          settingKey="background"
          currentUrl={backgroundUrl}
          onUpdate={setBackgroundUrl}
        />

        {backgroundUrl && (
          <div>
            <label className="label">Hintergrund-Deckkraft: {Math.round(bgOpacity * 100)}%</label>
            <p className="text-xs text-slate-600 mb-2">Steuert wie stark das Hintergrundbild sichtbar ist (weniger = dunkler / lesbarer)</p>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={bgOpacity}
              onChange={e => setBgOpacity(parseFloat(e.target.value))}
              className="w-full max-w-xs accent-indigo-600"
            />
          </div>
        )}
      </div>

      {/* Layout */}
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
          {saved ? <><span className="text-green-400">✓</span> Gespeichert!</> : <><Save size={15} />{loading ? 'Speichern...' : 'Einstellungen speichern'}</>}
        </button>
      </div>
    </div>
  )
}
