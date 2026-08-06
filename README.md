# Lantern

> Private, offline translation that runs in your browser. Nothing leaves your device.

Lantern is a small PWA that downloads one or more open-source models
into your browser's cache and then runs them locally for as long as you
have the app installed. No internet connection required, no analytics,
no account.

## Three modes

- **Translate Photo** — take or pick a photo; OCR runs locally; each
  region is translated; results are drawn on top of the image.
- **Live Camera** — viewfinder with bounding-box overlay; throttle-limited
  to ~1-2 fps on phones.
- **Translate Text** — type or paste; streaming output.

## Three default models

The model picker shows three tiers, **all pluggable** — you can swap,
delete, and replace them at any time.

| Tier   | Model                | Engine          | Size    | When                         |
|--------|----------------------|-----------------|---------|------------------------------|
| Budget | OPUS-MT zh↔en        | Transformers.js | ~110 MB | Old phones, one pair only.   |
| Stand. | Qwen 3 1.7B (q4f16)  | WebLLM (WebGPU) | ~1.1 GB | Modern phones, many langs.   |
| Pro    | Gemma 4 E4B (q4f16)  | WebLLM (WebGPU) | ~4.9 GB | Multimodal OCR + translate.  |

Adding a new model is two lines in `src/registry/catalog.ts`.

## Stack

- Vite + React + TypeScript
- vite-plugin-pwa (service worker, manifest, installability)
- `@huggingface/transformers` for OPUS-MT-family models
- `@mlc-ai/web-llm` for Qwen/Gemma/Phi-style general LLMs
- Tesseract.js for on-device OCR (PaddleOCR adapter stubbed; CDN ESM path was broken on iOS)
- `idb` for the local model registry

## Run

```bash
npm install
npm run dev
```

Open the printed localhost URL. For real device testing, run
`npm run build && npm run preview -- --host` and visit the LAN IP
from your phone.

## Deploy

It's a static bundle — `dist/` can go anywhere. Easiest path is
GitHub Pages, configured for `gh-pages` from `main`:

1. Push this repo to GitHub.
2. Settings → Pages → Build and deployment: **GitHub Actions**.
3. The workflow at `.github/workflows/deploy.yml` builds on push to
   `main` and publishes to Pages at `https://<user>.github.io/lantern/`.

If you want to deploy as a user/organization site (root path) instead,
change the build step to drop the `--base` flag and rename the workflow
to deploy from a separate `gh-pages` branch.

Other static hosts that work out of the box: Cloudflare Pages,
Netlify, Vercel (no framework needed), GitLab Pages, Surge,
`bun x serve dist/`.

## Notes on supply-chain safety

This project depends on a deliberately tiny set of well-known, heavily
audited packages. **Do not add new dependencies without inspecting them
first** — npm supply-chain attacks (Shai-Hulud family) routinely target
unmaintained or freshly-published packages.

After `npm install`, run:

```bash
npm audit --omit=dev
npm ls --all
```

If you want full belt-and-suspenders:

```bash
npm install --ignore-scripts
```

This disables lifecycle scripts (`postinstall`, etc.) so even a compromised
package can't run shell commands during install.

## License

This source code is MIT. Bundled model weights retain their respective
licenses (Apache-2.0 for Qwen / Gemma; CC-BY-4.0 for OPUS-MT).
