import { distinctWords, lyricsPlainText, normalizeSearch, searchTokens } from './searchText';

test('нормалізація: регістр, діакритика, апострофи, розділові знаки', () => {
  expect(normalizeSearch("  'Tis So Sweet — Blessèd   Assurance!")).toBe('tis so sweet blessed assurance');
  expect(normalizeSearch('Ти — світло, Ісус!')).toBe('ти світло ісус');
  expect(searchTokens('')).toEqual([]);
});

test('текст без акордів, директив і міток частин', () => {
  expect(lyricsPlainText('{title: X}\nVerse 1:\n[G]Amazing [C]grace\nRefrain:\nHow [D]sweet')).toBe('Amazing grace How sweet');
});

test('унікальні слова без назви й першого рядка', () => {
  expect(distinctWords('Verse 1:\n[G]Amazing grace how sweet\nThat saved a wretch like me\nThat saved', ['Amazing Grace', 'Amazing grace how sweet'])).toBe(
    'that saved wretch like me',
  );
});
