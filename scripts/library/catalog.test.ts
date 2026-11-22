import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decodeAbc } from './abc';
import { buildCatalog, chunkKey, firstLineOf, OPEN_HYMNAL, publicDomainReason, songId, tuneName } from './catalog';
import type { LibraryChunk, LibraryIndex } from '../../src/library/catalogTypes';
import { parseChordPro } from '../../src/music/chordpro';

const FIX = join(__dirname, 'fixtures');
const fixture = (name: string) => decodeAbc(readFileSync(join(FIX, name)));
const AMAZING = fixture('Amazing_Grace-New_Britain.abc');

describe('фільтр ліцензій', () => {
  test.each([
    ['public domain.  This score is a part of the Open Hymnal Project, 2006 Revision.', null],
    ['public domain. Setting released into the public domain by Donna Snell 10 Nov 2010.', null],
  ])('приймає «%s»', (c, expected) => expect(publicDomainReason(c)).toBe(expected));

  test.each([
    [undefined, 'немає рядка'],
    ['Words: Copyright 2009, Brian L. Penney. These lyrics may be freely reproduced', 'не public domain'],
    ['music and setting public domain.  Words: Copyright 2010, Anthony Robertson.', 'не public domain'],
    ['Words and Music, public domain.  Setting: Copyright 2009 Brian J. Dumont.', 'не public domain'],
    ['public domain music. Words: Copyright 2001 Someone', 'частина захищена'],
  ])('відкидає «%s»', (c, reason) => expect(publicDomainReason(c)).toContain(reason));
});

describe('допоміжні функції', () => {
  test('id, назва мелодії, частина, перший рядок', () => {
    expect(songId('Complete/Amazing_Grace/Amazing_Grace-New_Britain.abc')).toBe('oh-amazing-grace-new-britain');
    expect(tuneName('Complete/Amazing_Grace/Amazing_Grace-New_Britain.abc')).toBe('New Britain');
    expect(tuneName('Complete/X/What_A_Friend-untitled.abc')).toBeUndefined();
    expect(chunkKey('The Church’s One Foundation')).toBe('c');
    expect(chunkKey('A Mighty Fortress')).toBe('m');
    expect(chunkKey('O Come, All Ye Faithful')).toBe('c');
    expect(chunkKey('Holy, Holy, Holy')).toBe('h');
    expect(chunkKey('123')).toBe('other');
    expect(firstLineOf('Verse 1:\n[G]Amazing [C]grace! How sweet\nThat saved')).toBe('Amazing grace! How sweet');
  });
});

describe('buildCatalog', () => {
  const copyrighted = AMAZING.replace(/^C: copyright:.*$/m, 'C: copyright: Words: Copyright 2009, Someone. These lyrics may be reproduced.');
  const noCopyright = AMAZING.replace(/^C: copyright:.*$/m, '');
  const catalog = buildCatalog([
    { path: 'Complete/Amazing_Grace/Amazing_Grace-New_Britain.abc', text: AMAZING },
    { path: 'Complete/Amazing_Grace/Amazing_Grace-Other_Tune.abc', text: AMAZING },
    { path: 'Complete/Holy_Holy_Holy/Holy_Holy_Holy-Nicaea.abc', text: fixture('Holy_Holy_Holy-Nicaea.abc') },
    { path: 'Complete/X/Copyrighted-Tune.abc', text: copyrighted },
    { path: 'Complete/Y/NoLine-Tune.abc', text: noCopyright },
  ]);

  test('у бібліотеку йде лише public domain, решта — у звіт з причиною', () => {
    expect(catalog.index.songs.map((s) => s.id)).toEqual([
      'oh-amazing-grace-new-britain',
      'oh-amazing-grace-other-tune',
      'oh-holy-holy-holy-nicaea',
    ]);
    expect(catalog.skipped).toEqual([
      { path: 'Complete/X/Copyrighted-Tune.abc', reason: expect.stringContaining('не public domain') },
      { path: 'Complete/Y/NoLine-Tune.abc', reason: expect.stringContaining('немає рядка') },
    ]);
  });

  test('однакові назви розрізняються назвою мелодії', () => {
    expect(catalog.index.songs.map((s) => s.title)).toEqual([
      'Amazing Grace (New Britain)',
      'Amazing Grace (Other Tune)',
      'Holy, Holy, Holy',
    ]);
  });

  test('запис індексу і повна пісня мають усі потрібні поля', () => {
    const entry = catalog.index.songs[0];
    expect(entry).toMatchObject({
      firstLine: 'Amazing grace! How sweet the sound',
      author: 'John Newton',
      key: 'G',
      chordsOrigin: 'auto',
    });
    expect(entry.chunk).toMatch(/^a-[0-9a-f]{8}$/);
    expect(entry.tags.length).toBeGreaterThan(0);
    // Слова тексту без тих, що вже є в назві й першому рядку.
    expect(entry.words.split(' ')).toEqual(expect.arrayContaining(['wretch', 'saved', 'twas', 'snow']));
    expect(entry.words.split(' ')).not.toContain('amazing');
    const song = catalog.chunks.get(entry.chunk)!.songs[entry.id];
    expect(song).toMatchObject({
      source: 'Open Hymnal Project',
      license: 'public domain',
      chordsOrigin: 'auto',
      sourceUrl: `${OPEN_HYMNAL.repo}/blob/${OPEN_HYMNAL.commit}/Complete/Amazing_Grace/Amazing_Grace-New_Britain.abc`,
    });
    expect(parseChordPro(song.body).sections[0].label).toBe('Verse 1');
  });
});

describe('згенерована бібліотека в public/library', () => {
  const dir = join(__dirname, '../../public/library');
  const has = existsSync(join(dir, 'index.json'));

  test.runIf(has)('індекс і частини узгоджені, усе public domain, розмір у межах бюджету', () => {
    const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as LibraryIndex;
    expect(index.version).toBe(1);
    expect(index.source.commit).toBe(OPEN_HYMNAL.commit);
    expect(index.songs.length).toBeGreaterThan(200);
    const chunks = new Map<string, LibraryChunk>();
    for (const f of readdirSync(dir)) {
      const m = /^songs-(.+)\.json$/.exec(f);
      if (m) chunks.set(m[1], JSON.parse(readFileSync(join(dir, f), 'utf8')) as LibraryChunk);
    }
    const ids = new Set<string>();
    for (const e of index.songs) {
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
      const song = chunks.get(e.chunk)?.songs[e.id];
      expect(song, e.id).toBeDefined();
      expect(song!.license).toBe('public domain');
      expect(song!.chordsOrigin).toBe('auto');
      expect(song!.sourceUrl).toContain(OPEN_HYMNAL.commit);
    }
    const total = readdirSync(dir).reduce((sum, f) => sum + statSync(join(dir, f)).size, 0);
    expect(statSync(join(dir, 'index.json')).size).toBeLessThan(300 * 1024);
    expect(total).toBeLessThan(15 * 1024 * 1024);
  });
});
