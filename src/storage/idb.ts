import { openDB, type IDBPDatabase } from "idb";

/**
 * Tiny IndexedDB wrapper. Stores:
 *   - "installed" object store: ModelEntry objects the user has downloaded.
 *   - "prefs"  object store: app preferences (last selected model, language pair).
 *
 * NOTE: the actual model weights live in the underlying engine caches
 * (Cache API for both Transformers.js and WebLLM). We just track metadata
 * here so we can show "Downloaded / 1.1 GB" status without re-listing files.
 */
const DB_NAME = "lantern";
const DB_VERSION = 1;

let _db: Promise<IDBPDatabase> | null = null;

function db() {
  if (!_db) {
    _db = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("installed")) {
          d.createObjectStore("installed", { keyPath: "id" });
        }
        if (!d.objectStoreNames.contains("prefs")) {
          d.createObjectStore("prefs", { keyPath: "key" });
        }
      },
    });
  }
  return _db;
}

export interface InstalledModel {
  id: string;
  name: string;
  sizeMB: number;
  installedAt: number;
  bytesOnDisk: number;
}

export interface Pref {
  key: string;
  value: any;
}

export const idb = {
  async listInstalled(): Promise<InstalledModel[]> {
    return (await db()).getAll("installed") as Promise<InstalledModel[]>;
  },

  async markInstalled(m: InstalledModel) {
    await (await db()).put("installed", m);
  },

  async removeInstalled(id: string) {
    await (await db()).delete("installed", id);
  },

  async getPref<T>(key: string, fallback: T): Promise<T> {
    const row = (await (await db()).get("prefs", key)) as Pref | undefined;
    return (row?.value as T) ?? fallback;
  },

  async setPref(key: string, value: any) {
    await (await db()).put("prefs", { key, value });
  },
};
