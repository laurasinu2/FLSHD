const CACHE = "flshd-v10";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/data.js",
  "./src/db.js",
  "./src/srs.js",
  "./src/vocab/block-01a.js",
  "./src/vocab/block-01b.js",
  "./src/vocab/block-02.js",
  "./src/vocab/block-03.js",
  "./src/vocab/block-04.js",
  "./src/vocab/block-05.js",
  "./src/vocab/block-06.js",
  "./src/vocab/block-07a.js",
  "./src/vocab/block-07b.js",
  "./src/vocab/block-08a.js",
  "./src/vocab/block-08b.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }))
  );
});
