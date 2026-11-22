/**
 * Побудова офлайн-бібліотеки з файлів Open Hymnal: фільтр ліцензій, конвертація в ChordPro,
 * індекс для пошуку й частини з повними піснями (за першою літерою назви).
 * Формат результату описано в типах LibraryIndex / LibraryChunk (їх же читає застосунок).
 */
import { createHash } from 'node:crypto';
import { parseAbc, type AbcTune } from './abc';
import { distinctWords } from '../../src/library/searchText';
import { abcToChordPro } from './abcToChordPro';
import type { LibraryChunk, LibraryIndex, LibraryIndexEntry, LibrarySong } from '../../src/library/catalogTypes';

export const OPEN_HYMNAL = {
  repo: 'https://github.com/mzealey/openhymnal',
  /** Зафіксований коміт: бібліотека відтворюється однаково, хоч би що змінилося в репозиторії. */
  commit: 'd35811b2d5c9b0bbc5887d60a2936454815416e8',
  source: 'Open Hymnal Project',
};

export type SourceFile = { path: string; text: string };
export type Skipped = { path: string; reason: string };

/**
 * Чи пісня явно в суспільному надбанні. Беремо лише файли, де рядок `C: copyright:` починається з
 * «public domain» і не згадує захищених слів або музики.
 */
export function publicDomainReason(copyright: string | undefined): string | null {
  if (!copyright) return 'немає рядка «C: copyright»';
  const c = copyright.trim();
  if (!/^public domain\b/i.test(c)) return `не public domain: «${c.slice(0, 120)}»`;
  if (/\b(words|text|lyrics|music|setting)\s*:?\s*(©|\(c\)|copyright)/i.test(c)) return `частина захищена: «${c.slice(0, 120)}»`;
  return null;
}

/** «Complete/Amazing_Grace/Amazing_Grace-New_Britain.abc» → «oh-amazing-grace-new-britain». */
export function songId(path: string): string {
  const file = path.split('/').pop()!.replace(/\.abc$/i, '');
  return (
    'oh-' +
    file
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

/** Назва мелодії з імені файлу: «Amazing_Grace-New_Britain.abc» → «New Britain». */
export function tuneName(path: string): string | undefined {
  const file = path.split('/').pop()!.replace(/\.abc$/i, '');
  const parts = file.split('-');
  if (parts.length < 2) return undefined;
  const name = parts[parts.length - 1].replace(/_/g, ' ').trim();
  return name && name.toLowerCase() !== 'untitled' ? name : undefined;
}

/** Частина, в якій лежить пісня: перша латинська літера назви (без «A »/«The »), інакше «other». */
export function chunkKey(title: string): string {
  const t = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(the|a|an|o)\s+/i, '')
    .trim();
  const m = /[a-z]/i.exec(t);
  return m ? m[0].toLowerCase() : 'other';
}

/** Теми з %OHTOPICS («{Grace}, {Heaven [3,5]}») і категорія, не більше 8. */
export function tagsOf(tune: AbcTune): string[] {
  const topics = [...(tune.meta.TOPICS ?? '').matchAll(/\{([^}]+)\}/g)].map((m) => m[1].replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim());
  const category = (tune.meta.CATEGORY ?? '').trim();
  const all = [category ? category.charAt(0) + category.slice(1).toLowerCase() : '', ...topics].filter(Boolean);
  return [...new Set(all)].slice(0, 8);
}

/** Перший рядок першого куплету без акордів. */
export function firstLineOf(body: string): string {
  for (const line of body.split('\n')) {
    const t = line.replace(/\[[^\]]*\]/g, '').trim();
    if (!t || /:$/.test(t)) continue;
    return t;
  }
  return '';
}

function sourceUrl(path: string): string {
  return `${OPEN_HYMNAL.repo}/blob/${OPEN_HYMNAL.commit}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export type Catalog = { index: LibraryIndex; chunks: Map<string, LibraryChunk>; skipped: Skipped[] };

/** Будує бібліотеку з файлів джерела (шляхи відносно кореня репозиторію Open Hymnal). */
export function buildCatalog(files: SourceFile[]): Catalog {
  const skipped: Skipped[] = [];
  const songs: { entry: LibraryIndexEntry; song: LibrarySong }[] = [];
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    let tune: AbcTune;
    try {
      tune = parseAbc(f.text);
    } catch (e) {
      skipped.push({ path: f.path, reason: `не вдалося розібрати ABC: ${String(e)}` });
      continue;
    }
    const licenseProblem = publicDomainReason(tune.copyright);
    if (licenseProblem) {
      skipped.push({ path: f.path, reason: licenseProblem });
      continue;
    }
    const converted = abcToChordPro(tune, { source: OPEN_HYMNAL.source, sourceUrl: sourceUrl(f.path), license: 'public domain' });
    if (converted.stats.warnings.length) {
      // Голоси, що не сходяться, дають неправдиві акорди — краще пропустити, ніж вигадати.
      skipped.push({ path: f.path, reason: `ненадійний розбір: ${converted.stats.warnings.join('; ')}` });
      continue;
    }
    if (!converted.title || !converted.body.trim()) {
      skipped.push({ path: f.path, reason: 'немає назви або тексту' });
      continue;
    }
    const id = songId(f.path);
    const song: LibrarySong = {
      id,
      title: converted.title,
      artist: converted.artist,
      key: converted.key,
      bpm: converted.bpm,
      timeSig: converted.timeSig,
      body: converted.body,
      source: OPEN_HYMNAL.source,
      sourceUrl: sourceUrl(f.path),
      license: 'public domain',
      chordsOrigin: 'auto',
    };
    const firstLine = firstLineOf(converted.body);
    const entry: LibraryIndexEntry = {
      id,
      title: converted.title,
      firstLine,
      author: converted.artist,
      key: converted.key,
      tags: tagsOf(tune),
      chordsOrigin: 'auto',
      chunk: '',
      words: distinctWords(converted.body, [converted.title, firstLine]),
      tune: tuneName(f.path),
    };
    songs.push({ entry, song });
  }

  // Однакові назви (кілька мелодій одного гімну) розрізняємо назвою мелодії.
  const byTitle = new Map<string, number>();
  for (const s of songs) byTitle.set(s.entry.title.toLowerCase(), (byTitle.get(s.entry.title.toLowerCase()) ?? 0) + 1);
  for (const s of songs) {
    if ((byTitle.get(s.entry.title.toLowerCase()) ?? 0) > 1 && s.entry.tune) {
      s.entry.title = `${s.entry.title} (${s.entry.tune})`;
      s.song.title = s.entry.title;
    }
  }

  const byKey = new Map<string, { chunk: LibraryChunk; entries: LibraryIndexEntry[] }>();
  for (const s of songs) {
    const key = chunkKey(s.entry.title);
    const group = byKey.get(key) ?? { chunk: { version: 1, songs: {} }, entries: [] };
    group.chunk.songs[s.entry.id] = s.song;
    group.entries.push(s.entry);
    byKey.set(key, group);
  }
  // Назва частини = літера + хеш вмісту: змінена частина отримує нову адресу.
  const chunks = new Map<string, LibraryChunk>();
  for (const [key, group] of byKey) {
    const hash = createHash('sha256').update(JSON.stringify(group.chunk)).digest('hex').slice(0, 8);
    const name = `${key}-${hash}`;
    for (const e of group.entries) e.chunk = name;
    chunks.set(name, group.chunk);
  }
  const entries = songs.map((s) => s.entry).sort((a, b) => a.title.localeCompare(b.title, 'en'));
  const index: LibraryIndex = {
    version: 1,
    source: { name: OPEN_HYMNAL.source, repo: OPEN_HYMNAL.repo, commit: OPEN_HYMNAL.commit },
    songs: entries,
  };
  return { index, chunks, skipped };
}
