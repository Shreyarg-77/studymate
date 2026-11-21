// Minimal service worker: it makes the app installable and never caches anything.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", () => {
  // Network only: the browser handles every request as normal.
});
