/**
 * PaddleOCR adapter — intentionally disabled.
 *
 * History: the previous implementation did
 *   import("https://cdn.jsdelivr.net/npm/paddleocr-js@latest/dist/paddleocr.min.js")
 * which:
 *   1. 404s (real browser file is dist/browser/index.min.js)
 *   2. is a UMD/webpack bundle, not an ES module — Safari reports the
 *      opaque "importing a module script failed" and the photo flow
 *      freezes at 10% (right after onProgress("ocr", 0.1))
 *   3. the UMD build still expects a `canvas` global, so even a script-tag
 *      load would not run cleanly on iOS
 *
 * Tesseract is the primary OCR engine for now. Re-enable Paddle only with
 * a real browser-first package (e.g. @paddleocr/paddleocr-js) loaded as a
 * proper dependency, not a bare CDN import().
 */
import type { OCREngine } from "./types";

export const paddleEngine: OCREngine = {
  id: "paddle-v6-tiny",
  name: "PaddleOCR (disabled)",
  sizeMB: 2,
  async isSupported() {
    return false;
  },
  async load() {
    throw new Error(
      "PaddleOCR is not available in this build. Using Tesseract instead."
    );
  },
  async recognize() {
    return { text: "", blocks: [] };
  },
};
