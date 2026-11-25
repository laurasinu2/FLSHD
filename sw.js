const CACHE = "flshd-v12";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/cloud.js",
  "./src/supabase-config.js",
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
      .then(keys => Promise.all(keys.filter(key => key.startsWith("flshd-") && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Only cache public static application assets and the public SDK.
// Never cache Supabase auth, API, image, or other private responses.
const STATIC_URLS = new Set(ASSETS.map(path => new URL(path,self.location.href).href));
const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
self.addEventListener("fetch", event => {
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.href!==SDK_URL && !STATIC_URLS.has(url.href))return;
  if(request.headers.has("Authorization") || request.headers.has("apikey"))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(request);
      if(response.ok || (url.href===SDK_URL && response.type==="opaque")) {
        try{await cache.put(request,response.clone());}catch{}
      }
      return response;
    }catch(error){
      const fallback=await cache.match(request);
      if(fallback)return fallback;
      throw error;
    }
  })());
});
