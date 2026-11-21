import Dexie from 'dexie';
import { db, WorshipDb, normalizeStoredSong, requestPersistentStorage, saveSong, getSong, listSongs, deleteSong, saveService, listServices, deleteService } from './db';
import { exportAll, importAll } from './backup';

beforeEach(async () => {
  await db.songs.clear();
  await db.services.clear();
});

const base = { title: 'Світло в темряві', body: '[G]Ти світло в [D]темряві', originalKey: 'G' };

test('зберігає і читає пісню', async () => {
  const s = await saveSong(base);
  expect(s.id).toBeTruthy();
  expect(s.createdAt).toBeGreaterThan(0);
  expect((await getSong(s.id))?.title).toBe('Світло в темряві');
});

test('оновлює пісню з тим самим id, не міняючи createdAt', async () => {
  const s = await saveSong(base);
  const u = await saveSong({ ...s, title: 'Нова' });
  expect(u.id).toBe(s.id);
  expect(u.createdAt).toBe(s.createdAt);
  expect(await db.songs.count()).toBe(1);
});

test('listSongs шукає за текстом без урахування регістру й сортує за назвою', async () => {
  await saveSong(base);
  await saveSong({ title: 'Великий Бог', body: '[C]Хвала', artist: 'Хор' });
  expect((await listSongs('СВІТЛО')).map((s) => s.title)).toEqual(['Світло в темряві']);
  expect((await listSongs('хор')).map((s) => s.title)).toEqual(['Великий Бог']);
  expect((await listSongs()).map((s) => s.title)).toEqual(['Великий Бог', 'Світло в темряві']);
});

test('deleteSong прибирає пісню зі служінь', async () => {
  const a = await saveSong(base);
  const b = await saveSong({ title: 'Б', body: '[C]б' });
  const sv = await saveService({ title: 'Неділя', date: '2026-11-08', items: [{ songId: a.id }, { songId: b.id, key: 'D' }] });
  await deleteSong(a.id);
  expect(await getSong(a.id)).toBeUndefined();
  const [after] = await listServices();
  expect(after.id).toBe(sv.id);
  expect(after.items).toEqual([{ songId: b.id, key: 'D' }]);
});

test('listServices — новіші спочатку; deleteService', async () => {
  await saveService({ title: 'Стара', date: '2026-10-01', items: [] });
  const n = await saveService({ title: 'Нова', date: '2026-11-08', items: [] });
  expect((await listServices()).map((s) => s.title)).toEqual(['Нова', 'Стара']);
  await deleteService(n.id);
  expect((await listServices()).map((s) => s.title)).toEqual(['Стара']);
});

test('експорт і відновлення бази', async () => {
  await saveSong(base);
  await saveService({ title: 'Неділя', date: '2026-11-08', items: [] });
  const json = await exportAll();
  await db.songs.clear();
  await db.services.clear();
  expect(await importAll(json)).toEqual({ songs: 1, services: 1 });
  expect((await listSongs())[0].title).toBe('Світло в темряві');
});

test('неправильний файл копії дає зрозумілу помилку', async () => {
  await expect(importAll('{bad')).rejects.toThrow('Файл не схожий на резервну копію For Worship');
  await expect(importAll('{"a":1}')).rejects.toThrow('Файл не схожий на резервну копію For Worship');
});

test('просить браузер не видаляти базу (persist)', async () => {
  const persist = vi.fn(async () => true);
  Object.defineProperty(navigator, 'storage', { configurable: true, value: { persisted: async () => false, persist } });
  expect(await requestPersistentStorage()).toBe(true);
  expect(persist).toHaveBeenCalled();
  Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined });
  expect(await requestPersistentStorage()).toBe(false);
});

describe('схема версії 2', () => {
  test('міграція з версії 1 переносить адресу з source у sourceUrl і зберігає решту', async () => {
    const name = 'migration-test-' + Math.random();
    const old = new Dexie(name);
    old.version(1).stores({ songs: 'id, title, updatedAt', services: 'id, date' });
    await old.table('songs').bulkPut([
      { id: 'a', title: 'З сайту', body: '[G]x', source: 'https://example.com/song', capo: 2, createdAt: 1, updatedAt: 2 },
      { id: 'b', title: 'З фото', body: '[C]y', source: 'фото', createdAt: 1, updatedAt: 2 },
    ]);
    await old.table('services').put({ id: 's', title: 'Неділя', date: '2026-01-04', items: [{ songId: 'a', key: 'A' }] });
    old.close();

    const fresh = new WorshipDb(name);
    const a = await fresh.songs.get('a');
    const b = await fresh.songs.get('b');
    expect(a).toMatchObject({ title: 'З сайту', sourceUrl: 'https://example.com/song', capo: 2, createdAt: 1, updatedAt: 2 });
    expect(a).not.toHaveProperty('source');
    expect(b).toMatchObject({ source: 'фото' });
    expect(b).not.toHaveProperty('sourceUrl');
    expect((await fresh.services.get('s'))?.items).toEqual([{ songId: 'a', key: 'A' }]);
    expect(fresh.verno).toBe(2);
    fresh.close();
    await Dexie.delete(name);
  });

  test('нові поля зберігаються й читаються', async () => {
    const s = await saveSong({ ...base, source: 'Open Hymnal Project', sourceUrl: 'https://x/y.abc', license: 'public domain', chordsOrigin: 'auto' });
    expect(await getSong(s.id)).toMatchObject({ license: 'public domain', chordsOrigin: 'auto', sourceUrl: 'https://x/y.abc' });
  });

  test('normalizeStoredSong прибирає невідоме chordsOrigin і не чіпає назву джерела', () => {
    expect(normalizeStoredSong({ source: 'фото', chordsOrigin: 'weird' as never })).toEqual({ source: 'фото' });
    expect(normalizeStoredSong({ source: ' https://a.b/c ', sourceUrl: 'https://keep' })).toEqual({ sourceUrl: 'https://keep' });
  });
});

describe('сумісність резервної копії', () => {
  test('стара копія версії 1 (адреса в source) відновлюється в новій схемі', async () => {
    const backupV1 = JSON.stringify({
      version: 1,
      songs: [{ id: 'old', title: 'Стара', body: '[D]z', source: 'https://example.com/old', createdAt: 5, updatedAt: 6 }],
      services: [{ id: 'sv', title: 'Неділя', date: '2026-02-01', items: [{ songId: 'old' }] }],
    });
    expect(await importAll(backupV1)).toEqual({ songs: 1, services: 1 });
    const s = await getSong('old');
    expect(s).toMatchObject({ title: 'Стара', sourceUrl: 'https://example.com/old', createdAt: 5 });
    expect(s).not.toHaveProperty('source');
  });

  test('копія з новими полями проходить коло експорт → імпорт без втрат', async () => {
    const s = await saveSong({ ...base, license: 'public domain', chordsOrigin: 'auto', source: 'Open Hymnal Project' });
    const json = await exportAll();
    expect(JSON.parse(json).version).toBe(1);
    await db.songs.clear();
    await importAll(json);
    expect(await getSong(s.id)).toEqual(s);
  });
});
