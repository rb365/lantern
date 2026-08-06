/**
 * Lightweight image prep for phone photos before Tesseract.
 * Phone JPEGs are noisy, skewed in color, and often huge — Tesseract
 * does much better on a mid-size grayscale image with boosted contrast.
 */

const MAX_SIDE = 1600;
const MIN_SIDE = 48;

export async function preprocessForOCR(
  image: Blob | HTMLImageElement | ImageBitmap
): Promise<{ blob: Blob; width: number; height: number }> {
  const { bmp, owned } = await toBitmap(image);
  try {
    const w =
      "naturalWidth" in bmp
        ? bmp.naturalWidth || bmp.width
        : (bmp as ImageBitmap).width;
    const h =
      "naturalHeight" in bmp
        ? bmp.naturalHeight || bmp.height
        : (bmp as ImageBitmap).height;
    if (w < MIN_SIDE || h < MIN_SIDE) {
      const blob = await bitmapToBlob(bmp, w, h);
      return { blob, width: w, height: h };
    }

    // Downscale huge camera frames (keeps OCR fast + more accurate).
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      const blob = await bitmapToBlob(bmp, w, h);
      return { blob, width: w, height: h };
    }

    ctx.drawImage(bmp as CanvasImageSource, 0, 0, dw, dh);
    const img = ctx.getImageData(0, 0, dw, dh);
    const d = img.data;

    // Grayscale + mild contrast stretch around the midtones.
    // Avoid aggressive binarization — it kills CJK strokes on photos.
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const c = Math.max(0, Math.min(255, (y - 128) * 1.35 + 128));
      d[i] = d[i + 1] = d[i + 2] = c;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))),
        "image/png"
      );
    });
    return { blob, width: dw, height: dh };
  } finally {
    if (owned && typeof ImageBitmap !== "undefined" && bmp instanceof ImageBitmap) {
      try {
        bmp.close();
      } catch {
        /* ignore */
      }
    }
  }
}

async function toBitmap(
  image: Blob | HTMLImageElement | ImageBitmap
): Promise<{ bmp: ImageBitmap | HTMLImageElement; owned: boolean }> {
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    return { bmp: image, owned: false };
  }
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
    if (image.complete && image.naturalWidth) return { bmp: image, owned: false };
    await new Promise<void>((res, rej) => {
      image.onload = () => res();
      image.onerror = () => rej(new Error("image load failed"));
    });
    return { bmp: image, owned: false };
  }
  return { bmp: await createImageBitmap(image as Blob), owned: true };
}

async function bitmapToBlob(
  bmp: ImageBitmap | HTMLImageElement,
  w: number,
  h: number
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bmp as CanvasImageSource, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });
}
