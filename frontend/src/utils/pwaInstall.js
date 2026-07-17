// Fängt das beforeinstallprompt-Event (Chrome/Edge auf Android & Desktop -- Safari/iOS
// unterstützt das gar nicht, dort bleibt nur "Teilen" -> "Zum Home-Bildschirm") möglichst
// früh ab (siehe App.jsx), damit es nicht verloren geht, falls die Komponente mit dem
// Install-Button erst später gerendert wird. Modul-weiter Singleton statt React-Context,
// da es nur einen einzigen, seltenen globalen Zustand gibt.
let deferredPrompt = null
let listeners = []

function notify() {
  listeners.forEach(cb => cb(!!deferredPrompt))
}

export function initPwaInstallCapture() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export function isPwaInstallAvailable() {
  return !!deferredPrompt
}

export function onPwaInstallAvailabilityChange(callback) {
  listeners.push(callback)
  return () => { listeners = listeners.filter(cb => cb !== callback) }
}

// Gibt 'accepted' | 'dismissed' zurück, oder null falls kein Prompt (mehr) verfügbar ist.
export async function promptPwaInstall() {
  if (!deferredPrompt) return null
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  notify()
  return outcome
}
