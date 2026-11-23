import { db, saveSong, type Song } from '../db/db';
import { parseSongSelectHtml } from './parseSongSelectHtml';

export type SongSelectImport = {
  type: 'for-worship/songselect-import';
  version: 1;
  html: string;
  pageUrl: string;
  ccliNumber: string;
};

/** Зберігає пісню зі SongSelect; якщо пісня з таким номером CCLI вже є — оновлює її, зберігаючи вибрані key і capo. */
export async function importSongSelect(msg: SongSelectImport): Promise<Song> {
  const parsed = parseSongSelectHtml(msg.html, msg.pageUrl, msg.ccliNumber);
  const existing = await db.songs.filter((s) => s.ccliNumber === msg.ccliNumber).first();
  if (!existing) return saveSong(parsed);
  return saveSong({
    ...existing,
    ...parsed,
    id: existing.id,
    key: existing.key,
    capo: existing.capo,
  });
}
