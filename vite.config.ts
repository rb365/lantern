import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GH Pages serves either at the repo root (user/org Pages) or under
// /<repo-name>/ (project Pages). Base is set via `LANTERN_BASE` env var
// or the Vite CLI's --base flag. Defaults to "/" for local dev.
const base = process.env.LANTERN_BASE ?? process.argv.find((a) => a.startsWith("--base="))?.slice("--base=".length) ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    // We do NOT use vite-plugin-pwa here. The full feature set (workbox
    // generation, manifest injection, asset precache beyond the app
    // shell) repeatedly broke iOS PWA standalone mode with opaque
    // "importing a module script failed" errors.
    //
    // Instead the service worker lives as a hand-rolled classic script
    // at public/sw.js, the manifest is generated at build time via a
    // small Vite plugin below, and src/pwa.ts registers the SW with
    // the classic (non-module) form which iOS handles reliably.
    {
      name: "lantern-manifest",
      apply: "build",
      generateBundle() {
        const manifest = {
          name: "Lantern — Offline Translation",
          short_name: "Lantern",
          description:
            "Private, offline translation that runs in your browser. Nothing leaves your device.",
          theme_color: "#0b0c0f",
          background_color: "#0b0c0f",
          display: "standalone",
          orientation: "portrait",
          start_url: base === "/" ? "/" : base,
          scope: base === "/" ? "/" : base,
          icons: [
            {
              src: "icons/icon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
        };
        this.emitFile({
          type: "asset",
          fileName: "manifest.webmanifest",
          source: JSON.stringify(manifest, null, 2),
        });
      },
    },
  ],
  optimizeDeps: {
    exclude: ["@huggingface/transformers", "@mlc-ai/web-llm"],
  },
  build: {
    target: "es2022",
    sourcemap: false,
    // tesseract.js is a real dependency now (primary OCR). Do NOT mark it
    // external — that left production builds trying to resolve a bare
    // specifier at runtime, which fails on GitHub Pages / iOS Safari.
  },
  worker: {
    format: "es",
  },
});
