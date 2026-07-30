const CACHE_NAME = 'batliss-cache-v4';
const urlsToCache = [
  './',
  './index.html',
  './src/app-core.js',
  './words.json',
  './quotes.json',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Stale-While-Revalidate for local app shell assets
  if (url.origin === location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cachedResponse = await cache.match(event.request, { ignoreSearch: true });

        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
          if (cachedResponse) {
            return cachedResponse;
          }
          throw err;
        });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Pass third-party requests directly to network
  event.respondWith(fetch(event.request));
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      ).then(() => self.clients.claim());
    })
  );
});
