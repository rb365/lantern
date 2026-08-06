/**
 * Render translated text onto a canvas, swapped in for the original
 * with a small backing rectangle so it stays readable on any background.
 *
 * This is intentionally simple. No clever text wrapping per box; the
 * caller passes already-wrapped lines.
 */
import type { TranslatedBlock } from "./pipeline";

interface OverlayOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  blocks: TranslatedBlock[];
  /** Background tint for translated regions. */
  bg?: string;
  /** Text color. */
  color?: string;
  /** Inner padding (px). */
  pad?: number;
  /** Font family; inherits canvas font if omitted. */
  font?: string;
}

export function renderOverlay(opts: OverlayOptions) {
  const {
    ctx,
    width,
    height,
    blocks,
    bg = "rgba(20, 22, 27, 0.95)",
    color = "#f4f4f6",
    pad = 6,
    font = "14px -apple-system, system-ui, sans-serif",
  } = opts;

  ctx.clearRect(0, 0, width, height);
  ctx.font = font;
  ctx.textBaseline = "top";

  for (const blk of blocks) {
    const [nx, ny, nw, nh] = blk.box;
    const x = nx * width;
    const y = ny * height;
    const w = nw * width;
    const h = nh * height;

    // Fill behind the text
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);

    // Wrap and draw translated text
    ctx.fillStyle = color;
    const lines = wrap(blk.translated, ctx, w - pad * 2);
    let yy = y + pad;
    for (const line of lines) {
      if (yy + 16 > y + h) break; // truncate inside box
      ctx.fillText(line, x + pad, yy);
      yy += 16;
    }
  }
}

function wrap(text: string, ctx: CanvasRenderingContext2D, maxW: number): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const ch of para) {
      const trial = line + ch;
      if (ctx.measureText(trial).width > maxW && line) {
        out.push(line);
        line = ch;
      } else {
        line = trial;
      }
    }
    if (line) out.push(line);
    if (out.length > 4) break;
  }
  return out;
}
