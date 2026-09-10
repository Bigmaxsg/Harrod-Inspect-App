// Harrod Truck Inspect — PWA wrapper service worker.
//
// WHY THIS IS NOT EMPTY ANY MORE (2026-09-10)
// It used to be two no-op listeners:
//     self.addEventListener('install', () => {});
//     self.addEventListener('fetch',   () => {});
// which was enough for Chrome's OLD installability rule: "has a service worker with a
// fetch handler". Chrome replaced that with "must actually work offline", and a fetch
// handler that never calls respondWith fails it. The Add-to-Home-Screen prompt then
// silently stops being offered — which is what happened on Max's Android tablet, with
// no change to this repo, when Chrome updated.
//
// So this worker does the minimum that is genuinely true: it caches the wrapper shell
// and serves it when the network is gone.
//
// WHAT IT DELIBERATELY DOES NOT CACHE: the Google Apps Script app itself. That is
// cross-origin (script.google.com), it is the live application, and a stale cached copy
// of it would be far worse than an offline message. Those requests fall straight
// through to the network untouched.
const CACHE = 'harrod-shell-v1';
const SHELL = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Drop older shell caches so a future CACHE bump cannot leave stale copies behind.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // NETWORK FIRST for the page itself. The wrapper's whole job is to load the live GAS
  // app, so a cached shell must never win while the network is available — cache is the
  // offline fallback only, which is also exactly what makes the app installable again.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache first for the handful of shell assets; everything else (including every
  // cross-origin request to the GAS app) simply goes to the network.
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
