// Service worker de VeDirecto: que el directorio siga abriendo SIN señal
// (zona de desastre = conectividad intermitente).
//
// Estrategia:
// - /_next/static/* (hasheados, inmutables) → cache-first.
// - Navegaciones y /api/sitios | /api/noticias → network-first con fallback a
//   la última copia cacheada (offline muestra lo último que viste).
// - Nunca se cachea: otros orígenes (favicons, Supabase), admin, auth, cron.
const CACHE = 'vedirecto-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

const NO_CACHE = /^\/(admin|auth|api\/admin|api\/cron|api\/me|api\/probe|api\/track)/

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  if (NO_CACHE.test(url.pathname)) return

  // Estáticos con hash: si está en caché, ni tocamos la red.
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req)
        if (hit) return hit
        const r = await fetch(req)
        if (r.ok) c.put(req, r.clone())
        return r
      })
    )
    return
  }

  // Páginas y datos propios: red primero; sin red, la última copia buena.
  if (req.mode === 'navigate' || url.pathname.startsWith('/api/sitios') || url.pathname.startsWith('/api/noticias')) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) {
            const copy = r.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return r
        })
        .catch(async () => (await caches.match(req)) || (req.mode === 'navigate' && (await caches.match('/'))) || Response.error())
    )
  }
})
