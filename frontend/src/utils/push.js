import { pushApi } from '../api/client'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

// Fragt die Browser-Berechtigung an und abonniert Push für dieses Gerät. Wirft bei
// Ablehnung/Fehler -- der Aufrufer entscheidet, ob das laut gemeldet wird (manueller
// Button im Profil) oder stillschweigend ignoriert wird (automatischer Versuch nach
// dem allerersten Login, siehe LoginPage.jsx).
export async function subscribeToPush() {
  const reg = await navigator.serviceWorker.ready
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Benachrichtigungen wurden nicht erlaubt.')
  const { publicKey } = await pushApi.getVapidPublicKey()
  if (!publicKey) throw new Error('Push ist serverseitig noch nicht eingerichtet (VAPID-Schlüssel fehlen).')
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
  await pushApi.subscribe(sub.toJSON())
  return sub
}
