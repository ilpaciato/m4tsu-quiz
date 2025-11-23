const CACHE_NAME = 'm4tsu-quiz-v1';
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

// 1. INSTALLAZIONE: Scarica e salva le risorse di base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// 2. ATTIVAZIONE: Pulisce vecchie cache se cambi versione
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 3. FETCH: Intercetta le richieste
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Se è in cache, restituiscilo (Offline first)
        if (response) {
          return response;
        }
        
        // Altrimenti, scaricalo da internet
        return fetch(event.request).then(
          (networkResponse) => {
            // Se la risposta è valida, salvala in cache per la prossima volta (Runtime caching)
            // Questo serve per salvare i file .json dei singoli quiz man mano che li apri
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
        ).catch(() => {
            // Se siamo offline e non è in cache (es. immagine nuova), potremmo mostrare un placeholder
            // Per ora non facciamo nulla di specifico
        });
      })
  );
});