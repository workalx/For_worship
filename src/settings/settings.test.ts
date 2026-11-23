import { loadSettings, saveSettings, DEFAULT_PHOTO_MODEL } from './settings';

beforeEach(() => localStorage.clear());

test('за замовчуванням — порожній ключ і безкоштовні моделі', () => {
  expect(loadSettings()).toEqual({ provider: 'gemini', geminiKey: '', photoModel: DEFAULT_PHOTO_MODEL, searchEngine: 'brave' });
  expect(DEFAULT_PHOTO_MODEL).toBe('gemini-3.6-flash');
});

test('збереження і завантаження', () => {
  saveSettings({ provider: 'gemini', geminiKey: 'k-123', photoModel: 'm2', searchEngine: 'google' });
  expect(loadSettings().geminiKey).toBe('k-123');
  expect(localStorage.getItem('fw.settings')).toContain('k-123');
});

test('пошкоджені налаштування не ламають програму', () => {
  localStorage.setItem('fw.settings', '{oops');
  expect(loadSettings().geminiKey).toBe('');
});
