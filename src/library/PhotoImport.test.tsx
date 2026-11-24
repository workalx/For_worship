import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { PhotoImport } from './PhotoImport';
import { AiError } from '../ai/provider';

const recognizePhoto = vi.fn();
const getProvider = vi.fn();
const recognizeWithTesseract = vi.fn();

vi.mock('../ai/getProvider', () => ({ getProvider: () => getProvider() }));
vi.mock('../ocr/tesseract', () => ({
  recognizeWithTesseract: (...a: unknown[]) => recognizeWithTesseract(...a),
}));

const cand = { title: 'Пісня', body: '[C]Слова' };

function setup() {
  const onResult = vi.fn();
  const onError = vi.fn();
  const { container } = render(<PhotoImport onResult={onResult} onError={onError} />);
  const input = container.querySelector('input[type=file]')!;
  const pick = () =>
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
  return { onResult, onError, input, pick };
}

beforeEach(() => {
  vi.clearAllMocks();
  getProvider.mockReturnValue({ recognizePhoto });
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

test('можна вибрати фото з галереї, а не лише зняти камерою', () => {
  const { input } = setup();
  expect(input).toHaveAttribute('accept', 'image/*');
  expect(input).not.toHaveAttribute('capture');
});

test('Gemini успішно — Tesseract не викликається', async () => {
  recognizePhoto.mockResolvedValue(cand);
  const { onResult, pick } = setup();
  pick();
  await waitFor(() => expect(onResult).toHaveBeenCalled());
  expect(onResult).toHaveBeenCalledWith({ ...cand, source: 'фото' }, 'gemini');
  expect(recognizeWithTesseract).not.toHaveBeenCalled();
});

test('no-key від getProvider — Tesseract', async () => {
  getProvider.mockImplementation(() => {
    throw new AiError('no-key');
  });
  recognizeWithTesseract.mockResolvedValue(cand);
  const { onResult, pick } = setup();
  pick();
  await waitFor(() => expect(onResult).toHaveBeenCalled());
  expect(onResult).toHaveBeenCalledWith({ ...cand, source: 'фото' }, 'tesseract');
});

test.each(['network', 'quota'] as const)('%s від Gemini — Tesseract', async (kind) => {
  recognizePhoto.mockRejectedValue(new AiError(kind));
  recognizeWithTesseract.mockResolvedValue(cand);
  const { onResult, pick } = setup();
  pick();
  await waitFor(() => expect(onResult).toHaveBeenCalled());
  expect(onResult).toHaveBeenCalledWith({ ...cand, source: 'фото' }, 'tesseract');
});

test('офлайн — Gemini не викликається', async () => {
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  recognizeWithTesseract.mockResolvedValue(cand);
  const { onResult, pick } = setup();
  pick();
  await waitFor(() => expect(onResult).toHaveBeenCalled());
  expect(recognizePhoto).not.toHaveBeenCalled();
  expect(onResult.mock.calls[0][1]).toBe('tesseract');
});

test.each(['bad-key', 'empty', 'unknown'] as const)('%s — помилка, без Tesseract', async (kind) => {
  recognizePhoto.mockRejectedValue(new AiError(kind));
  const { onError, pick } = setup();
  pick();
  await waitFor(() => expect(onError).toHaveBeenCalled());
  expect(onError.mock.calls[0][0].kind).toBe(kind);
  expect(recognizeWithTesseract).not.toHaveBeenCalled();
});

test('помилка Tesseract — onError, оверлей зникає', async () => {
  recognizePhoto.mockRejectedValue(new AiError('network'));
  recognizeWithTesseract.mockRejectedValue(new AiError('empty'));
  const { onError, pick } = setup();
  pick();
  await waitFor(() => expect(onError).toHaveBeenCalled());
  expect(onError.mock.calls[0][0]).toBeInstanceOf(AiError);
  expect(onError.mock.calls[0][0].kind).toBe('empty');
  expect(screen.queryByText(/Розпізнаю пісню/)).toBeNull();
});

test('інша помилка Tesseract - окремий вид ocr, не Gemini', async () => {
  recognizePhoto.mockRejectedValue(new AiError('network'));
  recognizeWithTesseract.mockRejectedValue(new AiError('unknown', 'x'));
  const { onError, pick } = setup();
  pick();
  await waitFor(() => expect(onError).toHaveBeenCalled());
  expect(onError.mock.calls[0][0].kind).toBe('ocr');
  expect(onError.mock.calls[0][0].message).toMatch(/на пристрої/);
});

test('не-AiError від Tesseract обгортається в ocr', async () => {
  recognizePhoto.mockRejectedValue(new AiError('network'));
  recognizeWithTesseract.mockRejectedValue(new Error('boom'));
  const { onError, pick } = setup();
  pick();
  await waitFor(() => expect(onError).toHaveBeenCalled());
  expect(onError.mock.calls[0][0].kind).toBe('ocr');
});

test('під час Tesseract видно «без Gemini», під час Gemini — звичайний текст', async () => {
  let resolveGem!: (v: unknown) => void;
  recognizePhoto.mockReturnValue(new Promise((r) => (resolveGem = r)));
  const { pick } = setup();
  pick();
  expect(await screen.findByText('Розпізнаю пісню з фото…')).toBeInTheDocument();
  resolveGem(cand);
  await waitFor(() => expect(screen.queryByText(/Розпізнаю/)).toBeNull());

  recognizePhoto.mockRejectedValue(new AiError('quota'));
  recognizeWithTesseract.mockReturnValue(new Promise(() => {}));
  pick();
  expect(await screen.findByText(/Розпізнаю пісню з фото \(без Gemini\)…/)).toBeInTheDocument();
});
