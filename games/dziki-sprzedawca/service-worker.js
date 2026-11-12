const CACHE_NAME = 'dziki-sprzedawca-shell-v3-polyhaven-stalls-v1-black-market-v1-reward-code-v1-door-light-v1';
const MODEL_CACHE = 'dziki-sprzedawca-models-v1';
const APP_FILES = [
  './index.html',
  './manifest.webmanifest',
  './style.css',
  './game.js',
  './world.js',
  './market-stalls.js',
  './black-market.js',
  './underworld.js',
  './contraband.js',
  './models.js',
  './polyhaven-models.js',
  './catalog.js',
  './legacy-items.js',
  './layout.js',
  './economy.js',
  './customers.js',
  './joystick.js',
  './prices.js',
  './icons.js',
  './vendor/three.module.min.js',
  './vendor/GLTFLoader.js',
  './vendor/BufferGeometryUtils.js',
  './vendor/SkeletonUtils.js',
  './vendor/RoomEnvironment.js',
  './vendor/meshopt_decoder.module.js',
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
    // Content-addressed models are cached on demand; never download the entire catalog at startup.
    if(url.pathname.endsWith('.glb')){
      const cache=await caches.open(MODEL_CACHE),cached=await cache.match(request);
      if(cached)return cached;
      const response=await fetch(request);
      if(response.ok){
        await cache.put(request,response.clone()).catch(()=>{});
        const keys=await cache.keys();if(keys.length>120)await Promise.all(keys.slice(0,keys.length-120).map(key=>cache.delete(key)));
      }
      return response;
    }
    const cache=await caches.open(CACHE_NAME);
    try{
      const response=await fetch(request);
      if(response.ok&&response.type==='basic')await cache.put(request,response.clone()).catch(()=>{});
      return response;
    }catch(error){
      const cached=await cache.match(request,{ignoreSearch:true});
      if(cached)return cached;
      if(request.mode==='navigate')return await cache.match(new URL('./index.html',self.registration.scope));
      throw error;
    }
  })());
});

