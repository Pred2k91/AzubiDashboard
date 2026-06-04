import { useState, useEffect, useCallback } from 'react'
import GridLayout from 'react-grid-layout'
import { Settings, Lock, Unlock, RotateCcw, AlignVerticalJustifyStart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PinModal from '../components/ui/PinModal'
import ClockWidget from '../components/widgets/ClockWidget'
import CalendarWidget from '../components/widgets/CalendarWidget'
import TodoWidget from '../components/widgets/TodoWidget'
import NotesWidget from '../components/widgets/NotesWidget'
import DepartmentWidget from '../components/widgets/DepartmentWidget'
import AnnouncementsWidget from '../components/widgets/AnnouncementsWidget'
import { settingsApi } from '../api/client'

const WIDGET_MAP = {
  clock: { component: ClockWidget, label: 'Uhrzeit' },
  calendar: { component: CalendarWidget, label: 'Kalender' },
  todos: { component: TodoWidget, label: 'Aufgaben' },
  departments: { component: DepartmentWidget, label: 'Abteilungen' },
  notes: { component: NotesWidget, label: 'Notizen' },
  announcements: { component: AnnouncementsWidget, label: 'Schwarzes Brett' },
}

const DEFAULT_LAYOUT = [
  { i: 'clock', x: 0, y: 0, w: 4, h: 5, minW: 2, minH: 3 },
  { i: 'calendar', x: 4, y: 0, w: 5, h: 10, minW: 3, minH: 6 },
  { i: 'todos', x: 0, y: 5, w: 4, h: 8, minW: 2, minH: 4 },
  { i: 'departments', x: 9, y: 0, w: 7, h: 10, minW: 4, minH: 6 },
  { i: 'notes', x: 4, y: 10, w: 8, h: 6, minW: 3, minH: 4 },
  { i: 'announcements', x: 12, y: 10, w: 4, h: 6, minW: 3, minH: 4 },
]

export default function KioskPage() {
  const navigate = useNavigate()
  const [pinOpen, setPinOpen] = useState(false)
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)
  const [editMode, setEditMode] = useState(false)
  const [widgetsEnabled, setWidgetsEnabled] = useState({
    clock: true, calendar: true, todos: true, departments: true, notes: true, announcements: true,
  })
  const [title, setTitle] = useState('Ausbildungsdashboard')
  const [kioskZoom, setKioskZoom] = useState(100)
  const [logoUrl, setLogoUrl] = useState(null)
  const [backgroundUrl, setBackgroundUrl] = useState(null)
  const [backgroundUrl2, setBackgroundUrl2] = useState(null)
  const [bgOpacity, setBgOpacity] = useState(0.5)
  const [containerWidth, setContainerWidth] = useState(window.innerWidth)
  const [containerHeight, setContainerHeight] = useState(window.innerHeight)

  // Burn-in Schutz
  const [pixelShift, setPixelShift] = useState({ x: 0, y: 0 })
  const [pixelShiftEnabled, setPixelShiftEnabled] = useState(true)
  const [nightDimEnabled, setNightDimEnabled] = useState(false)
  const [nightDimStart, setNightDimStart] = useState(18)
  const [nightDimEnd, setNightDimEnd] = useState(7)
  const [nightDimLevel, setNightDimLevel] = useState(0.7)
  const [isDimmed, setIsDimmed] = useState(false)
  const [darkScreenActive, setDarkScreenActive] = useState(false)
  const [darkScreenInterval, setDarkScreenIntervalVal] = useState(60)
  const [darkScreenDuration, setDarkScreenDuration] = useState(30)
  const [isMirrored, setIsMirrored] = useState(false)

  const HEADER_HEIGHT = 44
  const GRID_MARGIN = 12
  const GRID_ROWS = 16
  const rowHeight = Math.max(
    40,
    Math.floor((containerHeight - HEADER_HEIGHT - (GRID_ROWS + 1) * GRID_MARGIN) / GRID_ROWS)
  )

  useEffect(() => {
    settingsApi.getAll().then(s => {
      if (s.kiosk_layout && Array.isArray(s.kiosk_layout) && s.kiosk_layout.length > 0) {
        setLayout(s.kiosk_layout)
      }
      if (s.widgets_enabled) setWidgetsEnabled(s.widgets_enabled)
      if (s.dashboard_title) setTitle(s.dashboard_title)
      if (s.kiosk_zoom !== undefined) setKioskZoom(s.kiosk_zoom)
      if (s.logo_url) setLogoUrl(s.logo_url)
      if (s.background_url) setBackgroundUrl(s.background_url)
      if (s.background_url_2) setBackgroundUrl2(s.background_url_2)
      if (s.background_opacity !== undefined) setBgOpacity(s.background_opacity)
      if (s.night_dim_enabled !== undefined) setNightDimEnabled(s.night_dim_enabled)
      if (s.pixel_shift_enabled !== undefined) setPixelShiftEnabled(s.pixel_shift_enabled)
      if (s.night_dim_start !== undefined) setNightDimStart(s.night_dim_start)
      if (s.night_dim_end !== undefined) setNightDimEnd(s.night_dim_end)
      if (s.night_dim_level !== undefined) setNightDimLevel(s.night_dim_level)
      if (s.dark_screen_interval !== undefined) setDarkScreenIntervalVal(s.dark_screen_interval)
      if (s.dark_screen_duration !== undefined) setDarkScreenDuration(s.dark_screen_duration)
    }).catch(() => {})

    const handleResize = () => {
      setContainerWidth(window.innerWidth)
      setContainerHeight(window.innerHeight)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Pixel-Shift: alle 8 Minuten um 15-20px verschieben
  useEffect(() => {
    if (!pixelShiftEnabled) { setPixelShift({ x: 0, y: 0 }); return }
    const S = 18
    const POSITIONS = [
      { x: 0, y: 0 }, { x: S, y: 8 }, { x: -12, y: S },
      { x: -S, y: -8 }, { x: 10, y: -S }, { x: S, y: -12 },
      { x: -8, y: S }, { x: -S, y: 12 }, { x: 12, y: -8 },
    ]
    let idx = 0
    const interval = setInterval(() => {
      idx = (idx + 1) % POSITIONS.length
      setPixelShift(POSITIONS[idx])
    }, 8 * 60 * 1000)
    return () => clearInterval(interval)
  }, [pixelShiftEnabled])

  // Periodischer Dunkelscreen + Spiegelung
  useEffect(() => {
    if (!darkScreenInterval || darkScreenInterval <= 0) return
    const interval = setInterval(() => {
      setDarkScreenActive(true)
      setTimeout(() => {
        setIsMirrored(prev => !prev)
        setDarkScreenActive(false)
      }, darkScreenDuration * 1000)
    }, darkScreenInterval * 60 * 1000)
    return () => clearInterval(interval)
  }, [darkScreenInterval, darkScreenDuration])

  // Gespiegelte Layout-Berechnung (Widgets links↔rechts tauschen)
  const COLS = 16
  const mirrorLayout = (items) =>
    items.map(item => ({ ...item, x: COLS - item.x - item.w }))

  // Vor-Skalierungsmaße für react-grid-layout
  const scaleFactor = kioskZoom / 100
  const preScaleWidth = Math.round(containerWidth / scaleFactor)
  const preScaleHeight = Math.round(containerHeight / scaleFactor)

  // Nacht-Dimming: jede Minute prüfen
  useEffect(() => {
    const check = () => {
      if (!nightDimEnabled) { setIsDimmed(false); return }
      const h = new Date().getHours()
      const dimmed = nightDimStart > nightDimEnd
        ? h >= nightDimStart || h < nightDimEnd
        : h >= nightDimStart && h < nightDimEnd
      setIsDimmed(dimmed)
    }
    check()
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [nightDimEnabled, nightDimStart, nightDimEnd])

  const saveLayout = useCallback(async (newLayout) => {
    await settingsApi.update('kiosk_layout', newLayout).catch(() => {})
  }, [])

  const handleLayoutChange = (newLayout) => {
    if (!editMode) return  // Keine Layout-Änderung durch Spiegelung speichern
    const merged = newLayout.map(item => {
      const orig = layout.find(l => l.i === item.i)
      return { ...item, minW: orig?.minW, minH: orig?.minH }
    })
    // Gespiegelte Koordinaten zurückrechnen vor dem Speichern
    const unmirrored = isMirrored ? mirrorLayout(merged) : merged
    setLayout(unmirrored)
    saveLayout(unmirrored)
  }

  const handleReset = async () => {
    setLayout(DEFAULT_LAYOUT)
    await saveLayout(DEFAULT_LAYOUT)
  }

  const handleCompact = async () => {
    // Sortiere nach Y-Position, dann packe alle Widgets lückenlos zusammen
    const sorted = [...activeWidgets].sort((a, b) => a.y - b.y || a.x - b.x)
    let compacted = []
    for (const item of sorted) {
      let y = 0
      // Finde die niedrigste freie Y-Position für dieses Widget
      for (const placed of compacted) {
        if (placed.x < item.x + item.w && placed.x + placed.w > item.x) {
          y = Math.max(y, placed.y + placed.h)
        }
      }
      compacted.push({ ...item, y })
    }
    setLayout(prev => prev.map(l => {
      const c = compacted.find(c => c.i === l.i)
      return c ? { ...l, y: c.y } : l
    }))
    await saveLayout(compacted)
  }

  const toggleWidget = async (key) => {
    const updated = { ...widgetsEnabled, [key]: !widgetsEnabled[key] }
    setWidgetsEnabled(updated)
    await settingsApi.update('widgets_enabled', updated).catch(() => {})
    // Reset layout item visibility
    if (!updated[key]) {
      const filtered = layout.filter(l => l.i !== key)
      setLayout(filtered)
      await saveLayout(filtered)
    } else {
      const def = DEFAULT_LAYOUT.find(l => l.i === key)
      if (def && !layout.find(l => l.i === key)) {
        const updated = [...layout, def]
        setLayout(updated)
        await saveLayout(updated)
      }
    }
  }

  const activeWidgets = (() => {
    const visible = layout.filter(l => widgetsEnabled[l.i])
    return isMirrored ? mirrorLayout(visible) : visible
  })()

  return (
    <div
      style={{
        width: '100vw', height: '100vh',
        overflow: 'hidden', backgroundColor: '#0d0f1a',
        transform: `translate(${pixelShift.x}px, ${pixelShift.y}px)`,
        transition: 'transform 90s ease-in-out',
      }}
    >
    <div
      className={`flex relative ${isMirrored ? 'flex-col-reverse' : 'flex-col'}`}
      style={{
        width: `${preScaleWidth}px`,
        height: `${preScaleHeight}px`,
        transform: `scale(${scaleFactor})`,
        transformOrigin: 'top left',
        backgroundColor: '#0d0f1a',
      }}
    >
      {/* Periodischer Dunkelscreen */}
      <div
        className="absolute inset-0 z-[60] pointer-events-none"
        style={{
          backgroundColor: '#000',
          opacity: darkScreenActive ? 1 : 0,
          transition: darkScreenActive ? 'opacity 3s ease-in' : 'opacity 4s ease-out',
        }}
      />

      {/* Nacht-Dimming Overlay */}
      {isDimmed && (
        <div
          className="absolute inset-0 z-50 pointer-events-none"
          style={{ backgroundColor: `rgba(0,0,0,${nightDimLevel})`, transition: 'opacity 2s ease' }}
        />
      )}

      {/* Hintergrundbild */}
      {(backgroundUrl || backgroundUrl2) && (() => {
        const activeBg = isMirrored && backgroundUrl2 ? backgroundUrl2 : backgroundUrl
        if (!activeBg) return null
        return (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${activeBg})`, transition: 'background-image 2s ease' }}
            />
            <div
              className="absolute inset-0 bg-[#0d0f1a]"
              style={{ opacity: 1 - bgOpacity }}
            />
          </>
        )
      })()}

      {/* Header */}
      <div className={`relative flex items-center justify-between px-6 py-3 shrink-0 backdrop-blur-sm ${isMirrored ? 'border-t' : 'border-b'} border-[#2a2d4a]/80`}
        style={{ background: 'rgba(13, 15, 26, var(--widget-opacity))' }}>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          )}
          <h1 className="text-lg font-bold text-white tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {editMode && (
            <>
              <div className="flex gap-1 mr-2">
                {Object.entries(WIDGET_MAP).map(([key, { label }]) => (
                  <button
                    key={key}
                    onClick={() => toggleWidget(key)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all font-medium
                      ${widgetsEnabled[key]
                        ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-[#1e2035] border-[#2a2d4a] text-slate-600'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCompact}
                className="btn-secondary text-xs py-1.5"
                title="Lücken schließen"
              >
                <AlignVerticalJustifyStart size={13} />
                Lücken füllen
              </button>
              <button
                onClick={handleReset}
                className="btn-secondary text-xs py-1.5"
                title="Layout zurücksetzen"
              >
                <RotateCcw size={13} />
                Reset
              </button>
            </>
          )}
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
              ${editMode
                ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                : 'bg-[#1e2035] border-[#2a2d4a] text-slate-500 hover:text-slate-300'
              }`}
          >
            {editMode ? <Unlock size={13} /> : <Lock size={13} />}
            {editMode ? 'Fertig' : 'Layout'}
          </button>
          {/* Zoom-Schnellsteuerung */}
          <div className="flex items-center gap-0.5 bg-[#1e2035] border border-[#2a2d4a] rounded-lg overflow-hidden">
            <button
              onClick={() => { const z = Math.max(50, kioskZoom - 5); setKioskZoom(z); settingsApi.update('kiosk_zoom', z) }}
              className="px-2.5 py-1.5 text-slate-500 hover:text-white hover:bg-[#2a2d4a] text-sm font-bold transition-colors"
            >−</button>
            <span className="text-xs text-slate-500 px-1 min-w-[38px] text-center">{kioskZoom}%</span>
            <button
              onClick={() => { const z = Math.min(150, kioskZoom + 5); setKioskZoom(z); settingsApi.update('kiosk_zoom', z) }}
              className="px-2.5 py-1.5 text-slate-500 hover:text-white hover:bg-[#2a2d4a] text-sm font-bold transition-colors"
            >+</button>
          </div>

          <button
            onClick={() => setPinOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e2035] border border-[#2a2d4a] text-slate-500 hover:text-slate-300 transition-all"
          >
            <Settings size={13} />
            Admin
          </button>
        </div>
      </div>

      {/* Edit mode hint */}
      {editMode && (
        <div className="relative px-6 py-2 bg-indigo-600/10 border-b border-indigo-500/20 text-xs text-indigo-300 text-center backdrop-blur-sm">
          Header ziehen = verschieben · Ecke (unten rechts) ziehen = Größe ändern · "Lücken füllen" = Platz von ausgeblendeten Widgets schließen
        </div>
      )}

      {/* Grid */}
      <div className={`relative flex-1 overflow-hidden ${editMode ? 'layout-edit-mode overflow-auto' : ''}`}>
        <GridLayout
          className="layout"
          layout={activeWidgets}
          cols={16}
          rowHeight={rowHeight}
          width={preScaleWidth}
          isDraggable={editMode}
          isResizable={editMode}
          onLayoutChange={handleLayoutChange}
          margin={[12, 12]}
          containerPadding={[16, 16]}
          draggableHandle=".widget-header"
        >
          {activeWidgets.map(item => {
            const Widget = WIDGET_MAP[item.i]?.component
            if (!Widget) return null
            return (
              <div key={item.i}>
                {editMode && (
                  <div className="absolute inset-0 ring-2 ring-indigo-500/40 ring-inset rounded-xl z-10 pointer-events-none" />
                )}
                <Widget />
              </div>
            )
          })}
        </GridLayout>
      </div>

      <PinModal
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        onSuccess={() => { setPinOpen(false); navigate('/admin') }}
      />
    </div>
    </div>
  )
}
