import { guessKey, parseChordPro, transposeDoc, looksLikeChordPro } from './chordpro';
import { semitonesBetween, keyPrefersFlats } from './chords';
import { parseSongSelectHtml } from '../songselect/parseSongSelectHtml';
import { SONGSELECT_SAMPLE_HTML } from '../songselect/fixtures';

test('розбирає акорди в рядку з позиціями', () => {
  const doc = parseChordPro('[G]Ти світло в [D]темряві');
  expect(doc.sections).toHaveLength(1);
  expect(doc.sections[0].lines[0]).toEqual({
    lyrics: 'Ти світло в темряві',
    chords: [{ pos: 0, chord: 'G' }, { pos: 12, chord: 'D' }],
  });
});

test('мітки частин починають нові секції', () => {
  const doc = parseChordPro('Куплет 1:\n[G]А\nПриспів ×2\n[C]Б');
  expect(doc.sections.map((s) => s.label)).toEqual(['Куплет 1', 'Приспів ×2']);
  expect(doc.sections[1].lines[0].lyrics).toBe('Б');
});

test('текст до першої мітки — секція без назви', () => {
  const doc = parseChordPro('[Am]Вступ без мітки\nChorus\n[F]x');
  expect(doc.sections[0].label).toBe('');
  expect(doc.sections[1].label).toBe('Chorus');
});

test('директиви {c:} і {soc}', () => {
  const doc = parseChordPro('{title: Пісня}\n{c: Брідж}\n[Em]а\n{soc}\n[C]б\n{eoc}');
  expect(doc.sections.map((s) => s.label)).toEqual(['Брідж', 'Приспів']);
});

test('рядок лише з акордами має порожні слова', () => {
  const line = parseChordPro('[G]  [D]  [Em]  [C]').sections[0].lines[0];
  expect(line.lyrics).toBe('');
  expect(line.chords.map((c) => c.chord)).toEqual(['G', 'D', 'Em', 'C']);
});

test('transposeDoc зсуває всі акорди', () => {
  const doc = transposeDoc(parseChordPro('[G]а\n[G/B]б [D]в'), 2, false);
  expect(doc.sections[0].lines[0].chords[0].chord).toBe('A');
  expect(doc.sections[0].lines[1].chords.map((c) => c.chord)).toEqual(['A/C#', 'E']);
});

test('looksLikeChordPro', () => {
  expect(looksLikeChordPro('[G]Слово')).toBe(true);
  expect(looksLikeChordPro('G  D\nСлово')).toBe(false);
  expect(looksLikeChordPro('[Приспів]')).toBe(false);
});

test('guessKey — перший акорд пісні', () => {
  expect(guessKey('[Am]a [F]b')).toBe('Am');
  expect(guessKey('Куплет\n[G/B]a')).toBe('G');
  expect(guessKey('[F#m7]x')).toBe('F#m');
  expect(guessKey('без акордів')).toBeUndefined();
});

test('пісня з G у Eb: бемолі, бас транспонується', () => {
  const doc = parseChordPro('[G]а [D/F#]б [Em7]в [Cadd9]г');
  const out = transposeDoc(doc, semitonesBetween('G', 'Eb'), keyPrefersFlats('Eb'));
  expect(out.sections[0].lines[0].chords.map((c) => c.chord)).toEqual(['Eb', 'Bb/D', 'Cm7', 'Abadd9']);
  expect(out.sections[0].lines[0].lyrics).toBe('а б в г');
});

test('імпорт SongSelect: +2 транспонує акорди, текст не змінюється', () => {
  const body = parseSongSelectHtml(SONGSELECT_SAMPLE_HTML, 'https://songselect.ccli.com/songs/1', '1').body;
  const doc = parseChordPro(body);
  const out = transposeDoc(doc, 2, false);
  const chords = (d: typeof doc) => d.sections.flatMap((s) => s.lines.flatMap((l) => l.chords.map((c) => c.chord)));
  const lyrics = (d: typeof doc) => d.sections.flatMap((s) => s.lines.map((l) => l.lyrics));
  expect(new Set(chords(doc))).toEqual(new Set(['G', 'D/F#', 'Em7', 'Cadd9']));
  expect(new Set(chords(out))).toEqual(new Set(['A', 'E/G#', 'F#m7', 'Dadd9']));
  expect(lyrics(out)).toEqual(lyrics(doc));
});

test('акорд у дужках [(Bb/F)] — акорд, транспонується з дужками', () => {
  const doc = parseChordPro('[(Bb/F)]Слава [G]нам');
  expect(doc.sections[0].lines[0]).toEqual({
    lyrics: 'Слава нам',
    chords: [{ pos: 0, chord: '(Bb/F)' }, { pos: 6, chord: 'G' }],
  });
  expect(looksLikeChordPro('[(Bb/F)]текст')).toBe(true);
  const out = transposeDoc(doc, -2, true);
  expect(out.sections[0].lines[0].chords.map((c) => c.chord)).toEqual(['(Ab/Eb)', 'F']);
});

test('[(2x)] і [(To Chorus)] лишаються текстом', () => {
  const line = parseChordPro('[(2x)]Слава [(To Chorus)]').sections[0].lines[0];
  expect(line.chords).toEqual([]);
  expect(line.lyrics).toBe('[(2x)]Слава [(To Chorus)]');
});
