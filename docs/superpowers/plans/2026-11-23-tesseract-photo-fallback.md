# Розпізнавання фото без Gemini (Tesseract.js) — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Кнопка «Фото» розпізнає аркуш через Tesseract.js на пристрої, коли Gemini недоступний (немає ключа, мережі або ліміту), з файлами Tesseract, вбудованими в PWA.

**Architecture:** Vite-плагін копіює worker, ядро і мовні пакети Tesseract у збірку під `tesseract/`, Workbox їх precache-ить. `src/ocr/` містить чисту функцію, що з координат слів будує текст «акорди над рядком», і обгортку над Tesseract (динамічний import). `PhotoImport` вирішує, коли переходити на Tesseract.

**Tech Stack:** React 18 + TS + Vite 5 + vite-plugin-pwa (Workbox), tesseract.js 7, @tesseract.js-data/{ukr,rus,eng}, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-23-tesseract-photo-fallback-design.md`

## Global Constraints

- Жодного CDN: `workerPath`, `corePath`, `langPath` — шляхи всередині програми, відносні до `import.meta.env.BASE_URL`.
- Файли: `tesseract/worker.min.js` ← `node_modules/tesseract.js/dist/worker.min.js`; `tesseract/tesseract-core-simd-lstm.wasm.js` ← `node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js`; `tesseract/lang/{ukr,rus,eng}.traineddata.gz` ← `node_modules/@tesseract.js-data/<lang>/4.0.0_best_int/<lang>.traineddata.gz`.
- Мови: `'ukr+rus+eng'`. `gzip: true`, `cacheMethod: 'none'`.
- Перехід на Tesseract лише для `no-key`, `network`, `quota` і коли `navigator.onLine === false` (тоді Gemini не викликається). `bad-key`, `empty`, `unknown` — як зараз (помилка).
- Тексти: «Розпізнаю пісню з фото…» (Gemini), «Розпізнаю пісню з фото (без Gemini)…», тост «Розпізнано без Gemini — перевірте текст і акорди».
- Tesseract-модуль вантажиться лише динамічним `import()`; у головному бандлі його немає.
- LF-закінчення рядків у нових файлах; у наявних — не міняти стиль закінчень.

## Review Focus

1. Збірка (`npm run build`) кладе 5 файлів у `dist/tesseract/…`, і всі вони є в precache-маніфесті `dist/sw.js` (ліміт розміру файлу Workbox піднято, інакше ядро 3,9 МБ мовчки випаде) — перевірка в Task 1.
2. Рядок, де акорди стоять над пробілами між словами або над кінцем рядка, не зсуває акорди — тест у Task 2.
3. Фото без тексту (Tesseract повернув порожньо) → `AiError('empty')`, а не порожня пісня — тест у Task 2.
4. Gemini з ключем працює як раніше і Tesseract не вантажиться — тест у Task 3.
5. Помилка самого Tesseract (файл не завантажився) показується як помилка, а не «висить» оверлей — тест у Task 3.

---

### Task 1: Файли Tesseract у збірці й PWA

**Files:**
- Create: `vite/tesseractAssets.ts` (Vite-плагін), Modify: `vite.config.ts`, `tsconfig*.json` (якщо треба включити `vite/`)
- Test: `src/ocr/tesseractAssets.test.ts`

**Interfaces:**
- Produces: `TESSERACT_FILES: { from: string; to: string }[]` (експорт з `vite/tesseractAssets.ts`, `to` — шлях відносно кореня збірки, напр. `tesseract/lang/ukr.traineddata.gz`); `tesseractAssets(): Plugin` — у `build` емітить файли (`this.emitFile({ type: 'asset', fileName: to, source })`), у `serve` віддає їх тим самим шляхом через `configureServer` middleware (з урахуванням `base`).

- [ ] **Step 1: Failing test** — `TESSERACT_FILES` має рівно 5 записів з `to` з Global Constraints, і кожен `from` існує на диску (`fs.existsSync`).
- [ ] **Step 2:** Run `npx vitest run src/ocr/tesseractAssets.test.ts` → FAIL.
- [ ] **Step 3:** Реалізувати плагін; підключити у `vite.config.ts`; у `workbox`: `globPatterns` додати `'tesseract/**/*.{js,gz}'`, `maximumFileSizeToCacheInBytes: 6 * 1024 * 1024`; видалити `runtimeCaching`-правило `fw-library-songs` (бібліотеку видалено).
- [ ] **Step 4:** `npm run build`; перевірити, що 5 файлів є в `dist/tesseract/…` і їхні шляхи є в `dist/sw.js` (`grep`). Записати вивід у звіт. `npm test` зелений.
- [ ] **Step 5: Commit** `build(pwa): bundle Tesseract worker, core and uk/ru/en data for offline OCR`

### Task 2: OCR → «акорди над рядком» і обгортка Tesseract

**Files:**
- Create: `src/ocr/layoutText.ts`, `src/ocr/tesseract.ts`
- Test: `src/ocr/layoutText.test.ts`, `src/ocr/tesseract.test.ts`

**Interfaces:**
- Consumes: `chordsOverLyricsToChordPro`, `isChordLine` (`src/music/chordsOverLyrics.ts`); `sectionLabel` (`src/music/chordpro.ts`); `guessKey`; `SongCandidate`, `AiError` (`src/ai/provider.ts`).
- Produces:
  - `type OcrWord = { text: string; x0: number; x1: number }`, `type OcrLine = { words: OcrWord[] }`;
  - `layoutLines(lines: OcrLine[]): string` — рядки тексту з пробілами, що відтворюють горизонтальні позиції: колонка слова = `round((x0 - minX) / charWidth)`, де `minX` — найменший `x0` серед усіх рядків, `charWidth` — медіана `(x1 - x0) / text.length` по всіх словах; слова в рядку не злипаються (мінімум один пробіл);
  - `ocrToCandidate(lines: OcrLine[]): SongCandidate` — `body = chordsOverLyricsToChordPro(layoutLines(lines))`; `title` — перший непорожній рядок, що не рядок акордів і не мітка частини (його ж прибрати з тексту); `key = guessKey(body)`; без жодного рядка тексту → `throw new AiError('empty')`;
  - `recognizeWithTesseract(image: Blob, onProgress?: (p: number) => void): Promise<SongCandidate>` у `tesseract.ts`: динамічний `import('tesseract.js')`, `createWorker('ukr+rus+eng', 1, { workerPath, corePath, langPath, gzip: true, cacheMethod: 'none', logger })` з шляхами від `import.meta.env.BASE_URL`, `recognize(image, {}, { blocks: true })`, з `data.blocks → paragraphs → lines → words` (`bbox.x0/x1`) будує `OcrLine[]`, `worker.terminate()` у `finally`; повертає `{ ...ocrToCandidate(lines), source: 'фото' }`.

- [ ] **Step 1: Failing tests** (`layoutText.test.ts`): (a) рядок акордів `G` над «Ти» і `D/F#` над «темряві» у рядку «Ти світло в темряві» (координати підібрати під ширину символу 10) → `ocrToCandidate(...).body` містить `[G]Ти світло в [D/F#]темряві`; (b) акорд над кінцем рядка / над пробілом між словами лишається на своїй колонці; (c) назва з першого рядка, рядок «Приспів» лишається міткою частини; (d) порожній вхід → `AiError` з `kind: 'empty'`. `tesseract.test.ts`: з підміненим `vi.mock('tesseract.js')` — перевірити шляхи (`workerPath` закінчується на `tesseract/worker.min.js`, `corePath` на `tesseract/tesseract-core-simd-lstm.wasm.js`, `langPath` на `tesseract/lang`), мови `'ukr+rus+eng'`, `gzip: true`, `cacheMethod: 'none'`, `terminate` викликано і при помилці.
- [ ] **Step 2:** Run `npx vitest run src/ocr` → FAIL.
- [ ] **Step 3:** Реалізувати.
- [ ] **Step 4:** `npx vitest run src/ocr`, `npm test`, `npx tsc --noEmit -p .` → PASS.
- [ ] **Step 5: Commit** `feat(ocr): Tesseract.js recognition with chord positions from word boxes`

### Task 3: Перехід на Tesseract у «Фото»

**Files:**
- Modify: `src/library/PhotoImport.tsx`, `src/library/LibraryScreen.tsx` (тост)
- Test: `src/library/PhotoImport.test.tsx`

**Interfaces:**
- Consumes: `getProvider` (`src/ai/getProvider.ts`), `recognizeWithTesseract` (Task 2, імпорт динамічний: `await import('../ocr/tesseract')`).
- Produces: `PhotoImport` props `{ onResult: (c: SongCandidate, via: 'gemini' | 'tesseract') => void; onError: (e: AiError) => void }`. `LibraryScreen` при `via === 'tesseract'` показує тост з Global Constraints.

- [ ] **Step 1: Failing tests** (`vi.mock` для `../ai/getProvider` і `../ocr/tesseract`): (a) є ключ, Gemini повернув пісню → `onResult(c, 'gemini')`, Tesseract не викликано; (b) `getProvider` кидає `no-key` → Tesseract, `onResult(c, 'tesseract')`; (c) Gemini кидає `network` і `quota` → Tesseract; (d) `navigator.onLine = false` → Gemini не викликано, одразу Tesseract; (e) `bad-key` → `onError`, Tesseract не викликано; (f) Tesseract кидає → `onError(AiError)`, оверлей зник; (g) під час Tesseract видно «Розпізнаю пісню з фото (без Gemini)…».
- [ ] **Step 2:** Run `npx vitest run src/library/PhotoImport.test.tsx` → FAIL.
- [ ] **Step 3:** Реалізувати; помилку Tesseract, що не `AiError`, обгорнути в `AiError('unknown', …)`.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit -p .`, `npm run build` → PASS.
- [ ] **Step 5: Commit** `feat(photo): fall back to on-device Tesseract when Gemini is unavailable`

### Task 4: Перевірка наживо (контролер)

- [ ] У dev-сервері: згенерувати в браузері зображення аркуша (canvas: рядок акордів над рядком тексту, укр.), викликати `recognizeWithTesseract` через `import('/src/ocr/tesseract.ts')` → пісня з акордами на місцях; у мережі немає запитів до CDN.
- [ ] `npm run build && vite preview`: перевірити, що service worker precache містить файли `tesseract/…`.
