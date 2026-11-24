import { DEFAULT_SEARCH_ENGINE, isSearchEngine, type SearchEngine } from '../library/webSearch';

/** Стабільна Flash-модель для розпізнавання фото. */
export const DEFAULT_PHOTO_MODEL = 'gemini-3.6-flash';

export type Settings = { provider: 'gemini'; geminiKey: string; photoModel: string;
  /** Пошукова система для кнопки «Шукати в інтернеті». */
  searchEngine: SearchEngine;
};

const STORAGE_KEY = 'fw.settings';

const DEFAULTS: Settings = {
  provider: 'gemini',
  geminiKey: '',
  photoModel: DEFAULT_PHOTO_MODEL,
  searchEngine: DEFAULT_SEARCH_ENGINE,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      provider: 'gemini',
      geminiKey: typeof s.geminiKey === 'string' ? s.geminiKey : '',
      photoModel: s.photoModel || DEFAULT_PHOTO_MODEL,
      searchEngine: isSearchEngine(s.searchEngine) ? s.searchEngine : DEFAULT_SEARCH_ENGINE,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* сховище недоступне — налаштування діятимуть лише до перезапуску */
  }
}
