import { paddleEngine } from "./paddle";
import { tesseractEngine } from "./tesseract";
import type { OCREngine } from "./types";

export type { OCREngine, OCRResult, OCRBlock } from "./types";

const ALL: OCREngine[] = [paddleEngine, tesseractEngine];

let _active: OCREngine | null = null;

export async function pickOCR(): Promise<OCREngine> {
  if (_active) return _active;
  for (const e of ALL) {
    if (await e.isSupported()) {
      _active = e;
      await _active.load();
      return _active;
    }
  }
  throw new Error("No OCR engine supported in this browser.");
}

export function getActiveOCR(): OCREngine | null {
  return _active;
}
