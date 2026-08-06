/**
 * Tesseract OCR engine — primary path for photo/camera modes.
 *
 * Uses tesseract.js (WASM). First recognize() downloads worker + language
 * data (~2–15 MB depending on langs); subsequent runs are cached by the
 * browser.
 */
import type { OCREngine, OCRResult, OCRBlock } from "./types";
import { preprocessForOCR } from "./preprocess";
import { filterOCRResult, mergeNearbyBlocks } from "./filter";

type CreateWorker = typeof import("tesseract.js").createWorker;
type Worker = Awaited<ReturnType<CreateWorker>>;

let _createWorker: CreateWorker | null = null;
let _worker: Worker | null = null;
let _loadedLangs = "";

/** Map app language codes → Tesseract traineddata ids. */
function tessLangsFor(src?: string): string {
  const s = (src ?? "auto").toLowerCase();
  // Keep language packs focused — multi-lang packs raise false positives
  // (Latin noise misread as Chinese / Japanese).
  if (s === "zh" || s === "zh-cn" || s === "zh-hans") return "chi_sim";
  if (s === "zh-hant" || s === "zh-tw" || s === "zh-hk") return "chi_tra";
  if (s === "ja") return "jpn";
  if (s === "ko") return "kor";
  if (s === "ru") return "rus";
  if (s === "es") return "spa";
  if (s === "fr") return "fra";
  if (s === "de") return "deu";
  if (s === "en") return "eng";
  // Auto / unknown: Chinese + English covers this app's main signage case.
  return "chi_sim+eng";
}

async function ensureLib(): Promise<CreateWorker> {
  if (_createWorker) return _createWorker;
  const mod = await import("tesseract.js");
  _createWorker = mod.createWorker;
  return _createWorker;
}

async function ensureWorker(srcLang?: string): Promise<Worker> {
  const langs = tessLangsFor(srcLang);
  const createWorker = await ensureLib();

  if (_worker && _loadedLangs === langs) return _worker;

  if (_worker) {
    try {
      await _worker.terminate();
    } catch {
      /* ignore */
    }
    _worker = null;
  }

  _worker = await createWorker(langs, 1, {
    // logger: (m) => console.debug("[tess]", m),
  });

  // Sparse text (PSM 11) works better for phone photos of signs/menus
  // than the default "single uniform block" assumption.
  // See https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html
  try {
    await _worker.setParameters({
      tessedit_pageseg_mode: "11" as any, // SPARSE_TEXT
      preserve_interword_spaces: "1",
      // Slightly prefer dictionary words when available.
      language_model_penalty_non_dict_word: "0.3",
      language_model_penalty_non_freq_dict_word: "0.2",
    } as any);
  } catch {
    // Older tesseract builds may reject some keys — ignore.
  }

  _loadedLangs = langs;
  return _worker;
}

function blocksFromData(
  data: any,
  imgW: number,
  imgH: number
): OCRBlock[] {
  const w = Math.max(imgW, 1);
  const h = Math.max(imgH, 1);
  const out: OCRBlock[] = [];

  const lines: any[] = data?.lines ?? [];
  if (lines.length) {
    for (const line of lines) {
      const text = (line.text ?? "").trim();
      if (!text) continue;
      const b = line.bbox ?? { x0: 0, y0: 0, x1: w, y1: h };
      out.push({
        text,
        box: [
          b.x0 / w,
          b.y0 / h,
          Math.max(0, (b.x1 - b.x0) / w),
          Math.max(0, (b.y1 - b.y0) / h),
        ],
        confidence: (line.confidence ?? 0) / 100,
      });
    }
    return out;
  }

  const words: any[] = data?.words ?? [];
  for (const word of words) {
    const text = (word.text ?? "").trim();
    if (!text) continue;
    const b = word.bbox ?? { x0: 0, y0: 0, x1: w, y1: h };
    out.push({
      text,
      box: [
        b.x0 / w,
        b.y0 / h,
        Math.max(0, (b.x1 - b.x0) / w),
        Math.max(0, (b.y1 - b.y0) / h),
      ],
      confidence: (word.confidence ?? 0) / 100,
    });
  }
  return out;
}

/** Optional source-language hint set by the pipeline before recognize(). */
let _srcLangHint: string | undefined;

export function setOCRSourceLang(src?: string) {
  _srcLangHint = src;
}

export const tesseractEngine: OCREngine = {
  id: "tesseract",
  name: "Tesseract",
  sizeMB: 12,
  async isSupported() {
    if (typeof WebAssembly === "undefined") return false;
    if (typeof Worker === "undefined") return false;
    try {
      await ensureLib();
      return true;
    } catch {
      return false;
    }
  },
  async load(onProgress) {
    onProgress?.(0, this.sizeMB * 1024 * 1024);
    await ensureWorker(_srcLangHint);
    onProgress?.(this.sizeMB * 1024 * 1024, this.sizeMB * 1024 * 1024);
  },
  async recognize(image): Promise<OCRResult> {
    const worker = await ensureWorker(_srcLangHint);
    // Prep image for phone photos; use preprocessed dimensions for boxes.
    const { blob, width, height } = await preprocessForOCR(image);
    const { data } = await worker.recognize(blob);
    let blocks = blocksFromData(data, width, height);
    const rawText = (data?.text ?? "").trim();

    // Drop garbage, then merge nearby lines so the translator sees phrases.
    const filtered = filterOCRResult({ text: rawText, blocks });
    blocks = mergeNearbyBlocks(filtered.blocks);

    return {
      text: blocks.map((b) => b.text).join("\n").trim() || filtered.text,
      blocks,
    };
  },
};
