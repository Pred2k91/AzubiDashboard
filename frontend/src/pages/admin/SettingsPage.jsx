import { useState, useEffect, useRef } from 'react'
import { Settings, Save, RotateCcw, Upload, X, Image, Building2, Mail } from 'lucide-react'
import { settingsApi } from '../../api/client'
import { applyAccentColor, applyWidgetOpacity } from '../../utils/theme'
import {
  TEMPLATE_PLACEHOLDERS,
  DEFAULT_REMINDER_SUBJECT, DEFAULT_REMINDER_BODY,
  DEFAULT_ESCALATION_SUBJECT, DEFAULT_ESCALATION_BODY,
} from '../../utils/reportMailTemplates'
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

function WeatherTest() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const test = async () => {
    setLoading(true); setStatus(null)
    try {
      const r = await axios.get('/api/weather')
      setStatus(r.data)
    } catch { setStatus({ available: false, error: 'Verbindungsfehler' }) }
    finally { setLoading(false) }
  }

  return (
    <div className="shrink-0">
      <button className="btn-secondary text-xs py-1.5" onClick={test} disabled={loading}>
        {loading ? 'Teste...' : 'Verbindung testen'}
      </button>
      {status && (
        <div className={`mt-2 text-xs p-2 rounded-lg ${status.available ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {status.available
            ? `✓ ${status.emoji} ${status.temp}°C in ${status.city}`
            : `✗ ${status.error || 'Nicht verfügbar'}`}
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const [showSeconds, setShowSeconds] = useState(true)
  const [announcementInterval, setAnnouncementInterval] = useState(8000)
  const [kioskZoom, setKioskZoom] = useState(100)
  const [reportWarnDays, setReportWarnDays] = useState(14)
  const [reportAlertDays, setReportAlertDays] = useState(28)
  const [reminderSubject, setReminderSubject] = useState(DEFAULT_REMINDER_SUBJECT)
  const [reminderBody, setReminderBody] = useState(DEFAULT_REMINDER_BODY)
  const [escalationSubject, setEscalationSubject] = useState(DEFAULT_ESCALATION_SUBJECT)
  const [escalationBody, setEscalationBody] = useState(DEFAULT_ESCALATION_BODY)
  const [weatherCity, setWeatherCity] = useState('')
  const [weatherApiKey, setWeatherApiKey] = useState('')
  const [title, setTitle] = useState('HERcademy')
  const [trainerName, setTrainerName] = useState('')
  const [accent, setAccent] = useState('#6366f1')
  const [refreshInterval, setRefreshInterval] = useState(300000)
  const [logoUrl, setLogoUrl] = useState(null)
  const [backgroundUrl, setBackgroundUrl] = useState(null)
  const [backgroundUrl2, setBackgroundUrl2] = useState(null)
  const [loginBackgroundUrl, setLoginBackgroundUrl] = useState(null)
  const [bgOpacity, setBgOpacity] = useState(0.5)
  const [widgetOpacity, setWidgetOpacity] = useState(0.85)
  const [nightDimEnabled, setNightDimEnabled] = useState(false)
  const [nightDimStart, setNightDimStart] = useState(18)
  const [nightDimEnd, setNightDimEnd] = useState(7)
  const [nightDimLevel, setNightDimLevel] = useState(0.7)
  const [darkScreenInterval, setDarkScreenInterval] = useState(60)
  const [darkScreenDuration, setDarkScreenDuration] = useState(30)
  const [pixelShiftEnabled, setPixelShiftEnabled] = useState(true)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    settingsApi.getAll().then(s => {
      if (s.dashboard_title) setTitle(s.dashboard_title)
      if (s.trainer_name) setTrainerName(s.trainer_name)
      if (s.show_seconds !== undefined) setShowSeconds(s.show_seconds)
      if (s.announcement_interval !== undefined) setAnnouncementInterval(s.announcement_interval)
      if (s.kiosk_zoom !== undefined) setKioskZoom(s.kiosk_zoom)
      if (s.report_warn_days !== undefined) setReportWarnDays(s.report_warn_days)
      if (s.report_alert_days !== undefined) setReportAlertDays(s.report_alert_days)
      if (s.report_reminder_subject) setReminderSubject(s.report_reminder_subject)
      if (s.report_reminder_body) setReminderBody(s.report_reminder_body)
      if (s.report_escalation_subject) setEscalationSubject(s.report_escalation_subject)
      if (s.report_escalation_body) setEscalationBody(s.report_escalation_body)
      if (s.weather_city) setWeatherCity(s.weather_city)
      if (s.weather_api_key) setWeatherApiKey(s.weather_api_key)
      if (s.theme_accent) setAccent(s.theme_accent)
      if (s.refresh_interval) setRefreshInterval(s.refresh_interval)
      if (s.logo_url) setLogoUrl(s.logo_url)
      if (s.background_url) setBackgroundUrl(s.background_url)
      if (s.background_url_2) setBackgroundUrl2(s.background_url_2)
      if (s.login_background_url) setLoginBackgroundUrl(s.login_background_url)
      if (s.background_opacity !== undefined) setBgOpacity(s.background_opacity)
      if (s.widget_opacity !== undefined) setWidgetOpacity(s.widget_opacity)
      if (s.night_dim_enabled !== undefined) setNightDimEnabled(s.night_dim_enabled)
      if (s.night_dim_start !== undefined) setNightDimStart(s.night_dim_start)
      if (s.night_dim_end !== undefined) setNightDimEnd(s.night_dim_end)
      if (s.night_dim_level !== undefined) setNightDimLevel(s.night_dim_level)
      if (s.dark_screen_interval !== undefined) setDarkScreenInterval(s.dark_screen_interval)
      if (s.dark_screen_duration !== undefined) setDarkScreenDuration(s.dark_screen_duration)
      if (s.pixel_shift_enabled !== undefined) setPixelShiftEnabled(s.pixel_shift_enabled)
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    setLoading(true)
    try {
      await Promise.all([
        settingsApi.update('dashboard_title', title),
        settingsApi.update('trainer_name', trainerName),
        settingsApi.update('show_seconds', showSeconds),
        settingsApi.update('announcement_interval', announcementInterval),
        settingsApi.update('report_warn_days', reportWarnDays),
        settingsApi.update('report_alert_days', reportAlertDays),
        settingsApi.update('report_reminder_subject', reminderSubject),
        settingsApi.update('report_reminder_body', reminderBody),
        settingsApi.update('report_escalation_subject', escalationSubject),
        settingsApi.update('report_escalation_body', escalationBody),
        settingsApi.update('kiosk_zoom', kioskZoom),
        settingsApi.update('weather_city', weatherCity),
        settingsApi.update('weather_api_key', weatherApiKey),
        settingsApi.update('theme_accent', accent),
        settingsApi.update('refresh_interval', refreshInterval),
        settingsApi.update('background_opacity', bgOpacity),
        settingsApi.update('widget_opacity', widgetOpacity),
        settingsApi.update('night_dim_enabled', nightDimEnabled),
        settingsApi.update('night_dim_start', nightDimStart),
        settingsApi.update('night_dim_end', nightDimEnd),
        settingsApi.update('night_dim_level', nightDimLevel),
        settingsApi.update('dark_screen_interval', darkScreenInterval),
        settingsApi.update('dark_screen_duration', darkScreenDuration),
        settingsApi.update('pixel_shift_enabled', pixelShiftEnabled),
      ])
      applyAccentColor(accent)
      applyWidgetOpacity(widgetOpacity)
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
            placeholder="HERcademy"
          />
          <p className="text-xs text-slate-600 mt-1">Wird im Header der Kiosk-Ansicht angezeigt</p>
        </div>

        <div>
          <label className="label">Ausbilder-Name</label>
          <input
            className="input-field"
            value={trainerName}
            onChange={e => setTrainerName(e.target.value)}
            placeholder="z. B. Max Mustermann"
          />
          <p className="text-xs text-slate-600 mt-1">Wird als Signatur in Berichtsheft-Erinnerungs-E-Mails verwendet</p>
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

      {/* Dashboard-Zoom */}
      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Darstellung</h2>
        <div>
          <label className="label">Dashboard-Zoom: {kioskZoom}%</label>
          <p className="text-xs text-slate-600 mb-2">
            Verkleinert/vergrößert das gesamte Dashboard — nützlich wenn der Browser auf dem Bildschirm eine andere Skalierung hat.
            Direktsteuerung auch über die +/− Buttons im Kiosk-Header.
          </p>
          <div className="flex items-center gap-3">
            <input type="range" min="50" max="150" step="5" value={kioskZoom}
              onChange={e => setKioskZoom(parseInt(e.target.value))}
              className="flex-1 max-w-xs accent-indigo-600" />
            <div className="flex gap-1">
              {[75, 85, 100, 110, 125].map(z => (
                <button key={z} onClick={() => setKioskZoom(z)}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                    kioskZoom === z ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                                   : 'bg-[#0d0f1a] border-[#2a2d4a] text-slate-500'
                  }`}>{z}%</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Uhrzeit-Widget */}
      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-5">
        <h2 className="text-sm font-semibold text-white">Uhrzeit-Widget</h2>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-indigo-600"
            checked={showSeconds} onChange={e => setShowSeconds(e.target.checked)} />
          <div>
            <p className="text-sm text-slate-300">Sekunden anzeigen</p>
            <p className="text-xs text-slate-600 mt-0.5">HH:MM:SS statt nur HH:MM</p>
          </div>
        </label>

        <div>
          <label className="label">Schwarzes Brett — Rotationszeit</label>
          <select className="input-field max-w-xs" value={announcementInterval}
            onChange={e => setAnnouncementInterval(parseInt(e.target.value))}>
            <option value={5000}>5 Sekunden</option>
            <option value={8000}>8 Sekunden</option>
            <option value={10000}>10 Sekunden</option>
            <option value={15000}>15 Sekunden</option>
            <option value={20000}>20 Sekunden</option>
            <option value={30000}>30 Sekunden</option>
          </select>
          <p className="text-xs text-slate-600 mt-1">Wie lange jede Sektion angezeigt wird</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-slate-300">Wetter</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Stadt</label>
              <input className="input-field" value={weatherCity}
                onChange={e => setWeatherCity(e.target.value)}
                placeholder="z.B. Oldenburg" />
            </div>
            <div>
              <label className="label">OpenWeatherMap API-Key</label>
              <input className="input-field" type="password" value={weatherApiKey}
                onChange={e => setWeatherApiKey(e.target.value)}
                placeholder="32-stelliger Key" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-600 flex-1">
              Kostenlos unter <span className="text-indigo-400">openweathermap.org</span> → Account → API Keys · Neue Keys brauchen bis zu 2h zum Aktivieren
            </p>
            <WeatherTest />
          </div>
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
          label="Hintergrundbild 1 (Normal)"
          description="Wird in der normalen Ansicht angezeigt"
          settingKey="background"
          currentUrl={backgroundUrl}
          onUpdate={setBackgroundUrl}
        />

        <ImageUpload
          label="Hintergrundbild 2 (Gespiegelt)"
          description="Wird nach dem Dunkelscreen in der gespiegelten Ansicht angezeigt — optional"
          settingKey="background2"
          currentUrl={backgroundUrl2}
          onUpdate={setBackgroundUrl2}
        />

        <ImageUpload
          label="Login-Hintergrundbild"
          description="Wird als Hintergrund auf dem Anmelde-Bildschirm angezeigt — optional"
          settingKey="login_background"
          currentUrl={loginBackgroundUrl}
          onUpdate={setLoginBackgroundUrl}
        />

        {backgroundUrl && (
          <div>
            <label className="label">Hintergrund-Deckkraft: {Math.round(bgOpacity * 100)}%</label>
            <p className="text-xs text-slate-600 mb-2">Steuert wie stark das Hintergrundbild sichtbar ist (weniger = dunkler / lesbarer)</p>
            <input
              type="range" min="0.1" max="1" step="0.05" value={bgOpacity}
              onChange={e => setBgOpacity(parseFloat(e.target.value))}
              className="w-full max-w-xs accent-indigo-600"
            />
          </div>
        )}

        <div>
          <label className="label">Widget-Transparenz: {Math.round(widgetOpacity * 100)}%</label>
          <p className="text-xs text-slate-600 mb-2">
            Glassmorphism-Deckkraft der Widgets — weniger = transparenter / mehr Hintergrundbild sichtbar
          </p>
          <input
            type="range" min="0.1" max="1" step="0.05" value={widgetOpacity}
            onChange={e => {
              const v = parseFloat(e.target.value)
              setWidgetOpacity(v)
              applyWidgetOpacity(v)
            }}
            className="w-full max-w-xs accent-indigo-600"
          />
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
            <span>Transparenter</span>
            <div className="flex-1 h-6 rounded-lg border border-[#2a2d4a] overflow-hidden">
              <div
                className="h-full rounded-lg"
                style={{ background: `rgba(14, 16, 26, ${widgetOpacity})`, backdropFilter: 'blur(12px)' }}
              />
            </div>
            <span>Undurchsichtiger</span>
          </div>
        </div>
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

      {/* Berichtsheft-Schwellwerte */}
      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Berichtsheft-Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Gelb ab (Tage)
            </label>
            <input type="number" min="1" max="90" className="input-field" value={reportWarnDays}
              onChange={e => setReportWarnDays(parseInt(e.target.value))} />
            <p className="text-xs text-slate-600 mt-1">Standard: 14 Tage (2 Wochen)</p>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              Rot ab (Tage)
            </label>
            <input type="number" min="1" max="180" className="input-field" value={reportAlertDays}
              onChange={e => setReportAlertDays(parseInt(e.target.value))} />
            <p className="text-xs text-slate-600 mt-1">Standard: 28 Tage (4 Wochen)</p>
          </div>
        </div>
      </div>

      {/* Berichtsheft E-Mail-Vorlagen */}
      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Mail size={14} className="text-slate-400" />
            Berichtsheft E-Mail-Vorlagen
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Werden bei den Erinnerungs-/Eskalations-Buttons im Bereich "Berichtshefte" verwendet. Platzhalter werden beim Öffnen der Mail automatisch ersetzt:{' '}
            {TEMPLATE_PLACEHOLDERS.map(p => `{{${p.key}}}`).join(', ')}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="label mb-0">Erinnerung — Betreff</label>
            <button className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
              onClick={() => { setReminderSubject(DEFAULT_REMINDER_SUBJECT); setReminderBody(DEFAULT_REMINDER_BODY) }}>
              <RotateCcw size={11} />Zurücksetzen
            </button>
          </div>
          <input className="input-field" value={reminderSubject} onChange={e => setReminderSubject(e.target.value)} />
          <label className="label">Erinnerung — Text</label>
          <textarea className="input-field font-mono text-xs" rows={8} value={reminderBody} onChange={e => setReminderBody(e.target.value)} />
        </div>

        <div className="space-y-3 pt-2 border-t border-[#2a2d4a]">
          <div className="flex items-center justify-between">
            <label className="label mb-0">Eskalation — Betreff</label>
            <button className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
              onClick={() => { setEscalationSubject(DEFAULT_ESCALATION_SUBJECT); setEscalationBody(DEFAULT_ESCALATION_BODY) }}>
              <RotateCcw size={11} />Zurücksetzen
            </button>
          </div>
          <input className="input-field" value={escalationSubject} onChange={e => setEscalationSubject(e.target.value)} />
          <label className="label">Eskalation — Text</label>
          <textarea className="input-field font-mono text-xs" rows={10} value={escalationBody} onChange={e => setEscalationBody(e.target.value)} />
        </div>
      </div>

      {/* Burn-in Schutz */}
      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-5">
        <h2 className="text-sm font-semibold text-white">Burn-in Schutz</h2>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-300">Pixel-Shift</p>
            <p className="text-xs text-slate-600 mt-0.5">Verschiebt alle 8 Minuten den gesamten Inhalt um ~18px — bei TV-Abstand nicht wahrnehmbar</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              className="w-4 h-4 accent-indigo-600"
              checked={pixelShiftEnabled}
              onChange={e => setPixelShiftEnabled(e.target.checked)}
            />
            <span className="text-sm text-slate-300">Aktiv</span>
          </label>
        </div>

        <div>
          <p className="text-sm text-slate-300 mb-1">Periodischer Dunkelscreen</p>
          <p className="text-xs text-slate-600 mb-3">Blendet den Bildschirm kurz komplett schwarz — setzt alle Pixel zurück, effektivster Schutz</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Intervall</label>
              <select className="input-field" value={darkScreenInterval} onChange={e => setDarkScreenInterval(parseInt(e.target.value))}>
                <option value={0}>Deaktiviert</option>
                <option value={30}>Alle 30 Minuten</option>
                <option value={60}>Alle 60 Minuten</option>
                <option value={90}>Alle 90 Minuten</option>
                <option value={120}>Alle 2 Stunden</option>
              </select>
            </div>
            <div>
              <label className="label">Dauer</label>
              <select className="input-field" value={darkScreenDuration} onChange={e => setDarkScreenDuration(parseInt(e.target.value))}>
                <option value={10}>10 Sekunden</option>
                <option value={20}>20 Sekunden</option>
                <option value={30}>30 Sekunden</option>
                <option value={60}>60 Sekunden</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-indigo-600"
              checked={nightDimEnabled}
              onChange={e => setNightDimEnabled(e.target.checked)}
            />
            <div>
              <p className="text-sm text-slate-300">Nacht-Dimming</p>
              <p className="text-xs text-slate-600 mt-0.5">Dunkelt den Bildschirm automatisch ab — schont den Monitor und spart Strom</p>
            </div>
          </label>

          {nightDimEnabled && (
            <div className="mt-4 space-y-4 pl-7">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Dimmen ab (Uhr)</label>
                  <select className="input-field" value={nightDimStart} onChange={e => setNightDimStart(parseInt(e.target.value))}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00 Uhr</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Aufhellen ab (Uhr)</label>
                  <select className="input-field" value={nightDimEnd} onChange={e => setNightDimEnd(parseInt(e.target.value))}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00 Uhr</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Abdunkelung: {Math.round(nightDimLevel * 100)}%</label>
                <input
                  type="range" min="0.3" max="0.95" step="0.05"
                  value={nightDimLevel}
                  onChange={e => setNightDimLevel(parseFloat(e.target.value))}
                  className="w-full max-w-xs accent-indigo-600"
                />
                <p className="text-xs text-slate-600 mt-1">Höher = dunkler</p>
              </div>
            </div>
          )}
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
