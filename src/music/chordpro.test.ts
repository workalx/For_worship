import { guessKey, parseChordPro, transposeDoc, looksLikeChordPro } from './chordpro';

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
