// Minimaler Service Worker nur für Web Push (Workflows: Push-Benachrichtigungen).
// Kein Offline-Caching/PWA-Funktionsumfang -- bewusst so schlank wie möglich gehalten.

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (_) {}
  const title = data.title || 'Ausbildungsdashboard'
  const options = {
    body: data.body || '',
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
