import { frequencyToNote, nearestString, PitchSmoother, GUITAR_STRINGS } from './notes';

test('A4 = 440 Гц', () => {
  expect(frequencyToNote(440)).toMatchObject({ name: 'A', octave: 4, cents: 0, midi: 69 });
});

test('110.3 Гц — A2 приблизно +5 центів', () => {
  const n = frequencyToNote(110.3);
  expect(n.name).toBe('A');
  expect(n.octave).toBe(2);
  expect(Math.abs(n.cents - 5)).toBeLessThanOrEqual(1);
});

test('82.41 Гц — E2; нижче на чверть тону — від’ємні центи', () => {
  expect(frequencyToNote(82.41)).toMatchObject({ name: 'E', octave: 2 });
  expect(frequencyToNote(81.5).cents).toBeLessThan(0);
});

test('інший стрій A4', () => {
  expect(frequencyToNote(442, 442)).toMatchObject({ name: 'A', cents: 0 });
});

test('стандартний стрій і найближча струна', () => {
  expect(GUITAR_STRINGS.map((s) => s.name + s.octave)).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
  expect(nearestString(108)).toBe(1);
  expect(nearestString(330)).toBe(5);
  expect(nearestString(80)).toBe(0);
});

describe('PitchSmoother', () => {
  test('тиша (мала гучність) дає null', () => {
    const s = new PitchSmoother();
    let out: number | null = 1;
    for (let i = 0; i < 10; i++) out = s.push({ freq: 220, clarity: 0.99, rms: 0.001 });
    expect(out).toBeNull();
  });

  test('випадковий стрибок не збиває показ', () => {
    const s = new PitchSmoother();
    for (let i = 0; i < 5; i++) s.push({ freq: 110, clarity: 0.95, rms: 0.05 });
    expect(s.push({ freq: 300, clarity: 0.95, rms: 0.05 })).toBe(110);
  });

  test('нечіткий звук відкидається, але показ тримається до 10 відкидань', () => {
    const s = new PitchSmoother();
    s.push({ freq: 196, clarity: 0.95, rms: 0.05 });
    for (let i = 0; i < 9; i++) expect(s.push({ freq: 500, clarity: 0.5, rms: 0.05 })).toBe(196);
    expect(s.push(null)).toBeNull();
  });
});
