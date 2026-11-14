// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 LoneWolf4Blitzkrieg. Part of The Game of Life; see LICENSE.
//
// Service worker for The Game of Life. It does two jobs:
// 1. Multicore: browsers only allow shared memory (SharedArrayBuffer) on pages sent with the
//    COOP and COEP headers. GitHub Pages can't set headers, so this worker adds them.
// 2. Offline play: it keeps a copy of the game (and its fonts) on the device, so after one visit
//    the game opens without internet, still multicore, and can be installed as an app.
// index.html registers it; if anything fails, the game simply runs on one thread.
const CACHE = 'gol-offline-v1';
const CORE = ['./', './index.html', './coi-sw.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(CORE.map(u => c.add(u).catch(() => { /* a missing extra file is not fatal */ }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('gol-offline-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Add the cross-origin isolation headers to a response (they are what switches multicore on).
function isolate(res) {
  if (!res || res.status === 0) return res;   // opaque responses can't be changed
  const headers = new Headers(res.headers);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
function remember(req, res) {
  if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) {
    // Fonts: use the saved copy if there is one, otherwise fetch and save it.
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => remember(req, res))).then(isolate));
    return;
  }
  if (url.origin !== self.location.origin) { e.respondWith(fetch(req).then(isolate)); return; }
  // The game itself: try the network first (so updates arrive), fall back to the saved copy offline.
  e.respondWith(fetch(req).then(res => remember(req, res)).catch(() =>
    caches.match(req, { ignoreSearch: true }).then(hit => hit ||
      (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  ).then(isolate));
});
