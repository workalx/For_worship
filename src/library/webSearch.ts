export type SearchEngine = 'brave' | 'google' | 'duckduckgo';

export const SEARCH_ENGINES: { id: SearchEngine; label: string; url: string }[] = [
  { id: 'brave', label: 'Brave Search', url: 'https://search.brave.com/search?q=' },
  { id: 'google', label: 'Google', url: 'https://www.google.com/search?q=' },
  { id: 'duckduckgo', label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
];

export const DEFAULT_SEARCH_ENGINE: SearchEngine = 'brave';

export function isSearchEngine(v: unknown): v is SearchEngine {
  return SEARCH_ENGINES.some((e) => e.id === v);
}

/** Чи це посилання на веб-сторінку (лише http/https). */
export function isWebUrl(text: string): boolean {
  const t = text.trim();
  if (!/^https?:\/\/\S+$/i.test(t)) return false;
  try {
    new URL(t);
    return true;
  } catch {
    return false;
  }
}

const CHORD_WORD_RE = /акорд|аккорд|chord/i;

/**
 * Адреса, яку треба відкрити в браузері: саме посилання, якщо користувач вставив посилання,
 * інакше — пошук «назва акорди» у вибраній пошуковій системі.
 */
export function webSearchUrl(query: string, engine: SearchEngine = DEFAULT_SEARCH_ENGINE): string {
  const q = query.trim();
  if (isWebUrl(q)) return q;
  const base = (SEARCH_ENGINES.find((e) => e.id === engine) ?? SEARCH_ENGINES[0]).url;
  return base + encodeURIComponent(CHORD_WORD_RE.test(q) ? q : `${q} акорди`);
}

/** Відкриває пошук у браузері пристрою (для встановленої програми — в окремому вікні браузера). */
export function openInBrowser(query: string, engine?: SearchEngine): void {
  window.open(webSearchUrl(query, engine), '_blank', 'noopener,noreferrer');
}
