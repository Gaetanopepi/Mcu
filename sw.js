/* Minimal offline cache for the app shell. Never touches TMDB or image
   requests — those stay live so data can't go stale silently. */
const CACHE_NAME = "mcu-tracker-v5";
const APP_SHELL = [
  "./",
  "./index.html",
  "./assets/style.css",
  "./assets/data.js",
  "./assets/synopses.js",
  "./assets/metadata.js",
  "./assets/poster.js",
  "./assets/tmdb.js",
  "./assets/ui.js",
  "./assets/app.js",
  "./manifest.json",
];

// File di dati che cambiano da soli (la GitHub Action riscrive metadata.js ogni
// notte): vanno serviti network-first, altrimenti l'utente vedrebbe i dati del
// giorno prima. Tutto il resto è shell statica e sta bene in cache-first.
const NETWORK_FIRST = ["/assets/metadata.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // leave TMDB API + image CDN alone
  if (event.request.method !== "GET") return;

  const store = (res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return res;
  };

  if (NETWORK_FIRST.some((path) => url.pathname.endsWith(path))) {
    // dati freschi se la rete c'è, cache solo come rete di sicurezza offline
    event.respondWith(
      fetch(event.request).then(store).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then(store).catch(() => cached);
      return cached || network;
    })
  );
});
