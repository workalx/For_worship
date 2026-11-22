import { parseChordProFile, toChordProFile } from './chordproFile';
import { parseChordPro } from './chordpro';

const FILE = `{title: Amazing Grace}
{artist: John Newton}
{key: G}
{tempo: 90}
{time: 3/4}
{capo: 2}
{meta: source Open Hymnal Project}
{meta: sourceurl https://example.com/amazing.abc}
{meta: license public domain}
{meta: chords auto}

{c: Verse 1}
A[G]mazing [C]grace, how [G]sweet the sound
{soc}
[D]Chorus line
`;

test('метадані з директив, текст і мітки частин лишаються в body', () => {
  const { meta, body } = parseChordProFile(FILE);
  expect(meta).toEqual({
    title: 'Amazing Grace',
    artist: 'John Newton',
    key: 'G',
    bpm: 90,
    timeSig: '3/4',
    capo: 2,
    source: 'Open Hymnal Project',
    sourceUrl: 'https://example.com/amazing.abc',
    license: 'public domain',
    chordsOrigin: 'auto',
  });
  expect(body).toBe('{c: Verse 1}\nA[G]mazing [C]grace, how [G]sweet the sound\n{soc}\n[D]Chorus line');
  const doc = parseChordPro(body);
  expect(doc.sections.map((s) => s.label)).toEqual(['Verse 1', 'Приспів']);
});

test('короткі назви директив, copyright і BOM', () => {
  const { meta } = parseChordProFile('﻿{t: Пісня}\r\n{st: Автор}\r\n{copyright: public domain}\r\n[Am]Слово');
  expect(meta).toEqual({ title: 'Пісня', artist: 'Автор', license: 'public domain' });
});

test('неправильні значення ігноруються, а не ламають розбір', () => {
  const { meta, body } = parseChordProFile('{key: H}\n{time: 5/4}\n{capo: 20}\n{tempo: швидко}\n{meta: chords maybe}\n[G]x');
  expect(meta).toEqual({});
  expect(body).toBe('[G]x');
});

test('експорт → імпорт повертає ті самі метадані й текст', () => {
  const song = {
    title: 'Holy, Holy, Holy',
    artist: 'Reginald Heber',
    key: 'D',
    bpm: 80,
    timeSig: '4/4' as const,
    capo: 3,
    source: 'Open Hymnal Project',
    sourceUrl: 'https://example.com/holy.abc',
    license: 'public domain',
    chordsOrigin: 'auto' as const,
    body: 'Verse 1:\n[D]Holy, holy, [Bm]holy',
  };
  const text = toChordProFile(song);
  expect(text.startsWith('{title: Holy, Holy, Holy}\n')).toBe(true);
  const { meta, body } = parseChordProFile(text);
  const { body: _b, ...expected } = song;
  expect(meta).toEqual(expected);
  expect(body).toBe(song.body);
});

test('експорт не дублює директиви, що вже є в тексті', () => {
  const text = toChordProFile({ title: 'Нова', body: '{title: Стара}\n{key: C}\n[C]x' });
  expect(text.match(/\{title/g)).toHaveLength(1);
  expect(text).not.toContain('{key: C}');
  expect(parseChordProFile(text).meta.title).toBe('Нова');
});
