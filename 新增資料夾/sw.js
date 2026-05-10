const CACHE_NAME = 'collecttrack-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/index11.html',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 若在快取中找到，則回傳快取
        if (response) {
          return response;
        }
        // 否則透過網路抓取
        return fetch(event.request);
      })
  );
});
