/**
 * Core types for the Lantern model registry.
 *
 * A `ModelEntry` is the unit the user sees in the picker.
 * An `Engine` is the runtime that knows how to load and run that entry.
 *
 * This split is what lets the same UI swap between:
 *   - OPUS-MT (Transformers.js engine, tiny dedicated MT model)
 *   - Qwen 1.7B / Gemma 4 E4B (WebLLM engine, general LLM)
 *   - any future model that someone wraps an Engine for.
 */

export type EngineKind = "transformersjs" | "webllm" | "custom";

export type ModelKind = "translation-dedicated" | "general-llm" | "ocr";

export interface ModelEntry {
  /** Stable id, used as the cache key. */
  id: string;
  /** User-visible name. */
  name: string;
  /** Short marketing line, one sentence. */
  tagline: string;
  /** Which engine drives this model. */
  engine: EngineKind;
  /** Translation-dedicated or general LLM. */
  kind: ModelKind;
  /** Approximate download size in MB, post-quantization. */
  sizeMB: number;
  /** Minimum recommended RAM for the device, in GB. */
  ramGB: number;
  /** Optional quant tag, e.g. q4f16_1 for WebLLM, q8 for ONNX. */
  quant?: string;
  /** Hf model id, MLC model id, OR a custom URL list — engine-specific. */
  ref: string;
  /** Source language codes the model handles (ISO 639-1). */
  src: string[];
  /** Target language codes. */
  tgt: string[];
  /** License string. Shown on the model card. */
  license: string;
  /** Quality rank, 0-100, used for sorting and conflict resolution. */
  quality: number;
  /** True if this model can do OCR (Gemma 4 E4B is multimodal). */
  hasOcr?: boolean;
}

export interface DownloadProgress {
  id: string;
  loaded: number;
  total: number;
  /** Human readable, e.g. "47.2 MB / 1.10 GB". */
  label: string;
}

export interface Engine {
  /** Free, fast feature check. Used at app start to choose tier. */
  isSupported(): Promise<boolean>;
  /** Load (and cache) a model. Resolves when ready to run. */
  load(entry: ModelEntry, onProgress?: (p: DownloadProgress) => void): Promise<void>;
  /** True if a model is currently loaded in this engine. */
  has(entryId: string): Promise<boolean>;
  /** Free VRAM/RAM by unloading. */
  unload(entryId: string): Promise<void>;
  /** Translate text. Streams if `onToken` provided. */
  translate(opts: {
    entry: ModelEntry;
    text: string;
    src: string;
    tgt: string;
    signal?: AbortSignal;
    onToken?: (delta: string) => void;
  }): Promise<string>;
  /** OCR an image, if the model is multimodal. */
  ocr?(opts: {
    entry: ModelEntry;
    image: Blob | HTMLImageElement | ImageBitmap;
    signal?: AbortSignal;
  }): Promise<string>;
}
