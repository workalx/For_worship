import type { SongCandidate } from '../ai/provider';
import { ocrToCandidate, type OcrLine } from './layoutText';

const MIN_CONFIDENCE = 30;

function assetUrl(path: string): string {
  return new URL(import.meta.env.BASE_URL + path, window.location.href).href;
}

type RawWord = { text: string; confidence?: number; bbox: { x0: number; x1: number } };
type RawLine = { words?: RawWord[] };
type RawBlocks = { paragraphs?: { lines?: RawLine[] }[] }[] | null | undefined;

function toOcrLines(blocks: RawBlocks): OcrLine[] {
  const out: OcrLine[] = [];
  for (const block of blocks ?? []) {
    for (const par of block.paragraphs ?? []) {
      for (const line of par.lines ?? []) {
        const words = (line.words ?? [])
          .filter((w) => w.text.trim() !== '' && (w.confidence ?? 100) >= MIN_CONFIDENCE)
          .map((w) => ({ text: w.text.trim(), x0: w.bbox.x0, x1: w.bbox.x1 }));
        if (words.length) out.push({ words });
      }
    }
  }
  return out;
}

/** Розпізнає фото офлайн (Tesseract.js, укр+рос+англ) і будує пісню з позицій слів. */
export async function recognizeWithTesseract(
  image: Blob,
  onProgress?: (p: number) => void,
): Promise<SongCandidate> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('ukr+rus+eng', 1, {
    workerPath: assetUrl('tesseract/worker.min.js'),
    corePath: assetUrl('tesseract/tesseract-core-simd-lstm.wasm.js'),
    langPath: assetUrl('tesseract/lang'),
    gzip: true,
    cacheMethod: 'none',
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(image, {}, { blocks: true });
    return { ...ocrToCandidate(toOcrLines(data.blocks as RawBlocks)), source: 'фото' };
  } finally {
    await worker.terminate();
  }
}
