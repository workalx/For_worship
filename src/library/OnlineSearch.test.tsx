import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnlineSearch } from './OnlineSearch';
import { AiError, type AiProvider } from '../ai/provider';

const fake = (impl: AiProvider['searchSongs']): AiProvider => ({ searchSongs: impl, recognizePhoto: vi.fn() });

test('показує знайдені варіанти і передає вибраний', async () => {
  const onPick = vi.fn();
  const provider = fake(async () => [
    { title: 'Світло в темряві', key: 'D', body: '[D]a', source: 'https://a.example/1' },
    { title: 'Світло в темряві (live)', key: 'A', body: '[A]b' },
  ]);
  render(<OnlineSearch query="світло" provider={provider} onPick={onPick} onManual={() => {}} onSettings={() => {}} />);
  expect(screen.getByText('Шукаю…')).toBeInTheDocument();
  expect(await screen.findByText('Світло в темряві (live)')).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole('button', { name: '+ Додати' })[0]);
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ title: 'Світло в темряві', key: 'D' }));
});

test('ліміт — повідомлення і кнопка ручної вставки', async () => {
  const onManual = vi.fn();
  const provider = fake(async () => {
    throw new AiError('quota');
  });
  render(<OnlineSearch query="x" provider={provider} onPick={() => {}} onManual={onManual} onSettings={() => {}} />);
  expect(await screen.findByText(/ліміт Gemini/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Вставити текст вручну' }));
  expect(onManual).toHaveBeenCalled();
});

test('немає ключа — кнопка налаштувань', async () => {
  const onSettings = vi.fn();
  const provider = fake(async () => {
    throw new AiError('no-key');
  });
  render(<OnlineSearch query="x" provider={provider} onPick={() => {}} onManual={() => {}} onSettings={onSettings} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Відкрити налаштування' }));
  expect(onSettings).toHaveBeenCalled();
});
