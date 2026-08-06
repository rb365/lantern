import { useRef, useState } from "react";
import { translatePhoto, type PhotoTranslateResult } from "../translate/pipeline";
import { renderOverlay } from "../translate/overlay";
import { modelManager } from "../registry";

interface Props {
  src: string;
  tgt: string;
  onBack: () => void;
}

export function PhotoMode({ src, tgt, onBack }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [stage, setStage] = useState<string>("");
  const [pct, setPct] = useState(0);
  const [result, setResult] = useState<PhotoTranslateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = !!modelManager.getCurrent();

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    const url = URL.createObjectURL(file);

    // Load image into an offscreen <img> so we can overlay on it.
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Could not load image"));
      img.src = url;
    });
    imgRef.current = img;

    try {
      const r = await translatePhoto(file, src, tgt, (s, p) => {
        setStage(s);
        setPct(p);
      });
      setResult(r);
      draw(img, r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function draw(img: HTMLImageElement, r: PhotoTranslateResult) {
    const c = canvasRef.current;
    if (!c) return;
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Draw the original image first
    ctx.drawImage(img, 0, 0);
    // Overlay translated text on top of the bounding-box fills
    renderOverlay({ ctx, width: c.width, height: c.height, blocks: r.blocks });
  }

  return (
    <div>
      <button className="back" onClick={onBack}>← Back</button>
      <h2 style={{ margin: "8px 0" }}>Translate Photo</h2>

      {!ready && (
        <div className="status bad">
          No model loaded. Pick one in Settings first.
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        <button className="primary" onClick={() => fileRef.current?.click()}>
          📷 Take photo
        </button>
        <button onClick={() => fileRef.current?.click()}>🖼️ Choose from library</button>
      </div>

      {stage && pct > 0 && pct < 1 && (
        <>
          <div className="status" style={{ marginTop: 16 }}>
            {stage} — {Math.round(pct * 100)}%
          </div>
          <div className="progress"><div style={{ width: pct * 100 + "%" }} /></div>
        </>
      )}

      {error && <div className="status bad" style={{ marginTop: 14 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 16 }}>
          <canvas
            ref={canvasRef}
            style={{
              width: "100%",
              height: "auto",
              borderRadius: "var(--radius)",
              background: "#000",
              display: "block",
            }}
          />
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", color: "var(--fg-dim)" }}>
              Plain text
            </summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                background: "var(--bg-elev)",
                padding: 12,
                borderRadius: "var(--radius)",
                marginTop: 8,
                fontSize: 13,
              }}
            >
              {result.fullText}
              {"\n\n—\n\n"}
              {result.fullTranslation}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
