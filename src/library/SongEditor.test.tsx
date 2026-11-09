import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SongEditor } from './SongEditor';
import { db } from '../db/db';

beforeEach(async () => {
  await db.songs.clear();
});

test('вставлений текст розбирається, тональність вгадується з першого акорду', async () => {
  const onSave = vi.fn();
  render(<SongEditor onSave={onSave} onCancel={() => {}} />);
  await userEvent.type(screen.getByLabelText('Назва'), 'Свята любов');
  await userEvent.click(screen.getByLabelText('Текст пісні'));
  await userEvent.paste('Am    F\nСвята любов Твоя');
  expect(screen.getByLabelText('Текст пісні')).toHaveValue('[Am]Свята [F]любов Твоя');
  await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const saved = onSave.mock.calls[0][0];
  expect(saved.title).toBe('Свята любов');
  expect(saved.originalKey).toBe('Am');
  expect(await db.songs.count()).toBe(1);
});

test('без назви зберегти не можна', async () => {
  const onSave = vi.fn();
  render(<SongEditor onSave={onSave} onCancel={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByText('Вкажіть назву пісні')).toBeInTheDocument();
});

test('редагування існуючої пісні зберігає id', async () => {
  const onSave = vi.fn();
  render(
    <SongEditor
      initial={{ id: 'x1', title: 'Стара', body: '[G]a', originalKey: 'G', bpm: 70 }}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  expect(screen.getByLabelText('BPM')).toHaveValue(70);
  await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave.mock.calls[0][0].id).toBe('x1');
});
