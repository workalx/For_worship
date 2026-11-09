import { chordsOverLyricsToChordPro, isChordLine } from './chordsOverLyrics';
import { parseChordPro } from './chordpro';

test('акорд стає над тим самим символом', () => {
  const doc = parseChordPro(chordsOverLyricsToChordPro('G        D\nТи світло в темряві'));
  const line = doc.sections[0].lines[0];
  expect(line.lyrics).toBe('Ти світло в темряві');
  expect(line.chords).toEqual([{ pos: 0, chord: 'G' }, { pos: 9, chord: 'D' }]);
});

test('рядок акордів без слів (програш) зберігається', () => {
  const doc = parseChordPro(chordsOverLyricsToChordPro('Вступ\nG  D  Em  C\n\nКуплет 1\nG\nСлово'));
  expect(doc.sections[0].label).toBe('Вступ');
  const line = doc.sections[0].lines[0];
  expect(line.lyrics).toBe('');
  expect(line.chords.map((c) => c.chord)).toEqual(['G', 'D', 'Em', 'C']);
  expect(doc.sections[1].lines[0]).toEqual({ lyrics: 'Слово', chords: [{ pos: 0, chord: 'G' }] });
});

test('акорд далі за кінець рядка слів', () => {
  const doc = parseChordPro(chordsOverLyricsToChordPro('C          G\nКоротко'));
  expect(doc.sections[0].lines[0].chords[1]).toEqual({ pos: 11, chord: 'G' });
});

describe('isChordLine', () => {
  test.each([
    ['Am I a soldier', false],
    ['A new day', false],
    ['A   E   F#m  D', true],
    ['Em  C  G  D  x2', true],
    ['| G | D | (x2)', true],
    ['', false],
    ['Ти світло', false],
  ] as const)('%j → %s', (line, expected) => {
    expect(isChordLine(line)).toBe(expected);
  });
});
