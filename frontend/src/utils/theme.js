export function applyWidgetOpacity(opacity) {
  document.documentElement.style.setProperty('--widget-opacity', opacity)
}

export function applyAccentColor(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return

  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  const root = document.documentElement
  root.style.setProperty('--accent', hex)
  root.style.setProperty('--accent-hover', hex)
  root.style.setProperty('--accent-muted', `rgba(${r},${g},${b},0.15)`)

  const id = 'theme-accent-override'
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('style')
    el.id = id
    document.head.appendChild(el)
  }

  el.textContent = `
    .bg-indigo-600 { background-color: ${hex} !important; }
    .bg-indigo-500 { background-color: ${hex} !important; }
    .hover\\:bg-indigo-500:hover { background-color: rgba(${r},${g},${b},0.85) !important; }
    .bg-indigo-600\\/20 { background-color: rgba(${r},${g},${b},0.2) !important; }
    .bg-indigo-600\\/10 { background-color: rgba(${r},${g},${b},0.1) !important; }
    .text-indigo-400 { color: rgba(${r},${g},${b},0.9) !important; }
    .text-indigo-300 { color: rgba(${r},${g},${b},0.75) !important; }
    .border-indigo-500 { border-color: ${hex} !important; }
    .border-indigo-500\\/40 { border-color: rgba(${r},${g},${b},0.4) !important; }
    .border-indigo-500\\/30 { border-color: rgba(${r},${g},${b},0.3) !important; }
    .border-indigo-500\\/20 { border-color: rgba(${r},${g},${b},0.2) !important; }
    .ring-1.ring-indigo-500\\/50 { --tw-ring-color: rgba(${r},${g},${b},0.5) !important; }
    .accent-indigo-600 { accent-color: ${hex} !important; }
    .nav-item.active { border-left-color: ${hex} !important; }
  `
}
