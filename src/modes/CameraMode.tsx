import { useEffect, useRef, useState } from "react";
import { pickOCR } from "../ocr";
import { translatePhoto } from "../translate/pipeline";
import { renderOverlay } from "../translate/overlay";
import { modelManager } from "../registry";

interface Props {
  src: string;
  tgt: string;
  onBack: () => void;
}

/**
 * Live-camera mode. Captures a frame, runs OCR + translate, draws the
 * overlay, waits a beat, repeats. Roughly 1-2 fps on phones, ~5 fps on
 * a desktop with a fast model. Designed to be unresponsive-tap friendly:
 * a Start button arms the loop and a Stop button kills it.
 */
export function CameraMode({ src, tgt, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const running = useRef(false);

  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  const ready = !!modelManager.getCurrent();

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      setStreaming(true);
      running.current = true;
      loop();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function stop() {
    running.current = false;
    const v = videoRef.current;
    if (v?.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
    setStreaming(false);
  }

  useEffect(() => () => stop(), []);

  async function loop() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !running.current) return;

    // Throttle: process every ~600ms (slow on phones)
    const cnv = document.createElement("canvas");
    cnv.width = v.videoWidth || 640;
    cnv.height = v.videoHeight || 480;
    const ctx = cnv.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, cnv.width, cnv.height);

    const then = Date.now();
    try {
      // Warm OCR with the active source language so lang packs match.
      await pickOCR(src);
      const blob = await new Promise<Blob | null>((res) =>
        cnv.toBlob((b) => res(b), "image/jpeg", 0.85)
      );
      if (!blob || !running.current) return;
      const r = await translatePhoto(blob, src, tgt);
      // Render overlay onto the visible canvas
      if (running.current && c) {
        c.width = cnv.width;
        c.height = cnv.height;
        const cctx = c.getContext("2d");
        if (cctx) {
          cctx.drawImage(cnv, 0, 0);
          renderOverlay({ ctx: cctx, width: c.width, height: c.height, blocks: r.blocks });
        }
      }
    } catch (e: any) {
      console.warn("frame error", e);
    }
    const elapsed = Date.now() - then;
    setFps(Math.round(1000 / Math.max(elapsed, 1)));
    if (running.current) setTimeout(loop, 250);
  }

  return (
    <div>
      <button className="back" onClick={onBack}>← Back</button>
      <h2 style={{ margin: "8px 0" }}>Live Camera</h2>

      {!ready && (
        <div className="status bad">
          No model loaded. Pick one in Settings first.
        </div>
      )}

      {error && <div className="status bad">{error}</div>}

      <div className="cammera-frame" style={{ marginTop: 8 }}>
        <video ref={videoRef} muted playsInline />
        <canvas ref={canvasRef} className="cammera-overlay" />
      </div>

      <p style={{ color: "var(--fg-dim)", fontSize: 13, marginTop: 10 }}>
        Point your camera at text. Live camera runs at ~1-2 fps on phones —
        for high-quality results use Translate Photo.
        {streaming && (
          <span style={{ marginLeft: 8, color: "var(--accent)" }}>{fps} fps</span>
        )}
      </p>

      {!streaming ? (
        <button
          className="primary"
          onClick={start}
          disabled={!ready}
          style={{ width: "100%", marginTop: 12 }}
        >
          Start camera
        </button>
      ) : (
        <button onClick={stop} style={{ width: "100%", marginTop: 12 }}>
          Stop
        </button>
      )}
    </div>
  );
}
