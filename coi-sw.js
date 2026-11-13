// Cross-origin isolation service worker for The Game of Life.
// Multicore play needs SharedArrayBuffer, which browsers only allow on pages served with the
// COOP and COEP headers. GitHub Pages can't set headers, so this worker adds them to every
// response it serves. index.html registers it and reloads once; if anything fails, the game
// simply runs on one thread as before.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  e.respondWith(fetch(req).then(res => {
    if (res.status === 0) return res;   // opaque responses can't be modified
    const headers = new Headers(res.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }).catch(err => { console.warn('coi-sw fetch failed', err); return fetch(req); }));
});
