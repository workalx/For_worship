import { getProvider } from './getProvider';
import { saveSettings, DEFAULT_PHOTO_MODEL } from '../settings/settings';

beforeEach(() => localStorage.clear());

test('без ключа — помилка no-key', () => {
  expect(() => getProvider()).toThrowError(expect.objectContaining({ kind: 'no-key' }));
});

test('з ключем — провайдер', () => {
  saveSettings({ provider: 'gemini', geminiKey: 'k', photoModel: DEFAULT_PHOTO_MODEL, searchEngine: 'brave' });
  expect(typeof getProvider().recognizePhoto).toBe('function');
});
