/**
 * Surface module-loading errors so we can debug iOS PWA from the page.
 * iOS Safari never tells you the URL of the failed module — it just
 * shows "importing a module script failed" — so we catch both the
 * global 'error' event and 'unhandledrejection' and print them into a
 * fixed corner of the page.
 */
export function installErrorDiagnostics() {
  if (typeof window === "undefined") return;
  const box = document.createElement("pre");
  box.id = "lantern-diag";
  box.style.cssText =
    "position:fixed;bottom:0;left:0;right:0;max-height:40vh;overflow:auto;" +
    "background:rgba(0,0,0,0.85);color:#ffb4b4;font:11px/1.3 monospace;" +
    "padding:6px 8px;margin:0;white-space:pre-wrap;z-index:99999;" +
    "border-top:1px solid #ffb4b4;display:none;";
  document.body?.appendChild(box);

  const show = (label: string, e: any) => {
    box.style.display = "block";
    const ts = new Date().toISOString().slice(11, 19);
    const msg = (e?.message ?? e?.reason?.message ?? String(e)).slice(0, 400);
    const src = e?.filename ?? e?.reason?.stack?.match?.(/https?:[^\s)]+/)?.[0] ?? "";
    box.textContent += `[${ts}] ${label}: ${msg}${src ? "\n  src: " + src : ""}\n`;
  };

  window.addEventListener("error", (ev) => show("error", ev.error ?? ev.message));
  window.addEventListener("unhandledrejection", (ev) =>
    show("rejection", ev.reason)
  );
}
