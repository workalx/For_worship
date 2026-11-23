import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

test('показує 4 вкладки', () => {
  render(<App />);
  for (const name of ['Пісні', 'Служіння', 'Тюнер', 'Метроном']) {
    expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
  }
});

test('перемикає вкладку', async () => {
  render(<App />);
  const tuner = screen.getByRole('button', { name: /Тюнер/ });
  expect(tuner).not.toHaveAttribute('aria-current');
  await userEvent.click(tuner);
  expect(tuner).toHaveAttribute('aria-current', 'page');
});

test('вкладка «Служіння» показує список служінь', async () => {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /Служіння/ }));
  expect(await screen.findByRole('button', { name: 'Нове служіння' })).toBeInTheDocument();
});

test('вкладка «Пісні» відкривається першою і показує бібліотеку', async () => {
  render(<App />);
  expect(await screen.findByRole('button', { name: 'Нова пісня' })).toBeInTheDocument();
});

test('вкладка «Тюнер» показує тюнер', async () => {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /Тюнер/ }));
  expect(screen.getByRole('button', { name: 'Увімкнути мікрофон' })).toBeInTheDocument();
});

test('метроном бере темп з останньої відкритої пісні', async () => {
  const { db, saveSong } = await import('./db/db');
  await db.songs.clear();
  await saveSong({ title: 'Ти гідний', body: '[E]Гідний', originalKey: 'E', bpm: 80 });
  render(<App />);
  await userEvent.click(await screen.findByText('Ти гідний'));
  await screen.findByText('Гідний');
  await userEvent.click(screen.getByRole('button', { name: /Метроном/ }));
  await userEvent.click(screen.getByRole('button', { name: /З пісні: Ти гідний · 80/ }));
  expect(screen.getByTestId('bpm')).toHaveTextContent('80');
});

test('після переходу на іншу вкладку служіння продовжується з тієї ж пісні', async () => {
  const { db, saveSong, saveService } = await import('./db/db');
  const { fireEvent } = await import('@testing-library/react');
  await db.songs.clear();
  await db.services.clear();
  const a = await saveSong({ title: 'Перша', body: '[C]а', originalKey: 'C' });
  const b = await saveSong({ title: 'Друга', body: '[G]б', originalKey: 'G' });
  await saveService({ title: 'Неділя', date: '2999-01-01', items: [{ songId: a.id }, { songId: b.id }] });
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /Служіння/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Почати' }));
  await screen.findByText(/пісня 1 з 2/);
  const area = screen.getByTestId('swipe-area');
  fireEvent.pointerDown(area, { clientX: 400, clientY: 300 });
  fireEvent.pointerUp(area, { clientX: 200, clientY: 300 });
  await screen.findByText(/пісня 2 з 2/);
  await userEvent.click(screen.getByRole('button', { name: /Тюнер/ }));
  await userEvent.click(screen.getByRole('button', { name: /Служіння/ }));
  expect(await screen.findByText(/пісня 2 з 2/)).toBeInTheDocument();
});

test('при старті просить браузер зберігати базу постійно', async () => {
  const persist = vi.fn(async () => true);
  Object.defineProperty(navigator, 'storage', { configurable: true, value: { persisted: async () => false, persist } });
  render(<App />);
  await vi.waitFor(() => expect(persist).toHaveBeenCalled());
  Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined });
});

test('імпортована пісня відкривається один раз: повернення на «Пісні» показує список', async () => {
  const { db } = await import('./db/db');
  const { SONGSELECT_SAMPLE_HTML } = await import('./songselect/fixtures');
  await db.songs.clear();
  render(<App />);
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        type: 'for-worship/songselect-import',
        version: 1,
        html: SONGSELECT_SAMPLE_HTML,
        pageUrl: 'https://songselect.ccli.com/songs/1234567/test',
        ccliNumber: '1234567',
      },
    }),
  );
  expect(await screen.findByRole('button', { name: 'До списку пісень' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Тюнер/ }));
  await userEvent.click(screen.getByRole('button', { name: /Пісні/ }));
  expect(await screen.findByLabelText('Пошук пісні')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'До списку пісень' })).not.toBeInTheDocument();
});
