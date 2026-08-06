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

/** Cap generation length from input size so small models don't freestyle. */
function maxTokensFor(text: string): number {
  // ~2 output tokens per input char is generous for CJK→EN; hard cap 256.
  const n = Math.ceil(text.length * 2.5) + 16;
  return Math.max(24, Math.min(256, n));
}

/** Strip common chatty preambles models still emit despite instructions. */
function cleanTranslation(out: string, src: string): string {
  let s = (out ?? "").trim();
  // Drop wrapping quotes.
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("“") && s.endsWith("”")) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  // Drop "Translation:" / "Here is the translation:" prefixes.
  s = s.replace(/^(?:here(?:'s| is)(?: the)?\s+)?translation\s*[:：\-–]\s*/i, "");
  s = s.replace(/^(?:translated\s+text|output)\s*[:：\-–]\s*/i, "");
  // If model admits unreadable OCR, surface empty.
  if (/^\[(?:unreadable|illegible|garbled|n\/a|none)\]$/i.test(s)) return "";
  // Refuse obvious freeform songs when input was short.
  if (src.length < 40 && s.length > src.length * 8 && s.includes("\n")) {
    // Likely invented multi-line content — keep first line only.
    s = s.split("\n").map((l) => l.trim()).find(Boolean) ?? s;
  }
  return s.trim();
}

export const webllmEngine: Engine = {
  async isSupported() {
    try {
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

    const input = (text ?? "").trim();
    if (!input) return "";

    // Strict machine-translator prompt. Small models invent poetry/songs
    // when given OCR noise unless we clamp temperature + length hard.
    const sys =
      `You are a machine translation engine, not a chatbot. ` +
      `Translate the user's text faithfully. ` +
      `Rules:\n` +
      `1. Output ONLY the translation — no quotes, no labels, no explanation.\n` +
      `2. Do not invent, complete, rhyme, sing, or add content that is not in the input.\n` +
      `3. Keep numbers, brand names, and formatting when possible.\n` +
      `4. If the input is garbled OCR noise (random letters/symbols, not real words), output exactly: [unreadable]`;

    const user =
      src === "auto"
        ? `Translate into ${nameForLang(tgt)}:\n\n${input}`
        : `Translate from ${nameForLang(src)} into ${nameForLang(tgt)}:\n\n${input}`;

    const max_tokens = maxTokensFor(input);
    const temperature = 0;

    if (onToken) {
      const stream = await engine.chat.completions.create({
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature,
        max_tokens,
        top_p: 1,
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
      return cleanTranslation(acc, input);
    }

    const reply = await engine.chat.completions.create({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature,
      max_tokens,
      top_p: 1,
    });
    return cleanTranslation(reply.choices?.[0]?.message?.content ?? "", input);
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
    auto: "the source language",
  };
  return m[code] ?? code;
}
