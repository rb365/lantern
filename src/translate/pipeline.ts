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

export async function translatePhoto(
  image: Blob | HTMLImageElement | ImageBitmap,
  src: string,
  tgt: string,
  onProgress?: (stage: string, pct: number) => void
): Promise<PhotoTranslateResult> {
  onProgress?.("ocr", 0.1);
  const ocr = await pickOCR();
  const result: OCRResult = await ocr.recognize(image);

  onProgress?.("ocr", 0.35);

  if (!result.blocks.length) {
    return { blocks: [], fullText: "", fullTranslation: "" };
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
      onProgress?.("translate", 0.35 + (0.6 * done) / Math.max(total, 1));
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
    onProgress?.("translate", 0.35 + (0.6 * done) / Math.max(total, 1));
  }

  onProgress?.("done", 1);
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
