import { db, requestPersistentStorage, saveSong, getSong, listSongs, deleteSong, saveService, listServices, deleteService } from './db';
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
