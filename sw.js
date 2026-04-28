// ============================================================
//  Service Worker — Cache face-api.js models
//  ไฟล์นี้ต้องวางที่ root ของโปรเจกต์ (เดียวกับ index.html)
// ============================================================

const CACHE_NAME  = 'faceapi-models-v1';
const MODEL_ORIGIN = 'https://justadudewhohacks.github.io';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // ลบ cache เวอร์ชันเก่าออก
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Cache เฉพาะ face-api model files (*.bin, *.json จาก justadudewhohacks)
  if (url.startsWith(MODEL_ORIGIN) && (url.endsWith('.bin') || url.endsWith('.json'))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached; // ✅ ได้จาก cache ทันที
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
  }
});
