import type { Engine, ModelEntry, EngineKind } from "../types";
import { transformersEngine } from "./transformersjs";
import { webllmEngine } from "./webllm";

const REGISTRY: Record<EngineKind, Engine> = {
  transformersjs: transformersEngine,
  webllm: webllmEngine,
  custom: transformersEngine, // fallback; real one supplied by host (Capacitor etc.)
};

export function engineFor(entry: ModelEntry): Engine {
  return REGISTRY[entry.engine] ?? transformersEngine;
}

export { transformersEngine, webllmEngine };
