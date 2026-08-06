import React, { useEffect, useState } from "react";
import { Logo } from "./icon";
import { InstallBanner } from "./ui/InstallBanner";
import { ModelPicker } from "./ui/ModelPicker";
import { TextMode } from "./modes/TextMode";
import { PhotoMode } from "./modes/PhotoMode";
import { CameraMode } from "./modes/CameraMode";
import { idb } from "./storage/idb";
import { probeDevice, type DeviceProfile } from "./lib/deviceDetect";

type View = "home" | "text" | "photo" | "camera" | "settings";

const LANGS: Record<string, string> = {
  en: "English",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ru: "Русский",
};

export default function App() {
  const [view, setView] = useState<View>("home");
  const [src, setSrc] = useState("auto");
  const [tgt, setTgt] = useState("en");
  const [device, setDevice] = useState<DeviceProfile | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await idb.getPref<{ src: string; tgt: string }>("lang", {
        src: "auto",
        tgt: "en",
      });
      setSrc(saved.src);
      setTgt(saved.tgt);
      setDevice(await probeDevice());
    })();
  }, []);

  useEffect(() => {
    idb.setPref("lang", { src, tgt });
  }, [src, tgt]);

  return (
    <div className="app">
      {view === "home" && (
        <HomeView
          src={src}
          tgt={tgt}
          setSrc={setSrc}
          setTgt={setTgt}
          device={device}
          onPick={(v) => setView(v)}
        />
      )}
      {view === "text" && <TextMode src={src} tgt={tgt} onBack={() => setView("home")} />}
      {view === "photo" && <PhotoMode src={src} tgt={tgt} onBack={() => setView("home")} />}
      {view === "camera" && <CameraMode src={src} tgt={tgt} onBack={() => setView("home")} />}
      {view === "settings" && (
        <SettingsView
          src={src}
          tgt={tgt}
          setSrc={setSrc}
          setTgt={setTgt}
          device={device}
          onBack={() => setView("home")}
        />
      )}
    </div>
  );
}

function HomeView(props: {
  src: string;
  tgt: string;
  setSrc: (s: string) => void;
  setTgt: (s: string) => void;
  device: DeviceProfile | null;
  onPick: (v: View) => void;
}) {
  return (
    <>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="brand">
          <span className="mark"><Logo /></span>
          Lantern
        </div>
        <button className="ghost" onClick={() => props.onPick("settings")}>Settings</button>
      </header>

      <div className="hero">
        <h1>Private translation that runs on your phone.</h1>
        <p>
          No internet. No data collection. Lantern is a small offline brain that
          reads Chinese, Japanese, Korean and English. Tap a photo. Point your
          camera. Paste text. Done.
        </p>
      </div>

      <LangPicker
        src={props.src}
        tgt={props.tgt}
        onChange={(s, t) => {
          props.setSrc(s);
          props.setTgt(t);
        }}
      />

      <p className="section-title">Choose a mode</p>
      <div className="modes">
        <button onClick={() => props.onPick("photo")}>
          <span className="icon">📷</span>
          <div>
            <div className="label">Translate Photo</div>
            <div className="hint">Snap or pick a photo. Overlay replaces the text.</div>
          </div>
        </button>
        <button onClick={() => props.onPick("camera")}>
          <span className="icon">🎥</span>
          <div>
            <div className="label">Live Camera</div>
            <div className="hint">Translate text in the viewfinder as you move.</div>
          </div>
        </button>
        <button onClick={() => props.onPick("text")}>
          <span className="icon">📝</span>
          <div>
            <div className="label">Translate Text</div>
            <div className="hint">Type or paste. Streaming output, copy when done.</div>
          </div>
        </button>
      </div>

      <InstallBanner />

      {props.device && (
        <div className="status" style={{ marginTop: 14 }}>
          {props.device.ramGB
            ? `≈${props.device.ramGB} GB RAM detected · `
            : ""}
          {props.device.hasWebGPU ? "WebGPU ready" : "WASM only"} ·{" "}
          suggested model: <strong>{props.device.recommendedModelId}</strong>
        </div>
      )}
    </>
  );
}

function LangPicker(props: {
  src: string;
  tgt: string;
  onChange: (src: string, tgt: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <select
        value={props.src}
        onChange={(e) => props.onChange(e.target.value, props.tgt)}
        style={selectStyle}
      >
        <option value="auto">Auto-detect</option>
        {Object.entries(LANGS).map(([code, name]) => (
          <option key={code} value={code}>{name}</option>
        ))}
      </select>
      <span style={{ alignSelf: "center", color: "var(--fg-dim)" }}>→</span>
      <select
        value={props.tgt}
        onChange={(e) => props.onChange(props.src, e.target.value)}
        style={selectStyle}
      >
        {Object.entries(LANGS).map(([code, name]) => (
          <option key={code} value={code}>{name}</option>
        ))}
      </select>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  flex: 1,
  background: "var(--bg-elev)",
  color: "var(--fg)",
  border: "1px solid #2a2d35",
  borderRadius: "var(--radius)",
  padding: "10px 12px",
  font: "inherit",
};

function SettingsView(props: {
  src: string;
  tgt: string;
  setSrc: (s: string) => void;
  setTgt: (s: string) => void;
  device: DeviceProfile | null;
  onBack: () => void;
}) {
  return (
    <div>
      <button className="back" onClick={props.onBack}>← Back</button>
      <h2 style={{ margin: "8px 0" }}>Settings</h2>

      <p className="section-title">Language pair</p>
      <LangPicker
        src={props.src}
        tgt={props.tgt}
        onChange={(s, t) => {
          props.setSrc(s);
          props.setTgt(t);
        }}
      />

      <p className="section-title">Models</p>
      <p style={{ color: "var(--fg-dim)", fontSize: 13 }}>
        Lantern is pluggable. Pick any model you like — replace, swap, delete.
        Models run entirely on this device.
      </p>
      <ModelPicker
        src={props.src}
        tgt={props.tgt}
        highlightId={props.device?.recommendedModelId}
      />

      <p className="section-title">Privacy</p>
      <p style={{ color: "var(--fg-dim)", fontSize: 13, lineHeight: 1.5 }}>
        Lantern does not phone home. There is no analytics, no telemetry,
        no account. The model weights are cached locally; once downloaded, the
        app works with the network fully off.
      </p>
    </div>
  );
}
