const CACHE = 'app-v157';
// Los dibujos viven en un caché propio que sobrevive a los bumps de versión (si no, cada
// release los volvía a bajar). Si se cambia un dibujo existente, subir este número.
const IMG_CACHE = 'jf-imgs-v2';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.all([
        c.add(new Request('./', { cache: 'reload' })),
        c.add(new Request('./index.html', { cache: 'reload' })),
      ]).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Dibujos: cache-first. Con network-first cada re-render del entreno esperaba a la red
  // y si fallaba el 503 hacía que el <img> se borrara.
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.includes('/imgs/')) {
    e.respondWith(
      caches.open(IMG_CACHE).then(c =>
        c.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(response => {
          if (response.ok) c.put(req, response.clone());
          return response;
        }))
      )
    );
    return;
  }

  e.respondWith(
    fetch(req).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(req).then(cached => {
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
