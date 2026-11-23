import { beforeEach, expect, test, vi } from 'vitest';
import { db } from '../db/db';
import { SONGSELECT_SAMPLE_HTML } from './fixtures';
import { isSongSelectImport, isSongSelectResult, listenForSongSelect } from './bridge';
import type { SongSelectImport } from './importSong';

const msg = (html: string): SongSelectImport => ({
  type: 'for-worship/songselect-import',
  version: 1,
  html,
  pageUrl: 'https://songselect.ccli.com/songs/1234567/test',
  ccliNumber: '1234567',
});

const post = (data: unknown, origin = window.location.origin) =>
  window.dispatchEvent(new MessageEvent('message', { data, origin }));

beforeEach(async () => {
  await db.songs.clear();
});

test('валідне повідомлення імпортує пісню і викликає onImported', async () => {
  const onImported = vi.fn();
  const off = listenForSongSelect(onImported, vi.fn());
  post(msg(SONGSELECT_SAMPLE_HTML));
  await vi.waitFor(() => expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ ccliNumber: '1234567' })));
  off();
});

test.each([
  ['інший origin', msg(SONGSELECT_SAMPLE_HTML), 'https://evil.example'],
  ['інший type', { ...msg(SONGSELECT_SAMPLE_HTML), type: 'x' }, undefined],
  ['інша версія', { ...msg(SONGSELECT_SAMPLE_HTML), version: 2 }, undefined],
  ['порожній html', msg(''), undefined],
  ['порожній ccliNumber', { ...msg(SONGSELECT_SAMPLE_HTML), ccliNumber: '' }, undefined],
  ['pageUrl не рядок', { ...msg(SONGSELECT_SAMPLE_HTML), pageUrl: 5 }, undefined],
  ['не об’єкт', 'рядок', undefined],
])('%s — ігнорується', async (_, data, origin) => {
  const onImported = vi.fn();
  const onError = vi.fn();
  const off = listenForSongSelect(onImported, onError);
  post(data, origin);
  await new Promise((r) => setTimeout(r, 50));
  expect(onImported).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
  expect(await db.songs.count()).toBe(0);
  off();
});

test('isSongSelectImport відхиляє null', () => {
  expect(isSongSelectImport(null)).toBe(false);
});

test('помилка розбору йде в onError', async () => {
  const onImported = vi.fn();
  const onError = vi.fn();
  const off = listenForSongSelect(onImported, onError);
  post(msg('<html><body><p>без назви</p></body></html>'));
  await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  expect(onImported).not.toHaveBeenCalled();
  expect(await db.songs.count()).toBe(0);
  off();
});

test('після відписки повідомлення ігноруються', async () => {
  const onImported = vi.fn();
  const off = listenForSongSelect(onImported, vi.fn());
  off();
  post(msg(SONGSELECT_SAMPLE_HTML));
  await new Promise((r) => setTimeout(r, 50));
  expect(onImported).not.toHaveBeenCalled();
});

const collectResults = () => {
  const results: unknown[] = [];
  const h = (e: MessageEvent) => {
    if (isSongSelectResult(e.data)) results.push(e.data);
  };
  window.addEventListener('message', h);
  return { results, stop: () => window.removeEventListener('message', h) };
};

test('успішний імпорт надсилає результат ok з назвою', async () => {
  const { results, stop } = collectResults();
  const off = listenForSongSelect(vi.fn(), vi.fn());
  post(msg(SONGSELECT_SAMPLE_HTML));
  await vi.waitFor(() => expect(results).toHaveLength(1));
  expect(results[0]).toMatchObject({ type: 'for-worship/songselect-result', version: 1, ccliNumber: '1234567', ok: true });
  expect(typeof (results[0] as { title: string }).title).toBe('string');
  off();
  stop();
});

test('помилка розбору надсилає результат ok:false', async () => {
  const { results, stop } = collectResults();
  const off = listenForSongSelect(vi.fn(), vi.fn());
  post(msg('<html><body><p>без назви</p></body></html>'));
  await vi.waitFor(() => expect(results).toHaveLength(1));
  expect(results[0]).toMatchObject({ ok: false, ccliNumber: '1234567' });
  expect(typeof (results[0] as { error: string }).error).toBe('string');
  off();
  stop();
});

test('сторонні та хибні повідомлення не дають результату', async () => {
  const { results, stop } = collectResults();
  const off = listenForSongSelect(vi.fn(), vi.fn());
  post(msg(SONGSELECT_SAMPLE_HTML), 'https://evil.example');
  post({ ...msg(SONGSELECT_SAMPLE_HTML), version: 2 });
  post('рядок');
  await new Promise((r) => setTimeout(r, 50));
  expect(results).toHaveLength(0);
  off();
  stop();
});

test('isSongSelectResult перевіряє форму', () => {
  expect(isSongSelectResult({ type: 'for-worship/songselect-result', version: 1, ccliNumber: '1', ok: true, title: 'x' })).toBe(true);
  expect(isSongSelectResult({ type: 'for-worship/songselect-result', version: 1, ok: true, title: 'x' })).toBe(false);
  expect(isSongSelectResult({ type: 'for-worship/songselect-result', version: 2, ccliNumber: '1', ok: true })).toBe(false);
  expect(isSongSelectResult(null)).toBe(false);
});

test('швидкі однакові повідомлення — один імпорт, один onImported, один рядок', async () => {
  const { results, stop } = collectResults();
  const onImported = vi.fn();
  const off = listenForSongSelect(onImported, vi.fn());
  post(msg(SONGSELECT_SAMPLE_HTML));
  post(msg(SONGSELECT_SAMPLE_HTML));
  post(msg(SONGSELECT_SAMPLE_HTML));
  await vi.waitFor(() => expect(results.length).toBeGreaterThanOrEqual(1));
  await new Promise((r) => setTimeout(r, 100));
  post(msg(SONGSELECT_SAMPLE_HTML)); // пізній дубль: повторює результат, але не імпорт
  await new Promise((r) => setTimeout(r, 100));
  expect(onImported).toHaveBeenCalledTimes(1);
  expect(await db.songs.count()).toBe(1);
  expect(results.length).toBeGreaterThanOrEqual(2);
  off();
  stop();
});

test('той самий CCLI, але інший вміст — імпортується знову (інша тональність)', async () => {
  const { results, stop } = collectResults();
  const onImported = vi.fn();
  const off = listenForSongSelect(onImported, vi.fn());
  const second = SONGSELECT_SAMPLE_HTML.replace('data-chordname="G">G</code> |', 'data-chordname="A">A</code> |');
  post(msg(SONGSELECT_SAMPLE_HTML));
  await vi.waitFor(() => expect(results).toHaveLength(1));
  post(msg(second));
  await vi.waitFor(() => expect(onImported).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(results).toHaveLength(2));
  expect(await db.songs.count()).toBe(1);
  expect((await db.songs.toArray())[0].originalKey).toBe('A');
  off();
  stop();
});

test('нерозпізнана розмітка: результат ok:false, наявне тіло не змінюється', async () => {
  const { results, stop } = collectResults();
  const off = listenForSongSelect(vi.fn(), vi.fn());
  post(msg(SONGSELECT_SAMPLE_HTML));
  await vi.waitFor(() => expect(results).toHaveLength(1));
  const before = (await db.songs.toArray())[0].body;
  post(msg('<span class="cproTitle">Тестова пісня</span><pre class="cproSongBody"></pre>'));
  await vi.waitFor(() => expect(results).toHaveLength(2));
  expect(results[1]).toMatchObject({ ok: false, ccliNumber: '1234567' });
  expect((await db.songs.toArray())[0].body).toBe(before);
  off();
  stop();
});
