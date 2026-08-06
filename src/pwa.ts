/**
 * Service worker registration.
 *
 * Classic worker (no `type: "module"`) — the only form iOS PWA
 * standalone mode reliably accepts without the opaque
 * "importing a module script failed" error during the install dialog.
 *
 * We append the running build version as a query string on the SW URL
 * so the browser sees a fresh script every release and replaces the
 * old SW. Without this cache-buster, an iOS PWA can hold onto a stale
 * SW for the lifetime of the install.
 */
import { loadBuildInfo } from "./buildInfo";

export function registerPWA() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  // Reload once the new SW has taken over so cache-busted files load.
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    const build = await loadBuildInfo().catch(() => null);
    const v = build?.version ?? "0";
    navigator.serviceWorker
      .register(`/lantern/sw.js?v=${encodeURIComponent(v)}`, {
        scope: "/lantern/",
      })
      .catch((err) => {
        console.warn("Lantern SW registration failed:", err);
      });
  });
}
