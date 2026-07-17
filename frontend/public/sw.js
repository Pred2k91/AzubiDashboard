// Minimaler Service Worker nur für Web Push (Workflows: Push-Benachrichtigungen).
// Kein Offline-Caching/PWA-Funktionsumfang -- bewusst so schlank wie möglich gehalten.
//
// Bewusst OHNE fetch-Handler: Chrome verlangt den für die PWA-Installierbarkeit schon
// lange nicht mehr, und ein registrierter fetch-Listener fängt JEDE Netzwerk-Anfrage der
// Seite ab (auch normale API-Aufrufe) -- das hat in der installierten PWA (WebAPK) zu
// 401-Fehlern beim Push-Abonnieren geführt (Anmelde-Cookie kam beim abgefangenen Request
// nicht mehr an). Ohne Listener bleiben alle Anfragen komplett unangetastet.

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
