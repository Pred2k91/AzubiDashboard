// Minimaler Service Worker nur für Web Push (Workflows: Push-Benachrichtigungen) + die
// PWA-Installierbarkeit (manche Browser verlangen einen fetch-Handler dafür). Kein
// echtes Offline-Caching -- bewusst so schlank wie möglich gehalten, lässt den Browser
// die Anfrage normal behandeln.
self.addEventListener('fetch', () => {})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (_) {}
  const title = data.title || 'HERcademy'
  const options = {
    body: data.body || '',
    ...(data.icon ? { icon: data.icon } : {}),
    ...(data.badge ? { badge: data.badge } : {}),
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus()
      return self.clients.openWindow('/')
    })
  )
})
