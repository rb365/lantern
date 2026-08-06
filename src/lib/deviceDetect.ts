/**
 * Detect device capabilities so the model picker can recommend a tier.
 *
 * We don't pretend to know the exact RAM; we read navigator.deviceMemory
 * (a coarse hint provided by browsers) and combine with user agent and
 * UA-class hints to estimate a sensible recommended max-ram.
 */
export interface DeviceProfile {
  /** Estimated total device RAM in GB. May be undefined if unknown. */
  ramGB?: number;
  hasWebGPU: boolean;
  hasWasm: boolean;
  isMobile: boolean;
  recommendedModelId: string;
}

export async function probeDevice(): Promise<DeviceProfile> {
  const navAny = navigator as any;
  const ramHintGB: number | undefined =
    typeof navAny.deviceMemory === "number" ? navAny.deviceMemory : undefined;
  const cores = navigator.hardwareConcurrency ?? 4;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  let hasWebGPU = false;
  try {
    if (navAny.gpu) {
      const adapter = await navAny.gpu.requestAdapter();
      hasWebGPU = !!adapter;
    }
  } catch {
    hasWebGPU = false;
  }
  const hasWasm = typeof WebAssembly !== "undefined";

  // Recommended tier:
  //   - 8GB+ AND WebGPU → Pro (Gemma 4 E4B multimodal)
  //   - 6GB+ → Standard (Qwen 3 1.7B)
  //   - else Budget (OPUS-MT small pair)
  let recommendedModelId = "opus-mt-zh-en";
  if ((ramHintGB ?? 0) >= 8 && hasWebGPU && !isMobile) {
    recommendedModelId = "gemma-4-e4b-q4f16";
  } else if ((ramHintGB ?? 0) >= 6 || cores >= 6) {
    recommendedModelId = "qwen3-1.7b-q4f16";
  }

  return {
    ramGB: ramHintGB,
    hasWebGPU,
    hasWasm,
    isMobile,
    recommendedModelId,
  };
}
