import Dexie, { type Table } from 'dexie';

export type TimeSig = '4/4' | '3/4' | '6/8';

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
  source?: string;
  createdAt: number;
  updatedAt: number;
};

export type ServiceItem = { songId: string; key?: string };

export type Service = { id: string; title: string; /** YYYY-MM-DD */ date: string; items: ServiceItem[] };

export type SongInput = Omit<Song, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: number };

class WorshipDb extends Dexie {
  songs!: Table<Song, string>;
  services!: Table<Service, string>;
  constructor() {
    super('for-worship');
    this.version(1).stores({ songs: 'id, title, updatedAt', services: 'id, date' });
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
