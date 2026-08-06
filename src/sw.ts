/// <reference lib="webworker" />

// Hand-written service worker for Lantern.
//
// Deliberately minimal. We deliberately DO NOT install any
// NavigationRoute fallback, because iOS PWA standalone mode links any
// SW network-fallback error to the page that loaded the engine chunk,
// surfacing the error as "importing a module script failed" — even when
// the engine chunk itself was fetched fine.
//
// Responsibilities:
//   - precache the small app shell at explicit, absolute URLs
//   - runtime-cache HF / MLC model artifacts (CacheFirst, generous TTL)
//   - leave everything else (including our own engine bundles) to the
//     network, no SW interference
//
// Engine bundles and large WASMs are managed by each engine library's
// own internal cache; we don't touch them.

import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any };

// Precache only the tiny static shell. Vite hashes app-code bundles
// via index.html references, so we let the browser fetch them straight
// through the network each load (which is fast on /lantern/ even from
// cold cache).
precacheAndRoute(self.__WB_MANIFEST);

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
