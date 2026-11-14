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

test('каподастр: F#m з капо 2 показує акорди Em, тональність лишається F#m', () => {
  render(
    <SongScreen
      song={song({ originalKey: 'F#m', body: '[F#m]Слово [D]друге [A]третє [E]кінець', capo: 2 })}
      onKeyChange={() => {}}
    />,
  );
  expect(screen.getByText('Em', { selector: '.ch' })).toBeInTheDocument();
  expect(screen.getByText('C', { selector: '.ch' })).toBeInTheDocument();
  expect(screen.getByText('G', { selector: '.ch' })).toBeInTheDocument();
  expect(screen.getByText('D', { selector: '.ch' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Тональність' })).toHaveValue('F#m');
  expect(screen.getByText('акорди як у Em')).toBeInTheDocument();
});

test('каподастр враховує і змінену тональність', () => {
  render(<SongScreen song={song({ capo: 3 })} displayKey="G" onKeyChange={() => {}} />);
  expect(screen.getByText('E', { selector: '.ch' })).toBeInTheDocument();
});

test('кнопки каподастра: «+» і «−», не нижче 0', async () => {
  const onCapoChange = vi.fn();
  const { rerender } = render(<SongScreen song={song()} onKeyChange={() => {}} onCapoChange={onCapoChange} />);
  expect(screen.getByRole('button', { name: 'Капо нижче' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Капо вище' }));
  expect(onCapoChange).toHaveBeenCalledWith(1);
  rerender(<SongScreen song={song({ capo: 2 })} onKeyChange={() => {}} onCapoChange={onCapoChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Капо нижче' }));
  expect(onCapoChange).toHaveBeenLastCalledWith(1);
});

test('без onCapoChange кнопок каподастра немає', () => {
  render(<SongScreen song={song()} onKeyChange={() => {}} />);
  expect(screen.queryByRole('button', { name: 'Капо вище' })).not.toBeInTheDocument();
});

test('показує BPM, капо і підзаголовок', () => {
  render(<SongScreen song={song({ bpm: 72, capo: 2 })} subtitle="пісня 2 з 5" onKeyChange={() => {}} />);
  expect(screen.getByText('72')).toBeInTheDocument();
  expect(screen.getByText('2', { selector: 'b' })).toBeInTheDocument();
  expect(screen.getByText('пісня 2 з 5')).toBeInTheDocument();
});
