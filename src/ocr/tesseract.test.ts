import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const terminate = vi.fn(async () => {});
const recognize = vi.fn();
const createWorker = vi.fn(async () => ({ recognize, terminate }));
vi.mock('tesseract.js', () => ({ createWorker }));

import { AiError } from '../ai/provider';
import { OCR_TIMEOUT_MS, recognizeWithTesseract } from './tesseract';

const bw = (text: string, x0: number, confidence = 90) => ({
  text,
  confidence,
  bbox: { x0, y0: 0, x1: x0 + text.length * 10, y1: 10 },
});

beforeEach(() => {
  terminate.mockClear();
  recognize.mockReset();
  createWorker.mockClear();
});

describe('recognizeWithTesseract', () => {
  it('configures the worker with bundled offline paths', async () => {
    recognize.mockResolvedValue({
      data: {
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  { words: [bw('Назва', 0)] },
                  { words: [bw('G', 0)] },
                  { words: [bw('Ти', 0), bw('', 30), bw('шум', 40, 5)] },
                ],
              },
            ],
          },
        ],
      },
    });
    const progress = vi.fn();
    const c = await recognizeWithTesseract(new Blob(['x']), progress);
    const [langs, oem, opts] = createWorker.mock.calls[0] as unknown as [string, number, Record<string, unknown>];
    expect(langs).toBe('ukr+rus+eng');
    expect(oem).toBe(1);
    expect(String(opts.workerPath)).toMatch(/tesseract\/worker\.min\.js$/);
    expect(String(opts.corePath)).toMatch(/tesseract\/tesseract-core-simd-lstm\.wasm\.js$/);
    expect(String(opts.langPath)).toMatch(/tesseract\/lang$/);
    expect(opts.gzip).toBe(true);
    expect(opts.cacheMethod).toBe('none');
    expect(opts.workerBlobURL).toBe(false);
    expect(typeof opts.errorHandler).toBe('function');
    expect(recognize.mock.calls[0][2]).toEqual({ blocks: true });
    expect(c.title).toBe('Назва');
    expect(c.body).toBe('[G]Ти');
    expect(c.source).toBe('фото');
    expect(terminate).toHaveBeenCalledOnce();

    const logger = opts.logger as (m: { status: string; progress: number }) => void;
    logger({ status: 'recognizing text', progress: 0.5 });
    expect(progress).toHaveBeenCalledWith(0.5);
  });

  it('terminates the worker when recognition fails', async () => {
    recognize.mockRejectedValue(new Error('boom'));
    await expect(recognizeWithTesseract(new Blob(['x']))).rejects.toThrow('boom');
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('keeps low-confidence chord words but drops low-confidence noise', async () => {
    recognize.mockResolvedValue({
      data: {
        blocks: [
          { paragraphs: [{ lines: [{ words: [bw('Назва', 0)] }, { words: [bw('C', 0, 10), bw('G', 60, 5), bw('шум', 100, 5)] }, { words: [bw('Слава', 0), bw('Богу', 60)] }] }] },
        ],
      },
    });
    const c = await recognizeWithTesseract(new Blob(['x']));
    expect(c.body).toBe('[C]Слава [G]Богу');
  });

  describe('failures that never settle createWorker', () => {
    afterEach(() => vi.useRealTimers());

    it('rejects with AiError when errorHandler fires', async () => {
      createWorker.mockImplementationOnce(((_l: string, _o: number, opts: { errorHandler: (e: unknown) => void }) => {
        setTimeout(() => opts.errorHandler(new Error('lang fetch failed')), 0);
        return new Promise(() => {});
      }) as never);
      const err = await recognizeWithTesseract(new Blob(['x'])).catch((e) => e);
      expect(err).toBeInstanceOf(AiError);
      expect(err.kind).toBe('ocr');
      expect(terminate).not.toHaveBeenCalled();
    });

    it('rejects after the watchdog timeout', async () => {
      vi.useFakeTimers();
      createWorker.mockImplementationOnce((() => new Promise(() => {})) as never);
      const p = recognizeWithTesseract(new Blob(['x'])).catch((e) => e);
      await vi.advanceTimersByTimeAsync(OCR_TIMEOUT_MS + 1);
      const err = await p;
      expect(err).toBeInstanceOf(AiError);
      expect(err.kind).toBe('ocr');
    });

    it('times out a hanging recognize and terminates the worker', async () => {
      vi.useFakeTimers();
      recognize.mockReturnValue(new Promise(() => {}));
      const p = recognizeWithTesseract(new Blob(['x'])).catch((e) => e);
      await vi.advanceTimersByTimeAsync(OCR_TIMEOUT_MS + 1);
      expect((await p).kind).toBe('ocr');
      expect(terminate).toHaveBeenCalledOnce();
    });
  });
});
