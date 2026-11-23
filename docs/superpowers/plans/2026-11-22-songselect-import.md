# Імпорт пісень із SongSelect одною кнопкою — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Кнопка «Додати в For Worship» на сторінці акордів SongSelect одним натисканням зберігає пісню (ChordPro) у програмі; з програми можна шукати на SongSelect; транспонування коректне для акордів SongSelect.

**Architecture:** Розширення Chrome (Manifest V3, plain JS у `extension/`) на songselect.com отримує ChordPro через власний експорт сайту і передає його у вкладку програми; content script на адресі програми пересилає дані сторінці через `window.postMessage`. Програма (`src/songselect/`) перевіряє повідомлення, розбирає ChordPro наявним `parseChordProFile` і зберігає через `saveSong`, оновлюючи пісню з тим самим номером CCLI.

**Tech Stack:** React 18 + TypeScript + Vite PWA, Dexie (IndexedDB), Vitest + Testing Library + fake-indexeddb, Chrome Extension MV3.

**Spec:** `docs/superpowers/specs/2026-11-22-songselect-import-design.md`

## Global Constraints

- Жодних паролів чи cookie SongSelect у програмі, розширенні-сховищі чи на сервері; запити до SongSelect робить лише content script на songselect.com з cookie сторінки.
- Один імпорт = одна пісня, яку користувач відкрив і натиснув кнопку. Жодного обходу сторінок.
- Адреси програми, дозволені в розширенні: `http://localhost:5173/*` (адреса публікації додається пізніше одним рядком у `extension/manifest.json` і `extension/lib.js`).
- Повідомлення між розширенням і програмою: `{ type: 'for-worship/songselect-import', version: 1, chordPro: string, pageUrl: string, ccliNumber: string }`.
- Пісня з SongSelect: `source: 'SongSelect'`, `sourceUrl` = адреса сторінки, `chordsOrigin: 'manual'`, `ccliNumber`.
- Тексти інтерфейсу українською: «Шукати на SongSelect», «Додати в For Worship», «Додаю…», «Додано ✓», «Помилка».
- Залежне від розмітки чи ендпоінтів SongSelect живе лише в `extension/songselect.js`.
- У репозиторій не комітимо справжні тексти пісень SongSelect: фікстури синтетичні, лише повторюють формат.

## Review Focus

1. Пісню, вже імпортовану раніше, імпортують знову → оновлюється та сама пісня (той самий `id`, `createdAt`), без дубля — тест у Task 3.
2. Чуже `postMessage` (інший origin, інший `type`, `version` ≠ 1, порожній `chordPro`) → ігнорується, нічого не зберігається — тести в Task 4.
3. ChordPro без `{key}` або з тональністю на кшталт `C#m` → пісня зберігається, тональність вгадує наявний `guessKey` / зберігається `C#m` — тест у Task 2.
4. Підвал SongSelect (рядки `CCLI Song # …`, `©…`, `CCLI License # …`, «For use solely with the SongSelect…») не потрапляє в текст пісні; копірайт іде в `license` — тест у Task 2.
5. Нестандартні позначки в рядку акордів (`N.C.`, `(2x)`, `|`) при транспонуванні лишаються як є, а не ламаються — тест у Task 6.

---

### Task 1: З'ясувати формат експорту ChordPro на SongSelect (ручне дослідження)

Потребує дозволу користувача на завантаження одного файлу. Код програми не пишемо.

**Files:**
- Modify: `docs/superpowers/specs/2026-11-22-songselect-import-design.md` (розділ «Що з'ясовано на SongSelect»)
- Create: `src/songselect/fixtures.ts`

**Interfaces:**
- Produces: `SONGSELECT_SAMPLE: string` у `src/songselect/fixtures.ts` — синтетична пісня у форматі експорту SongSelect (ті самі директиви, позначки частин і підвал, вигаданий текст і номер `1234567`).

- [ ] **Step 1:** Попросити користувача дозволити завантаження одного ChordPro-файлу з будь-якої пісні SongSelect.
- [ ] **Step 2:** У Chrome на сторінці `…/viewchordsheet` увімкнути запис мережі (`read_network_requests`), натиснути «Download ChordPro®». Записати: URL і метод запиту, параметри (номер пісні, тональність), чи потрібні заголовки (наприклад, anti-forgery токен зі сторінки), тип відповіді (текст чи JSON з полем).
- [ ] **Step 3:** Записати формат файлу: які директиви (`{title}`, `{key}`, `{tempo}`, `{time}`, `{comment}`…), як позначені частини, як виглядає підвал. Знайти, де на сторінці є номер пісні (URL `songs/<номер>/…` чи текст «Song Number»).
- [ ] **Step 4:** Дописати знахідки в розділ специфікації; створити `fixtures.ts` з `SONGSELECT_SAMPLE`, який містить: усі знайдені директиви, мінімум дві частини, акорди `D/F#`, `Gsus`, `Bm7`, `A2`, і підвал у точному форматі SongSelect.
- [ ] **Step 5:** Видалити завантажений файл.
- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-11-22-songselect-import-design.md src/songselect/fixtures.ts
git commit -m "docs(songselect): record ChordPro export format and add synthetic fixture"
```

### Task 2: Розбір ChordPro з SongSelect у пісню

**Files:**
- Modify: `src/db/db.ts` (тип `Song`: нове поле)
- Create: `src/songselect/parseSongSelect.ts`
- Test: `src/songselect/parseSongSelect.test.ts`

**Interfaces:**
- Consumes: `parseChordProFile(text)` з `src/music/chordproFile.ts`; `guessKey(body)` з `src/music/chordpro.ts`; `SONGSELECT_SAMPLE` (Task 1).
- Produces: у `Song` — `ccliNumber?: string` (номер пісні CCLI; не індексується, версія Dexie не змінюється). `parseSongSelect(chordPro: string, pageUrl: string, ccliNumber: string): SongInput`.

- [ ] **Step 1: Write the failing tests**

```ts
import { SONGSELECT_SAMPLE } from './fixtures';
import { parseSongSelect } from './parseSongSelect';

const url = 'https://songselect.ccli.com/songs/1234567/sample-song/viewchordsheet';

test('бере назву, тональність, джерело й номер CCLI', () => {
  const s = parseSongSelect(SONGSELECT_SAMPLE, url, '1234567');
  expect(s.title).toBe(/* назва з фікстури */);
  expect(s.originalKey).toBe(/* {key} з фікстури */);
  expect(s.source).toBe('SongSelect');
  expect(s.sourceUrl).toBe(url);
  expect(s.ccliNumber).toBe('1234567');
  expect(s.chordsOrigin).toBe('manual');
});

test('підвал SongSelect не потрапляє в текст, копірайт іде в license', () => {
  const s = parseSongSelect(SONGSELECT_SAMPLE, url, '1234567');
  expect(s.body).not.toMatch(/CCLI|SongSelect|©/);
  expect(s.license).toMatch(/©|\d{4}/);
});

test('без {key} тональність вгадується з акордів', () => {
  const s = parseSongSelect('{title: Тест}\n[G]Слова [C]тут [D]ось [G]так', url, '1');
  expect(s.originalKey).toBe('G');
});

test('мінорна тональність з дієзом зберігається', () => {
  expect(parseSongSelect('{title: Т}\n{key: C#m}\n[C#m]а', url, '1').originalKey).toBe('C#m');
});

test('автори з SongSelect переходять в artist', () => {
  // директива, у якій SongSelect пише авторів (з Task 1), → s.artist
});

test('порожній ChordPro без назви — помилка', () => {
  expect(() => parseSongSelect('', url, '1')).toThrow();
});
```

- [ ] **Step 2:** Run `npx vitest run src/songselect/parseSongSelect.test.ts`. Очікується FAIL: модуль не знайдено.
- [ ] **Step 3:** Додати `ccliNumber?: string` у `Song` з коментарем; реалізувати `parseSongSelect`. Підвал відрізати за маркерами, знайденими в Task 1, рядок `©…` записати в `license`. `originalKey = meta.key ?? guessKey(body)`. Порожня назва → `throw new Error('SongSelect: немає назви пісні')`.
- [ ] **Step 4:** Run `npx vitest run src/songselect src/db`. Очікується PASS.
- [ ] **Step 5: Commit** `feat(songselect): parse SongSelect ChordPro into a song`

### Task 3: Збереження з оновленням за номером CCLI

**Files:**
- Create: `src/songselect/importSong.ts`
- Test: `src/songselect/importSong.test.ts`

**Interfaces:**
- Consumes: `parseSongSelect` (Task 2), `saveSong`, `db` з `src/db/db.ts`.
- Produces: `importSongSelect(msg: SongSelectImport): Promise<Song>` і тип `SongSelectImport = { type: 'for-worship/songselect-import'; version: 1; chordPro: string; pageUrl: string; ccliNumber: string }` (експортується з `src/songselect/importSong.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
beforeEach(async () => { await db.songs.clear(); });

test('нову пісню зберігає', async () => {
  const s = await importSongSelect(msg(SONGSELECT_SAMPLE));
  expect(await getSong(s.id)).toMatchObject({ ccliNumber: '1234567', source: 'SongSelect' });
});

test('повторний імпорт оновлює ту саму пісню без дубля', async () => {
  const a = await importSongSelect(msg(SONGSELECT_SAMPLE));
  const b = await importSongSelect(msg(SONGSELECT_SAMPLE.replace(/\{key:[^}]*\}/, '{key: A}')));
  expect(b.id).toBe(a.id);
  expect(b.createdAt).toBe(a.createdAt);
  expect(b.originalKey).toBe('A');
  expect(await db.songs.count()).toBe(1);
});

test('повторний імпорт не скидає вибрану користувачем тональність і капо', async () => {
  const a = await importSongSelect(msg(SONGSELECT_SAMPLE));
  await saveSong({ ...a, key: 'D', capo: 2 });
  const b = await importSongSelect(msg(SONGSELECT_SAMPLE));
  expect(b).toMatchObject({ key: 'D', capo: 2 });
});
```

(`msg(chordPro)` — локальний хелпер тесту, що будує `SongSelectImport` з номером `1234567`.)

- [ ] **Step 2:** Run `npx vitest run src/songselect/importSong.test.ts`. Очікується FAIL.
- [ ] **Step 3:** Реалізувати: шукати наявну через `db.songs.filter(s => s.ccliNumber === n).first()`; зберегти `{ ...existing, ...parsed, id: existing?.id }`, але `key` і `capo` взяти з `existing`, якщо вони там є.
- [ ] **Step 4:** Run `npx vitest run src/songselect`. Очікується PASS.
- [ ] **Step 5: Commit** `feat(songselect): import song, updating an existing one by CCLI number`

### Task 4: Приймання повідомлень від розширення і відкриття пісні

**Files:**
- Create: `src/songselect/bridge.ts`
- Modify: `src/App.tsx` (підписка; перехід на вкладку «Пісні»)
- Modify: `src/library/LibraryScreen.tsx` (новий проп для відкриття пісні за id)
- Test: `src/songselect/bridge.test.ts`, `src/library/LibraryScreen.test.tsx`

**Interfaces:**
- Consumes: `importSongSelect`, `SongSelectImport` (Task 3).
- Produces: `isSongSelectImport(data: unknown): data is SongSelectImport`; `listenForSongSelect(onImported: (song: Song) => void, onError: (e: Error) => void): () => void` (повертає відписку). `LibraryScreen` отримує проп `openSongId?: string`: коли він змінюється, екран переходить у `{ kind: 'view', id }`.

- [ ] **Step 1: Write the failing tests** (`bridge.test.ts`)

```ts
const post = (data: unknown, origin = window.location.origin) =>
  window.dispatchEvent(new MessageEvent('message', { data, origin }));

test('валідне повідомлення імпортує пісню і викликає onImported', async () => {
  const onImported = vi.fn();
  const off = listenForSongSelect(onImported, vi.fn());
  post(msg(SONGSELECT_SAMPLE));
  await vi.waitFor(() => expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ ccliNumber: '1234567' })));
  off();
});

test.each([
  ['інший origin', msg(SONGSELECT_SAMPLE), 'https://evil.example'],
  ['інший type', { ...msg(SONGSELECT_SAMPLE), type: 'x' }, undefined],
  ['інша версія', { ...msg(SONGSELECT_SAMPLE), version: 2 }, undefined],
  ['порожній chordPro', msg(''), undefined],
])('%s — ігнорується', async (_, data, origin) => {
  const onImported = vi.fn();
  const off = listenForSongSelect(onImported, vi.fn());
  post(data, origin);
  await new Promise((r) => setTimeout(r, 50));
  expect(onImported).not.toHaveBeenCalled();
  expect(await db.songs.count()).toBe(0);
  off();
});

test('помилка розбору йде в onError', async () => { /* chordPro без назви → onError викликано */ });
```

У `LibraryScreen.test.tsx`: рендер з `openSongId` наявної пісні → видно її назву на екрані пісні.

- [ ] **Step 2:** Run `npx vitest run src/songselect src/library/LibraryScreen.test.tsx`. Очікується FAIL.
- [ ] **Step 3:** Реалізувати `bridge.ts`. В `App.tsx`: `useEffect` з `listenForSongSelect`; при імпорті `setTab('songs')`, встановити `openSongId`, показати тост «Додано з SongSelect: <назва>»; при помилці тост «SongSelect: не вдалося додати пісню». Прокинути `openSongId` у `LibraryScreen`.
- [ ] **Step 4:** Run `npm test`. Очікується PASS усіх тестів.
- [ ] **Step 5: Commit** `feat(songselect): receive songs from the extension and open them`

### Task 5: «Шукати на SongSelect» у програмі

**Files:**
- Create: `src/songselect/searchUrl.ts`
- Modify: `src/library/LibraryScreen.tsx` (кнопка біля дій пошуку, поруч із наявною «Додати» в рядку 344)
- Test: `src/songselect/searchUrl.test.ts`, `src/library/LibraryScreen.test.tsx`

**Interfaces:**
- Produces: `songSelectSearchUrl(query: string): string`.

- [ ] **Step 1: Write the failing tests**

```ts
test('кодує запит', () => {
  expect(songSelectSearchUrl('  Amazing Grace ')).toBe('https://songselect.ccli.com/search/results?search=Amazing%20Grace');
});
test('порожній запит — сторінка пошуку без параметра', () => {
  expect(songSelectSearchUrl('')).toBe('https://songselect.ccli.com/search/results');
});
```

У `LibraryScreen.test.tsx`: ввести «Amazing Grace», натиснути «Шукати на SongSelect» → `window.open` викликано з адресою вище і `'_blank'`.

- [ ] **Step 2:** Run `npx vitest run src/songselect/searchUrl.test.ts src/library/LibraryScreen.test.tsx`. Очікується FAIL.
- [ ] **Step 3:** Реалізувати функцію й кнопку (`window.open(url, '_blank', 'noopener')`), стиль як у сусідніх кнопок, іконка з наявного набору.
- [ ] **Step 4:** Run `npm test`. Очікується PASS.
- [ ] **Step 5: Commit** `feat(songselect): search SongSelect from the library screen`

### Task 6: Транспонування акордів SongSelect

**Files:**
- Test: `src/music/chords.test.ts`, `src/music/chordpro.test.ts`
- Modify (лише якщо тести впадуть): `src/music/chords.ts`, `src/music/chordpro.ts`

**Interfaces:**
- Consumes: `transposeChord(chord, semitones, preferFlats)`, `transposeDoc`, `keyPrefersFlats`, `semitonesBetween`.

- [ ] **Step 1: Write the tests**

```ts
test.each([
  ['D/F#', 2, false, 'E/G#'],
  ['G/B', 1, true, 'Ab/C'],      // G → Ab, бас B → C
  ['Gsus', 2, false, 'Asus'],
  ['Asus4', -2, false, 'Gsus4'],
  ['A7sus4', 3, true, 'C7sus4'],
  ['C2', 3, true, 'Eb2'],
  ['Dadd9', 1, true, 'Ebadd9'],
  ['Fmaj7', 2, false, 'Gmaj7'],
  ['Bm7b5', 1, false, 'Cm7b5'],
  ['F#dim7', -1, false, 'Fdim7'],
  ['Eaug', 1, true, 'Faug'],
  ['Bbm', 2, false, 'Cm'],
  ['C#m7', 1, false, 'Dm7'],
])('%s на %i (бемолі: %s) → %s', (chord, n, flats, expected) => {
  expect(transposeChord(chord, n, flats)).toBe(expected);
});

test.each(['N.C.', '(2x)', '|', 'x2'])('%s не змінюється', (s) => {
  expect(transposeChord(s, 3, false)).toBe(s);
});

test('пісня з G у Eb: бемолі, бас транспонується', () => {
  // transposeDoc(parseChordPro('[G]а [D/F#]б [Em7]в [Cadd9]г'), semitonesBetween('G','Eb'), keyPrefersFlats('Eb'))
  // → акорди Eb, Bb/D, Cm7, Abadd9
});
```

У `chordpro.test.ts` додати: `parseChordPro(SONGSELECT_SAMPLE)` → `transposeDoc` на +2 → кожен акорд у результаті розпізнається `isChord` або лишився без змін, і текст рядків не змінився.

- [ ] **Step 2:** Run `npx vitest run src/music`. Записати, які впали.
- [ ] **Step 3:** Виправити `QUALITY`/`CHORD_RE` чи `transposeDoc` лише під ті, що впали; не розширювати регулярний вираз так, щоб звичайні слова тексту ставали акордами (наявні тести `isChord` мають лишитися зеленими).
- [ ] **Step 4:** Run `npm test`. Очікується PASS.
- [ ] **Step 5: Commit** `test(music): cover SongSelect chord shapes in transposition`

### Task 7: Розширення Chrome

**Files:**
- Create: `extension/manifest.json`, `extension/lib.js`, `extension/songselect.js`, `extension/app-bridge.js`, `extension/background.js`, `extension/icons/` (копії `public/icons/icon-192.png` → 48 і 128 через ті самі файли)
- Create: `extension/README.md` (як встановити: chrome://extensions → Режим розробника → «Завантажити розпаковане» → папка `extension`)
- Test: `src/songselect/extensionLib.test.ts`

**Interfaces:**
- Consumes: формат повідомлення з Global Constraints; знахідки Task 1 (ендпоінт ChordPro).
- Produces: `extension/lib.js` — класичний скрипт, що визначає `globalThis.ForWorshipExt = { MESSAGE_TYPE, VERSION, APP_ORIGINS, songNumberFromUrl(url: string): string | null, isChordSheetUrl(url: string): boolean, buildImportMessage(chordPro: string, pageUrl: string, ccliNumber: string) }`. `MESSAGE_TYPE`, `VERSION` збігаються з `src/songselect/importSong.ts`.

- [ ] **Step 1: Write the failing tests** (`extensionLib.test.ts`: `await import('../../extension/lib.js')`, далі `globalThis.ForWorshipExt`)

```ts
test('номер пісні з адреси', () => {
  expect(ext.songNumberFromUrl('https://songselect.ccli.com/songs/4768151/amazing-grace-my-chains-are-gone/viewchordsheet')).toBe('4768151');
  expect(ext.songNumberFromUrl('https://songselect.ccli.com/search/results?search=x')).toBeNull();
});
test('розпізнає сторінку акордів', () => {
  expect(ext.isChordSheetUrl('https://songselect.ccli.com/songs/1/x/viewchordsheet')).toBe(true);
  expect(ext.isChordSheetUrl('https://songselect.ccli.com/songs/1/x/viewlyrics')).toBe(false);
});
test('повідомлення відповідає тому, що чекає програма', () => {
  const m = ext.buildImportMessage(SONGSELECT_SAMPLE, url, '1234567');
  expect(isSongSelectImport(m)).toBe(true);
});
```

- [ ] **Step 2:** Run `npx vitest run src/songselect/extensionLib.test.ts`. Очікується FAIL.
- [ ] **Step 3:** Реалізувати `lib.js`. Решта розширення:
  - `manifest.json`: MV3, `name: "For Worship — SongSelect"`, `permissions: ["tabs"]`, `host_permissions` лише `https://songselect.ccli.com/*` і адреси програми; content scripts: `[lib.js, songselect.js]` на `https://songselect.ccli.com/*`, `[lib.js, app-bridge.js]` на адресах програми; `background.service_worker: background.js`.
  - `songselect.js`: стежить за зміною адреси (SPA: `setInterval` або `MutationObserver` + перевірка `location.href`); на сторінці акордів додає кнопку «Додати в For Worship» біля панелі дій аркуша; при натисканні отримує ChordPro запитом із Task 1 (`credentials: 'include'`), будує повідомлення, шле `chrome.runtime.sendMessage`; стан кнопки «Додаю…» → «Додано ✓» / «Помилка» за відповіддю.
  - `background.js`: шукає вкладку програми (`chrome.tabs.query` за `APP_ORIGINS`), інакше створює її й чекає `status: 'complete'`; пересилає повідомлення через `chrome.tabs.sendMessage`; відповідає content script `{ ok: true }` або `{ ok: false, error }`; активує вкладку програми.
  - `app-bridge.js`: на `chrome.runtime.onMessage` робить `window.postMessage(msg, location.origin)`.
- [ ] **Step 4:** Run `npm test`. Очікується PASS.
- [ ] **Step 5: Commit** `feat(extension): Chrome extension that sends a SongSelect song to the app`

### Task 8: Перевірка наживо

- [ ] **Step 1:** Запустити програму (`npm run dev`, порт 5173) через preview.
- [ ] **Step 2:** Попросити користувача встановити розширення з папки `extension` (chrome://extensions, «Завантажити розпаковане»). Сам цього не робити.
- [ ] **Step 3:** У програмі ввести «Amazing Grace» → «Шукати на SongSelect» → відкрилися результати.
- [ ] **Step 4:** Відкрити сторінку акордів пісні → «Додати в For Worship» → кнопка «Додано ✓», програма показує пісню з назвою, авторами, тональністю, посиланням.
- [ ] **Step 5:** Змінити тональність кнопками ±, вибрати бемольну (Eb) і мінорну пісню — звірити кілька акордів із тим самим аркушем на SongSelect у тій самій тональності (у SongSelect є свій «Transpose Key»).
- [ ] **Step 6:** Натиснути кнопку вдруге → у списку одна пісня, не дві.
- [ ] **Step 7:** Записати знайдені розбіжності; виправити через окремі тести у відповідних задачах; commit `fix(...)` за потреби.
