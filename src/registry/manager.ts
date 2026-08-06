/**
 * ModelManager — the single entry point UI code talks to.
 *
 * Responsibilities:
 *   - decide which engine to load a model with
 *   - download/cache the model (delegated to the engine)
 *   - keep only ONE model loaded at a time (memory pressure on phones)
 *   - swap to a different model on demand
 *   - translate using whatever's loaded
 *   - list installed/downloaded models
 */
import type { ModelEntry, DownloadProgress } from "./types";
import { engineFor } from "./engines";
import { idb } from "../storage/idb";

class ModelManager {
  private current: ModelEntry | null = null;
  private listeners = new Set<(id: string | null) => void>();
  private progressListeners = new Set<(p: DownloadProgress) => void>();

  /** Subscribe to model-swap events. */
  onChange(fn: (id: string | null) => void) {
    this.listeners.add(fn);
    fn(this.current?.id ?? null);
    return () => this.listeners.delete(fn);
  }
  onProgress(fn: (p: DownloadProgress) => void) {
    this.progressListeners.add(fn);
    return () => this.progressListeners.delete(fn);
  }
  private emit() {
    const id = this.current?.id ?? null;
    this.listeners.forEach((l) => l(id));
  }
  private emitProgress(p: DownloadProgress) {
    this.progressListeners.forEach((l) => l(p));
  }

  getCurrent(): ModelEntry | null {
    return this.current;
  }

  async isInstalled(id: string): Promise<boolean> {
    const all = await idb.listInstalled();
    return all.some((m) => m.id === id);
  }

  async listInstalled() {
    return idb.listInstalled();
  }

  /**
   * Load (and cache) a model. If a different model is already loaded,
   * unload it first. Progress is reported via onProgress.
   *
   * If `keepOthers` is true we don't unload first (useful for the
   * secondary "OCR" model in the multimodal path).
   */
  async load(entry: ModelEntry, opts: { keepOthers?: boolean } = {}): Promise<void> {
    if (!entry) throw new Error("No model entry");
    if (this.current?.id === entry.id) {
      // already loaded; nothing to do
      return;
    }
    if (this.current && !opts.keepOthers) {
      const old = this.current;
      const e = engineFor(old);
      try {
        await e.unload(old.id);
      } catch (err) {
        // unloading is best-effort
        console.warn("unload failed", err);
      }
    }
    const e = engineFor(entry);
    if (!(await e.isSupported())) {
      throw new Error(
        `Engine ${entry.engine} not supported in this browser. ` +
          `Try a recent Chrome/Safari with WebGPU.`
      );
    }
    await e.load(entry, (p) => this.emitProgress(p));
    this.current = entry;
    await idb.markInstalled({
      id: entry.id,
      name: entry.name,
      sizeMB: entry.sizeMB,
      installedAt: Date.now(),
      bytesOnDisk: entry.sizeMB * 1024 * 1024,
    });
    this.emit();
  }

  /** Remove a downloaded model + its cache entry. */
  async remove(entry: ModelEntry) {
    const e = engineFor(entry);
    try {
      await e.unload(entry.id);
    } catch {}
    await idb.removeInstalled(entry.id);
    // Tell the engine to drop cached weights. Each engine manages its own
    // cache (Cache API for Transformers.js / WebLLM).
    try {
      if ("caches" in self) {
        const keys = await caches.keys();
        for (const k of keys) {
          if (k.includes(entry.id) || k.includes(entry.ref)) {
            await caches.delete(k);
          }
        }
      }
    } catch {}
    if (this.current?.id === entry.id) {
      this.current = null;
      this.emit();
    }
  }

  /** Translate using whatever's currently loaded. */
  async translate(text: string, src: string, tgt: string): Promise<string> {
    if (!this.current) throw new Error("No model loaded. Choose one in Settings.");
    const e = engineFor(this.current);
    return e.translate({ entry: this.current, text, src, tgt });
  }

  async translateStream(
    text: string,
    src: string,
    tgt: string,
    onToken: (s: string) => void,
    signal?: AbortSignal
  ) {
    if (!this.current) throw new Error("No model loaded.");
    const e = engineFor(this.current);
    return e.translate({
      entry: this.current,
      text,
      src,
      tgt,
      signal,
      onToken,
    });
  }
}

export const modelManager = new ModelManager();
