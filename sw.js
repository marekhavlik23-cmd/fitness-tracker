// Service worker: network-first with cache fallback.
// Online you always get the freshest version, offline everything still works.
const CACHE = "fittrack-v6";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/storage.js",
  "./js/seed.js",
  "./js/migrations.js",
  "./js/format.js",
  "./js/chart.js",
  "./js/views/workout.js",
  "./js/views/session.js",
  "./js/views/weight.js",
  "./js/views/nutrition.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  event.respondWith(
    // cache: "no-cache" forces revalidation with the server so a stale HTTP cache
    // can never serve a mix of old and new app modules after an update.
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined))
      )
  );
});
