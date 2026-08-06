/**
 * WebLLM engine adapter.
 *
 * Wraps `@mlc-ai/web-llm` (MLC WebGPU engine). For general LLMs (Qwen,
 * Gemma, Llama, Phi), WebLLM is the fastest path: OpenAI-compatible API,
 * streams, KV-cache reuse. Caches model artifacts in the browser Cache API.
 */
import type { Engine, DownloadProgress, ModelEntry } from "../types";

let _mlc: any | null = null;

async function ensureImport() {
  if (_mlc) return _mlc;
  _mlc = await import("@mlc-ai/web-llm");
  return _mlc;
}

// Engines live in a per-id map; light eviction happens via manager.
const engines = new Map<string, any>();

export const webllmEngine: Engine = {
  async isSupported() {
    try {
      const mlc = await ensureImport();
      // WebLLM is the entry function. Calling with no args checks GPU.
      return !!(navigator as any).gpu;
    } catch {
      return false;
    }
  },

  async load(entry: ModelEntry, onProgress?: (p: DownloadProgress) => void) {
    const mlc = await ensureImport();
    if (!engines.has(entry.id)) {
      const engine = await mlc.CreateMLCEngine(entry.ref, {
        initProgressCallback: (rep: any) => {
          if (typeof onProgress === "function") {
            onProgress({
              id: entry.id,
              loaded: rep.loaded ?? 0,
              total: rep.total ?? entry.sizeMB * 1024 * 1024,
              label: rep.text ?? "",
            });
          }
        },
      });
      engines.set(entry.id, engine);
    }
  },

  async has(entryId: string) {
    return engines.has(entryId);
  },

  async unload(entryId: string) {
    const e = engines.get(entryId);
    if (e?.unload) await e.unload();
    engines.delete(entryId);
  },

  async translate({ entry, text, src, tgt, signal, onToken }) {
    const engine = engines.get(entry.id);
    if (!engine) throw new Error(`Model ${entry.id} not loaded.`);

    // WebLLM is OpenAI-compatible. We prompt the LLM to translate.
    // For "auto" src/tgt we just say "to <tgt>".
    const sys =
      `You are Lantern, a translation engine. ` +
      `Translate faithfully, preserve tone, keep numbers/formatting. ` +
      `Output only the translation, no preamble, no quotes.`;
    const user =
      src === "auto"
        ? `Translate the following text into ${nameForLang(tgt)}.\n\n${text}`
        : `Translate the following text from ${nameForLang(src)} into ${nameForLang(tgt)}.\n\n${text}`;

    if (onToken) {
      const stream = await engine.chat.completions.create({
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 1024,
        stream: true,
      });
      let acc = "";
      for await (const chunk of stream) {
        if (signal?.aborted) throw new DOMException("aborted", "AbortError");
        const delta = chunk.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          acc += delta;
          onToken(delta);
        }
      }
      return acc;
    }

    const reply = await engine.chat.completions.create({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    });
    return reply.choices?.[0]?.message?.content ?? "";
  },
};

/** Tiny ISO-639-1 → English name map. Extend as we add language pairs. */
function nameForLang(code: string): string {
  const m: Record<string, string> = {
    en: "English",
    zh: "Chinese (Simplified)",
    "zh-Hant": "Chinese (Traditional)",
    ja: "Japanese",
    ko: "Korean",
    es: "Spanish",
    fr: "French",
    de: "German",
    ru: "Russian",
    pt: "Portuguese",
    it: "Italian",
    ar: "Arabic",
    hi: "Hindi",
    tr: "Turkish",
    vi: "Vietnamese",
    th: "Thai",
    id: "Indonesian",
  };
  return m[code] ?? code;
}
