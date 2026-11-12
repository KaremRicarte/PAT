// Service worker do PAT: só recebe os lembretes (web push). Nada de cache offline nesta etapa.
// O payload vem das funções lembrete e lembrete-teste: { titulo, corpo, url }.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()))

self.addEventListener('push', (evento) => {
  let dados = {}
  try { dados = evento.data ? evento.data.json() : {} } catch { dados = { corpo: evento.data?.text() } }
  const titulo = dados.titulo || 'PAT'
  evento.waitUntil(self.registration.showNotification(titulo, {
    body: dados.corpo || '',
    icon: '/img/icone-192.png',
    badge: '/img/icone-192.png',
    data: { url: dados.url || '/' },
  }))
})

// Tocar na notificação: usa uma aba do PAT já aberta (foca e vai para a url) ou abre uma nova.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url = new URL(evento.notification.data?.url || '/', self.location.origin).href
  evento.waitUntil((async () => {
    const abas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const aba = abas.find((c) => new URL(c.url).origin === self.location.origin)
    if (aba) {
      try {
        await aba.focus()
        await aba.navigate(url)
        return
      } catch { /* aba não controlada por este service worker: abre outra */ }
    }
    await self.clients.openWindow(url)
  })())
})
