/**
 * Transformers.js engine adapter.
 *
 * Wraps `@huggingface/transformers` and exposes the Engine interface.
 * Good for: OPUS-MT, NLLB, MADLAD, distilled general models, embeddings.
 * Caches ONNX weights in IndexedDB after first download via the HF cache.
 */
import type { Engine, DownloadProgress, ModelEntry } from "../types";

// Dynamic import keeps the bundle small until we actually need it.
let _pipeline: any | null = null;
let _env: any | null = null;

async function ensureImport() {
  if (_pipeline) return;
  const mod = await import("@huggingface/transformers");
  _pipeline = mod.pipeline;
  _env = mod.env;
  // Default cache directory is Cache API; we keep that, but expose a stable key.
  _env.useBrowserCache = true;
}

// One pipeline per model id, lazily created.
const pipes = new Map<string, any>();

export const transformersEngine: Engine = {
  async isSupported() {
    try {
      await ensureImport();
      // Transformers.js works in any modern browser via WASM.
      // WebGPU is opt-in and optional for now.
      return true;
    } catch {
      return false;
    }
  },

  async load(entry: ModelEntry, onProgress?: (p: DownloadProgress) => void) {
    await ensureImport();
    if (!pipes.has(entry.id)) {
      const pipe = await _pipeline("translation", entry.ref, {
        dtype: entry.quant ?? "q8",
        device: "wasm", // WebGPU for seq2seq isn't stable yet; WASM is universal.
        progress_callback: (data: any) => {
          if (typeof onProgress === "function" && data?.status === "progress") {
            onProgress({
              id: entry.id,
              loaded: data.loaded ?? 0,
              total: data.total ?? entry.sizeMB * 1024 * 1024,
              label: data.file ?? "",
            });
          }
        },
      });
      pipes.set(entry.id, pipe);
    }
  },

  async has(entryId: string) {
    return pipes.has(entryId);
  },

  async unload(entryId: string) {
    pipes.delete(entryId);
  },

  async translate({ entry, text, src, tgt }) {
    await ensureImport();
    const pipe = pipes.get(entry.id);
    if (!pipe) {
      throw new Error(`Model ${entry.id} not loaded. Call load() first.`);
    }
    // OPUS-MT and other seq2seq models don't take src/tgt; the model
    // itself embodies the direction. For general models (e.g. NLLB) we
    // would prefix the input with the language tag.
    const out = await pipe(text, {
      // general models may need src_lang/tgt_lang for many-to-many
      src_lang: src,
      tgt_lang: tgt,
    });
    // Output is typically [{ translation_text: string }]
    if (Array.isArray(out) && out[0]?.translation_text) return out[0].translation_text;
    if (typeof out === "string") return out;
    return JSON.stringify(out);
  },
};
