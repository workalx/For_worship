import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryScreen } from './LibraryScreen';
import { db, saveSong, saveService, listServices } from '../db/db';

beforeEach(async () => {
  await db.songs.clear();
  await db.services.clear();
  await saveSong({ title: 'Великий Бог', body: '[C]Хвала', originalKey: 'C' });
  await saveSong({ title: 'Світло в темряві', body: '[G]Ти світло', originalKey: 'G' });
});

test('пошук серед своїх пісень', async () => {
  render(<LibraryScreen onPlay={() => {}} />);
  expect(await screen.findByText('Великий Бог')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Пошук пісні'), 'світло');
  expect(screen.queryByText('Великий Бог')).not.toBeInTheDocument();
  expect(screen.getByText('Світло в темряві')).toBeInTheDocument();
});

test('відкриває пісню і додає її в найближче служіння', async () => {
  const sv = await saveService({ title: 'Неділя', date: '2999-01-01', items: [] });
  render(<LibraryScreen onPlay={() => {}} />);
  await userEvent.click(await screen.findByText('Великий Бог'));
  expect(await screen.findByText('Хвала')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Додати в служіння' }));
  const [s] = await listServices();
  expect(s.id).toBe(sv.id);
  expect(s.items).toHaveLength(1);
});

test('«Нова пісня» відкриває редактор', async () => {
  render(<LibraryScreen onPlay={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Нова пісня' }));
  expect(screen.getByLabelText('Текст пісні')).toBeInTheDocument();
});

test('пошук в інтернеті без ключа відкриває пошук у браузері', async () => {
  localStorage.clear();
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);
  render(<LibraryScreen onPlay={() => {}} />);
  const online = await screen.findByRole('button', { name: 'Шукати в інтернеті' });
  expect(online).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Пошук пісні'), 'Свята любов');
  await userEvent.click(online);
  expect(open).toHaveBeenCalledTimes(1);
  expect(open.mock.calls[0][0]).toBe(
    `https://search.brave.com/search?q=${encodeURIComponent('Свята любов акорди')}`,
  );
  expect(screen.getByText(/Пошук відкрито в браузері/)).toBeInTheDocument();
  expect(screen.queryByText('Додайте ключ Gemini в налаштуваннях')).not.toBeInTheDocument();
  open.mockRestore();
});

test('«У браузері» використовує пошукову систему з налаштувань', async () => {
  localStorage.setItem('fw.settings', JSON.stringify({ geminiKey: 'k', searchEngine: 'google' }));
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);
  render(<LibraryScreen onPlay={() => {}} />);
  const btn = await screen.findByRole('button', { name: 'У браузері' });
  expect(btn).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Пошук пісні'), 'Свята любов');
  await userEvent.click(btn);
  expect(open.mock.calls[0][0]).toBe(`https://www.google.com/search?q=${encodeURIComponent('Свята любов акорди')}`);
  open.mockRestore();
  localStorage.clear();
});

test('«Вставити з буфера» відкриває редактор з розібраною піснею', async () => {
  const user = userEvent.setup();
  render(<LibraryScreen onPlay={() => {}} />);
  await user.type(await screen.findByLabelText('Пошук пісні'), 'Свята любов');
  await navigator.clipboard.writeText('Em      C\nСвята любов');
  await user.click(screen.getByRole('button', { name: 'Вставити з буфера' }));
  const body = (await screen.findByLabelText('Текст пісні')) as HTMLTextAreaElement;
  expect(body.value).toContain('[Em]');
  expect(body.value).toContain('[C]');
  expect(screen.getByDisplayValue('Свята любов')).toBeInTheDocument();
});

test('порожній буфер відкриває редактор з підказкою', async () => {
  const user = userEvent.setup();
  render(<LibraryScreen onPlay={() => {}} />);
  await screen.findByText('Великий Бог');
  await navigator.clipboard.writeText('   ');
  await user.click(screen.getByRole('button', { name: 'Вставити з буфера' }));
  expect(await screen.findByLabelText('Текст пісні')).toHaveValue('');
  expect(screen.getByText(/Не вдалося прочитати буфер/)).toBeInTheDocument();
});

test('поширений з браузера текст одразу відкривається в редакторі', async () => {
  render(
    <LibraryScreen
      onPlay={() => {}}
      shared={{ kind: 'text', text: 'Am   F\nСлово', title: 'Нова пісня з сайту', source: 'https://example.com/s' }}
    />,
  );
  const body = (await screen.findByLabelText('Текст пісні')) as HTMLTextAreaElement;
  expect(body.value).toContain('[Am]');
  expect(screen.getByDisplayValue('Нова пісня з сайту')).toBeInTheDocument();
});

test('поширене посилання без ключа підказує поділитися текстом', async () => {
  localStorage.clear();
  render(<LibraryScreen onPlay={() => {}} shared={{ kind: 'url', url: 'https://example.com/s' }} />);
  expect(await screen.findByLabelText('Пошук пісні')).toHaveValue('https://example.com/s');
  expect(screen.getByText(/Отримано лише посилання/)).toBeInTheDocument();
});

test('⚙ відкриває налаштування', async () => {
  render(<LibraryScreen onPlay={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Налаштування' }));
  expect(screen.getByText('Резервна копія')).toBeInTheDocument();
});

test('кнопка «Фото» активна', async () => {
  render(<LibraryScreen onPlay={() => {}} />);
  expect(await screen.findByRole('button', { name: 'Фото' })).toBeEnabled();
});

test('🗑 на екрані пісні видаляє її після підтвердження', async () => {
  render(<LibraryScreen onPlay={() => {}} />);
  await userEvent.click(await screen.findByText('Великий Бог'));
  await userEvent.click(await screen.findByRole('button', { name: 'Видалити пісню' }));
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Видалити' }));
  expect(await screen.findByText('Світло в темряві')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText('Великий Бог')).not.toBeInTheDocument());
  expect(await db.songs.count()).toBe(1);
});

test('🗑 без підтвердження нічого не видаляє', async () => {
  render(<LibraryScreen onPlay={() => {}} />);
  await userEvent.click(await screen.findByText('Великий Бог'));
  await userEvent.click(await screen.findByRole('button', { name: 'Видалити пісню' }));
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Скасувати' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(await db.songs.count()).toBe(2);
});

test('🗑 у списку видаляє пісню, не відкриваючи її', async () => {
  render(<LibraryScreen onPlay={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Видалити «Великий Бог»' }));
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Видалити' }));
  await waitFor(() => expect(screen.queryByText('Великий Бог')).not.toBeInTheDocument());
  expect(screen.getByText('Світло в темряві')).toBeInTheDocument();
  expect(screen.getByLabelText('Пошук пісні')).toBeInTheDocument();
  expect(await db.songs.count()).toBe(1);
});

test('🗑 у списку без підтвердження нічого не видаляє', async () => {
  render(<LibraryScreen onPlay={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Видалити «Великий Бог»' }));
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Скасувати' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(await db.songs.count()).toBe(2);
  expect(screen.getByText('Великий Бог')).toBeInTheDocument();
});

test('«Видалити» в редакторі питає підтвердження у власному вікні', async () => {
  render(<LibraryScreen onPlay={() => {}} />);
  await userEvent.click(await screen.findByText('Великий Бог'));
  await userEvent.click(await screen.findByRole('button', { name: 'Редагувати' }));
  await userEvent.click(screen.getByRole('button', { name: 'Видалити' }));
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Видалити' }));
  expect(await screen.findByText('Світло в темряві')).toBeInTheDocument();
  expect(await db.songs.count()).toBe(1);
});
