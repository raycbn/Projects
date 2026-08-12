/* PedalMap service worker — cache app shell for offline reopen.
 * NEVER intercept Firebase Auth helper routes (/__/auth, /__/firebase):
 * a cached or SPA fallback response there breaks Google redirect login.
 */
const CACHE = 'pedalmap-shell-v31'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/og-default.jpg', '/llms.txt']
const APEX = 'https://pedalmap.es'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Firebase Auth / Hosting reserved helpers — always network, never cache.
  if (url.pathname.startsWith('/__/')) return

  // MapLibre worker must stay network-first (stale workers break the map).
  if (
    url.pathname.includes('maplibre-gl-worker') ||
    url.pathname.endsWith('maplibre-gl-worker.mjs')
  ) {
    event.respondWith(
      fetch(req)
        .then((res) => res)
        .catch(() => caches.match(req).then((r) => r || Response.error())),
    )
    return
  }

  if (req.mode === 'navigate') {
    // Belt-and-suspenders if an old SW is still controlling a legacy host.
    if (
      url.hostname === 'pedalmap-79b3a.web.app' ||
      url.hostname === 'pedalmap-79b3a.firebaseapp.com' ||
      url.hostname === 'www.pedalmap.es'
    ) {
      event.respondWith(Response.redirect(APEX + url.pathname + url.search + url.hash, 302))
      return
    }
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only cache the app shell, not arbitrary navigations.
          if (url.pathname === '/' || url.pathname === '/index.html') {
            const copy = res.clone()
            void caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/index.html'))),
    )
    return
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.svg'))) {
            // Never put maplibre workers into the shell cache.
            if (
              url.pathname.includes('maplibre-gl-worker') ||
              url.pathname.endsWith('maplibre-gl-worker.mjs')
            ) {
              return res
            }
            const copy = res.clone()
            void caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})
