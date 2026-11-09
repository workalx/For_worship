import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SongScreen } from './SongScreen';
import type { Song } from '../db/db';

const song = (over: Partial<Song> = {}): Song => ({
  id: '1', title: 'Пісня', body: '[D]Слово', originalKey: 'D', createdAt: 1, updatedAt: 1, ...over,
});

test('«+» підвищує тональність на півтону в написанні ALL_KEYS', async () => {
  const onKeyChange = vi.fn();
  render(<SongScreen song={song()} onKeyChange={onKeyChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Тон вище' }));
  expect(onKeyChange).toHaveBeenCalledWith('Eb');
});

test('displayKey транспонує акорди', () => {
  render(<SongScreen song={song()} displayKey="G" onKeyChange={() => {}} />);
  expect(screen.getByText('G', { selector: '.ch' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Тональність' })).toHaveValue('G');
});

test('мінорна пісня: «−» з Am дає Abm', async () => {
  const onKeyChange = vi.fn();
  render(<SongScreen song={song({ originalKey: 'Am', body: '[Am]Слово' })} onKeyChange={onKeyChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Тон нижче' }));
  expect(onKeyChange).toHaveBeenCalledWith('Abm');
});

test('без originalKey тональність береться з першого акорду', async () => {
  const onKeyChange = vi.fn();
  render(<SongScreen song={song({ originalKey: undefined, body: '[C]Слово' })} onKeyChange={onKeyChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Тон вище' }));
  expect(onKeyChange).toHaveBeenCalledWith('Db');
});

test('показує BPM, капо і підзаголовок', () => {
  render(<SongScreen song={song({ bpm: 72, capo: 2 })} subtitle="пісня 2 з 5" onKeyChange={() => {}} />);
  expect(screen.getByText('72')).toBeInTheDocument();
  expect(screen.getByText('2', { selector: 'b' })).toBeInTheDocument();
  expect(screen.getByText('пісня 2 з 5')).toBeInTheDocument();
});
