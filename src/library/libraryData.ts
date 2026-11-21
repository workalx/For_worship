/**
 * Завантаження вбудованої бібліотеки: індекс (у офлайн-кеші з моменту встановлення) і частини з
 * повними піснями (кешуються service worker'ом при першому відкритті). Результати тримаються в пам'яті.
 */
import type { SongInput } from '../db/db';
import type { LibraryChunk, LibraryIndex, LibraryIndexEntry, LibrarySong } from './catalogTypes';

type FetchFn = (url: string) => Promise<Response>;

const LOAD_ERROR = 'Не вдалося відкрити бібліотеку пісень. Перевірте інтернет і спробуйте ще раз';

export function libraryUrl(file: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base.endsWith('/') ? base : base + '/'}library/${file}`;
}

async function getJson<T>(url: string, fetchFn: FetchFn): Promise<T> {
  let res: Response;
  try {
    res = await fetchFn(url);
  } catch {
    throw new Error(LOAD_ERROR);
  }
  if (!res.ok) throw new Error(LOAD_ERROR);
  return (await res.json()) as T;
}

/** Створює завантажувач (окремий екземпляр зручний для тестів). */
export function createLibraryLoader(fetchFn: FetchFn = (u) => fetch(u)) {
  let index: Promise<LibraryIndex> | null = null;
  const chunks = new Map<string, Promise<LibraryChunk>>();

  const loadIndex = (): Promise<LibraryIndex> => {
    index ??= getJson<LibraryIndex>(libraryUrl('index.json'), fetchFn).catch((e) => {
      index = null; // наступна спроба піде в мережу заново
      throw e;
    });
    return index;
  };

  const loadSong = async (entry: Pick<LibraryIndexEntry, 'id' | 'chunk'>): Promise<LibrarySong> => {
    let chunk = chunks.get(entry.chunk);
    if (!chunk) {
      chunk = getJson<LibraryChunk>(libraryUrl(`songs-${entry.chunk}.json`), fetchFn);
      chunks.set(entry.chunk, chunk);
      chunk.catch(() => chunks.delete(entry.chunk));
    }
    const song = (await chunk).songs[entry.id];
    if (!song) throw new Error('Пісню не знайдено в бібліотеці');
    return song;
  };

  return { loadIndex, loadSong };
}

export const libraryLoader = createLibraryLoader();

/** Пісня з бібліотеки → звичайна пісня користувача (для «Додати в мої пісні»). */
export function librarySongToInput(song: LibrarySong): SongInput {
  return {
    title: song.title,
    artist: song.artist,
    body: song.body,
    originalKey: song.key,
    bpm: song.bpm,
    timeSig: song.timeSig,
    source: song.source,
    sourceUrl: song.sourceUrl,
    license: song.license,
    chordsOrigin: song.chordsOrigin,
  };
}
