import { fireEvent, render, screen } from '@testing-library/react';
import { ServicePlayer } from './ServicePlayer';
import { db, saveService, saveSong, listServices } from '../db/db';
import userEvent from '@testing-library/user-event';

async function setup() {
  await db.songs.clear();
  await db.services.clear();
  const a = await saveSong({ title: 'Великий Бог', body: '[C]Хвала', originalKey: 'C' });
  const b = await saveSong({ title: 'Світло в темряві', body: '[G]Ти світло', originalKey: 'G' });
  return saveService({ title: 'Неділя', date: '2026-11-08', items: [{ songId: a.id }, { songId: b.id }] });
}

function swipe(dx: number, dy = 0) {
  const area = screen.getByTestId('swipe-area');
  fireEvent.pointerDown(area, { clientX: 400, clientY: 300, pointerId: 1 });
  fireEvent.pointerUp(area, { clientX: 400 + dx, clientY: 300 + dy, pointerId: 1 });
}

test('свайп справа наліво відкриває наступну пісню', async () => {
  const s = await setup();
  render(<ServicePlayer serviceId={s.id} index={0} onExit={() => {}} />);
  expect(await screen.findByText('Великий Бог', { selector: '.topbar-title' , exact: false })).toBeInTheDocument();
  expect(screen.getByText(/пісня 1 з 2/)).toBeInTheDocument();
  swipe(-150);
  expect(await screen.findByText(/пісня 2 з 2/)).toBeInTheDocument();
  expect(screen.getByText('Світло в темряві', { selector: '.topbar-title', exact: false })).toBeInTheDocument();
});

test('на останній пісні свайп «далі» нічого не робить, «назад» повертає', async () => {
  const s = await setup();
  render(<ServicePlayer serviceId={s.id} index={1} onExit={() => {}} />);
  await screen.findByText(/пісня 2 з 2/);
  swipe(-150);
  expect(screen.getByText(/пісня 2 з 2/)).toBeInTheDocument();
  swipe(150);
  expect(await screen.findByText(/пісня 1 з 2/)).toBeInTheDocument();
});

test('вертикальний жест не перемикає пісню', async () => {
  const s = await setup();
  render(<ServicePlayer serviceId={s.id} index={0} onExit={() => {}} />);
  await screen.findByText(/пісня 1 з 2/);
  swipe(-90, 70);
  expect(screen.getByText(/пісня 1 з 2/)).toBeInTheDocument();
});

test('зміна тональності зберігається в служінні', async () => {
  const s = await setup();
  render(<ServicePlayer serviceId={s.id} index={0} onExit={() => {}} />);
  await screen.findByText(/пісня 1 з 2/);
  await userEvent.click(screen.getByRole('button', { name: 'Тон вище' }));
  await screen.findByDisplayValue('Db');
  const [saved] = await listServices();
  expect(saved.items[0].key).toBe('Db');
});
