// ── HanziPL Service Worker ────────────────────────────
// Strategia: cache-first dla app shell, network-first dla reszty.
// Brak: cachowania audio, push notifications, złożonej logiki offline.

const CACHE_NAME = 'hanzipl-shell-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/words.js',
  '/js/lesson-examples.js',
  '/js/srs.js',
  '/js/storage.js',
  '/js/courseStages.js',
  '/js/firebase.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg',
];

// ── Install: pre-cache app shell ─────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // addAll z indywidualnym fallbackiem — jeden błąd nie blokuje instalacji
      return Promise.all(
        APP_SHELL.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] nie udało się zakeszować:', url, err.message);
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── Activate: usuń stare cache'e ─────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(k) { return k !== CACHE_NAME; })
          .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── Fetch: cache-first dla app shell, pass-through dla reszty ──
self.addEventListener('fetch', function(e) {
  var req = e.request;

  // Tylko GET
  if (req.method !== 'GET') return;

  var url = req.url;

  // Nie przechwytuj Firebase, Google APIs, CDN fontów, audio mp3
  if (
    url.includes('firebaseapp.com') ||
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.google') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('fonts.gstatic.com') ||
    url.includes('fonts.googleapis.com') ||
    url.endsWith('.mp3')
  ) {
    return;
  }

  e.respondWith(
    caches.match(req).then(function(cached) {
      if (cached) return cached;

      return fetch(req).then(function(response) {
        // Zakeszuj tylko udane odpowiedzi dla lokalnych zasobów
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(req, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline fallback dla nawigacji
        if (req.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
