const CACHE_NAME = 'dziki-sprzedawca-shell-v1';
const APP_FILES = [
  './index.html',
  './manifest.webmanifest',
  './style.css',
  './game.js',
  './world.js',
  './models.js',
  './layout.js',
  './economy.js',
  './customers.js',
  './joystick.js',
  './prices.js',
  './icons.js',
  './vendor/three.module.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names
        .filter(name => name.startsWith('dziki-sprzedawca-shell-') && name !== CACHE_NAME)
        .map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return await cache.match(request) || await cache.match(new URL('./index.html', self.registration.scope));
      }
    }

    const cached = await cache.match(request, {ignoreSearch: true});
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
    return response;
  })());
});
