import { useEffect, useState } from "react";
import { CATALOG, modelManager, type ModelEntry } from "../registry";

interface Props {
  src: string;
  tgt: string;
  onLoaded?: () => void;
  highlightId?: string;
}

export function ModelPicker({ src, tgt, onLoaded, highlightId }: Props) {
  const [installed, setInstalled] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
    const off = modelManager.onChange(setCurrent);
    const offp = modelManager.onProgress((p) =>
      setProgress({ loaded: p.loaded, total: p.total })
    );
    return () => {
      off();
      offp();
    };
  }, []);

  async function refresh() {
    setInstalled((await modelManager.listInstalled()).map((m) => m.id));
    setCurrent(modelManager.getCurrent()?.id ?? null);
  }

  async function load(m: ModelEntry) {
    setError(null);
    setBusy(m.id);
    setProgress({ loaded: 0, total: m.sizeMB * 1024 * 1024 });
    try {
      await modelManager.load(m);
      await refresh();
      onLoaded?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function remove(m: ModelEntry) {
    if (!confirm(`Remove ${m.name} (~${m.sizeMB} MB)? This frees storage.`)) return;
    setBusy(m.id);
    try {
      await modelManager.remove(m);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  const pct =
    progress && progress.total
      ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
      : 0;

  return (
    <div>
      {error && <div className="status bad">{error}</div>}
      {CATALOG.map((m) => {
        const fits =
          m.src.includes("auto") ||
          m.tgt.includes("auto") ||
          (m.src.includes(src) && m.tgt.includes(tgt));
        const isInstalled = installed.includes(m.id);
        const isCurrent = current === m.id;
        return (
          <div
            key={m.id}
            className="model-card"
            style={
              highlightId === m.id
                ? { borderColor: "var(--accent)" }
                : undefined
            }
          >
            <header>
              <h3>{m.name}</h3>
              <span className="meta">
                {m.sizeMB >= 1000
                  ? `~${(m.sizeMB / 1024).toFixed(1)} GB`
                  : `~${m.sizeMB} MB`}{" "}
                · {m.ramGB}+ GB
              </span>
            </header>
            <p style={{ margin: 0, fontSize: 13, color: "var(--fg-dim)" }}>
              {m.tagline}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--fg-dim)" }}>
              Engine: {m.engine} · {m.license}
              {!fits && m.src[0] !== "auto" && " · doesn't pair — needs another model"}
            </p>

            {busy === m.id && (
              <div className="progress">
                <div style={{ width: pct + "%" }} />
              </div>
            )}

            <div className="row">
              {isCurrent ? (
                <button disabled>Loaded ✓</button>
              ) : (
                <button
                  className={isInstalled ? "" : "primary"}
                  disabled={busy !== null}
                  onClick={() => load(m)}
                >
                  {busy === m.id ? `Downloading… ${pct}%` : isInstalled ? "Use" : "Download"}
                </button>
              )}
              {isInstalled && !isCurrent && (
                <button onClick={() => remove(m)}>Delete</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
