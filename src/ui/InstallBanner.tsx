import { useEffect, useState } from "react";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function InstallBanner() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // iOS does NOT fire beforeinstallprompt; users there install via
  // Share → Add to Home Screen, which we cover in the in-app hint.
  // Hiding this banner on iOS prevents the "Install" → broken-PWA loop.
  if (isIOS()) return null;
  if (!evt || dismissed) return null;

  return (
    <div className="install-banner" role="status">
      <span style={{ flex: 1 }}>
        Install Lantern for one-tap access. Works offline.
      </span>
      <button
        className="primary"
        onClick={async () => {
          await evt.prompt();
          setDismissed(true);
        }}
      >
        Install
      </button>
      <button className="ghost" onClick={() => setDismissed(true)}>
        Not now
      </button>
    </div>
  );
}
