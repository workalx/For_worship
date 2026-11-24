import { AiError, type SongCandidate } from '../ai/provider';
import { isChordWord, ocrToCandidate, type OcrLine } from './layoutText';

const MIN_CONFIDENCE = 30;
/** Завантаження мови + ініціалізація + розпізнавання. */
export const OCR_TIMEOUT_MS = 90_000;

function assetUrl(path: string): string {
  return new URL(import.meta.env.BASE_URL + path, window.location.href).href;
}

type RawWord = { text: string; confidence?: number; bbox: { x0: number; x1: number } };
type RawLine = { words?: RawWord[]; bbox?: { y0: number; y1: number } };
type RawBlocks = { paragraphs?: { lines?: RawLine[] }[] }[] | null | undefined;

function toOcrLines(blocks: RawBlocks): OcrLine[] {
  const out: OcrLine[] = [];
  for (const block of blocks ?? []) {
    for (const par of block.paragraphs ?? []) {
      let first = true;
      for (const line of par.lines ?? []) {
        const words = (line.words ?? [])
          .filter((w) => w.text.trim() !== '' && ((w.confidence ?? 100) >= MIN_CONFIDENCE || isChordWord(w.text)))
          .map((w) => ({ text: w.text.trim(), x0: w.bbox.x0, x1: w.bbox.x1 }));
        if (!words.length) continue;
        out.push({ words, y0: line.bbox?.y0, y1: line.bbox?.y1, paragraphStart: first || undefined });
        first = false;
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
  // tesseract.js 7: якщо мовні дані/initialize падають, проміс createWorker не завершується —
  // помилка приходить лише в errorHandler. Тож гонимо його з власним промісом і таймером.
  let fail!: (e: Error) => void;
  const failed = new Promise<never>((_, reject) => {
    fail = reject;
  });
  failed.catch(() => {});
  const timer = setTimeout(() => fail(new AiError('ocr', 'timeout')), OCR_TIMEOUT_MS);
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let finished = false;
  try {
    const created = createWorker('ukr+rus+eng', 1, {
      workerPath: assetUrl('tesseract/worker.min.js'),
      corePath: assetUrl('tesseract/tesseract-core-simd-lstm.wasm.js'),
      langPath: assetUrl('tesseract/lang'),
      workerBlobURL: false,
      gzip: true,
      cacheMethod: 'none',
      logger: (m) => {
        if (m.status === 'recognizing text') onProgress?.(m.progress);
      },
      errorHandler: (e: unknown) => fail(new AiError('ocr', String(e))),
    });
    created.then(
      (w) => {
        worker = w;
        // воркер створився вже після збою/таймауту — прибираємо його
        if (finished) void w.terminate().catch(() => {});
      },
      () => {},
    );
    const w = await Promise.race([created, failed]);
    const { data } = await Promise.race([w.recognize(image, {}, { blocks: true }), failed]);
    return { ...ocrToCandidate(toOcrLines(data.blocks as RawBlocks)), source: 'фото' };
  } finally {
    finished = true;
    clearTimeout(timer);
    if (worker) await worker.terminate().catch(() => {});
  }
}
