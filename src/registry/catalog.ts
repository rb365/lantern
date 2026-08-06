import type { ModelEntry } from "./types";

/**
 * Built-in model catalog.
 *
 * Each entry is hand-curated. Users can also add their own via the
 * registry, but these power the defaults.
 *
 * Sources / notes:
 *   - OPUS-MT zh<->en is ~100MB ONNX, runs via Transformers.js, blazingly
 *     fast for a single pair. License: CC-BY-4.0.
 *   - Qwen 3 1.7B (q4f16_1) is the strongest multilingual SLM that fits
 *     on a 6 GB phone. 119+ languages. Apache 2.0.
 *   - Gemma 4 E4B is the multimodal model: OCR + translate + chat in one.
 *     Designed for phones. Apache 2.0.
 */
export const CATALOG: ModelEntry[] = [
  // ---------------------------------------------------------------
  // Budget tier: OPUS-MT dedicated MT pairs. Tiny, fast, one direction.
  // ---------------------------------------------------------------
  {
    id: "opus-mt-zh-en",
    name: "OPUS-MT zh → en",
    tagline: "Tiny dedicated Chinese→English model. Best on old phones.",
    engine: "transformersjs",
    kind: "translation-dedicated",
    sizeMB: 110,
    ramGB: 2,
    quant: "q8",
    ref: "Xenova/opus-mt-zh-en",
    src: ["zh"],
    tgt: ["en"],
    license: "CC-BY-4.0",
    quality: 70,
  },
  {
    id: "opus-mt-en-zh",
    name: "OPUS-MT en → zh",
    tagline: "Tiny dedicated English→Chinese model. Best on old phones.",
    engine: "transformersjs",
    kind: "translation-dedicated",
    sizeMB: 110,
    ramGB: 2,
    quant: "q8",
    ref: "Xenova/opus-mt-en-zh",
    src: ["en"],
    tgt: ["zh"],
    license: "CC-BY-4.0",
    quality: 70,
  },
  // ---------------------------------------------------------------
  // Standard tier: Qwen 3 1.7B. Strong multilingual, 6 GB phone.
  // ---------------------------------------------------------------
  {
    id: "qwen3-1.7b-q4f16",
    name: "Qwen 3 1.7B",
    tagline: "Multilingual general LLM. Handles chatty / idiomatic text well.",
    engine: "webllm",
    kind: "general-llm",
    sizeMB: 1100,
    ramGB: 6,
    quant: "q4f16_1",
    ref: "Qwen3-1.7B-q4f16_1-MLC",
    src: ["auto"],
    tgt: ["auto"],
    license: "Apache-2.0",
    quality: 78,
  },
  // ---------------------------------------------------------------
  // Pro tier: Gemma 4 E4B. Multimodal: OCR + translate + image-understanding.
  // Designed by Google for on-device phones (April 2026).
  // ---------------------------------------------------------------
  {
    id: "gemma-4-e4b-q4f16",
    name: "Gemma 4 E4B",
    tagline: "Phone-class multimodal model. OCR + translate in one.",
    engine: "webllm",
    kind: "general-llm",
    sizeMB: 4900,
    ramGB: 8,
    quant: "q4f16_1",
    ref: "gemma-4-e4b-it-q4f16_1-MLC",
    src: ["auto"],
    tgt: ["auto"],
    license: "Apache-2.0",
    quality: 92,
    hasOcr: true,
  },
];

/**
 * Pick the best model for a given (src, tgt) pair.
 * Falls back to the highest-quality general LLM if no dedicated pair matches.
 */
export function pickBest(src: string, tgt: string, maxRamGB = 6): ModelEntry {
  const direct = CATALOG.filter((m) => {
    if (m.ramGB > maxRamGB) return false;
    const s = m.src.includes("auto") || m.src.includes(src);
    const t = m.tgt.includes("auto") || m.tgt.includes(tgt);
    return s && t;
  });
  if (!direct.length) {
    // fall back to the smallest fitting "auto" model
    const fallback = CATALOG.filter(
      (m) => m.ramGB <= maxRamGB && m.src.includes("auto") && m.tgt.includes("auto")
    ).sort((a, b) => a.sizeMB - b.sizeMB);
    return fallback[0] ?? CATALOG[CATALOG.length - 1];
  }
  // Prefer dedicated > general, then by quality
  return direct.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "translation-dedicated" ? -1 : 1;
    }
    return b.quality - a.quality;
  })[0];
}
