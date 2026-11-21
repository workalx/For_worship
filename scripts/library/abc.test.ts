import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeAbc, meterInfo, parseAbc, parseKey, parseLyricLine } from './abc';
import { abcToChordPro, formatAuthors, metricalPattern } from './abcToChordPro';
import { chordName, harmonize } from './harmony';
import { parseChordProFile } from '../../src/music/chordproFile';
import { parseChordPro } from '../../src/music/chordpro';

const FIX = join(__dirname, 'fixtures');
const load = (name: string) => parseAbc(decodeAbc(readFileSync(join(FIX, name))));
const AMAZING = 'Amazing_Grace-New_Britain.abc';
const HOLY = 'Holy_Holy_Holy-Nicaea.abc';
const FRIEND = 'What_A_Friend_We_Have_In_Jesus-untitled.abc';
const BLESSED = 'Blessed_Assurance-Blessed_Assurance-Assurance.abc';
const ALL = [AMAZING, HOLY, FRIEND, BLESSED];

describe('розбір ABC', () => {
  test('тональність: знаки й назва', () => {
    expect(parseKey('G')).toEqual({ accidentals: { F: 1 }, name: 'G' });
    expect(parseKey('Eb % key')).toEqual({ accidentals: { B: -1, E: -1, A: -1 }, name: 'Eb' });
    expect(parseKey('F#m')).toEqual({ accidentals: { F: 1, C: 1, G: 1 }, name: 'F#m' });
    expect(parseKey('Dm').name).toBe('Dm');
    expect(parseKey('Dm').accidentals).toEqual({ B: -1 });
  });

  test('метр: доля і такт', () => {
    expect(meterInfo('3/4')).toEqual({ beat: 1 / 4, bar: 3 / 4 });
    expect(meterInfo('6/8')).toEqual({ beat: 3 / 8, bar: 6 / 8 });
    expect(meterInfo('C|')).toEqual({ beat: 1 / 2, bar: 1 });
  });

  test('рядок слів: склади, пропуски, тягнення, ~ і такт', () => {
    expect(parseLyricLine('1.~A- maz- ing * grace!')).toEqual([
      { kind: 'syl', text: '1. A', wordEnd: false },
      { kind: 'syl', text: 'maz', wordEnd: false },
      { kind: 'syl', text: 'ing', wordEnd: true },
      { kind: 'skip' },
      { kind: 'syl', text: 'grace!', wordEnd: true },
    ]);
    expect(parseLyricLine('sweet_ | sound')).toEqual([
      { kind: 'syl', text: 'sweet', wordEnd: true },
      { kind: 'hold' },
      { kind: 'bar' },
      { kind: 'syl', text: 'sound', wordEnd: true },
    ]);
  });

  test('Amazing Grace: метадані, 4 голоси однакової довжини, 5 куплетів під нотами й 2 окремо', () => {
    const t = load(AMAZING);
    expect(t.title).toBe('Amazing Grace');
    expect(t.key).toBe('G');
    expect(t.meter).toBe('3/4');
    expect(t.tempo).toBe(100);
    expect(t.copyright?.startsWith('public domain')).toBe(true);
    expect(t.meta.AUTHOR).toBe('Newton, John (1725-1807)');
    expect(t.voices.map((v) => v.id)).toEqual(['S1V1', 'S1V2', 'S2V1', 'S2V2']);
    const ends = t.voices.map((v) => v.end);
    expect(Math.max(...ends) - Math.min(...ends)).toBeLessThan(1e-9);
    // Мелодія: затакт D4, далі G4 B4 G4 (D G2 B/G/).
    expect(t.voices[0].notes.slice(0, 4).map((n) => n.pitches[0])).toEqual([62, 67, 71, 67]);
    expect(t.voices[0].notes[2].dur).toBeCloseTo(1 / 8);
    expect(Math.max(...[...t.lyrics.values()].map((l) => l.length))).toBe(5);
    expect(t.extraVerses).toHaveLength(2);
  });

  test('Latin-1 файл читається без «�»', () => {
    expect(load(BLESSED).extraVerses.join(' ') + [...load(BLESSED).lyrics.values()].join(' ')).not.toContain('�');
  });
});

describe('акорди з чотириголосся', () => {
  test.each(ALL)('%s: не більше двох акордів на такт, лише мажор/мінор/7', (name) => {
    const t = load(name);
    const events = harmonize(t);
    const starts = t.voices[0].barStarts;
    const perBar = new Map<number, number>();
    for (const e of events) {
      let bar = 0;
      while (bar + 1 < starts.length && starts[bar + 1] <= e.time + 1e-9) bar++;
      perBar.set(bar, (perBar.get(bar) ?? 0) + 1);
    }
    expect(Math.max(...perBar.values())).toBeLessThanOrEqual(2);
    for (const e of events) expect(['', 'm', '7']).toContain(e.quality);
  });

  test('Amazing Grace (G): починається й закінчується на G, акорди з G C D7 Em', () => {
    const t = load(AMAZING);
    const names = harmonize(t).map((e) => chordName(e, false));
    expect(names[0]).toBe('G');
    expect(names[names.length - 1]).toBe('G');
    expect(new Set(names)).toEqual(new Set(['G', 'C', 'D7', 'Em']));
  });

  test('What a Friend (F): лише I, IV, V', () => {
    const names = harmonize(load(FRIEND)).map((e) => chordName(e, true));
    expect(new Set(names)).toEqual(new Set(['F', 'Bb', 'C']));
  });

  test('Holy, Holy, Holy (D): тоніка на початку й у кінці, бемолі не з’являються', () => {
    const names = harmonize(load(HOLY)).map((e) => chordName(e, false));
    expect(names[0]).toBe('D');
    expect(names[names.length - 1]).toBe('D');
    expect(names.join(' ')).not.toMatch(/b/);
  });
});

describe('ABC → ChordPro', () => {
  test('допоміжне: автори й віршовий розмір', () => {
    expect(formatAuthors('Newton, John (1725-1807)')).toBe('John Newton');
    expect(formatAuthors('Heber, Reginald (1783-1826);Smith, J.')).toBe('Reginald Heber, J. Smith');
    expect(formatAuthors('none')).toBeUndefined();
    expect(metricalPattern('8 6 8 6')).toEqual([8, 6, 8, 6]);
    expect(metricalPattern('C M D')).toEqual([8, 6, 8, 6, 8, 6, 8, 6]);
    expect(metricalPattern('Irregular')).toBeNull();
  });

  test('Amazing Grace: перший куплет з акордами над складами', () => {
    const song = abcToChordPro(load(AMAZING), { source: 'Open Hymnal Project', license: 'public domain' });
    const verse1 = song.body.split('\n\n')[0];
    expect(verse1).toBe(
      [
        'Verse 1:',
        '[G]Amazing grace! [D7]How [Em]sweet [C]the [G]sound',
        'That saved a wretch [D7]like [G]me!',
        'I once was lost, but [C]now am [G]found;',
        'Was [Em]blind, [G]but now [D7]I [G]see.',
      ].join('\n'),
    );
    expect(song.body).toContain('Verse 7:\nWhen we\'ve been there ten thousand years,');
    expect(song.stats.warnings).toEqual([]);
  });

  test('файл ChordPro має метадані й позначку автоакордів, текст розбирається програмою', () => {
    const song = abcToChordPro(load(AMAZING), { source: 'Open Hymnal Project', sourceUrl: 'https://x/a.abc', license: 'public domain' });
    const { meta, body } = parseChordProFile(song.chordpro);
    expect(meta).toEqual({
      title: 'Amazing Grace',
      artist: 'John Newton',
      key: 'G',
      bpm: 100,
      timeSig: '3/4',
      source: 'Open Hymnal Project',
      sourceUrl: 'https://x/a.abc',
      license: 'public domain',
      chordsOrigin: 'auto',
    });
    const doc = parseChordPro(body);
    expect(doc.sections.map((s) => s.label)).toEqual(['Verse 1', 'Verse 2', 'Verse 3', 'Verse 4', 'Verse 5', 'Verse 6', 'Verse 7']);
  });

  test('Blessed Assurance: приспів окремою частиною, з рядками за віршовим розміром', () => {
    const song = abcToChordPro(load(BLESSED));
    const parts = song.body.split('\n\n');
    expect(parts[0].startsWith('Verse 1:\n[D]Blessèd assurance, Jesus is mine!')).toBe(true);
    expect(parts[1]).toBe(
      [
        'Refrain:',
        'This is my story, [G]this is my [D]song,',
        'Praising my [G]Savior, [A]all the day long;',
        '[A7]This is my [D]story, this is my song,',
        'Praising my [Em]Savior, [D]all the day long.',
      ].join('\n'),
    );
    expect(parts.filter((p) => p.startsWith('Refrain:'))).toHaveLength(1);
  });
});
