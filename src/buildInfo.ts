/**
 * Load /build.json (emitted on every CI build).
 * Returns the current build's version + timestamp + short commit,
 * formatted to expose hour + minute so two deploys the same day are
 * distinguishable at a glance.
 */
export interface BuildInfo {
  version: string;
  builtAt: string;       // ISO 8601 with full time
  displayStamp: string;  // YYYY-MM-DD HH:MM in user's local zone
  commit: string;        // short SHA
}

let cached: Promise<BuildInfo> | null = null;

export function loadBuildInfo(): Promise<BuildInfo> {
  if (cached) return cached;
  cached = (async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}build.json`, {
        cache: "no-cache",
      });
      const raw = await res.json();
      return normalise(raw);
    } catch {
      // Local dev, or fetch blocked: fall back to "dev" so the UI doesn't
      // crash when running `npm run dev`.
      return normalise({ version: "dev", builtAt: new Date().toISOString(), commit: "local" });
    }
  })();
  return cached;
}

function normalise(raw: any): BuildInfo {
  const d = new Date(raw.builtAt ?? Date.now());
  const pad = (n: number) => String(n).padStart(2, "0");
  const displayStamp =
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return {
    version: raw.version ?? "0.0.0",
    builtAt: raw.builtAt ?? new Date().toISOString(),
    displayStamp,
    commit: raw.commit ?? "—",
  };
}
