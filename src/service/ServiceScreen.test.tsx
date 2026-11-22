import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceScreen } from './ServiceScreen';
import { db, saveSong, listServices } from '../db/db';

beforeEach(async () => {
  await db.songs.clear();
  await db.services.clear();
  await saveSong({ title: 'Великий Бог', body: '[C]Хвала', originalKey: 'C' });
  await saveSong({ title: 'Ти гідний', body: '[E]Гідний', originalKey: 'E' });
});

test('створює служіння, додає пісні, міняє порядок і запускає', async () => {
  const onPlay = vi.fn();
  render(<ServiceScreen onPlay={onPlay} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Нове служіння' }));
  const title = screen.getByLabelText('Назва служіння');
  await userEvent.clear(title);
  await userEvent.type(title, 'Молодіжне');
  await userEvent.click(screen.getByRole('button', { name: 'Створити' }));

  const picker = await screen.findByLabelText('Пісня для додавання');
  await userEvent.selectOptions(picker, 'Великий Бог');
  await userEvent.click(screen.getByRole('button', { name: 'Додати' }));
  await userEvent.selectOptions(picker, 'Ти гідний');
  await userEvent.click(screen.getByRole('button', { name: 'Додати' }));

  await userEvent.click(screen.getAllByRole('button', { name: 'Вище' })[1]);
  await waitFor(async () => {
    const [s] = await listServices();
    expect(s.title).toBe('Молодіжне');
    expect(s.items).toHaveLength(2);
  });
  const [s] = await listServices();
  const first = await db.songs.get(s.items[0].songId);
  expect(first?.title).toBe('Ти гідний');

  await userEvent.click(screen.getByRole('button', { name: 'Почати' }));
  expect(onPlay).toHaveBeenCalledWith(s.id, 0);
});
