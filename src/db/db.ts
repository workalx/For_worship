import Dexie, { type Table } from 'dexie';

export type TimeSig = '4/4' | '3/4' | '6/8';

export type ChordsOrigin = 'auto' | 'manual';

export type Song = {
  id: string;
  title: string;
  artist?: string;
  /** Текст у форматі ChordPro. */
  body: string;
  originalKey?: string;
  key?: string;
  bpm?: number;
  timeSig?: TimeSig;
  capo?: number;
  /** Звідки пісня: назва джерела («Open Hymnal Project», «фото»). Адреса сторінки — у sourceUrl. */
  source?: string;
  /** Адреса сторінки, з якої взято пісню. */
  sourceUrl?: string;
  /** Ліцензія тексту й музики, якщо відома («public domain»). */
  license?: string;
  /** Звідки акорди: 'auto' — згенеровані програмою, 'manual' — з джерела або від користувача. */
  chordsOrigin?: ChordsOrigin;
  /** id пісні у вбудованій бібліотеці, якщо пісню додано звідти (щоб не додати двічі). */
  libraryId?: string;
  createdAt: number;
  updatedAt: number;
};

export type ServiceItem = { songId: string; key?: string };

export type Service = { id: string; title: string; /** YYYY-MM-DD */ date: string; items: ServiceItem[] };

export type SongInput = Omit<Song, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: number };

const isUrl = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v.trim());

/**
 * Приводить збережену пісню до поточної схеми. До версії 2 адреса сторінки лежала в `source`;
 * тепер вона в `sourceUrl`, а `source` — назва джерела. Невідоме значення chordsOrigin прибирається.
 * Використовується в міграції бази та під час відновлення з резервної копії.
 */
export function normalizeStoredSong<T extends Partial<Song>>(song: T): T {
  const s: T = { ...song };
  if (isUrl(s.source)) {
    if (!s.sourceUrl) s.sourceUrl = s.source.trim();
    delete s.source;
  }
  if (s.chordsOrigin !== undefined && s.chordsOrigin !== 'auto' && s.chordsOrigin !== 'manual') delete s.chordsOrigin;
  return s;
}

export class WorshipDb extends Dexie {
  songs!: Table<Song, string>;
  services!: Table<Service, string>;
  constructor(name = 'for-worship') {
    super(name);
    this.version(1).stores({ songs: 'id, title, updatedAt', services: 'id, date' });
    // Версія 2: індекси ті самі, лише переносимо адресу сторінки з source у sourceUrl.
    this.version(2)
      .stores({ songs: 'id, title, updatedAt', services: 'id, date' })
      .upgrade((tx) =>
        tx
          .table('songs')
          .toCollection()
          .modify((song: Song) => {
            const n = normalizeStoredSong(song);
            for (const k of Object.keys(song) as (keyof Song)[]) if (!(k in n)) delete song[k];
            Object.assign(song, n);
          }),
      );
  }
}

export const db = new WorshipDb();

export async function saveSong(input: SongInput): Promise<Song> {
  const now = Date.now();
  const existing = input.id ? await db.songs.get(input.id) : undefined;
  const song: Song = {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? input.createdAt ?? now,
    updatedAt: now,
  };
  await db.songs.put(song);
  return song;
}

export function getSong(id: string): Promise<Song | undefined> {
  return db.songs.get(id);
}

export async function listSongs(query?: string): Promise<Song[]> {
  const q = query?.trim().toLocaleLowerCase('uk');
  const all = await db.songs.toArray();
  const found = q
    ? all.filter((s) =>
        [s.title, s.artist ?? '', s.body].some((f) => f.toLocaleLowerCase('uk').includes(q)),
      )
    : all;
  return found.sort((a, b) => a.title.localeCompare(b.title, 'uk'));
}

export async function deleteSong(id: string): Promise<void> {
  await db.transaction('rw', db.songs, db.services, async () => {
    await db.songs.delete(id);
    const services = await db.services.toArray();
    for (const s of services) {
      if (s.items.some((i) => i.songId === id)) {
        await db.services.put({ ...s, items: s.items.filter((i) => i.songId !== id) });
      }
    }
  });
}

export async function saveService(input: Omit<Service, 'id'> & { id?: string }): Promise<Service> {
  const service: Service = { ...input, id: input.id ?? crypto.randomUUID() };
  await db.services.put(service);
  return service;
}

export async function listServices(): Promise<Service[]> {
  const all = await db.services.toArray();
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export async function deleteService(id: string): Promise<void> {
  await db.services.delete(id);
}

/** Просить браузер не видаляти базу при нестачі місця (для встановленої PWA Chrome погоджується). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = navigator.storage;
    if (!storage?.persist) return false;
    if (await storage.persisted?.()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
