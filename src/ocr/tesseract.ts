/**
 * Tesseract OCR engine — primary path for photo/camera modes.
 *
 * Uses tesseract.js (WASM). First recognize() downloads worker + language
 * data (~2–15 MB depending on langs); subsequent runs are cached by the
 * browser. Works on iOS Safari / PWA, unlike the previous CDN ESM import
 * of paddleocr-js which 404'd and triggered Safari's opaque
 * "importing a module script failed" error.
 */
import type { OCREngine, OCRResult, OCRBlock } from "./types";

type CreateWorker = typeof import("tesseract.js").createWorker;
type Worker = Awaited<ReturnType<CreateWorker>>;

let _createWorker: CreateWorker | null = null;
let _worker: Worker | null = null;
let _loadedLangs = "";

/** Map app language codes → Tesseract traineddata ids. */
function tessLangsFor(src?: string): string {
  // Always include eng so mixed signs still work.
  const codes = new Set<string>(["eng"]);
  const s = (src ?? "auto").toLowerCase();
  if (s === "zh" || s === "zh-cn" || s === "zh-hans" || s === "auto") {
    codes.add("chi_sim");
  }
  if (s === "zh-hant" || s === "zh-tw" || s === "zh-hk") {
    codes.add("chi_tra");
  }
  if (s === "ja" || s === "auto") codes.add("jpn");
  if (s === "ko") codes.add("kor");
  if (s === "ru") codes.add("rus");
  if (s === "es") codes.add("spa");
  if (s === "fr") codes.add("fra");
  if (s === "de") codes.add("deu");
  // Prefer Chinese + English for auto (this app's main use case).
  if (s === "auto") return "chi_sim+eng";
  return Array.from(codes).join("+");
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

  // Swap worker when language set changes.
  if (_worker) {
    try {
      await _worker.terminate();
    } catch {
      /* ignore */
    }
    _worker = null;
  }

  // Let tesseract.js use its default CDN paths for worker/core/lang data.
  // That avoids Vite base-path breakage on GitHub Pages (/lantern/) and
  // is the path that works on iOS Safari.
  _worker = await createWorker(langs, 1, {
    // logger: (m) => console.debug("[tess]", m),
  });
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

  // Prefer lines (good for signs/menus). Fall back to words, then paragraphs.
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
        confidence: (line.confidence ?? 80) / 100,
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
      confidence: (word.confidence ?? 80) / 100,
    });
  }
  return out;
}

async function imageSize(
  image: Blob | HTMLImageElement | ImageBitmap
): Promise<{ w: number; h: number }> {
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    return { w: image.width, h: image.height };
  }
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
    return {
      w: image.naturalWidth || image.width,
      h: image.naturalHeight || image.height,
    };
  }
  if (image instanceof Blob) {
    const bmp = await createImageBitmap(image);
    const size = { w: bmp.width, h: bmp.height };
    bmp.close?.();
    return size;
  }
  return { w: 1, h: 1 };
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
    // Warm the worker + default language pack so the first photo is faster.
    onProgress?.(0, this.sizeMB * 1024 * 1024);
    await ensureWorker(_srcLangHint);
    onProgress?.(this.sizeMB * 1024 * 1024, this.sizeMB * 1024 * 1024);
  },
  async recognize(image): Promise<OCRResult> {
    const worker = await ensureWorker(_srcLangHint);
    const { w, h } = await imageSize(image);
    const { data } = await worker.recognize(image as any);
    const blocks = blocksFromData(data, w, h);
    const text =
      (data?.text ?? "").trim() ||
      blocks.map((b) => b.text).join("\n");
    return { text, blocks };
  },
};
