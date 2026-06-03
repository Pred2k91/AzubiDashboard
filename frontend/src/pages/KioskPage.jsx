import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import GridLayout from 'react-grid-layout'
import { Settings, Lock, Unlock, RotateCcw, ExternalLink } from 'lucide-react'
import ClockWidget from '../components/widgets/ClockWidget'
import CalendarWidget from '../components/widgets/CalendarWidget'
import TodoWidget from '../components/widgets/TodoWidget'
import NotesWidget from '../components/widgets/NotesWidget'
import DepartmentWidget from '../components/widgets/DepartmentWidget'
import { settingsApi } from '../api/client'

const WIDGET_MAP = {
  clock: { component: ClockWidget, label: 'Uhrzeit' },
  calendar: { component: CalendarWidget, label: 'Kalender' },
  todos: { component: TodoWidget, label: 'Aufgaben' },
  departments: { component: DepartmentWidget, label: 'Abteilungen' },
  notes: { component: NotesWidget, label: 'Notizen' },
}

const DEFAULT_LAYOUT = [
  { i: 'clock', x: 0, y: 0, w: 4, h: 5, minW: 2, minH: 3 },
  { i: 'calendar', x: 4, y: 0, w: 5, h: 10, minW: 3, minH: 6 },
  { i: 'todos', x: 0, y: 5, w: 4, h: 8, minW: 2, minH: 4 },
  { i: 'departments', x: 9, y: 0, w: 7, h: 10, minW: 4, minH: 6 },
  { i: 'notes', x: 4, y: 10, w: 12, h: 6, minW: 3, minH: 4 },
]

export default function KioskPage() {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)
  const [editMode, setEditMode] = useState(false)
  const [widgetsEnabled, setWidgetsEnabled] = useState({
    clock: true, calendar: true, todos: true, departments: true, notes: true,
  })
  const [title, setTitle] = useState('Ausbildungsdashboard')
  const [logoUrl, setLogoUrl] = useState(null)
  const [backgroundUrl, setBackgroundUrl] = useState(null)
  const [bgOpacity, setBgOpacity] = useState(0.5)
  const [containerWidth, setContainerWidth] = useState(window.innerWidth)
  const [containerHeight, setContainerHeight] = useState(window.innerHeight)

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
      if (s.logo_url) setLogoUrl(s.logo_url)
      if (s.background_url) setBackgroundUrl(s.background_url)
      if (s.background_opacity !== undefined) setBgOpacity(s.background_opacity)
    }).catch(() => {})

    const handleResize = () => {
      setContainerWidth(window.innerWidth)
      setContainerHeight(window.innerHeight)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const saveLayout = useCallback(async (newLayout) => {
    await settingsApi.update('kiosk_layout', newLayout).catch(() => {})
  }, [])

  const handleLayoutChange = (newLayout) => {
    const merged = newLayout.map(item => {
      const orig = layout.find(l => l.i === item.i)
      return { ...item, minW: orig?.minW, minH: orig?.minH }
    })
    setLayout(merged)
    if (editMode) saveLayout(merged)
  }

  const handleReset = async () => {
    setLayout(DEFAULT_LAYOUT)
    await saveLayout(DEFAULT_LAYOUT)
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

  const activeWidgets = layout.filter(l => widgetsEnabled[l.i])

  return (
    <div
      className="h-screen flex flex-col relative overflow-hidden"
      style={{ backgroundColor: '#0d0f1a' }}
    >
      {/* Hintergrundbild */}
      {backgroundUrl && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${backgroundUrl})` }}
          />
          <div
            className="absolute inset-0 bg-[#0d0f1a]"
            style={{ opacity: 1 - bgOpacity }}
          />
        </>
      )}

      {/* Header */}
      <div className="relative flex items-center justify-between px-6 py-3 border-b border-[#2a2d4a]/80 shrink-0 backdrop-blur-sm bg-[#0d0f1a]/60">
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
          <Link
            to="/admin"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e2035] border border-[#2a2d4a] text-slate-500 hover:text-slate-300 transition-all"
          >
            <Settings size={13} />
            Admin
          </Link>
        </div>
      </div>

      {/* Edit mode hint */}
      {editMode && (
        <div className="relative px-6 py-2 bg-indigo-600/10 border-b border-indigo-500/20 text-xs text-indigo-300 text-center backdrop-blur-sm">
          Widgets verschieben und in der Größe anpassen — Änderungen werden automatisch gespeichert
        </div>
      )}

      {/* Grid */}
      <div className={`relative flex-1 overflow-hidden ${editMode ? 'layout-edit-mode overflow-auto' : ''}`}>
        <GridLayout
          className="layout"
          layout={activeWidgets}
          cols={16}
          rowHeight={rowHeight}
          width={containerWidth}
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
    </div>
  )
}
