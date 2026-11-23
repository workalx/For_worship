import { isSongSelectImport } from './bridge';
import { SONGSELECT_SAMPLE_HTML } from './fixtures';

await import('../../extension/lib.js');
const ext = globalThis.ForWorshipExt;
const url = 'https://songselect.ccli.com/songs/4768151/amazing-grace-my-chains-are-gone/viewchordsheet';

test('номер пісні з адреси', () => {
  expect(ext.songNumberFromUrl(url)).toBe('4768151');
  expect(ext.songNumberFromUrl('https://songselect.ccli.com/search/results?search=x')).toBeNull();
});

test('розпізнає сторінку акордів', () => {
  expect(ext.isChordSheetUrl('https://songselect.ccli.com/songs/1/x/viewchordsheet')).toBe(true);
  expect(ext.isChordSheetUrl('https://songselect.ccli.com/songs/1/x/viewlyrics')).toBe(false);
  expect(ext.isChordSheetUrl('https://songselect.ccli.com/songs/1/x/viewchordsheet?key=G')).toBe(true);
});

test('адреса аркуша акордів', () => {
  expect(ext.chordsHtmlUrl('4768151', 'F#')).toBe(
    '/api/GetSongChordsHTML?songNumber=4768151&key=F%23&style=Standard&columns=1&enableFontCustomization=0',
  );
});

test('повідомлення відповідає тому, що чекає програма', () => {
  const msg = ext.buildImportMessage(SONGSELECT_SAMPLE_HTML, url, '1234567');
  expect(isSongSelectImport(msg)).toBe(true);
  expect(msg.type).toBe(ext.MESSAGE_TYPE);
  expect(msg.version).toBe(ext.VERSION);
});

test('адреси програми містять локальну', () => {
  expect(ext.APP_ORIGINS).toContain('http://localhost:5173');
});

test('розпізнає повідомлення-результат від програми', () => {
  expect(ext.isResultMessage({ type: ext.RESULT_TYPE, version: 1, ok: true, title: 'x' })).toBe(true);
  expect(ext.isResultMessage({ type: ext.RESULT_TYPE, version: 1, ok: false, error: 'e' })).toBe(true);
  expect(ext.isResultMessage({ type: ext.RESULT_TYPE, version: 2, ok: true })).toBe(false);
  expect(ext.isResultMessage({ type: ext.MESSAGE_TYPE, version: 1, ok: true })).toBe(false);
  expect(ext.isResultMessage(null)).toBe(false);
});
