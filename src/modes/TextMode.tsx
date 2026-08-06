import { useState } from "react";
import { modelManager } from "../registry";
import { translateText } from "../translate/pipeline";

interface Props {
  src: string;
  tgt: string;
  onBack: () => void;
}

export function TextMode({ src, tgt, onBack }: Props) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = !!modelManager.getCurrent();

  async function go() {
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    setOutput("");
    try {
      await translateText(input, src, tgt, (chunk) => setOutput((o) => o + chunk));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="back" onClick={onBack}>← Back</button>
      <h2 style={{ margin: "8px 0" }}>Translate Text</h2>

      {!ready && (
        <div className="status bad">
          No model loaded. Pick one in Settings first.
        </div>
      )}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={6}
        placeholder="Paste or type text…"
        style={{
          width: "100%",
          background: "var(--bg-elev)",
          color: "var(--fg)",
          border: "1px solid #2a2d35",
          borderRadius: "var(--radius)",
          padding: 12,
          font: "inherit",
          resize: "vertical",
        }}
      />
      <button
        className="primary"
        disabled={!ready || busy || !input.trim()}
        onClick={go}
        style={{ marginTop: 10, width: "100%" }}
      >
        {busy ? "Translating…" : `Translate ${src.toUpperCase()} → ${tgt.toUpperCase()}`}
      </button>

      {error && <div className="status bad" style={{ marginTop: 12 }}>{error}</div>}

      {output && (
        <div
          style={{
            marginTop: 14,
            background: "var(--bg-elev)",
            borderRadius: "var(--radius)",
            padding: 12,
            whiteSpace: "pre-wrap",
            minHeight: 80,
          }}
        >
          {output}
        </div>
      )}
    </div>
  );
}
