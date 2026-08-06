/**
 * OCR interface. The OCR layer is pluggable just like the LLMs:
 *   - some users prefer PaddleOCR v6 (best CJK quality)
 *   - some want fast classic Tesseract
 *   - on phones with a multimodal LLM (Gemma 4 E4B) we can skip OCR
 *     entirely and ask the model to read+translate the image directly.
 */
export interface OCRBlock {
  text: string;
  /** Normalized 0..1 box. [x, y, w, h] relative to image size. */
  box: [number, number, number, number];
  confidence: number;
}

export interface OCRResult {
  text: string;
  blocks: OCRBlock[];
}

export interface OCREngine {
  id: string;
  name: string;
  sizeMB: number;
  isSupported(): Promise<boolean>;
  load(onProgress?: (loaded: number, total: number) => void): Promise<void>;
  recognize(image: Blob | HTMLImageElement | ImageBitmap): Promise<OCRResult>;
}
