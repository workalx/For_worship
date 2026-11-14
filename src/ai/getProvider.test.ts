import { getProvider } from './getProvider';
import { saveSettings, DEFAULT_PHOTO_MODEL, DEFAULT_SEARCH_MODEL } from '../settings/settings';

beforeEach(() => localStorage.clear());

test('без ключа — помилка no-key', () => {
  expect(() => getProvider()).toThrowError(expect.objectContaining({ kind: 'no-key' }));
});

test('з ключем — провайдер', () => {
  saveSettings({ provider: 'gemini', geminiKey: 'k', searchModel: DEFAULT_SEARCH_MODEL, photoModel: DEFAULT_PHOTO_MODEL, searchEngine: 'brave' });
  expect(typeof getProvider().searchSongs).toBe('function');
});
