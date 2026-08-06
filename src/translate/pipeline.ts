/**
 * Translate pipeline: image (or already-OCR'd text) → translated text.
 *
 *   1. OCR (Tesseract) with preprocess + garbage filter.
 *   2. Translate surviving blocks with the loaded model.
 *   3. Hand back blocks + translations for the UI overlay.
 */
import { pickOCR, type OCRResult, type OCRBlock } from "../ocr";
import { isPlausibleOCRText } from "../ocr/filter";
import { modelManager } from "../registry";

export interface TranslatedBlock extends OCRBlock {
  translated: string;
}

export interface PhotoTranslateResult {
  blocks: TranslatedBlock[];
  fullText: string;
  fullTranslation: string;
}

function friendlyError(e: unknown): string {
  const msg = (e as any)?.message ?? String(e);
  if (/importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(msg)) {
    return (
      "Could not load the OCR engine (module import failed). " +
      "On iPhone: hard-refresh the page, or clear the site data for this " +
      "GitHub Pages origin and try again with a network connection so " +
      "Tesseract can download once."
    );
  }
  return msg;
}

/** Cap how many blocks we translate per photo (keeps phones responsive). */
const MAX_BLOCKS = 24;

export async function translatePhoto(
  image: Blob | HTMLImageElement | ImageBitmap,
  src: string,
  tgt: string,
  onProgress?: (stage: string, pct: number) => void
): Promise<PhotoTranslateResult> {
  onProgress?.("Loading OCR…", 0.05);
  let ocr;
  try {
    ocr = await pickOCR(src);
  } catch (e) {
    throw new Error(friendlyError(e));
  }

  onProgress?.("Reading text…", 0.15);
  let result: OCRResult;
  try {
    result = await ocr.recognize(image);
  } catch (e) {
    throw new Error(`OCR failed: ${friendlyError(e)}`);
  }

  onProgress?.("Reading text…", 0.35);

  // Prefer filtered line boxes; fall back to whole-page text once.
  let blocks = result.blocks.filter((b) =>
    isPlausibleOCRText(b.text, b.confidence)
  );
  if (blocks.length > MAX_BLOCKS) {
    // Keep highest-confidence lines.
    blocks = [...blocks]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_BLOCKS)
      .sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0]);
  }

  if (!blocks.length) {
    const full = (result.text ?? "").trim();
    if (!full || !isPlausibleOCRText(full, 0.5)) {
      return { blocks: [], fullText: full, fullTranslation: "" };
    }
    onProgress?.("Translating…", 0.5);
    try {
      const t = await modelManager.translate(full, src, tgt);
      onProgress?.("Done", 1);
      return {
        blocks: t
          ? [
              {
                text: full,
                box: [0.05, 0.05, 0.9, 0.25],
                confidence: 0.5,
                translated: t,
              },
            ]
          : [],
        fullText: full,
        fullTranslation: t,
      };
    } catch (e: any) {
      throw new Error(`Translate failed: ${e?.message ?? e}`);
    }
  }

  const out: TranslatedBlock[] = [];
  let fullSrc = "";
  let fullTgt = "";

  const total = blocks.length;
  let done = 0;

  for (const blk of blocks) {
    fullSrc += blk.text + "\n";
    try {
      const t = (await modelManager.translate(blk.text, src, tgt)).trim();
      // Skip empty / unreadable markers so we don't paint song lyrics
      // over random photo regions.
      if (!t) {
        out.push({ ...blk, translated: "" });
      } else {
        out.push({ ...blk, translated: t });
        fullTgt += t + "\n";
      }
    } catch (e: any) {
      out.push({ ...blk, translated: "" });
      console.warn("block translate failed", e?.message ?? e);
    }
    done++;
    onProgress?.("Translating…", 0.35 + (0.6 * done) / Math.max(total, 1));
  }

  // Only show blocks that actually produced a translation.
  const shown = out.filter((b) => b.translated);

  onProgress?.("Done", 1);
  return {
    blocks: shown.length ? shown : out,
    fullText: fullSrc.trim(),
    fullTranslation: fullTgt.trim(),
  };
}

export async function translateText(
  text: string,
  src: string,
  tgt: string,
  onToken?: (s: string) => void
) {
  return onToken
    ? modelManager.translateStream(text, src, tgt, onToken)
    : modelManager.translate(text, src, tgt);
}
