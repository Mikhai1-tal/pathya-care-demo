/* Pathya Care service worker: network-first so updates show immediately, cache fallback for offline use. */
const CACHE = "pathya-care-v6";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/app.css", "data/pathya-data.js",
  "js/core.js", "js/store.js", "js/planner.js", "js/chat.js", "js/views-today.js", "js/views-care.js", "js/views-care2.js", "js/views-profile.js", "js/sync.js", "js/account.js", "js/app.js", "privacy.html",
  "assets/icon-192.png", "assets/icon-512.png", "assets/apple-touch-icon.png", "assets/og.png"
];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/api/")) return;   // account data is never cached by the service worker
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match("index.html"))));
});