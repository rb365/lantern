/**
 * Translate pipeline: image (or already-OCR'd text) → translated text.
 *
 *   1. Pick an OCR engine (PaddleOCR by default).
 *   2. Run OCR. Get back blocks with bounding boxes.
 *   3. Translate each block (or the joined text) using the loaded LLM.
 *   4. Hand back blocks + translations for the UI to overlay.
 *
 * If a multimodal model is loaded (Gemma 4 E4B) we'd skip OCR entirely;
 * that's a future path. For now we keep OCR + translate as separate steps
 * so the OCR engine is also swappable.
 */
import { pickOCR, type OCRResult, type OCRBlock } from "../ocr";
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
  // Safari's opaque module-load failure — map to something actionable.
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

  // If we got free-form text but no boxes, still translate the whole blob.
  if (!result.blocks.length) {
    const full = (result.text ?? "").trim();
    if (!full) {
      return { blocks: [], fullText: "", fullTranslation: "" };
    }
    onProgress?.("Translating…", 0.5);
    try {
      const t = await modelManager.translate(full, src, tgt);
      onProgress?.("Done", 1);
      return {
        blocks: [
          {
            text: full,
            box: [0.05, 0.05, 0.9, 0.2],
            confidence: 0.5,
            translated: t,
          },
        ],
        fullText: full,
        fullTranslation: t,
      };
    } catch (e: any) {
      throw new Error(`Translate failed: ${e?.message ?? e}`);
    }
  }

  // Translate block-by-block so the overlay can stick each translation to
  // its bounding box. We also build a "full text" version for text mode
  // and for users who want to copy it.
  const out: TranslatedBlock[] = [];
  let fullSrc = "";
  let fullTgt = "";

  const total = result.blocks.length;
  let done = 0;

  for (const blk of result.blocks) {
    fullSrc += blk.text + "\n";
    if (!blk.text.trim()) {
      out.push({ ...blk, translated: "" });
      done++;
      onProgress?.("Translating…", 0.35 + (0.6 * done) / Math.max(total, 1));
      continue;
    }
    try {
      const t = await modelManager.translate(blk.text, src, tgt);
      out.push({ ...blk, translated: t });
      fullTgt += t + "\n";
    } catch (e: any) {
      out.push({ ...blk, translated: `[error: ${e.message}]` });
    }
    done++;
    onProgress?.("Translating…", 0.35 + (0.6 * done) / Math.max(total, 1));
  }

  onProgress?.("Done", 1);
  return { blocks: out, fullText: fullSrc.trim(), fullTranslation: fullTgt.trim() };
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
