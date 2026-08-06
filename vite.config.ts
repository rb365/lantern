import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GH Pages serves either at the repo root (user/org Pages) or under
// /<repo-name>/ (project Pages). Base is set via `LANTERN_BASE` env var
// or the Vite CLI's --base flag. Defaults to "/" for local dev.
const base = process.env.LANTERN_BASE ?? process.argv.find((a) => a.startsWith("--base="))?.slice("--base=".length) ?? "/";

// vite-plugin-pwa MUST know the same base, otherwise the generated
// service worker registers precache paths like "/index.html" while the
// site lives under "/lantern/" — and iOS PWA silently fails every
// chunk fetch ("importing a module script failed"). We normalize to a
// trailing-slash form: "/" or "/lantern/".
const swBase = base === "/" ? "/" : base.replace(/\/+$/, "") + "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      base: swBase,
      scope: swBase,
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Lantern — Offline Translation",
        short_name: "Lantern",
        description: "Private, offline translation that runs in your browser. Nothing leaves your device.",
        theme_color: "#0b0c0f",
        background_color: "#0b0c0f",
        display: "standalone",
        orientation: "portrait",
        scope: swBase,
        start_url: swBase,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      // We use injectManifest so we ship a hand-written SW (src/sw.ts)
      // that targets our exact URLs under /lantern/. The plugin's
      // bundled SW uses an AMD/importScripts wrapper that iOS PWA
      // standalone mode handles unreliably — leading to
      // "importing a module script failed" when our 6 MB engine chunk
      // is fetched for the first time.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // No auto-register: src/pwa.ts does it with type: "module".
      injectRegister: false,
      injectManifest: {
        // Don't precache large engine bundles or wasm; each engine
        // owns its own cache. We only precache the tiny app shell.
        globPatterns: ["**/*.{html,css,svg,png,webmanifest}"],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      },
    }),
  ],
  optimizeDeps: {
    exclude: ["@huggingface/transformers", "@mlc-ai/web-llm"],
  },
  build: {
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      external: ["tesseract.js"],
    },
  },
});
