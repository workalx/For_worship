import { parseShared } from './shareTarget';

const qs = (o: Record<string, string>) => '?' + new URLSearchParams(o).toString();

test('без параметрів нічого не повертає', () => {
  expect(parseShared('')).toBeNull();
  expect(parseShared('?foo=1')).toBeNull();
});

test('виділений текст стає текстом пісні', () => {
  expect(parseShared(qs({ title: 'Великий Бог', text: 'Em  C\nСлово' }))).toEqual({
    kind: 'text',
    text: 'Em  C\nСлово',
    title: 'Великий Бог',
    source: undefined,
  });
});

test('адреса в кінці тексту стає джерелом, а не частиною пісні', () => {
  expect(parseShared(qs({ text: 'Em  C\nСлово\nhttps://example.com/song' }))).toEqual({
    kind: 'text',
    text: 'Em  C\nСлово',
    title: undefined,
    source: 'https://example.com/song',
  });
});

test('поширена сторінка без тексту дає посилання', () => {
  expect(parseShared(qs({ title: 'Сторінка', text: 'https://example.com/song' }))).toEqual({
    kind: 'url',
    url: 'https://example.com/song',
    title: 'Сторінка',
  });
  expect(parseShared(qs({ url: 'https://example.com/a' }))).toEqual({
    kind: 'url',
    url: 'https://example.com/a',
    title: undefined,
  });
});
