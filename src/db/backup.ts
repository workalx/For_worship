import { db, normalizeStoredSong, type Service, type Song } from './db';

const BAD_FILE = 'Файл не схожий на резервну копію For Worship';

/**
 * Формат копії лишається версії 1: нові поля пісні (sourceUrl, license, chordsOrigin) необов'язкові,
 * тож старі копії відновлюються, а старі версії програми просто ігнорують нові поля.
 */
type Backup = { version: 1; songs: Song[]; services: Service[] };

export async function exportAll(): Promise<string> {
  const backup: Backup = { version: 1, songs: await db.songs.toArray(), services: await db.services.toArray() };
  return JSON.stringify(backup, null, 2);
}

export async function importAll(json: string): Promise<{ songs: number; services: number }> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error(BAD_FILE);
  }
  const b = data as Partial<Backup>;
  if (!b || b.version !== 1 || !Array.isArray(b.songs) || !Array.isArray(b.services)) throw new Error(BAD_FILE);
  await db.transaction('rw', db.songs, db.services, async () => {
    await db.songs.bulkPut(b.songs!.map((s) => normalizeStoredSong(s)));
    await db.services.bulkPut(b.services!);
  });
  return { songs: b.songs.length, services: b.services.length };
}
