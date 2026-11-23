import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { TESSERACT_FILES } from '../../vite/tesseractAssets';

describe('TESSERACT_FILES', () => {
  it('lists exactly the five files needed for offline OCR', () => {
    expect(TESSERACT_FILES.map((f) => f.to).sort()).toEqual([
      'tesseract/lang/eng.traineddata.gz',
      'tesseract/lang/rus.traineddata.gz',
      'tesseract/lang/ukr.traineddata.gz',
      'tesseract/tesseract-core-simd-lstm.wasm.js',
      'tesseract/worker.min.js',
    ]);
  });

  it('points every source at an existing file', () => {
    for (const f of TESSERACT_FILES) {
      expect(existsSync(resolve(f.from)), f.from).toBe(true);
    }
  });
});
