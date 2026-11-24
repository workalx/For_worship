import { expect, test, vi } from 'vitest';
import { bookmarkletHref, bookmarkletSource } from './bookmarklet';
import { decodeSongSelectHash } from './hashImport';
import { SONGSELECT_SAMPLE_HTML } from './fixtures';

const APP = 'https://example.github.io/for-worship/';
const PAGE = 'https://songselect.ccli.com/songs/1234567/test-song/viewchordsheet';

/** Виконує букмарклет з підставними location/document/fetch, як браузер на сторінці SongSelect. */
async function run(opts: { href?: string; key?: string | null; payload?: unknown; compression?: boolean } = {}) {
  const url = new URL(opts.href ?? PAGE);
  const loc = { href: url.href, hostname: url.hostname, pathname: url.pathname };
  const key = opts.key === undefined ? 'G' : opts.key;
  const doc = {
    querySelector: () => (key ? { getAttribute: () => key } : null),
    getElementById: () => null,
  };
  const fetchMock = vi.fn(async () => ({
    json: async () => ({ isSuccess: true, payload: opts.payload ?? SONGSELECT_SAMPLE_HTML }),
  }));
  const alertMock = vi.fn();
  const fn = new Function('location', 'document', 'fetch', 'alert', 'CompressionStream', bookmarkletSource(APP));
  fn(loc, doc, fetchMock, alertMock, opts.compression === false ? undefined : CompressionStream);
  await vi.waitFor(() => expect(loc.href !== url.href || alertMock.mock.calls.length > 0).toBe(true));
  return { loc, fetchMock, alertMock };
}

test('бере акорди у вибраній тональності й переходить у програму з піснею в хеші', async () => {
  const { loc, fetchMock, alertMock } = await run();
  expect(alertMock).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/api/GetSongChordsHTML?songNumber=1234567&key=G&'),
    { credentials: 'include' },
  );
  expect(loc.href.startsWith(APP + '#songselect=z')).toBe(true);
  const msg = await decodeSongSelectHash(loc.href.split('#songselect=')[1]);
  expect(msg).toEqual({
    type: 'for-worship/songselect-import',
    version: 1,
    html: SONGSELECT_SAMPLE_HTML,
    pageUrl: PAGE,
    ccliNumber: '1234567',
  });
});

test('без CompressionStream передає нестиснуті дані', async () => {
  const { loc } = await run({ compression: false, payload: 'Привіт <b>світ</b>' });
  const payload = loc.href.split('#songselect=')[1];
  expect(payload[0]).toBe('r');
  expect((await decodeSongSelectHash(payload))?.html).toBe('Привіт <b>світ</b>');
});

test.each<[string, { href?: string; key?: string | null }]>([
  ['не сторінка акордів', { href: 'https://songselect.ccli.com/songs/1234567/test-song' }],
  ['інший сайт', { href: 'https://evil.example/songs/1234567/x/viewchordsheet' }],
  ['немає тональності', { key: null }],
])('%s — показує підказку й нікуди не переходить', async (_, opts) => {
  const { loc, fetchMock, alertMock } = await run(opts);
  expect(alertMock).toHaveBeenCalledOnce();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(loc.href).toBe(new URL(opts.href ?? PAGE).href);
});

test('адреса закладки — це закодований код букмарклета', () => {
  const href = bookmarkletHref(APP);
  expect(href.startsWith('javascript:')).toBe(true);
  expect(href).not.toMatch(/[\s#]/);
  expect(decodeURIComponent(href.slice('javascript:'.length))).toBe(bookmarkletSource(APP));
});

test.each([
  ['порожньо', ''],
  ['невідомий режим', 'xabc'],
  ['сміття', 'z!!!'],
  ['не JSON', 'r' + btoa('hello')],
  ['чужий pageUrl', 'r' + btoa(JSON.stringify({ html: 'x', pageUrl: 'https://evil.example/', ccliNumber: '1' }))],
  ['без номера CCLI', 'r' + btoa(JSON.stringify({ html: 'x', pageUrl: PAGE, ccliNumber: '' }))],
])('decodeSongSelectHash: %s → null', async (_, payload) => {
  expect(await decodeSongSelectHash(payload)).toBeNull();
});
