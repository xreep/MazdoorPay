// MazdoorPay service worker: caches the app shell only, so the app opens quickly and installs.
// API calls are never cached or replayed; without a connection the app says it cannot reach the
// server rather than showing old data or saving anything.
const CACHE = 'mazdoorpay-shell-v2';
const SHELL = ['/', '/theme.js', '/favicon.svg', '/manifest.webmanifest', '/icon-192.png'];
const MAX_ASSETS = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Built files are content-hashed, so old ones are never needed again; keep the cache small.
async function trim(cache) {
  const keys = await cache.keys();
  const assets = keys.filter((r) => new URL(r.url).pathname.startsWith('/assets/'));
  await Promise.all(
    assets.slice(0, Math.max(0, assets.length - MAX_ASSETS)).map((r) => cache.delete(r))
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Pages: always try the network for the latest app; offline, use the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Small shell files (like the theme script): the latest when online, the cached copy offline.
  if (SHELL.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(url.pathname)));
    return;
  }

  // Hashed build files never change: serve from the cache once fetched.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then(async (cache) => {
                await cache.put(request, copy);
                await trim(cache);
              });
            }
            return response;
          })
      )
    );
  }
});
