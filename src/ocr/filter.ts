/**
 * Drop OCR garbage before it ever reaches the LLM.
 *
 * Small chat models (Qwen 1.7B etc.) invent "songs", poetry, and random
 * prose when fed noisy Tesseract output. Filtering hard here is the
 * single biggest quality win for photo translate.
 */
import type { OCRBlock, OCRResult } from "./types";

/** Tesseract confidence is 0..1 after our normalize. Keep only usable lines. */
const MIN_CONF = 0.45;

/** Too short to be real text (after cleanup). */
const MIN_CHARS = 2;

/** Reject lines that are almost all non-letter junk. */
const MIN_SCRIPT_RATIO = 0.35;

// Letters: Latin, CJK, Kana, Hangul, Cyrillic, Greek, Arabic, Hebrew, Thai, Devanagari.
const SCRIPT_RE =
  /[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0370-\u03FF\u0600-\u06FF\u0590-\u05FF\u0E00-\u0E7F\u0900-\u097F\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF]/u;

const ONLY_PUNCT_RE = /^[\s\d\p{P}\p{S}]+$/u;

/** Common Tesseract hallucinations on blank / textured regions. */
const NOISE_RE =
  /^(?:[ilI1|!]{2,}|[oO0]{3,}|[.\-_=]{2,}|[^\p{L}\p{N}]{1,})$/u;

export function cleanOCRText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isPlausibleOCRText(text: string, confidence = 1): boolean {
  const t = cleanOCRText(text);
  if (t.length < MIN_CHARS) return false;
  if (confidence < MIN_CONF) return false;
  if (ONLY_PUNCT_RE.test(t)) return false;
  if (NOISE_RE.test(t)) return false;

  // Count script characters vs total non-space.
  const compact = t.replace(/\s/g, "");
  if (!compact.length) return false;
  const script = (compact.match(SCRIPT_RE) || []).join("").length;
  if (script / compact.length < MIN_SCRIPT_RATIO) return false;

  // Single repeated character (e.g. "一一一一" noise) is rarely real signage alone.
  if (compact.length >= 4) {
    const unique = new Set([...compact]);
    if (unique.size === 1) return false;
  }

  return true;
}

export function filterOCRResult(result: OCRResult): OCRResult {
  const blocks = result.blocks
    .map((b) => ({
      ...b,
      text: cleanOCRText(b.text),
    }))
    .filter((b) => isPlausibleOCRText(b.text, b.confidence));

  // Prefer filtered blocks; fall back to cleaning the full page text.
  let text = blocks.map((b) => b.text).join("\n").trim();
  if (!text) {
    const cleaned = cleanOCRText(result.text);
    text = isPlausibleOCRText(cleaned, 0.6) ? cleaned : "";
  }

  return { text, blocks };
}

/**
 * Merge vertically-adjacent lines into larger chunks so the LLM sees
 * phrase/sentence context instead of single broken tokens.
 * Boxes become the union of the merged lines.
 */
export function mergeNearbyBlocks(blocks: OCRBlock[], yGap = 0.035): OCRBlock[] {
  if (blocks.length <= 1) return blocks;

  const sorted = [...blocks].sort((a, b) => {
    const dy = a.box[1] - b.box[1];
    if (Math.abs(dy) > 0.01) return dy;
    return a.box[0] - b.box[0];
  });

  const out: OCRBlock[] = [];
  let cur: OCRBlock | null = null;

  for (const b of sorted) {
    if (!cur) {
      cur = { ...b, box: [...b.box] as [number, number, number, number] };
      continue;
    }
    const curBottom = cur.box[1] + cur.box[3];
    const sameColumn =
      Math.abs(cur.box[0] - b.box[0]) < 0.15 ||
      overlap1d(cur.box[0], cur.box[0] + cur.box[2], b.box[0], b.box[0] + b.box[2]) > 0.3;
    const closeY = b.box[1] - curBottom <= yGap && b.box[1] >= cur.box[1] - 0.01;

    if (sameColumn && closeY) {
      const x0 = Math.min(cur.box[0], b.box[0]);
      const y0 = Math.min(cur.box[1], b.box[1]);
      const x1 = Math.max(cur.box[0] + cur.box[2], b.box[0] + b.box[2]);
      const y1 = Math.max(cur.box[1] + cur.box[3], b.box[1] + b.box[3]);
      cur = {
        text: `${cur.text} ${b.text}`.replace(/\s+/g, " ").trim(),
        box: [x0, y0, x1 - x0, y1 - y0],
        confidence: Math.min(cur.confidence, b.confidence),
      };
    } else {
      out.push(cur);
      cur = { ...b, box: [...b.box] as [number, number, number, number] };
    }
  }
  if (cur) out.push(cur);
  return out;
}

function overlap1d(a0: number, a1: number, b0: number, b1: number): number {
  const left = Math.max(a0, b0);
  const right = Math.min(a1, b1);
  const inter = Math.max(0, right - left);
  const union = Math.max(a1, b1) - Math.min(a0, b0);
  return union > 0 ? inter / union : 0;
}
