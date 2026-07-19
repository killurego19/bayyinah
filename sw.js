/* Bayyinah service worker — app-shell caching for a fast, installable PWA.
   Strategy:
     • /api/*  and non-GET  → never intercepted (answers always hit the live API)
     • navigations (HTML)    → network-first, fall back to cached shell when offline
     • static assets         → stale-while-revalidate
*/
const VERSION = "bayyinah-v4";
const SHELL = [
  "/", "/index.html", "/assistant.html", "/manifest.webmanifest", "/appendices.json",
  "/fonts/uthmanic-hafs.woff2",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                     // POST /api/ask etc. → straight to network
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.startsWith("/api/")) return; // API: network only

  if (req.mode === "navigate") {                        // HTML: network-first
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        caches.open(VERSION).then((c) => c.put("/", net.clone())).catch(() => {});
        return net;
      } catch (err) {
        return (await caches.match(req)) || (await caches.match("/")) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {                          // static: stale-while-revalidate
    const cached = await caches.match(req);
    const fetchP = fetch(req).then((res) => {
      if (res && res.status === 200 && (url.origin === location.origin || res.type === "opaque")) {
        caches.open(VERSION).then((c) => c.put(req, res.clone())).catch(() => {});
      }
      return res;
    }).catch(() => null);
    return cached || (await fetchP) || Response.error();
  })());
});
