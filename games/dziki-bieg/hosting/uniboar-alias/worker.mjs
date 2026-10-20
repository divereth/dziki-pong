export const CANONICAL_ORIGIN = 'https://dzikibieg.pages.dev';

// This must remain at the old /sw.js URL: existing installations check it for
// updates even while their original service worker serves a cached game.
export const RETIRE_WORKER = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('robot-uniboar-')).map(key => caches.delete(key)));
  await self.registration.unregister();
  const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
  await Promise.all(windows.map(client => {
    const old = new URL(client.url);
    return client.navigate(${JSON.stringify(CANONICAL_ORIGIN)} + old.pathname + old.search + old.hash).catch(() => {});
  }));
})()));
`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/sw.js') {
      return new Response(RETIRE_WORKER, {headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store', 'Service-Worker-Allowed': '/',
        'X-Content-Type-Options': 'nosniff',
      }});
    }
    const target = CANONICAL_ORIGIN + url.pathname + url.search;
    if (url.pathname === '/api/leaderboard' || url.pathname.startsWith('/api/leaderboard/')) {
      // Keep the existing same-origin POST boundary, then identify this trusted
      // server-side forward as a canonical request to the shared backend.
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return new Response('Origin not allowed.', {status: 403});
      const forwarded = new Request(target, request);
      if (origin) forwarded.headers.set('Origin', CANONICAL_ORIGIN);
      return fetch(forwarded);
    }
    return new Response(null, {status: 302, headers: {
      Location: target, 'Cache-Control': 'no-store',
    }});
  },
};
