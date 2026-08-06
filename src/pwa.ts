/**
 * Service worker registration.
 *
 * Hand-rolled instead of using vite-plugin-pwa's auto-injection so we can
 * explicitly pass `type: "module"` (our generated SW is an ES module — see
 * .github/workflows/deploy.yml and vite.config.ts). Without this, Safari
 * iOS rejects the SW as "importing a module script failed" because the
 * default register call uses the classic-worker type.
 *
 * Also subscribes to updates: when a new SW activates, we reload so users
 * never run stale code.
 */
export function registerPWA() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  // Reload once the new SW has taken over so cache-busted files load.
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    // SW scope must match vite.config.ts's swBase (i.e. /lantern/).
    navigator.serviceWorker
      .register("/lantern/sw.js", { scope: "/lantern/", type: "module" })
      .catch((err) => {
        // Surface only — we don't want to block the app from loading.
        console.warn("Lantern SW registration failed:", err);
      });
  });
}
