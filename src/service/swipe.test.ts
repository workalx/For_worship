import { detectSwipe, nextSunday } from './swipe';

test.each([
  [-120, 10, 'next'],
  [120, 0, 'prev'],
  [-60, 0, null],
  [-90, 70, null],
  [-80, 0, 'next'],
] as const)('dx=%d dy=%d → %s', (dx, dy, expected) => {
  expect(detectSwipe(dx, dy)).toBe(expected);
});

test('nextSunday — найближча неділя (сьогодні, якщо неділя)', () => {
  expect(nextSunday(new Date(2026, 10, 8))).toBe('2026-11-08'); // неділя
  expect(nextSunday(new Date(2026, 10, 9))).toBe('2026-11-15'); // понеділок
  expect(nextSunday(new Date(2026, 11, 29))).toBe('2027-01-03');
});

test('некоректні координати не дають свайпу', () => {
  expect(detectSwipe(NaN, 0)).toBeNull();
  expect(detectSwipe(-200, NaN)).toBeNull();
});
