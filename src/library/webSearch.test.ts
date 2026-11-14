import { isWebUrl, webSearchUrl } from './webSearch';

test('будує пошук «назва акорди» у Brave за замовчуванням', () => {
  expect(webSearchUrl(' Великий Бог ')).toBe(
    `https://search.brave.com/search?q=${encodeURIComponent('Великий Бог акорди')}`,
  );
});

test('не дублює слово «акорди» і враховує вибрану пошукову систему', () => {
  expect(webSearchUrl('Великий Бог акорди', 'google')).toBe(
    `https://www.google.com/search?q=${encodeURIComponent('Великий Бог акорди')}`,
  );
  expect(webSearchUrl('Amazing grace chords', 'duckduckgo')).toBe(
    `https://duckduckgo.com/?q=${encodeURIComponent('Amazing grace chords')}`,
  );
});

test('посилання відкриває як є', () => {
  expect(webSearchUrl('https://example.com/song?id=1')).toBe('https://example.com/song?id=1');
});

test('isWebUrl приймає лише http/https', () => {
  expect(isWebUrl('https://example.com/a')).toBe(true);
  expect(isWebUrl('javascript:alert(1)')).toBe(false);
  expect(isWebUrl('Великий Бог https://example.com')).toBe(false);
});
