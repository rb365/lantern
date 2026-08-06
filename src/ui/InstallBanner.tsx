import { useEffect, useState } from "react";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
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
