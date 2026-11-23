import { shiftKey, transposeChord, isChord, semitonesBetween, keyPrefersFlats, ALL_KEYS, parseChord } from './chords';

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

describe('акорди в дужках (SongSelect)', () => {
  test('parseChord розбирає внутрішній акорд', () => {
    expect(parseChord('(Bb/F)')).toEqual({ root: 'Bb', quality: '', bass: 'F', optional: true });
  });
  test('transposeChord зберігає дужки', () => {
    expect(transposeChord('(Bb/F)', -2, true)).toBe('(Ab/Eb)');
    expect(transposeChord('(G)', 2, false)).toBe('(A)');
  });
  test.each(['(Bb/F)', '(Am7)', '(G)'])('%s — акорд', (s) => {
    expect(isChord(s)).toBe(true);
  });
  test.each(['(2x)', '(To Chorus)', 'N.C.', '|', 'x2', '()', '(', '(Bb', '((G))'])('%s — не акорд', (s) => {
    expect(isChord(s)).toBe(false);
  });
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

test('shiftKey пише тональність як в ALL_KEYS і зберігає мінор', () => {
  expect(shiftKey('D', 1)).toBe('Eb');
  expect(shiftKey('Am', -1)).toBe('Abm');
  expect(shiftKey('B', 1)).toBe('C');
  expect(shiftKey('F#m', 0)).toBe('F#m');
});

describe('форми акордів SongSelect', () => {
  test.each([
    ['D/F#', 2, false, 'E/G#'],
    ['G/B', 1, true, 'Ab/C'],
    ['Bb/F', 2, false, 'C/G'],
    ['Gsus', 2, false, 'Asus'],
    ['Asus4', -2, false, 'Gsus4'],
    ['A7sus4', 3, true, 'C7sus4'],
    ['C2', 3, true, 'Eb2'],
    ['Dadd9', 1, true, 'Ebadd9'],
    ['Fmaj7', 2, false, 'Gmaj7'],
    ['Bm7b5', 1, false, 'Cm7b5'],
    ['F#dim7', -1, false, 'Fdim7'],
    ['Eaug', 1, true, 'Faug'],
    ['Bbm', 2, false, 'Cm'],
    ['C#m7', 1, false, 'Dm7'],
  ] as const)('%s на %i (бемолі: %s) → %s', (chord, n, flats, expected) => {
    expect(transposeChord(chord, n, flats)).toBe(expected);
  });

  test.each(['N.C.', '(2x)', '|', 'x2'])('%s не змінюється', (s) => {
    expect(transposeChord(s, 3, false)).toBe(s);
  });
});
