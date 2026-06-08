self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // Use a Network-First strategy to ensure installability constraints check marks on offline scenarios
  event.respondWith(
    fetch(event.request).then((res) => {
      const resClone = res.clone();
      caches.open('time-tracker-v1').then((cache) => {
        cache.put(event.request, resClone);
      });
      return res;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});
