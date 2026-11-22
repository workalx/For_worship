import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db, listSongs, saveSong } from '../db/db';
import { decodeText, importSongFiles, type ImportFile } from './bulkImport';
import { LibraryScreen } from './LibraryScreen';
import type { LibraryLoader } from './HymnLibrary';

const enc = new TextEncoder();
const file = (name: string, content: string | Uint8Array, size?: number): ImportFile => {
  const bytes = typeof content === 'string' ? enc.encode(content) : content;
  return { name, size: size ?? bytes.byteLength, arrayBuffer: async () => bytes.slice().buffer };
};

/** «Слава» у Windows-1251. */
const CP1251_SLAVA = new Uint8Array([0xd1, 0xeb, 0xe0, 0xe2, 0xe0]);

beforeEach(async () => {
  await db.songs.clear();
  await db.services.clear();
});

describe('масовий імпорт', () => {
  test('ChordPro з метаданими, .txt з «акордами над рядком» і назвою з імені файлу', async () => {
    const report = await importSongFiles(
      [
        file('a.cho', '{title: Ти світло}\n{artist: Гурт}\n{key: G}\n[G]Ти світло в [D]темряві'),
        file('Велика_Любов.txt', 'Am       F\nВелика любов'),
        file('b.chordpro', '{t: Song B}\n[C]Hello'),
      ],
      [],
    );
    expect(report.skipped).toEqual([]);
    expect(report.added.map((s) => s.title)).toEqual(['Ти світло', 'Велика Любов', 'Song B']);
    expect(report.added[0]).toMatchObject({ artist: 'Гурт', originalKey: 'G' });
    expect(report.added[1].body).toContain('[Am]');
    expect(await db.songs.count()).toBe(3);
  });

  test('пропускає з причиною: інший формат, порожній, завеликий, дублікат', async () => {
    await saveSong({ title: 'Є вже', body: '[G]Слово' });
    const report = await importSongFiles(
      [
        file('photo.jpg', 'xx'),
        file('empty.cho', '{title: Нічого}\n'),
        file('big.txt', '[G]x', 2 * 1024 * 1024),
        file('dup.cho', '{title: Є вже}\n[G]Слово'),
        file('twice.cho', '{title: Двічі}\n[C]Раз'),
        file('twice-copy.cho', '{title: Двічі}\n[C]Раз'),
      ],
      await listSongs(),
    );
    expect(report.added.map((s) => s.title)).toEqual(['Двічі']);
    expect(report.skipped).toEqual([
      { name: 'photo.jpg', reason: expect.stringContaining('не текстовий') },
      { name: 'empty.cho', reason: expect.stringContaining('немає тексту') },
      { name: 'big.txt', reason: expect.stringContaining('завеликий') },
      { name: 'dup.cho', reason: expect.stringContaining('вже є') },
      { name: 'twice-copy.cho', reason: expect.stringContaining('вже є') },
    ]);
  });

  test('кодування: UTF-8 з BOM і кирилиця у Windows-1251', () => {
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode('Слава')]).buffer)).toBe('Слава');
    expect(decodeText(CP1251_SLAVA.buffer)).toBe('Слава');
  });
});

describe('кнопка «📂 Імпорт файлів»', () => {
  const noLibrary: LibraryLoader = { loadIndex: () => new Promise(() => {}), loadSong: () => new Promise(() => {}) };

  test('імпортує вибрані файли, показує звіт і нові пісні в списку', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<LibraryScreen onPlay={() => {}} library={noLibrary} />);
    const input = await screen.findByLabelText('Імпорт файлів пісень');
    await user.upload(input, [
      new File(['{title: Нова з файлу}\n[D]Слово'], 'new.cho', { type: 'text/plain' }),
      new File(['x'], 'pic.png', { type: 'image/png' }),
    ]);
    expect(await screen.findByText('Нова з файлу')).toBeInTheDocument();
    expect(screen.getByText(/pic\.png — не текстовий файл/)).toBeInTheDocument();
    expect(screen.getByText('Імпортовано пісень: 1, пропущено: 1')).toBeInTheDocument();
    expect(await db.songs.count()).toBe(1);
  });
});
