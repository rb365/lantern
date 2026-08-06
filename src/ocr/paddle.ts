/**
 * PaddleOCR v6 adapter. Uses PaddleOCR.js (browser port). ~1.5MB tiny model,
 * best CJK quality of any sub-5MB engine.
 *
 * NOTE: PaddleOCR.js is loaded from CDN by default to keep the bundle
 * small. If you want the npm package, swap the import URL.
 */
import type { OCREngine, OCRResult } from "./types";

let _paddle: any | null = null;

async function ensureImport() {
  if (_paddle) return _paddle;
  // PaddleOCR.js ships a browser bundle. We lazy-load on first use.
  // CDN import is the simplest path; later we can install via npm.
  // @ts-ignore
  _paddle = (await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/paddleocr-js@latest/dist/paddleocr.min.js")).default;
  return _paddle;
}

export const paddleEngine: OCREngine = {
  id: "paddle-v6-tiny",
  name: "PaddleOCR v6 (tiny)",
  sizeMB: 2,
  async isSupported() {
    if (typeof WebAssembly === "undefined") return false;
    if (typeof Worker === "undefined") return false;
    return true;
  },
  async load(onProgress) {
    const P = await ensureImport();
    await P.create({ lang: "ch", model: "mobile" });
    onProgress?.(this.sizeMB * 1024 * 1024, this.sizeMB * 1024 * 1024);
  },
  async recognize(image) {
    const P = await ensureImport();
    const out = await P.recognize(image);
    // Normalize the output to our OCRResult shape.
    // Real PaddleOCR.js returns { text, blocks: [{ text, box:[x,y,w,h], score }] }.
    // We accept either form and convert.
    if (Array.isArray(out)) {
      const text = out.map((b: any) => b.text ?? "").join("\n");
      const blocks = (out as any[]).map((b) => ({
        text: b.text ?? "",
        box: (b.box ?? [0, 0, 1, 1]) as [number, number, number, number],
        confidence: b.score ?? 0.9,
      }));
      return { text, blocks };
    }
    return {
      text: out?.text ?? "",
      blocks: out?.blocks ?? [],
    };
  },
};
