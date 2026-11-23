# Імпорт пісень із SongSelect одною кнопкою — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Кнопка «Додати в For Worship» на сторінці акордів SongSelect одним натисканням зберігає пісню в програмі; з програми можна шукати на SongSelect; транспонування коректне для акордів SongSelect.

**Architecture:** Розширення Chrome (Manifest V3, plain JS у `extension/`) на songselect.com отримує HTML аркуша акордів (`/api/GetSongChordsHTML`) і передає його у вкладку програми; content script на адресі програми пересилає дані сторінці через `window.postMessage`. Програма (`src/songselect/`) перевіряє повідомлення, перетворює HTML у ChordPro і метадані, зберігає через `saveSong`, оновлюючи пісню з тим самим номером CCLI.

**Tech Stack:** React 18 + TypeScript + Vite PWA, Dexie (IndexedDB), Vitest + Testing Library (jsdom) + fake-indexeddb, Chrome Extension MV3.

**Spec:** `docs/superpowers/specs/2026-11-22-songselect-import-design.md` (розділи «Що з'ясовано на SongSelect» і «Дизайн» — точна структура HTML).

## Global Constraints

- Жодних паролів чи cookie SongSelect у програмі чи сховищі розширення; запити до SongSelect робить лише content script на songselect.com з cookie сторінки.
- Один імпорт = одна пісня, яку користувач відкрив і натиснув кнопку. Жодного обходу сторінок.
- Адреси програми, дозволені в розширенні: `http://localhost:5173/*` (адреса публікації додається пізніше одним рядком у `extension/manifest.json` і `extension/lib.js`).
- Повідомлення між розширенням і програмою: `{ type: 'for-worship/songselect-import', version: 1, html: string, pageUrl: string, ccliNumber: string }`.
- Пісня з SongSelect: `source: 'SongSelect'`, `sourceUrl` = адреса сторінки, `chordsOrigin: 'manual'`, `ccliNumber`.
- Номер ліцензії церкви (`.licenseno`) і дисклеймер (`.disclaimer`) ніде не зберігаються.
- Тексти інтерфейсу українською: «Шукати на SongSelect», «Додати в For Worship», «Додаю…», «Додано ✓», «Помилка».
- Залежне від ендпоінтів і розмітки сторінки SongSelect (не аркуша) живе лише в `extension/songselect.js`; розбір HTML аркуша — лише в `src/songselect/parseSongSelectHtml.ts`.
- У репозиторій не комітимо справжні тексти пісень SongSelect: фікстура синтетична, лише повторює структуру HTML.

## Review Focus

1. Пісню, вже імпортовану раніше, імпортують знову → оновлюється та сама пісня (той самий `id`, `createdAt`, вибрані `key`/`capo`), без дубля — тест у Task 2.
2. Чуже `postMessage` (інший origin, інший `type`, `version` ≠ 1, порожній `html`) → ігнорується, нічого не зберігається — тести в Task 3.
3. Акорд, видимий текст якого має `<sup>` (`Gm<sup>7</sup>`), береться з `data-chordname` (`Gm7`), а не з тексту — тест у Task 1.
4. Акорд над пробілом (порожній склад `.chordLyrics` = « ») і кілька пробілів між словами → позиції акордів не зсуваються, зайві пробіли в кінці рядка прибрані — тест у Task 1.
5. Нестандартні позначки (`N.C.`, `(2x)`, `|`) при транспонуванні лишаються як є — тест у Task 5.

---

### Task 1: Фікстура і перетворення HTML аркуша в пісню

**Files:**
- Modify: `src/db/db.ts` (тип `Song`: нове поле)
- Create: `src/songselect/fixtures.ts`, `src/songselect/parseSongSelectHtml.ts`
- Test: `src/songselect/parseSongSelectHtml.test.ts`

**Interfaces:**
- Consumes: `parseChordPro` з `src/music/chordpro.ts` (перевірка, що результат читається); тип `SongInput`, `TimeSig` з `src/db/db.ts`.
- Produces: у `Song` — `ccliNumber?: string` (номер пісні CCLI; не індексується, версія Dexie не змінюється). `SONGSELECT_SAMPLE_HTML: string` у `fixtures.ts`. `parseSongSelectHtml(html: string, pageUrl: string, ccliNumber: string): SongInput`.

`SONGSELECT_SAMPLE_HTML` — вигаданий текст у точній структурі зі специфікації: заголовок (`.cproTitle` «Тестова пісня», `.cproAuthors` «Автор Один, Автор Два», `.cproAuthor2`, `code.cproSongKey data-chordname="G"`, `.cproTempoTimeWrapper` «Tempo - 72 | Time - 4/4»), дві частини (`.cproComment` «Verse 1», «Chorus»), рядки з `.chordWrapper` для `G`, `D/F#`, `Em<sup>7</sup>` (`data-chordname="Em7"`), `Cadd9`, один акорд над « », один `.cproDirectionWrapper` «(To Chorus)», і `.copyright-info` з `.songnumber` «CCLI Song # 1234567», двома `li` («© 2020 Test Music», «Test Publishing»), `.disclaimer`, `.licenseno` «CCLI License # 99999999».

- [ ] **Step 1: Write the failing tests**

```ts
const url = 'https://songselect.ccli.com/songs/1234567/test-song/viewchordsheet';
const s = () => parseSongSelectHtml(SONGSELECT_SAMPLE_HTML, url, '1234567');

test('метадані', () => {
  expect(s()).toMatchObject({
    title: 'Тестова пісня', artist: 'Автор Один, Автор Два', originalKey: 'G', bpm: 72, timeSig: '4/4',
    source: 'SongSelect', sourceUrl: url, ccliNumber: '1234567', chordsOrigin: 'manual',
    license: '© 2020 Test Music | Test Publishing',
  });
});

test('частини стають {c: …}, акорди стоять перед складом', () => {
  const body = s().body;
  expect(body).toMatch(/^\{c: Verse 1\}$/m);
  expect(body).toMatch(/^\{c: Chorus\}$/m);
  // перший рядок фікстури: точний очікуваний ChordPro-рядок
});

test('назва акорду з data-chordname, не з видимого тексту з <sup>', () => {
  expect(s().body).toContain('[Em7]');
});

test('акорд над пробілом і пробіли між словами не зсувають позицій', () => {
  // рядок фікстури з акордом над « » → очікуваний рядок, без пробілів у кінці
});

test('напрямок «(To Chorus)» лишається в тексті', () => {
  expect(s().body).toContain('(To Chorus)');
});

test('ні номера ліцензії церкви, ні дисклеймера', () => {
  const all = JSON.stringify(s());
  expect(all).not.toMatch(/99999999|License|Terms of Use|CCLI/);
});

test('результат читається parseChordPro: дві частини, усі акорди розпізнані', () => {
  const doc = parseChordPro(s().body);
  expect(doc.sections.map((x) => x.label)).toEqual(['Verse 1', 'Chorus']);
});

test('HTML без .cproTitle — помилка', () => {
  expect(() => parseSongSelectHtml('<pre class="cproSongBody"></pre>', url, '1')).toThrow();
});

test('без тempo/time — поля не заповнюються; розмір не з 4/4,3/4,6/8 — ігнорується', () => { /* … */ });
```

(`SongSection.label` з `src/music/song.ts`; `parseChordPro` розпізнає `{c: …}` як початок частини.)

- [ ] **Step 2:** Run `npx vitest run src/songselect`. Очікується FAIL: модуль не знайдено.
- [ ] **Step 3:** Додати `ccliNumber?: string` у `Song` з коментарем; реалізувати `parseSongSelectHtml` через `new DOMParser().parseFromString(html, 'text/html')`. Рядок: обійти дочірні вузли `.cproSongLine` — текстовий вузол додає текст; `.chordWrapper` додає `[${data-chordname}]` + текст `.chordLyrics`; `.cproDirectionWrapper` додає текст `.cproDirection`. Рядок `trimEnd()`. Між частинами — порожній рядок. Темп/розмір — регулярним виразом з `.cproTempoTimeWrapper`. Без `.cproTitle` → `throw new Error('SongSelect: немає назви пісні')`.
- [ ] **Step 4:** Run `npx vitest run src/songselect src/db`. Очікується PASS.
- [ ] **Step 5: Commit** `feat(songselect): convert SongSelect chord sheet HTML into a song`

### Task 2: Збереження з оновленням за номером CCLI

**Files:**
- Create: `src/songselect/importSong.ts`
- Test: `src/songselect/importSong.test.ts`

**Interfaces:**
- Consumes: `parseSongSelectHtml`, `SONGSELECT_SAMPLE_HTML` (Task 1); `saveSong`, `getSong`, `db` з `src/db/db.ts`.
- Produces: тип `SongSelectImport = { type: 'for-worship/songselect-import'; version: 1; html: string; pageUrl: string; ccliNumber: string }` і `importSongSelect(msg: SongSelectImport): Promise<Song>` у `src/songselect/importSong.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
beforeEach(async () => { await db.songs.clear(); });

test('нову пісню зберігає', async () => {
  const s = await importSongSelect(msg(SONGSELECT_SAMPLE_HTML));
  expect(await getSong(s.id)).toMatchObject({ ccliNumber: '1234567', source: 'SongSelect' });
});

test('повторний імпорт оновлює ту саму пісню без дубля', async () => {
  const a = await importSongSelect(msg(SONGSELECT_SAMPLE_HTML));
  const b = await importSongSelect(msg(SONGSELECT_SAMPLE_HTML.replace('data-chordname="G">G</code> |', 'data-chordname="A">A</code> |')));
  expect(b.id).toBe(a.id);
  expect(b.createdAt).toBe(a.createdAt);
  expect(b.originalKey).toBe('A');
  expect(await db.songs.count()).toBe(1);
});

test('повторний імпорт не скидає вибрану користувачем тональність і капо', async () => {
  const a = await importSongSelect(msg(SONGSELECT_SAMPLE_HTML));
  await saveSong({ ...a, key: 'D', capo: 2 });
  expect(await importSongSelect(msg(SONGSELECT_SAMPLE_HTML))).toMatchObject({ key: 'D', capo: 2 });
});
```

(`msg(html)` — хелпер тесту: `SongSelectImport` з номером `1234567` і адресою сторінки. Рядок заміни тональності підігнати під точну розмітку фікстури.)

- [ ] **Step 2:** Run `npx vitest run src/songselect/importSong.test.ts`. Очікується FAIL.
- [ ] **Step 3:** Реалізувати: наявна — `db.songs.filter(s => s.ccliNumber === n).first()`; зберегти `{ ...existing, ...parsed, id: existing?.id }`, `key` і `capo` з `existing`, якщо вони там є.
- [ ] **Step 4:** Run `npx vitest run src/songselect`. Очікується PASS.
- [ ] **Step 5: Commit** `feat(songselect): import song, updating an existing one by CCLI number`

### Task 3: Приймання повідомлень від розширення і відкриття пісні

**Files:**
- Create: `src/songselect/bridge.ts`
- Modify: `src/App.tsx` (підписка; перехід на вкладку «Пісні»; тост)
- Modify: `src/library/LibraryScreen.tsx` (проп для відкриття пісні за id)
- Test: `src/songselect/bridge.test.ts`, `src/library/LibraryScreen.test.tsx`

**Interfaces:**
- Consumes: `importSongSelect`, `SongSelectImport` (Task 2).
- Produces: `isSongSelectImport(data: unknown): data is SongSelectImport` (порожній `html` → false); `listenForSongSelect(onImported: (song: Song) => void, onError: (e: Error) => void): () => void` (повертає відписку; приймає лише `event.origin === window.location.origin`). `LibraryScreen` отримує проп `openSongId?: string`: коли він змінюється, екран переходить у `{ kind: 'view', id }`.

- [ ] **Step 1: Write the failing tests** (`bridge.test.ts`)

```ts
const post = (data: unknown, origin = window.location.origin) =>
  window.dispatchEvent(new MessageEvent('message', { data, origin }));

test('валідне повідомлення імпортує пісню і викликає onImported', async () => {
  const onImported = vi.fn();
  const off = listenForSongSelect(onImported, vi.fn());
  post(msg(SONGSELECT_SAMPLE_HTML));
  await vi.waitFor(() => expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ ccliNumber: '1234567' })));
  off();
});

test.each([
  ['інший origin', msg(SONGSELECT_SAMPLE_HTML), 'https://evil.example'],
  ['інший type', { ...msg(SONGSELECT_SAMPLE_HTML), type: 'x' }, undefined],
  ['інша версія', { ...msg(SONGSELECT_SAMPLE_HTML), version: 2 }, undefined],
  ['порожній html', msg(''), undefined],
])('%s — ігнорується', async (_, data, origin) => {
  const onImported = vi.fn();
  const off = listenForSongSelect(onImported, vi.fn());
  post(data, origin);
  await new Promise((r) => setTimeout(r, 50));
  expect(onImported).not.toHaveBeenCalled();
  expect(await db.songs.count()).toBe(0);
  off();
});

test('помилка розбору йде в onError', async () => {
  // html без .cproTitle → onError викликано один раз, onImported — ні, пісень 0
});
```

У `LibraryScreen.test.tsx`: рендер з `openSongId` наявної пісні → видно її назву на екрані пісні.

- [ ] **Step 2:** Run `npx vitest run src/songselect src/library/LibraryScreen.test.tsx`. Очікується FAIL.
- [ ] **Step 3:** Реалізувати `bridge.ts`. В `App.tsx`: `useEffect` з `listenForSongSelect`; при імпорті `setTab('songs')`, встановити `openSongId`, тост «Додано з SongSelect: <назва>»; при помилці тост «SongSelect: не вдалося додати пісню». Тост — найпростіше без нової глобальної стейт-бібліотеки (на розсуд виконавця).
- [ ] **Step 4:** Run `npm test`. Очікується PASS усіх тестів.
- [ ] **Step 5: Commit** `feat(songselect): receive songs from the extension and open them`

### Task 4: «Шукати на SongSelect» у програмі

**Files:**
- Create: `src/songselect/searchUrl.ts`
- Modify: `src/library/LibraryScreen.tsx` (кнопка біля дій пошуку, поруч із наявною кнопкою додавання пісні)
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

У `LibraryScreen.test.tsx`: ввести «Amazing Grace», натиснути «Шукати на SongSelect» → `window.open` викликано з адресою вище, `'_blank'` і `'noopener'`.

- [ ] **Step 2:** Run `npx vitest run src/songselect/searchUrl.test.ts src/library/LibraryScreen.test.tsx`. Очікується FAIL.
- [ ] **Step 3:** Реалізувати функцію й кнопку, стиль як у сусідніх кнопок, іконка з наявного набору.
- [ ] **Step 4:** Run `npm test`. Очікується PASS.
- [ ] **Step 5: Commit** `feat(songselect): search SongSelect from the library screen`

### Task 5: Транспонування акордів SongSelect

**Files:**
- Test: `src/music/chords.test.ts`, `src/music/chordpro.test.ts`
- Modify (лише якщо тести впадуть): `src/music/chords.ts`, `src/music/chordpro.ts`

**Interfaces:**
- Consumes: `transposeChord(chord, semitones, preferFlats)`, `transposeDoc`, `keyPrefersFlats`, `semitonesBetween`; `parseSongSelectHtml`, `SONGSELECT_SAMPLE_HTML` (Task 1).

- [ ] **Step 1: Write the tests**

```ts
test.each([
  ['D/F#', 2, false, 'E/G#'],
  ['G/B', 1, true, 'Ab/C'],
  ['Bb/F', 2, false, 'C/G'],
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

У `chordpro.test.ts`: `parseChordPro(parseSongSelectHtml(SONGSELECT_SAMPLE_HTML, url, '1').body)` → `transposeDoc` на +2 → акорди `A`, `E/G#`, `F#m7`, `Dadd9`; текст рядків не змінився.

- [ ] **Step 2:** Run `npx vitest run src/music`. Записати, які впали.
- [ ] **Step 3:** Виправити `QUALITY`/`CHORD_RE` чи `transposeDoc` лише під ті, що впали; наявні тести `isChord` мають лишитися зеленими (звичайні слова не стають акордами).
- [ ] **Step 4:** Run `npm test`. Очікується PASS.
- [ ] **Step 5: Commit** `test(music): cover SongSelect chord shapes in transposition`

### Task 6: Розширення Chrome

**Files:**
- Create: `extension/manifest.json`, `extension/lib.js`, `extension/lib.d.ts`, `extension/songselect.js`, `extension/app-bridge.js`, `extension/background.js`, `extension/icons/` (з `public/icons`)
- Create: `extension/README.md` (українською: як встановити — chrome://extensions → «Режим розробника» → «Завантажити розпаковане» → папка `extension`; як додати адресу публікації)
- Test: `src/songselect/extensionLib.test.ts`

**Interfaces:**
- Consumes: формат повідомлення з Global Constraints; `isSongSelectImport` (Task 3); `SONGSELECT_SAMPLE_HTML` (Task 1).
- Produces: `extension/lib.js` — класичний скрипт, що визначає `globalThis.ForWorshipExt = { MESSAGE_TYPE, VERSION, APP_ORIGINS, songNumberFromUrl(url: string): string | null, isChordSheetUrl(url: string): boolean, chordsHtmlUrl(songNumber: string, key: string): string, buildImportMessage(html: string, pageUrl: string, ccliNumber: string) }`; `lib.d.ts` описує ці типи, щоб `npm run build` (`tsc -b`) лишався зеленим.

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
test('адреса аркуша акордів', () => {
  expect(ext.chordsHtmlUrl('4768151', 'F#')).toBe('/api/GetSongChordsHTML?songNumber=4768151&key=F%23&style=Standard&columns=1&enableFontCustomization=0');
});
test('повідомлення відповідає тому, що чекає програма', () => {
  expect(isSongSelectImport(ext.buildImportMessage(SONGSELECT_SAMPLE_HTML, url, '1234567'))).toBe(true);
});
```

- [ ] **Step 2:** Run `npx vitest run src/songselect/extensionLib.test.ts`. Очікується FAIL.
- [ ] **Step 3:** Реалізувати `lib.js`, `lib.d.ts`. Решта розширення:
  - `manifest.json`: MV3, `name: "For Worship — SongSelect"`, `permissions: ["tabs"]`, `host_permissions` лише `https://songselect.ccli.com/*` і адреси програми; content scripts: `[lib.js, songselect.js]` на `https://songselect.ccli.com/*`, `[lib.js, app-bridge.js]` на адресах програми; `background.service_worker: background.js`.
  - `songselect.js`: стежить за зміною `location.href` (SPA); на сторінці акордів додає кнопку «Додати в For Worship» біля панелі дій аркуша (один раз). При натисканні: тональність з `#ChordSheetTransposeKeySelectInput` (значення поля), інакше `code.cproSongKey[data-chordname]`; `fetch(chordsHtmlUrl(…), { credentials: 'include' })`; `isSuccess !== true` або порожній `payload` → «Помилка»; інакше `chrome.runtime.sendMessage(buildImportMessage(payload, location.href, номер))`; стан кнопки «Додаю…» → «Додано ✓» / «Помилка» за відповіддю.
  - `background.js`: шукає вкладку програми (`chrome.tabs.query` за `APP_ORIGINS`), інакше створює її й чекає `status: 'complete'`; пересилає `chrome.tabs.sendMessage`; відповідає `{ ok: true }` або `{ ok: false, error }`; активує вкладку програми.
  - `app-bridge.js`: на `chrome.runtime.onMessage` перевіряє `type`/`version` і робить `window.postMessage(msg, location.origin)`.
- [ ] **Step 4:** Run `npm test && npm run build`. Очікується PASS і успішна збірка.
- [ ] **Step 5: Commit** `feat(extension): Chrome extension that sends a SongSelect song to the app`

### Task 7: Перевірка наживо

- [ ] **Step 1:** Запустити програму (`npm run dev`, порт 5173) через preview.
- [ ] **Step 2:** Попросити користувача встановити розширення з папки `extension` (chrome://extensions, «Завантажити розпаковане»). Сам цього не робити.
- [ ] **Step 3:** У програмі ввести «Amazing Grace» → «Шукати на SongSelect» → відкрилися результати.
- [ ] **Step 4:** Відкрити сторінку акордів пісні → «Додати в For Worship» → «Додано ✓», програма показує пісню з назвою, авторами, тональністю, посиланням.
- [ ] **Step 5:** Змінити тональність, вибрати бемольну (Eb) — звірити кілька акордів із аркушем SongSelect у тій самій тональності (у SongSelect свій «Transpose Key»).
- [ ] **Step 6:** Натиснути кнопку вдруге → у списку одна пісня.
- [ ] **Step 7:** Розбіжності виправити з тестами у відповідних модулях; commit `fix(...)` за потреби.
