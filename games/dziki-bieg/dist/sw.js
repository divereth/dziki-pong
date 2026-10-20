'use strict';

const CACHE_NAME = 'dziki-bieg-pwa-v2';
const APP_FILES = [
  './index.html',
  './style.css?v=leaderboard-1',
  './engine.js?v=mobile-2',
  './viewport.js?v=mobile-2',
  './game.js?v=leaderboard-1',
  './pwa.js',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest'
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
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith('dziki-bieg-pwa-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.open(CACHE_NAME).then(cache =>
        cache.match(new URL('./index.html', self.registration.scope))
          .then(response => response || Response.error())
      ))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => cache.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        return cache.put(request, response.clone()).then(() => response);
      }
      return response;
    })))
  );
});
