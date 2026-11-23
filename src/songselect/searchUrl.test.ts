import { songSelectSearchUrl } from './searchUrl';

test('кодує запит', () => {
  expect(songSelectSearchUrl('  Amazing Grace ')).toBe('https://songselect.ccli.com/search/results?search=Amazing%20Grace');
});

test('порожній запит — сторінка пошуку без параметра', () => {
  expect(songSelectSearchUrl('')).toBe('https://songselect.ccli.com/search/results');
});
