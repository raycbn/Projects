/* PedalMap service worker — cache app shell for offline reopen.
 * NEVER intercept Firebase Auth helper routes (/__/auth, /__/firebase):
 * a cached or SPA fallback response there breaks Google redirect login.
 */
const CACHE = 'pedalmap-shell-v10'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

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

  if (req.mode === 'navigate') {
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
            const copy = res.clone()
            void caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})
