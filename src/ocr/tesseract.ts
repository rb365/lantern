/**
 * Tesseract fallback. Only registered if `tesseract.js` is installed;
 * otherwise it's a no-op that returns an empty result. PaddleOCR is the
 * primary OCR engine.
 */
import type { OCREngine, OCRResult } from "./types";

export const tesseractEngine: OCREngine = {
  id: "tesseract-eng",
  name: "Tesseract (English)",
  sizeMB: 10,
  async isSupported() {
    if (typeof Worker === "undefined") return false;
    try {
      // Resolved dynamically so we don't pay the cost when unused.
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports
      await import("tesseract.js" as string);
      return true;
    } catch {
      return false;
    }
  },
  async load() {
    // No-op; tesseract.js loads on first recognize() call.
  },
  async recognize(image): Promise<OCRResult> {
    // If we got here without isSupported returning true, this won't run.
    // If the user later installs the package, the dynamic import works.
    let Tesseract: any;
    try {
      Tesseract = (await import("tesseract.js" as string)).default;
    } catch {
      return { text: "", blocks: [] };
    }
    const { data } = await Tesseract.recognize(image as any, "eng");
    return { text: data.text, blocks: [] };
  },
};
