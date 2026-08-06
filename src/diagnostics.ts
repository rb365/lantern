/**
 * Surface module-loading errors so we can debug iOS PWA from the page.
 * iOS Safari never tells you the URL of the failed module — it just
 * shows "importing a module script failed" — so we:
 *   - install global error + unhandledrejection listeners
 *   - install a fixed-size overlay with the latest failures (no
 *     infinite growing buffer; we keep the last 6 lines)
 *   - when a load error happens, mark the next module that 404s with
 *     a "?_lantern_diag" so we can correlate it to the URL
 */
export function installErrorDiagnostics() {
  if (typeof window === "undefined") return;
  const box = document.createElement("pre");
  box.id = "lantern-diag";
  box.style.cssText =
    "position:fixed;bottom:0;left:0;right:0;max-height:30vh;overflow:auto;" +
    "background:rgba(0,0,0,0.92);color:#ffb4b4;font:11px/1.3 monospace;" +
    "padding:6px 8px;margin:0;white-space:pre-wrap;z-index:99999;" +
    "border-top:1px solid #ffb4b4;display:none;" +
    "font-family:ui-monospace,Menlo,Consolas,monospace;";
  document.body?.appendChild(box);

  const lines: string[] = [];
  const push = (s: string) => {
    lines.push(s);
    while (lines.length > 8) lines.shift();
    box.textContent = lines.join("\n");
    box.style.display = "block";
  };

  const stamp = () => new Date().toISOString().slice(11, 19);
  const oneLine = (s: string) => s.replace(/\s+/g, " ").slice(0, 240);

  window.addEventListener("error", (ev) => {
    const src = (ev as any).filename || "";
    const ln = (ev as any).lineno || 0;
    const col = (ev as any).colno || 0;
    const msg = (ev.error?.message ?? (ev as any).message ?? "error").toString();
    push(`[${stamp()}] error  ${oneLine(msg)}\n        at ${src}:${ln}:${col}`);
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const r: any = ev.reason;
    const msg = (r?.message ?? String(r)).toString();
    const src = (r?.stack ?? "").match(/https?:[^\s)]+\.js/g)?.[0] ?? "";
    push(`[${stamp()}] reject ${oneLine(msg)}${src ? "\n        at " + src : ""}`);
  });

  // Listen to ALL script resource failures and report the URL.
  // This works even for opaque cross-origin module errors where the
  // error event has no filename.
  const r = (ev: any) => {
    const src = ev.target?.src || ev.target?.href || "";
    if (src && !src.includes("chrome-extension://")) {
      push(`[${stamp()}] load   FAILED ${src}`);
    }
  };
  document.addEventListener("error", r, true);

  // Initial ready signal — visible only on error.
  push(`[${stamp()}] diag ready — build ok`);
}
