import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Tesseract worker, wasm core and language data bundled for offline OCR (no CDN). */
export const TESSERACT_FILES: { from: string; to: string }[] = [
  { from: 'node_modules/tesseract.js/dist/worker.min.js', to: 'tesseract/worker.min.js' },
  {
    from: 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
    to: 'tesseract/tesseract-core-simd-lstm.wasm.js',
  },
  ...['ukr', 'rus', 'eng'].map((lang) => ({
    from: `node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,
    to: `tesseract/lang/${lang}.traineddata.gz`,
  })),
];

function contentType(path: string): string {
  // .gz is served raw (no Content-Encoding): Tesseract gunzips the data itself.
  return path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream';
}

export function tesseractAssets(): Plugin {
  let root = process.cwd();
  let base = '/';
  return {
    name: 'fw-tesseract-assets',
    configResolved(config) {
      root = config.root;
      base = config.base;
    },
    buildStart() {
      for (const { from, to } of TESSERACT_FILES) {
        this.emitFile({ type: 'asset', fileName: to, source: readFileSync(resolve(root, from)) });
      }
    },
    configureServer(server) {
      // Registered before Vite's base middleware, so req.url still carries `base`.
      const prefix = base.endsWith('/') ? base : `${base}/`;
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0];
        if (!pathname.startsWith(prefix)) return next();
        const rel = decodeURIComponent(pathname.slice(prefix.length));
        const file = TESSERACT_FILES.find((f) => f.to === rel);
        if (!file) return next();
        res.setHeader('Content-Type', contentType(file.to));
        res.end(readFileSync(resolve(root, file.from)));
      });
    },
  };
}
