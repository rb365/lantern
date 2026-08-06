/// <reference lib="webworker" />

// Hand-written service worker for Lantern.
//
// Why hand-written instead of vite-plugin-pwa's generated SW?
// Because iOS PWA in standalone mode has well-known issues with the
// AMD/importScripts-based wrapper the generated SW uses — manifesting
// as "importing a module script failed" the moment a large engine
// bundle is fetched.
//
// This SW is intentionally minimal:
//   - precache the small app shell at exact, explicit paths
//   - runtime-cache HF / MLC model artifacts (CacheFirst, generous TTL)
//   - serve index.html for any SPA navigation fallback
//
// It does NOT cache the giant WebLLM/Transformers.js engine bundles —
// those are managed by those libraries' own internal caches.

import { precacheAndRoute } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any };

precacheAndRoute(self.__WB_MANIFEST);

// SPA fallback: any unauthenticated navigation under our scope gets
// index.html so the client-side router can take over.
registerRoute(new NavigationRoute(
  async () => {
    const cache = await caches.open("lantern-shell");
    const hit = await cache.match("/lantern/index.html");
    return hit ?? Response.redirect("/lantern/", 302);
  }
));

// Runtime cache for HuggingFace model weights (OPUS-MT, OCR ONNX, etc.)
registerRoute(
  /^https:\/\/huggingface\.co\/.*/,
  new CacheFirst({
    cacheName: "hf-models",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 32,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  })
);

// Runtime cache for WebLLM (MLC) model artifacts
registerRoute(
  /^https:\/\/.*\.mlc-ai\.org\/.*/,
  new CacheFirst({
    cacheName: "webllm-models",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 16,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);

self.skipWaiting();
self.addEventListener("activate", () => self.clients.claim());
