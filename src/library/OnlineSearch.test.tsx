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

test('збережені результати показуються без нового запиту', async () => {
  const searchSongs = vi.fn(async () => [{ title: 'Нове', body: '[C]x' }]);
  const cache = new Map([['світло', [{ title: 'З кешу', body: '[G]a' }]]]);
  render(<OnlineSearch query="світло" cache={cache} provider={fake(searchSongs)} onPick={() => {}} onManual={() => {}} onSettings={() => {}} />);
  expect(screen.getByText('З кешу')).toBeInTheDocument();
  expect(searchSongs).not.toHaveBeenCalled();
});

test('результати потрапляють у кеш', async () => {
  const cache = new Map();
  render(<OnlineSearch query="q" cache={cache} provider={fake(async () => [{ title: 'R', body: '[C]x' }])} onPick={() => {}} onManual={() => {}} onSettings={() => {}} />);
  await screen.findByText('R');
  expect(cache.get('q')).toEqual([{ title: 'R', body: '[C]x' }]);
});

test('новий nonce повторює пошук після помилки', async () => {
  let n = 0;
  const provider = fake(async () => {
    n++;
    if (n === 1) throw new AiError('network');
    return [{ title: 'Вдалося', body: '[C]x' }];
  });
  const { rerender } = render(<OnlineSearch query="q" nonce={1} provider={provider} onPick={() => {}} onManual={() => {}} onSettings={() => {}} />);
  await screen.findByText(/Немає інтернету/);
  rerender(<OnlineSearch query="q" nonce={2} provider={provider} onPick={() => {}} onManual={() => {}} onSettings={() => {}} />);
  expect(await screen.findByText('Вдалося')).toBeInTheDocument();
});
