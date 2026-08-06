// Lantern service worker.
// Classic (IIFE) script, no workbox. We deliberately do NOT install
// navigation fallbacks or intercept ANY same-origin request — iOS PWA
// standalone mode is extremely strict and any SW handler returning a
// Response.redirect() on a request that was actually a module-script
// fetch causes an opaque "importing a module script failed" error.
//
// What this SW does:
//   - precaches the tiny app shell on install
//   - runtime-caches HuggingFace model artifacts so they survive reloads
//   - runtime-caches MLC (WebLLM) model artifacts
//
// What it does NOT do:
//   - intercept any /assets/* request
//   - intercept any module-script fetch
//   - fall back to index.html on navigation miss (the engine bundles
//     are 6 MB and we never want a redirect there)

const VERSION = "v1";
const SHELL_CACHE = `lantern-shell-${VERSION}`;
const HF_CACHE = `hf-models-${VERSION}`;
const MLC_CACHE = `webllm-models-${VERSION}`;

const SHELL = [
  "/lantern/",
  "/lantern/index.html",
  "/lantern/manifest.webmanifest",
  "/lantern/icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) =>
      Promise.allSettled(SHELL.map((u) => c.add(u)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (n) =>
              ![SHELL_CACHE, HF_CACHE, MLC_CACHE].includes(n) &&
              n.startsWith("lantern-")
          )
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Hugging Face: cache-first, generous TTL.
  if (url.host.endsWith("huggingface.co")) {
    event.respondWith(cacheFirst(req, HF_CACHE));
    return;
  }
  // MLC AI artifact CDN.
  if (url.host.endsWith("mlc-ai.org") || /mlc.*\.ai$/.test(url.host)) {
    event.respondWith(cacheFirst(req, MLC_CACHE));
    return;
  }
  // Same-origin: do nothing — let the browser handle it.
  // Cross-origin (other than HF / MLC): also do nothing.
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (e) {
    if (hit) return hit;
    throw e;
  }
}
