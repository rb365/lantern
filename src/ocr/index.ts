import { paddleEngine } from "./paddle";
import { tesseractEngine, setOCRSourceLang } from "./tesseract";
import type { OCREngine } from "./types";

export type { OCREngine, OCRResult, OCRBlock } from "./types";
export { setOCRSourceLang };

// Tesseract first — reliable on iOS Safari / GitHub Pages.
// Paddle is registered but currently reports isSupported() = false.
const ALL: OCREngine[] = [tesseractEngine, paddleEngine];

let _active: OCREngine | null = null;
let _loading: Promise<OCREngine> | null = null;

export async function pickOCR(srcLang?: string): Promise<OCREngine> {
  if (srcLang) setOCRSourceLang(srcLang);
  if (_active) {
    // Language set may need a worker swap; load() is cheap if langs match.
    await _active.load();
    return _active;
  }
  if (_loading) return _loading;

  _loading = (async () => {
    const errors: string[] = [];
    for (const e of ALL) {
      try {
        if (await e.isSupported()) {
          await e.load();
          _active = e;
          return e;
        }
      } catch (err: any) {
        errors.push(`${e.id}: ${err?.message ?? err}`);
      }
    }
    throw new Error(
      "No OCR engine available in this browser. " +
        (errors.length ? `Tried: ${errors.join("; ")}` : "WebAssembly/Workers may be blocked.")
    );
  })();

  try {
    return await _loading;
  } finally {
    _loading = null;
  }
}

export function getActiveOCR(): OCREngine | null {
  return _active;
}
