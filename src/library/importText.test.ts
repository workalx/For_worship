import { normalizeImportedText, songFromChordProFile, songToChordPro } from './importText';

test('«акорди над рядком» перетворюються на ChordPro', () => {
  const out = normalizeImportedText('Em  C\nСлово');
  expect(out).toContain('[Em]');
  expect(out).toContain('[C]');
});

test('ChordPro лишається як є (крім порожніх рядків)', () => {
  expect(normalizeImportedText('[G]Ти\n\n\n\n[D]світло')).toBe('[G]Ти\n\n[D]світло');
});

test('прибирає пробіли по краях і зайві порожні рядки', () => {
  expect(normalizeImportedText('\n\nКуплет 1\nG\nСлово\n\n\n\nПриспів\nC\nХвала\n\n')).toBe(
    'Куплет 1\n[G]Слово\n\nПриспів\n[C]Хвала',
  );
});

describe('файли ChordPro', () => {
  test('songFromChordProFile бере метадані з директив', () => {
    const s = songFromChordProFile('{title: Be Thou My Vision}\n{key: D}\n{meta: chords auto}\n[D]Be thou my [G]vision', 'x.cho');
    expect(s).toMatchObject({ title: 'Be Thou My Vision', originalKey: 'D', chordsOrigin: 'auto', body: '[D]Be thou my [G]vision' });
  });

  test('без {title} назва береться з імені файлу, тональність з першого акорду', () => {
    const s = songFromChordProFile('[Em]Rock of [C]ages', 'Rock_of_Ages-Toplady.cho');
    expect(s).toMatchObject({ title: 'Rock of Ages Toplady', originalKey: 'Em' });
  });

  test('простий .txt з «акордами над рядком» теж імпортується', () => {
    const s = songFromChordProFile('G        D\nТи світло в темряві', 'song.txt');
    expect(s?.body).toContain('[D]');
    expect(s?.title).toBe('song');
  });

  test('порожній файл не дає пісні', () => {
    expect(songFromChordProFile('{title: Порожньо}\n\n', 'a.cho')).toBeNull();
  });

  test('songToChordPro → songFromChordProFile зберігає пісню', () => {
    const song = {
      title: 'Великий Бог',
      artist: 'Хор',
      body: 'Куплет 1:\n[C]Хвала [G]Тобі',
      originalKey: 'C',
      bpm: 72,
      timeSig: '3/4' as const,
      capo: 1,
      source: 'фото',
      sourceUrl: 'https://example.com/s',
      license: 'public domain',
      chordsOrigin: 'manual' as const,
    };
    expect(songFromChordProFile(songToChordPro(song), 'ignored.cho')).toEqual(song);
  });
});
