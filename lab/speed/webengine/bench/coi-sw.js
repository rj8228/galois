// Cross-origin isolation on a static host (GitHub Pages cannot send headers): this service worker
// re-serves every response of its scope with COOP and COEP, so after one reload the page is
// crossOriginIsolated and may create a shared WebAssembly.Memory (SharedArrayBuffer).
// Same idea as gzuidhof/coi-serviceworker, written from scratch (about 30 lines).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return // a Chrome devtools quirk
  event.respondWith(
    fetch(req).then((res) => {
      if (res.status === 0) return res // opaque (cross-origin no-cors): cannot be rewritten
      const headers = new Headers(res.headers)
      headers.set('Cross-Origin-Opener-Policy', 'same-origin')
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
      // Lets this origin's files load in other isolated pages too; harmless here.
      headers.set('Cross-Origin-Resource-Policy', 'same-origin')
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
    }),
  )
})
