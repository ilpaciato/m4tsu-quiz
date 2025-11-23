// CAMBIA v1 IN v2 QUI SOTTO PER FORZARE L'AGGIORNAMENTO SU TUTTI I DISPOSITIVI
const CACHE_NAME = 'm4tsu-quiz-v2'; 

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data/quiz-list.json',
  './images/logo.png',
  './images/background.png',
  './images/signature.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Forza il nuovo download di tutti i file
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  // Forza l'attivazione immediata del nuovo SW
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Cancellazione vecchia cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  // Prende il controllo della pagina immediatamente senza ricaricare
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          (networkResponse) => {
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            return networkResponse;
          }
        ).catch(() => { });
      })
  );
});