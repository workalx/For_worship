import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LibraryIndex, LibraryIndexEntry } from './catalogTypes';
import { createLibrarySearch } from './librarySearch';
import { createLibraryLoader, librarySongToInput } from './libraryData';

const entry = (over: Partial<LibraryIndexEntry>): LibraryIndexEntry => ({
  id: over.title ?? 'x',
  title: 'X',
  firstLine: '',
  key: 'C',
  tags: [],
  chordsOrigin: 'auto',
  chunk: 'x-00000000',
  words: '',
  ...over,
});

const SONGS = [
  entry({ id: 'ag', title: 'Amazing Grace', firstLine: 'Amazing grace! How sweet the sound', author: 'John Newton', words: 'that saved wretch like me twas taught heart fear', tags: ['Grace', 'Salvation'] }),
  entry({ id: 'gr', title: 'Grace Greater Than Our Sin', firstLine: 'Marvelous grace of our loving Lord', author: 'Julia Johnston', words: 'sin' }),
  entry({ id: 'hh', title: 'Holy, Holy, Holy', firstLine: 'Holy, holy, holy! Lord God Almighty!', author: 'Reginald Heber', words: 'early morning song shall rise thee', tags: ['Trinity'] }),
  entry({ id: 'it', title: 'It Is Well With My Soul', firstLine: 'When peace, like a river, attendeth my way', author: 'Horatio Spafford', words: 'sorrows sea billows roll' }),
  entry({ id: 'bb', title: 'Blessed Assurance', firstLine: 'Blessèd assurance, Jesus is mine!', author: 'Fanny Crosby', words: 'story song praising savior' }),
];

describe('пошук по бібліотеці', () => {
  const search = createLibrarySearch(SONGS);
  const ids = (q: string) => search(q).map((e) => e.id);

  test('за назвою: назва, що починається із запиту, вище', () => {
    expect(ids('grace')).toEqual(['gr', 'ag']);
    expect(ids('amazing grace')[0]).toBe('ag');
  });

  test('під час введення: останнє слово як початок', () => {
    expect(ids('amaz')).toEqual(['ag']);
    expect(ids('holy ho')).toEqual(['hh']);
  });

  test('за першим рядком, автором і фрагментом тексту', () => {
    expect(ids('peace like a river')).toEqual(['it']);
    expect(ids('crosby')).toEqual(['bb']);
    expect(ids('saved a wretch')).toEqual(['ag']);
    expect(ids('sea billows')).toEqual(['it']);
  });

  test('без діакритики, регістру й розділових знаків', () => {
    expect(ids('BLESSED assurance!!')).toEqual(['bb']);
    expect(ids('holy holy holy')).toEqual(['hh']);
  });

  test('усі слова мають знайтися; порожній запит — нічого', () => {
    expect(ids('grace river')).toEqual([]);
    expect(ids('   ')).toEqual([]);
  });

  test('за темою', () => {
    expect(ids('trinity')).toEqual(['hh']);
  });

  test('на справжньому індексі: швидко й знаходить відомі гімни', () => {
    const index = JSON.parse(readFileSync(join(__dirname, '../../public/library/index.json'), 'utf8')) as LibraryIndex;
    const real = createLibrarySearch(index.songs);
    const t0 = performance.now();
    const results = [
      real('amazing grace')[0]?.title,
      real('holy holy holy')[0]?.title,
      real('what a friend')[0]?.title,
      real('rock of ages')[0]?.title,
      real('wretch like me')[0]?.title,
    ];
    const ms = performance.now() - t0;
    expect(results).toEqual(['Amazing Grace', 'Holy, Holy, Holy', 'What A Friend We Have In Jesus', 'Rock of Ages', 'Amazing Grace']);
    expect(ms).toBeLessThan(200);
  });
});

describe('завантаження бібліотеки', () => {
  const chunk = { version: 1, songs: { ag: { id: 'ag', title: 'Amazing Grace', artist: 'John Newton', key: 'G', bpm: 100, timeSig: '3/4', body: 'Verse 1:\n[G]Amazing', source: 'Open Hymnal Project', sourceUrl: 'https://x/a.abc', license: 'public domain', chordsOrigin: 'auto' } } };
  const ok = (data: unknown) => Promise.resolve(new Response(JSON.stringify(data)));

  test('індекс і частина завантажуються один раз', async () => {
    const calls: string[] = [];
    const loader = createLibraryLoader((url) => {
      calls.push(url);
      return url.endsWith('index.json') ? ok({ version: 1, source: {}, songs: SONGS }) : ok(chunk);
    });
    await loader.loadIndex();
    await loader.loadIndex();
    const e = { id: 'ag', chunk: 'a-12345678' };
    expect((await loader.loadSong(e)).title).toBe('Amazing Grace');
    await loader.loadSong(e);
    expect(calls).toEqual(['/library/index.json', '/library/songs-a-12345678.json']);
  });

  test('помилка мережі — зрозуміле повідомлення, а наступна спроба йде заново', async () => {
    let fail = true;
    const loader = createLibraryLoader(() => (fail ? Promise.reject(new TypeError('offline')) : ok({ version: 1, source: {}, songs: [] })));
    await expect(loader.loadIndex()).rejects.toThrow('Не вдалося відкрити бібліотеку');
    fail = false;
    await expect(loader.loadIndex()).resolves.toMatchObject({ songs: [] });
  });

  test('пісня з бібліотеки стає звичайною піснею з джерелом і позначкою автоакордів', () => {
    expect(librarySongToInput(chunk.songs.ag as never)).toEqual({
      title: 'Amazing Grace',
      artist: 'John Newton',
      body: 'Verse 1:\n[G]Amazing',
      originalKey: 'G',
      bpm: 100,
      timeSig: '3/4',
      source: 'Open Hymnal Project',
      sourceUrl: 'https://x/a.abc',
      license: 'public domain',
      chordsOrigin: 'auto',
    });
  });
});
