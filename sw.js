const CACHE_NAME = 'notepad-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './script.js',
  './style.css',
  './manifest.json'
];

// تثبيت الـ Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// تفعيل الـ Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// اعتراض الطلبات وتقديم الاستجابات من الـ Cache
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إرجاع الاستجابة من الـ Cache إذا كانت متوفرة
        if (response) {
          return response;
        }
        // خلاف ذلك، قم بجلب الطلب من الشبكة
        return fetch(event.request);
      })
  );
});