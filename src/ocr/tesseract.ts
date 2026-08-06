/**
 * Tesseract.js fallback. Larger download (~10MB) but rock-solid and works
 * for any Latin script out of the box. Used when PaddleOCR isn't desired.
 */
import type { OCREngine, OCRResult } from "./types";

export const tesseractEngine: OCREngine = {
  id: "tesseract-eng",
  name: "Tesseract (English)",
  sizeMB: 10,
  async isSupported() {
    return typeof Worker !== "undefined";
  },
  async load() {
    // Tesseract.js is dynamic-imported on first recognize() call.
  },
  async recognize(image) {
    const Tesseract = (await import("tesseract.js")).default;
    const { data } = await Tesseract.recognize(image as any, "eng");
    return { text: data.text, blocks: [] };
  },
};
