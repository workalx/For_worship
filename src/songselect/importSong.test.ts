import { beforeEach, expect, test } from 'vitest';
import { db, getSong, saveSong } from '../db/db';
import { SONGSELECT_SAMPLE_HTML } from './fixtures';
import { importSongSelect, type SongSelectImport } from './importSong';

const msg = (html: string): SongSelectImport => ({
  type: 'for-worship/songselect-import',
  version: 1,
  html,
  pageUrl: 'https://songselect.ccli.com/songs/1234567/test',
  ccliNumber: '1234567',
});

beforeEach(async () => {
  await db.songs.clear();
});

test('нову пісню зберігає', async () => {
  const s = await importSongSelect(msg(SONGSELECT_SAMPLE_HTML));
  expect(await getSong(s.id)).toMatchObject({ ccliNumber: '1234567', source: 'SongSelect' });
});

test('повторний імпорт оновлює ту саму пісню без дубля', async () => {
  const a = await importSongSelect(msg(SONGSELECT_SAMPLE_HTML));
  const b = await importSongSelect(
    msg(SONGSELECT_SAMPLE_HTML.replace('data-chordname="G">G</code> |', 'data-chordname="A">A</code> |')),
  );
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

test('нерозпізнана розмітка не затирає тіло наявної пісні', async () => {
  const a = await importSongSelect(msg(SONGSELECT_SAMPLE_HTML));
  const empty = '<span class="cproTitle">Тестова пісня</span><pre class="cproSongBody"></pre>';
  await expect(importSongSelect(msg(empty))).rejects.toThrow('не знайдено тексту пісні');
  expect((await getSong(a.id))?.body).toBe(a.body);
  expect(await db.songs.count()).toBe(1);
});
