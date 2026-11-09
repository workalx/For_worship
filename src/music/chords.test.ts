import { transposeChord, isChord, semitonesBetween, keyPrefersFlats, ALL_KEYS, parseChord } from './chords';

describe('transposeChord', () => {
  test.each([
    ['G', 2, false, 'A'],
    ['F#m7', 1, false, 'Gm7'],
    ['G/B', -2, true, 'F/A'],
    ['Bb', 2, false, 'C'],
    ['Csus4', 1, true, 'Dbsus4'],
    ['E', 12, false, 'E'],
  ] as const)('%s %+d → %s', (chord, n, flats, expected) => {
    expect(transposeChord(chord, n, flats)).toBe(expected);
  });
});

describe('isChord', () => {
  test.each(['Am', 'C#m7b5', 'Dsus2', 'A/C#', 'Gmaj7', 'Eadd9', 'G', 'Bb', 'F#m', 'E7', 'Cdim', 'Faug', 'Dm7'])('%s — акорд', (s) => {
    expect(isChord(s)).toBe(true);
  });
  test.each(['I', 'new', 'Ти', 'H', 'Am I', 'Away', 'Do', 'Bless'])('%s — не акорд', (s) => {
    expect(isChord(s)).toBe(false);
  });
});

test('parseChord розбирає корінь, якість і бас', () => {
  expect(parseChord('F#m7/C#')).toEqual({ root: 'F#', quality: 'm7', bass: 'C#' });
  expect(parseChord('Хвала')).toBeNull();
});

test('semitonesBetween і keyPrefersFlats', () => {
  expect(semitonesBetween('D', 'G')).toBe(5);
  expect(semitonesBetween('G', 'D')).toBe(-5);
  expect(semitonesBetween('Am', 'Bm')).toBe(2);
  expect(keyPrefersFlats('F')).toBe(true);
  expect(keyPrefersFlats('E')).toBe(false);
  expect(keyPrefersFlats('Dm')).toBe(true);
});

test('ALL_KEYS — 12 тональностей', () => {
  expect(ALL_KEYS).toEqual(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
});
