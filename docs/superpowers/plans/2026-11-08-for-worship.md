# For Worship: план розробки

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Мета:** PWA для Android-планшета: пісні з акордами на один екран, служіння зі свайпом, тюнер, метроном, пошук і фото через Gemini.

**Архітектура:** Односторінковий React-застосунок без сервера. Дані на планшеті в IndexedDB (Dexie). Музична логіка (акорди, ChordPro, тюнер, метроном) складається з чистих функцій із тестами, а UI лише викликає їх. ШІ винесено за інтерфейс `AiProvider`; у першій версії реалізовано Gemini.

**Технології:** Node 22, Vite, React 18, TypeScript (strict), Vitest + @testing-library/react + jsdom, fake-indexeddb, Dexie 4, vite-plugin-pwa, pitchy.

**Опис:** `docs/specs/2026-11-08-for-worship-design.md` (виконавець читає його разом із планом).

## Загальні обмеження

- Інтерфейс лише українською. Пісні можуть бути українською, російською чи англійською.
- Горизонтальний планшет. Темна тема: фон `#0f1012`, акорди `#f5b841`, назви частин `#7fb3ff`, «точно» `#5fd38d` (CSS-змінні в `src/styles/theme.css`).
- Нижня навігація: **Пісні**, **Служіння**, **Тюнер**, **Метроном**; налаштування через ⚙ у верхньому куті екрана «Пісні».
- Позначення акорду **B** (не H).
- Шрифт пісні: максимум 28px, мінімум 14px. Якщо пісня не влазить навіть на 14px, з'являється вертикальна прокрутка.
- Свайп: |dx| ≥ 80px і переважно горизонтальний; працює лише в режимі служіння.
- Метроном: BPM 30–250; розміри 4/4, 3/4, 6/8.
- Тюнер: A4 = 440 Гц, стрій E2 A2 D3 G3 B3 E4.
- Офлайн: усе, крім пошуку й фото, працює без мережі.
- Ключ Gemini зберігається лише на пристрої; надсилається в заголовку `x-goog-api-key`, ніколи в URL.
- Помилки показуються користувачу українською, без технічного жаргону.

## На що звернути увагу під час перевірки

1. **Рядок слів, схожий на акорди** (англ. «Am I a soldier», «A new day»): він не повинен розпізнаватися як рядок акордів (тест у Задачі 3).
2. **Дуже довга пісня** (60+ рядків): шрифт опускається до 14px, далі з'являється прокрутка, а не обрізаний текст (тест у Задачі 5).
3. **Вертикальна прокрутка з невеликим зсувом убік** не повинна перемикати пісню (тест у Задачі 7).
4. **Тиша або шум перед тюнером:** показувати «—», а не стрибати по нотах (тест у Задачі 9).
5. **Відповідь Gemini у ```-обгортці, з поясненнями або без жодної пісні:** обгортку прибрати, порожню відповідь показати зрозумілою помилкою (тест у Задачі 11).

---

### Task 1: Каркас проєкту, тема, навігація

**Файли:**
- Створити: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/theme.css`, `src/components/BottomNav.tsx`, `src/test/setup.ts`, `.gitignore` (містить `node_modules`, `dist`, `.superpowers/`)
- Тест: `src/App.test.tsx`

**Інтерфейси:**
- Створює: `type Tab = 'songs' | 'service' | 'tuner' | 'metronome'`; `<App />` тримає активну вкладку в стані; `BottomNav({active, onChange})`.

- [ ] **Крок 1:** `git init`, створити Vite React-TS проєкт у корені папки, встановити залежності (див. «Технології»), налаштувати Vitest (`environment: 'jsdom'`, `setupFiles: src/test/setup.ts` з `fake-indexeddb/auto` та `@testing-library/jest-dom`). Скрипти: `dev`, `build`, `test` (`vitest run`).
- [ ] **Крок 2: Написати тест, що падає** `App.test.tsx`: «показує 4 вкладки» (знаходить кнопки з текстом `Пісні`, `Служіння`, `Тюнер`, `Метроном`); «перемикає вкладку» (клік «Тюнер» додає `aria-current="page"` цій кнопці).
- [ ] **Крок 3:** `npm test`, очікується FAIL.
- [ ] **Крок 4:** Реалізувати App + BottomNav + theme.css (CSS-змінні з «Загальних обмежень»; `html,body{height:100%;margin:0;background:var(--bg)}`; на весь екран без прокрутки сторінки). Вкладки поки показують заглушки-заголовки.
- [ ] **Крок 5:** `npm test`, очікується PASS; `npm run build` без помилок.
- [ ] **Крок 6:** Коміт `feat: scaffold app shell with bottom navigation`.

### Task 2: Акорди й транспонування

**Файли:** Створити `src/music/chords.ts`; тест `src/music/chords.test.ts`

**Інтерфейси:**
- Створює:
  - `parseChord(s: string): {root: string; quality: string; bass?: string} | null` (корінь A–G з `#`/`b`; `null`, якщо це не акорд)
  - `isChord(s: string): boolean`
  - `transposeChord(chord: string, semitones: number, preferFlats: boolean): string`
  - `keyPrefersFlats(key: string): boolean` (бемолі для F, Bb, Eb, Ab, Db, Gb та мінорів Dm, Gm, Cm, Fm, Bbm, Ebm)
  - `semitonesBetween(fromKey: string, toKey: string): number` (−5…+6)
  - `ALL_KEYS = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B']` (написання тональностей для вибору й для результату − / +; для мінорної пісні додається `m`)

- [ ] **Крок 1: Тести, що падають:**
  - `transposeChord('G', 2, false) === 'A'`; `transposeChord('F#m7', 1, false) === 'Gm7'`; `transposeChord('G/B', -2, true) === 'F/A'`; `transposeChord('Bb', 2, false) === 'C'`; `transposeChord('Csus4', 1, true) === 'Dbsus4'`; `transposeChord('E', 12, false) === 'E'`.
  - `isChord('Am') && isChord('C#m7b5') && isChord('Dsus2') && isChord('A/C#') && isChord('Gmaj7') && isChord('Eadd9')`; `!isChord('I')`, `!isChord('new')`, `!isChord('Ти')`, `!isChord('H')`.
  - `semitonesBetween('D','G') === 5`; `semitonesBetween('G','D') === -5`; `keyPrefersFlats('F') === true`; `keyPrefersFlats('E') === false`.
- [ ] **Крок 2:** Запустити, очікується FAIL.
- [ ] **Крок 3:** Реалізувати. Регулярний вираз для якості: `(m|maj|min|dim|aug|sus|add|M)?\d*(sus\d|add\d+|b\d+|#\d+|maj\d*|\(.*?\))*` з послідовністю нот за індексом 0–11.
- [ ] **Крок 4:** PASS. **Крок 5:** коміт `feat: chord parsing and transposition`.

### Task 3: Формат пісні (ChordPro + «акорди над рядком»)

**Файли:** Створити `src/music/song.ts`, `src/music/chordpro.ts`, `src/music/chordsOverLyrics.ts`; тести `src/music/chordpro.test.ts`, `src/music/chordsOverLyrics.test.ts`

**Інтерфейси:**
- Створює (`song.ts`):
  - `type ChordAt = {pos: number; chord: string}`
  - `type SongLine = {lyrics: string; chords: ChordAt[]}`
  - `type SongSection = {label: string; lines: SongLine[]}`
  - `type SongDoc = {sections: SongSection[]}`
- `parseChordPro(text: string): SongDoc`: розуміє `[G]` в тексті, `{c: Приспів}`, `{start_of_chorus}`/`{soc}`, рядки-мітки на кшталт `Куплет 1:`, `Приспів`, `Припев`, `Chorus`, `Verse 2`, `Bridge`, `Брідж` (з двокрапкою чи без, з `x2`/`×2`) як нову секцію. Текст до першої мітки потрапляє в секцію з `label: ''`.
- `transposeDoc(doc: SongDoc, semitones: number, preferFlats: boolean): SongDoc`
- `chordsOverLyricsToChordPro(text: string): string`
- `isChordLine(line: string): boolean`: усі токени, розділені пробілами, є акордами (або `|`, `-`, `x2`, `(`, `)`), і є хоча б один акорд.
- `looksLikeChordPro(text: string): boolean`: є хоча б один `[Акорд]`.

- [ ] **Крок 1: Тести, що падають:**
  - `parseChordPro('[G]Ти світло в [D]темряві')` дає один рядок `{lyrics:'Ти світло в темряві', chords:[{pos:0,chord:'G'},{pos:11,chord:'D'}]}`.
  - Текст `'Куплет 1:\n[G]А\nПриспів ×2\n[C]Б'` дає 2 секції з мітками `'Куплет 1'` і `'Приспів ×2'`.
  - `chordsOverLyricsToChordPro('G        D\nТи світло в темряві')`, потім `parseChordPro`: акорд D стоїть на позиції 9.
  - Рядок акордів без слів під ним (програш `G D Em C`) зберігається як рядок з порожнім `lyrics` і 4 акордами.
  - **Перевірка 1:** `isChordLine('Am I a soldier') === false`; `isChordLine('A new day') === false`; `isChordLine('A   E   F#m  D') === true`; `isChordLine('Em  C  G  D  x2') === true`.
  - `transposeDoc` з +2 перетворює `G` на `A` у всіх рядках.
- [ ] **Крок 2:** FAIL. **Крок 3:** Реалізувати. **Крок 4:** PASS. **Крок 5:** коміт `feat: song document parsing`.

### Task 4: Сховище (Dexie) та резервна копія

**Файли:** Створити `src/db/db.ts`, `src/db/backup.ts`; тест `src/db/db.test.ts`

**Інтерфейси:**
- Створює:
  - `type Song = {id: string; title: string; artist?: string; body: string /* ChordPro */; originalKey?: string; key?: string; bpm?: number; timeSig?: '4/4'|'3/4'|'6/8'; capo?: number; source?: string; createdAt: number; updatedAt: number}`
  - `type ServiceItem = {songId: string; key?: string}`
  - `type Service = {id: string; title: string; date: string /* YYYY-MM-DD */; items: ServiceItem[]}`
  - `db` (Dexie, таблиці `songs: 'id, title, updatedAt'`, `services: 'id, date'`)
  - `saveSong(s: Omit<Song,'id'|'createdAt'|'updatedAt'> & {id?: string}): Promise<Song>`, `getSong(id)`, `listSongs(query?: string): Promise<Song[]>` (пошук без урахування регістру за назвою, виконавцем і текстом; сортування за назвою з `localeCompare(…,'uk')`), `deleteSong(id)` (також прибирає пісню з усіх служінь)
  - `saveService(s)`, `listServices(): Promise<Service[]>` (новіші спочатку), `deleteService(id)`
  - `exportAll(): Promise<string>` (JSON `{version:1, songs, services}`), `importAll(json: string): Promise<{songs:number; services:number}>` (додає або оновлює за `id`; на неправильний JSON кидає `Error('Файл не схожий на резервну копію For Worship')`)
- Ключ Gemini і налаштування зберігаються в `localStorage` під `fw.settings` (див. Задачу 11), не в Dexie.

- [ ] **Крок 1: Тести, що падають:** збереження й читання пісні; `listSongs('світло')` знаходить пісню за текстом; `deleteSong` прибирає її зі служіння; `exportAll` → очистити базу → `importAll` повертає ті самі кількості; `importAll('{bad')` кидає помилку з українським текстом.
- [ ] **Крок 2:** FAIL. **Крок 3:** Реалізувати (`crypto.randomUUID()` для id). **Крок 4:** PASS. **Крок 5:** коміт `feat: local storage and backup`.

### Task 5: Показ пісні з підбором розміру шрифту

**Файли:** Створити `src/song/fit.ts`, `src/song/SongView.tsx`, `src/song/SongView.css`; тест `src/song/fit.test.ts`

**Інтерфейси:**
- Споживає: `SongDoc`, `transposeDoc`.
- Створює:
  - `fitFontSize(fits: (px: number) => boolean, max = 28, min = 14): {px: number; overflow: boolean}`: двійковий пошук найбільшого цілого px у [min,max], для якого `fits(px)`; якщо навіть `min` не влазить, повертає `{px:min, overflow:true}`.
  - `chooseColumns(lineCount: number): 1 | 2` (1, якщо рядків ≤ 14, інакше 2)
  - `<SongView doc={SongDoc} />`: займає всю доступну область. Рендерить секції в CSS-колонках (`column-count`, `break-inside: avoid` для секції); кожен рядок складається з двох `pre`-подібних рядків (акорди над словами, моноширинний шрифт, акорди розставлені за `pos`). Після монтування й на `resize` підбирає px через `fitFontSize`, перевіряючи `scrollHeight <= clientHeight && scrollWidth <= clientWidth`. При `overflow` вмикає `overflow-y: auto`.
- [ ] **Крок 1: Тести, що падають (`fit.test.ts`):** `fitFontSize(px => px <= 20).px === 20`; `fitFontSize(() => true).px === 28`; **перевірка 2:** `fitFontSize(() => false)` дорівнює `{px:14, overflow:true}`; `chooseColumns(10) === 1`, `chooseColumns(30) === 2`.
- [ ] **Крок 2:** FAIL. **Крок 3:** Реалізувати fit.ts і SongView. **Крок 4:** PASS.
- [ ] **Крок 5:** Перевірка в браузері (`npm run dev`, вікно 1280×800): демо-пісня з макета вміщається у 2 колонки без прокрутки; пісня на 70 рядків показує прокрутку на 14px.
- [ ] **Крок 6:** Коміт `feat: song view with fit-to-screen`.

### Task 6: Екран пісні (шапка, тональність, екран не гасне)

**Файли:** Створити `src/song/SongScreen.tsx`, `src/hooks/useWakeLock.ts`; тест `src/song/SongScreen.test.tsx`

**Інтерфейси:**
- Споживає: `Song`, `parseChordPro`, `transposeDoc`, `semitonesBetween`, `keyPrefersFlats`, `ALL_KEYS`, `SongView`.
- Створює:
  - `<SongScreen song={Song} displayKey?: string onKeyChange={(key: string) => void} subtitle?: string footer?: ReactNode />`: шапка з назвою, підзаголовком, «Тон X − +» (клік по X відкриває вибір з `ALL_KEYS`), «♩ BPM», «Капо N»; ліворуч кнопка ✎ відкриває редактор (Задача 8, через проп `onEdit?: () => void`). Чинна тональність: `displayKey ?? song.key ?? song.originalKey`; зсув рахується від `song.originalKey`. Якщо `originalKey` невідома, − / + просто зсувають на півтону відносно поточного.
  - `useWakeLock(active: boolean): void` (Screen Wake Lock API; без помилок там, де API немає; перезапит після `visibilitychange`)
  - `SongScreen` викликає `useWakeLock(true)`, поки змонтований.
- [ ] **Крок 1: Тести, що падають:** пісня `originalKey:'D'` з тілом `[D]Слово`: клік «+» викликає `onKeyChange('Eb')` (написання з `ALL_KEYS`); з `displayKey:'G'` на екрані показано акорд `G`; пісня `originalKey:'Am'`, клік «−» викликає `onKeyChange('Abm')`.
- [ ] **Крок 2:** FAIL. **Крок 3:** Реалізувати. **Крок 4:** PASS. **Крок 5:** коміт `feat: song screen with key controls`.

### Task 7: Служіння та свайп

**Файли:** Створити `src/service/swipe.ts`, `src/service/ServiceScreen.tsx`, `src/service/ServicePlayer.tsx`; тести `src/service/swipe.test.ts`, `src/service/ServicePlayer.test.tsx`

**Інтерфейси:**
- Споживає: `Service`, `Song`, `listServices`, `saveService`, `getSong`, `SongScreen`.
- Створює:
  - `detectSwipe(dx: number, dy: number): 'next' | 'prev' | null`: `'next'`, коли dx ≤ −80 і |dx| > 2·|dy|; `'prev'` дзеркально.
  - `<ServiceScreen onPlay={(serviceId: string, index: number) => void} />`: список служінь (новіші спочатку), «+ Нове служіння» (назва + дата, за замовчуванням найближча неділя), додавання пісень із бібліотеки, зміна порядку кнопками ↑↓ (перетягування необов'язкове), видалення, тональність пісні в служінні, «▶ Почати».
  - `<ServicePlayer serviceId index onExit />`: показує `SongScreen` поточної пісні з `subtitle` «{назва служіння} · пісня N з M» і футером «← Попередня: … · крапки · Наступна: … →». Pointer events на контейнері визначають свайп. Зміна тональності зберігається в `ServiceItem.key`.
- [ ] **Крок 1: Тести, що падають:** `detectSwipe(-120, 10) === 'next'`; `detectSwipe(120, 0) === 'prev'`; `detectSwipe(-60, 0) === null`; **перевірка 3:** `detectSwipe(-90, 70) === null` (вертикальний жест зі зсувом); у `ServicePlayer` зі служінням із 2 пісень симуляція pointerdown/pointerup з dx=−150 показує назву другої пісні; на останній пісні свайп «next» нічого не робить.
- [ ] **Крок 2:** FAIL. **Крок 3:** Реалізувати; підключити вкладку «Служіння» в App (перелік служінь ↔ програвач). **Крок 4:** PASS. **Крок 5:** коміт `feat: services with swipe navigation`.

### Task 8: Бібліотека пісень, вставка тексту, редактор

**Файли:** Створити `src/library/LibraryScreen.tsx`, `src/library/SongEditor.tsx`, `src/library/importText.ts`; тести `src/library/importText.test.ts`, `src/library/SongEditor.test.tsx`

**Інтерфейси:**
- Споживає: `listSongs`, `saveSong`, `deleteSong`, `looksLikeChordPro`, `chordsOverLyricsToChordPro`, `parseChordPro`, `SongScreen`.
- Створює:
  - `normalizeImportedText(text: string): string`: якщо це вже ChordPro, повертає як є; інакше конвертує «акорди над рядком»; прибирає зайві порожні рядки (не більше одного підряд).
  - `guessKey(body: string): string | undefined`: перший акорд пісні (корінь + `m`, якщо мінор).
  - `<SongEditor initial?: Partial<Song> onSave={(s: Song) => void} onCancel />`: поля «Назва», «Виконавець», «Тональність» (вибір), «BPM», «Розмір», «Капо», велике поле тексту; праворуч живий попередній перегляд `SongView`. Під час вставки тексту в поле застосовує `normalizeImportedText`. Якщо тональність порожня, бере `guessKey`.
  - `<LibraryScreen />`: макет екрана 2 з дизайну. Ліва панель: рядок пошуку (локальний пошук під час введення), кнопки «🔍 В інтернеті» і «📷 Фото» (поки неактивні, підключаються в Задачі 12), «+ Нова / вставити текст», список пісень (клік відкриває перегляд `SongScreen` з кнопками ✎ і «Додати в служіння»). Права панель: найближче служіння і його пісні.
- [ ] **Крок 1: Тести, що падають:** `normalizeImportedText('Em  C\nСлово')` містить `[Em]` і `[C]`; `guessKey('[Am]a [F]b') === 'Am'`; `SongEditor`: ввести назву й текст, натиснути «Зберегти», і `onSave` отримує `key` з `guessKey`.
- [ ] **Крок 2:** FAIL. **Крок 3:** Реалізувати; підключити вкладку «Пісні». **Крок 4:** PASS. **Крок 5:** коміт `feat: song library, editor and paste import`.

### Task 9: Тюнер

**Файли:** Створити `src/tuner/notes.ts`, `src/tuner/useTuner.ts`, `src/tuner/TunerScreen.tsx`; тести `src/tuner/notes.test.ts`, `src/tuner/useTuner.test.ts`

**Інтерфейси:**
- Створює:
  - `frequencyToNote(freq: number, a4 = 440): {name: string; octave: number; cents: number; midi: number}` (назви з дієзами)
  - `GUITAR_STRINGS = [{name:'E',octave:2,freq:82.41},{name:'A',octave:2,freq:110.0},{name:'D',octave:3,freq:146.83},{name:'G',octave:3,freq:196.0},{name:'B',octave:3,freq:246.94},{name:'E',octave:4,freq:329.63}]`
  - `nearestString(freq: number): number` (індекс 0–5)
  - `class PitchSmoother { push(reading: {freq: number; clarity: number; rms: number} | null): number | null }`: приймає зчитування, лише якщо `clarity ≥ 0.9` і `rms ≥ 0.01`; повертає медіану останніх 5 прийнятих частот; після 10 відкинутих підряд повертає `null`.
  - `useTuner(): {start(): Promise<void>; stop(): void; freq: number | null; error: string | null}`: `getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}})`, AnalyserNode `fftSize 4096`, `PitchDetector` з `pitchy`, цикл `requestAnimationFrame`. При відмові в мікрофоні: `error = 'Дозвольте доступ до мікрофона в налаштуваннях браузера'`.
  - `<TunerScreen />`: макет екрана 3. Нота, частота, центи (−50…+50), стрілка (CSS `transform` пропорційно центам), зелений колір при |cents| ≤ 5; при `freq === null` показує «—» і підказку «Зіграйте струну». Кнопка «Увімкнути мікрофон» (браузер вимагає дії користувача). Зупиняє мікрофон при виході з вкладки.
- [ ] **Крок 1: Тести, що падають:** `frequencyToNote(440)` → `{name:'A',octave:4,cents:0}`; `frequencyToNote(110.3).cents` ≈ 5 (±1); `frequencyToNote(82.41).name === 'E'`; `nearestString(108) === 1`; **перевірка 4:** `PitchSmoother`: 10 зчитувань з `rms:0.001` дають `null`; 5 стабільних зчитувань 110 Гц і одне випадкове 300 Гц дають 110.
- [ ] **Крок 2:** FAIL. **Крок 3:** Реалізувати; підключити вкладку. **Крок 4:** PASS.
- [ ] **Крок 5:** Ручна перевірка в Chrome на ПК з мікрофоном: нота відображається, у тиші стоїть «—».
- [ ] **Крок 6:** Коміт `feat: chromatic guitar tuner`.

### Task 10: Метроном

**Файли:** Створити `src/metronome/tempo.ts`, `src/metronome/scheduler.ts`, `src/metronome/MetronomeScreen.tsx`; тести `src/metronome/tempo.test.ts`, `src/metronome/scheduler.test.ts`

**Інтерфейси:**
- Споживає: поточну пісню для «взяти темп з пісні»: `App` тримає `currentSong: Song | null` (остання відкрита в `SongScreen`) і передає `<MetronomeScreen songBpm?: number songTitle?: string songTimeSig? />`.
- Створює:
  - `clampBpm(n: number): number` (30–250, ціле)
  - `tapTempo(timesMs: number[]): number | null`: середнє з останніх ≤ 4 інтервалів; `null`, якщо натискань < 2 або остання пауза > 2000 мс (тоді починається заново)
  - `beatsPerBar(sig: '4/4'|'3/4'|'6/8'): number` (4, 3, 6)
  - `class Scheduler { constructor(opts: {now: () => number; schedule: (time: number, beat: number) => void; lookahead?: number /*0.1 с*/}); setBpm(bpm); setBeats(n); start(); stop(); tick(): void }`: `tick()` планує всі долі, що потрапляють у `[now, now+lookahead)`; таймер `setInterval(tick, 25)` у `start()`. Для 6/8 доля дорівнює восьмій, BPM рахується у восьмих.
  - Звук: короткий осцилятор (сильна доля 1500 Гц, слабка 1000 Гц, 30 мс) у `AudioContext`; візуальна доля оновлюється через `setTimeout` з різницею часу. `useWakeLock(true)` під час відтворення.
  - `<MetronomeScreen />`: макет екрана 4.
- [ ] **Крок 1: Тести, що падають:** `clampBpm(10) === 30`, `clampBpm(300) === 250`; `tapTempo([0,500,1000,1500]) === 120`; `tapTempo([0,500,3000]) === null`; `beatsPerBar('6/8') === 6`; `Scheduler` з фальшивим `now` (0 → 1.0 с кроками по 0.025, bpm 120, beats 4) запланував долі в часи 0, 0.5, 1.0 з номерами 0, 1, 2, і `setBpm(60)` під час роботи не створює двох доль ближче ніж 0.5 с.
- [ ] **Крок 2:** FAIL. **Крок 3:** Реалізувати; підключити вкладку. **Крок 4:** PASS. **Крок 5:** коміт `feat: metronome with lookahead scheduler`.

### Task 11: ШІ-провайдер Gemini та налаштування

**Файли:** Створити `src/ai/provider.ts`, `src/ai/gemini.ts`, `src/ai/prompts.ts`, `src/settings/settings.ts`; тести `src/ai/gemini.test.ts`, `src/settings/settings.test.ts`

**Інтерфейси:**
- Створює:
  - `type SongCandidate = {title: string; artist?: string; key?: string; bpm?: number; body: string /* ChordPro */; source?: string}`
  - `interface AiProvider { searchSongs(query: string): Promise<SongCandidate[]>; recognizePhoto(image: Blob): Promise<SongCandidate> }`
  - `class AiError extends Error { kind: 'no-key' | 'quota' | 'network' | 'empty' | 'bad-key' }` з українським `message`: no-key → «Додайте ключ Gemini в налаштуваннях»; quota → «Безкоштовний ліміт Gemini на сьогодні вичерпано. Спробуйте пізніше або вставте текст пісні вручну»; network → «Немає інтернету. Збережені пісні працюють, а для пошуку потрібна мережа»; empty → «Пісню не знайдено. Спробуйте іншу назву або додайте виконавця»; bad-key → «Ключ Gemini не підходить. Перевірте його в налаштуваннях».
  - `createGeminiProvider(apiKey: string, model: string, fetchFn = fetch): AiProvider`: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, заголовок `x-goog-api-key`. Пошук: `tools: [{google_search:{}}, {url_context:{}}]`. Фото: `inline_data` з base64 і `mime_type`. Статус 429 → quota, 400/401/403 з помилкою ключа → bad-key, `TypeError` з fetch → network.
  - `extractJson(text: string): unknown`: прибирає ```json … ``` / ``` … ``` і текст до першої `[`/`{` та після останньої `]`/`}`.
  - `prompts.ts`: `searchPrompt(query)` (знайди до 3 варіантів пісні українською, російською або англійською на сайтах з акордами; поверни лише JSON-масив `SongCandidate`, акорди в ChordPro, мітки частин окремими рядками як `Куплет 1`, `Приспів`, `Брідж` мовою пісні; без вигаданих акордів, порожній масив, якщо не знайдено), `photoPrompt()` (розпізнай пісню з фото, збережи розташування акордів над складами, поверни один JSON-об'єкт `SongCandidate`).
  - `settings.ts`: `type Settings = {provider: 'gemini'; geminiKey: string; geminiModel: string}`, `loadSettings(): Settings`, `saveSettings(s: Settings)` у `localStorage['fw.settings']`; `DEFAULT_GEMINI_MODEL`: актуальна безкоштовна Flash-модель з підтримкою пошуку й зображень (перевірити в документації Gemini під час реалізації і записати точний id).
  - `getProvider(): AiProvider` кидає `AiError('no-key')`, якщо ключа немає.
- [ ] **Крок 1: Тести, що падають (фальшивий `fetchFn`):** запит іде на правильну URL з моделлю, ключ стоїть у заголовку і не потрапляє в URL; **перевірка 5:** відповідь з текстом ` ```json\n[{"title":"A","body":"[G]x"}]\n``` ` дає 1 кандидата; відповідь `[]` дає `AiError` з `kind:'empty'`; текст без JSON теж дає `empty`; статус 429 дає `quota`; відмова fetch (`TypeError`) дає `network`. `settings`: збереження й завантаження; за замовчуванням `geminiModel === DEFAULT_GEMINI_MODEL`.
- [ ] **Крок 2:** FAIL. **Крок 3:** Реалізувати. **Крок 4:** PASS. **Крок 5:** коміт `feat: gemini provider for search and photo`.

### Task 12: Пошук і фото в інтерфейсі, екран налаштувань

**Файли:** Створити `src/library/OnlineSearch.tsx`, `src/library/PhotoImport.tsx`, `src/settings/SettingsScreen.tsx`; змінити `src/library/LibraryScreen.tsx`; тест `src/library/OnlineSearch.test.tsx`

**Інтерфейси:**
- Споживає: `getProvider`, `AiError`, `SongCandidate`, `SongEditor`, `saveSong`, `exportAll`, `importAll`, `loadSettings`, `saveSettings`.
- Створює:
  - `<OnlineSearch query provider? />`: індикатор «Шукаю…», список кандидатів (назва, виконавець, тональність, джерело), «+ Додати» відкриває `SongEditor` з кандидатом (`originalKey = key`), де користувач править і зберігає. Помилки `AiError` показуються їхнім `message`; для quota/network/empty є кнопка «Вставити текст вручну».
  - `<PhotoImport />`: `<input type="file" accept="image/*" capture="environment">`; зменшує фото до ≤ 1600px по довшій стороні (canvas, JPEG 0.85), далі «Розпізнаю…» і `SongEditor` з результатом.
  - `<SettingsScreen />`: поле ключа Gemini (прихований ввід, кнопка «Показати»), посилання на aistudio.google.com з коротким поясненням, як отримати ключ, кнопка «Перевірити ключ» (пробний запит), «Зберегти копію бази» (завантаження `for-worship-backup-YYYY-MM-DD.json`), «Відновити з копії» (файл → `importAll`, з повідомленням про кількість).
- [ ] **Крок 1: Тести, що падають:** з фальшивим провайдером, що повертає 2 кандидати, видно 2 назви; «+ Додати» відкриває редактор з назвою кандидата; з провайдером, що кидає `AiError('quota')`, видно текст про ліміт і кнопку «Вставити текст вручну».
- [ ] **Крок 2:** FAIL. **Крок 3:** Реалізувати й підключити (⚙ на екрані «Пісні» відкриває налаштування). **Крок 4:** PASS.
- [ ] **Крок 5:** Ручна перевірка зі справжнім ключем (коли користувач його дасть): пошук українською, російською й англійською назвою; фото друкованого аркуша.
- [ ] **Крок 6:** Коміт `feat: online search, photo import and settings`.

### Task 13: PWA, офлайн і публікація на GitHub Pages

**Файли:** Змінити `vite.config.ts`; створити `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png` (згенерувати з SVG-іконки: жовтий медіатор/гітара на `#0f1012`), `.github/workflows/deploy.yml`, `README.md` (як встановити на планшет)

**Інтерфейси:**
- Маніфест: `name: 'For Worship'`, `short_name: 'For Worship'`, `display: 'fullscreen'`, `orientation: 'landscape'`, `background_color` і `theme_color: '#0f1012'`, `lang: 'uk'`.
- `base`: з `process.env.VITE_BASE ?? '/'`; у workflow `VITE_BASE=/${{ github.event.repository.name }}/`.
- Workbox: precache усіх зібраних файлів; запити до `generativelanguage.googleapis.com` не кешувати (`NetworkOnly`).
- Workflow: на push у `main`, кроки `npm ci`, `npm test`, `npm run build`, `actions/upload-pages-artifact`, `actions/deploy-pages`.
- [ ] **Крок 1:** Налаштувати `vite-plugin-pwa` (`registerType: 'autoUpdate'`), іконки, маніфест.
- [ ] **Крок 2:** `npm run build && npx vite preview`; у Chrome DevTools → Application: маніфест без помилок, service worker активний; після вмикання офлайн-режиму застосунок перезавантажується і показує збережені пісні.
- [ ] **Крок 3:** Повний прогін `npm test`, усе PASS.
- [ ] **Крок 4:** Коміт `feat: PWA offline support and GitHub Pages deploy`.
- [ ] **Крок 5:** Публікація: коли користувач дасть посилання на GitHub-репозиторій, отримати його дозвіл на push, додати remote, запушити, увімкнути Pages (Source: GitHub Actions), перевірити, що сайт відкривається, і дати користувачу інструкцію «Chrome → ⋮ → Встановити застосунок».
