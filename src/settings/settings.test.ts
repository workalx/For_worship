import { loadSettings, saveSettings, DEFAULT_SEARCH_MODEL, DEFAULT_PHOTO_MODEL } from './settings';

beforeEach(() => localStorage.clear());

test('за замовчуванням — порожній ключ і безкоштовні моделі', () => {
  expect(loadSettings()).toEqual({ provider: 'gemini', geminiKey: '', searchModel: DEFAULT_SEARCH_MODEL, photoModel: DEFAULT_PHOTO_MODEL });
  expect(DEFAULT_SEARCH_MODEL).toBe('gemini-2.5-flash-lite');
  expect(DEFAULT_PHOTO_MODEL).toBe('gemini-3.6-flash');
});

test('збереження і завантаження', () => {
  saveSettings({ provider: 'gemini', geminiKey: 'k-123', searchModel: 'm1', photoModel: 'm2' });
  expect(loadSettings().geminiKey).toBe('k-123');
  expect(localStorage.getItem('fw.settings')).toContain('k-123');
});

test('пошкоджені налаштування не ламають програму', () => {
  localStorage.setItem('fw.settings', '{oops');
  expect(loadSettings().geminiKey).toBe('');
});
