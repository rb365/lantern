import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GH Pages serves either at the repo root (user/org Pages) or under
// /<repo-name>/ (project Pages). Base is set via `LANTERN_BASE` env var
// or the Vite CLI's --base flag. Defaults to "/" for local dev.
const base = process.env.LANTERN_BASE ?? process.argv.find((a) => a.startsWith("--base="))?.slice("--base=".length) ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Lantern — Offline Translation",
        short_name: "Lantern",
        description: "Private, offline translation in your browser. Nothing leaves your device.",
        theme_color: "#0b0c0f",
        background_color: "#0b0c0f",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
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
      workbox: {
        // Cache the app shell. Model weights are handled separately via IDB.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            // Cache Hugging Face model weights (OPUS-MT/transformers.js models).
            urlPattern: /^https:\/\/huggingface\.co\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "hf-models",
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ["@huggingface/transformers", "@mlc-ai/web-llm"],
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
