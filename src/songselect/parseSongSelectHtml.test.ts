import { parseChordPro } from '../music/chordpro';
import { SONGSELECT_SAMPLE_HTML } from './fixtures';
import { parseSongSelectHtml } from './parseSongSelectHtml';

const url = 'https://songselect.ccli.com/songs/1234567/test-song/viewchordsheet';
const s = () => parseSongSelectHtml(SONGSELECT_SAMPLE_HTML, url, '1234567');

test('метадані', () => {
  expect(s()).toMatchObject({
    title: 'Тестова пісня', artist: 'Автор Один, Автор Два', originalKey: 'G', bpm: 72, timeSig: '4/4',
    source: 'SongSelect', sourceUrl: url, ccliNumber: '1234567', chordsOrigin: 'manual',
    license: '© 2020 Test Music | Test Publishing',
  });
});

test('частини стають {c: …}, акорди стоять перед складом', () => {
  const body = s().body;
  expect(body).toMatch(/^\{c: Verse 1\}$/m);
  expect(body).toMatch(/^\{c: Chorus\}$/m);
  expect(body.split('\n')).toContain('Ми [G]співаємо тут');
  expect(body.split('\n')).toContain('[G]Слава [D/F#]нам');
});

test('назва акорду з data-chordname, не з видимого тексту з <sup>', () => {
  expect(s().body).toContain('[Em7]');
  expect(s().body).not.toContain('<sup>');
});

test('акорд над пробілом і пробіли між словами не зсувають позицій', () => {
  const lines = s().body.split('\n');
  expect(lines).toContain('Світло [D/F#]тепле [Em7]вдома [Cadd9]');
  expect(lines.every((l) => l === l.trimEnd())).toBe(true);
});

test('напрямок «(To Chorus)» лишається в тексті', () => {
  expect(s().body).toContain('(To Chorus)');
  expect(s().body.split('\n')).toContain('Далі (To Chorus)');
});

test('ні номера ліцензії церкви, ні дисклеймера', () => {
  const all = JSON.stringify(s());
  expect(all).not.toMatch(/99999999|License|Terms of Use|CCLI/);
});

test('результат читається parseChordPro: дві частини, усі акорди розпізнані', () => {
  const doc = parseChordPro(s().body);
  expect(doc.sections.map((x) => x.label)).toEqual(['Verse 1', 'Chorus']);
  expect(doc.sections.flatMap((x) => x.lines).flatMap((l) => l.chords.map((c) => c.chord)))
    .toEqual(['G', 'D/F#', 'Em7', 'Cadd9', 'G', 'D/F#']);
  expect(s().body.match(/\[[^\]]+\]/g)).toHaveLength(6);
});

test('HTML без .cproTitle — помилка', () => {
  expect(() => parseSongSelectHtml('<pre class="cproSongBody"></pre>', url, '1')).toThrow();
});

test('без tempo/time — поля не заповнюються; розмір не з 4/4,3/4,6/8 — ігнорується', () => {
  const html = (t: string) => `<span class="cproTitle">X</span>${t}<pre class="cproSongBody"></pre>`;
  const none = parseSongSelectHtml(html(''), url, '1');
  expect(none.bpm).toBeUndefined();
  expect(none.timeSig).toBeUndefined();
  const odd = parseSongSelectHtml(html('<span class="cproTempoTimeWrapper">Tempo - 90 | Time - 5/4</span>'), url, '1');
  expect(odd.bpm).toBe(90);
  expect(odd.timeSig).toBeUndefined();
  const waltz = parseSongSelectHtml(html('<span class="cproTempoTimeWrapper">Time - 3/4</span>'), url, '1');
  expect(waltz.timeSig).toBe('3/4');
  expect(waltz.bpm).toBeUndefined();
});
