import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryScreen } from './LibraryScreen';
import { chordsOriginAfterEdit } from './SongEditor';
import { db, listSongs, saveSong } from '../db/db';
import { exportAll } from '../db/backup';
import type { LibraryIndexEntry, LibrarySong } from './catalogTypes';
import type { LibraryLoader } from './HymnLibrary';

const ENTRY: LibraryIndexEntry = {
  id: 'oh-amazing-grace',
  title: 'Amazing Grace',
  firstLine: 'Amazing grace! How sweet the sound',
  author: 'John Newton',
  key: 'G',
  tags: ['Grace'],
  chordsOrigin: 'auto',
  chunk: 'a-12345678',
  words: 'that saved wretch like me',
};
const HOLY: LibraryIndexEntry = { ...ENTRY, id: 'oh-holy', title: 'Holy, Holy, Holy', firstLine: 'Holy, holy, holy!', author: 'Reginald Heber', key: 'D', words: 'early morning' };
const SONG: LibrarySong = {
  id: ENTRY.id,
  title: 'Amazing Grace',
  artist: 'John Newton',
  key: 'G',
  bpm: 100,
  timeSig: '3/4',
  body: 'Verse 1:\n[G]Amazing grace! How [C]sweet the sound',
  source: 'Open Hymnal Project',
  sourceUrl: 'https://github.com/mzealey/openhymnal/blob/x/Complete/Amazing_Grace/Amazing_Grace-New_Britain.abc',
  license: 'public domain',
  chordsOrigin: 'auto',
};

const fakeLibrary = (fail = false): LibraryLoader => ({
  loadIndex: () =>
    fail
      ? Promise.reject(new Error('Не вдалося відкрити бібліотеку пісень. Перевірте інтернет і спробуйте ще раз'))
      : Promise.resolve({ version: 1, source: { name: 'Open Hymnal Project', repo: '', commit: '' }, songs: [ENTRY, HOLY] }),
  loadSong: () => Promise.resolve(SONG),
});

beforeEach(async () => {
  await db.songs.clear();
  await db.services.clear();
  localStorage.clear();
});

test('без запиту — підказка про бібліотеку; із запитом — результати з позначкою «автоакорди»', async () => {
  const user = userEvent.setup();
  render(<LibraryScreen onPlay={() => {}} library={fakeLibrary()} />);
  expect(await screen.findByText(/У вбудованій бібліотеці 2 англійських гімнів/)).toBeInTheDocument();
  await user.type(screen.getByLabelText('Пошук пісні'), 'wretch');
  expect(await screen.findByText('Бібліотека гімнів')).toBeInTheDocument();
  expect(screen.getByText('Amazing Grace')).toBeInTheDocument();
  expect(screen.queryByText('Holy, Holy, Holy')).not.toBeInTheDocument();
  expect(screen.getByText('автоакорди')).toBeInTheDocument();
  // Пошук в інтернеті лишається нижче.
  expect(screen.getByRole('button', { name: '🔍 Шукати в інтернеті' })).toBeEnabled();
});

test('«+ Додати» одним дотиком зберігає звичайну пісню з джерелом і позначкою, без дублів', async () => {
  const user = userEvent.setup();
  render(<LibraryScreen onPlay={() => {}} library={fakeLibrary()} />);
  await user.type(await screen.findByLabelText('Пошук пісні'), 'amazing');
  await user.click(await screen.findByRole('button', { name: 'Додати «Amazing Grace» в мої пісні' }));
  expect(await screen.findByRole('button', { name: '✓ У моїх піснях' })).toBeInTheDocument();
  const songs = await listSongs();
  expect(songs).toHaveLength(1);
  expect(songs[0]).toMatchObject({
    title: 'Amazing Grace',
    originalKey: 'G',
    chordsOrigin: 'auto',
    license: 'public domain',
    source: 'Open Hymnal Project',
    sourceUrl: SONG.sourceUrl,
    libraryId: ENTRY.id,
  });
  // Додана пісня — у «Моїх піснях» і в резервній копії.
  expect(screen.getAllByText('Amazing Grace').length).toBeGreaterThanOrEqual(2);
  expect(JSON.parse(await exportAll()).songs[0].libraryId).toBe(ENTRY.id);
});

test('картка: перегляд, транспонування без збереження, «Додати в мої пісні» з вибраною тональністю', async () => {
  const user = userEvent.setup();
  render(<LibraryScreen onPlay={() => {}} library={fakeLibrary()} />);
  await user.type(await screen.findByLabelText('Пошук пісні'), 'amazing');
  await user.click(await screen.findByText('Amazing Grace'));
  expect(await screen.findByText('G', { selector: '.ch' })).toBeInTheDocument();
  expect(screen.getByText('автоакорди')).toBeInTheDocument();
  expect(screen.getByText(/Open Hymnal Project · public domain/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Тон вище' }));
  expect(screen.getByText('Ab', { selector: '.ch' })).toBeInTheDocument();
  expect(await db.songs.count()).toBe(0);
  await user.click(screen.getByRole('button', { name: '+ Додати в мої пісні' }));
  // Після додавання відкривається вже власна пісня: редагується, додається в служіння.
  expect(await screen.findByRole('button', { name: 'Додати в служіння' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Редагувати' })).toBeInTheDocument();
  const [saved] = await listSongs();
  expect(saved).toMatchObject({ key: 'Ab', originalKey: 'G', libraryId: ENTRY.id });
});

test('пісня, вже додана з бібліотеки, у картці показує «✓ У моїх піснях» і відкриває її', async () => {
  const mine = await saveSong({ title: 'Amazing Grace', body: SONG.body, libraryId: ENTRY.id, chordsOrigin: 'auto' });
  const user = userEvent.setup();
  render(<LibraryScreen onPlay={() => {}} library={fakeLibrary()} />);
  await user.type(await screen.findByLabelText('Пошук пісні'), 'grace');
  const libraryRow = (await screen.findAllByText('Amazing Grace')).map((el) => el.closest('.item')!).find((row) => within(row as HTMLElement).queryByText('автоакорди') && within(row as HTMLElement).queryByText(/John Newton/));
  await user.click(within(libraryRow as HTMLElement).getByRole('button', { name: '✓ У моїх піснях' }));
  expect(await screen.findByRole('button', { name: 'Додати в служіння' })).toBeInTheDocument();
  expect(await db.songs.count()).toBe(1);
  expect(mine.id).toBeTruthy();
});

test('якщо бібліотека не завантажилась — зрозуміле повідомлення, а пошук в інтернеті працює', async () => {
  render(<LibraryScreen onPlay={() => {}} library={fakeLibrary(true)} />);
  await userEvent.type(await screen.findByLabelText('Пошук пісні'), 'grace');
  expect(await screen.findByText(/Не вдалося відкрити бібліотеку пісень/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: '🔍 Шукати в інтернеті' })).toBeEnabled());
});

describe('позначка «автоакорди» після редагування', () => {
  const body = 'Verse 1:\n[G]Amazing grace! How [C]sweet';
  test('правка лише слів лишає позначку', () => {
    expect(chordsOriginAfterEdit('auto', body, 'Verse 1:\n[G]Amazing grace!! How [C]sweet the sound')).toBe('auto');
  });
  test('правка акордів знімає позначку', () => {
    expect(chordsOriginAfterEdit('auto', body, 'Verse 1:\n[G]Amazing grace! How [Em]sweet')).toBe('manual');
  });
  test('пісні без позначки не чіпаються', () => {
    expect(chordsOriginAfterEdit(undefined, body, '[D]x')).toBeUndefined();
    expect(chordsOriginAfterEdit('manual', body, '[D]x')).toBe('manual');
  });
});
