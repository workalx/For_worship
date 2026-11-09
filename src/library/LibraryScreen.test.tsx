import { render, screen } from '@testing-library/react';
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

test('«+ Нова пісня» відкриває редактор', async () => {
  render(<LibraryScreen onPlay={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Нова пісня' }));
  expect(screen.getByLabelText('Текст пісні')).toBeInTheDocument();
});

test('пошук в інтернеті без ключа веде в налаштування', async () => {
  localStorage.clear();
  render(<LibraryScreen onPlay={() => {}} />);
  const online = await screen.findByRole('button', { name: '🔍 В інтернеті' });
  expect(online).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Пошук пісні'), 'Свята любов');
  await userEvent.click(online);
  expect(await screen.findByText('Додайте ключ Gemini в налаштуваннях')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Відкрити налаштування' }));
  expect(screen.getByLabelText('Ключ Gemini')).toBeInTheDocument();
});

test('⚙ відкриває налаштування', async () => {
  render(<LibraryScreen onPlay={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Налаштування' }));
  expect(screen.getByText('Резервна копія')).toBeInTheDocument();
});

test('кнопка «📷 Фото» активна', async () => {
  render(<LibraryScreen onPlay={() => {}} />);
  expect(await screen.findByRole('button', { name: '📷 Фото' })).toBeEnabled();
});
