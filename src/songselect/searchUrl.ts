const SEARCH_URL = 'https://songselect.ccli.com/search/results';

export function songSelectSearchUrl(query: string): string {
  const q = query.trim();
  return q ? `${SEARCH_URL}?search=${encodeURIComponent(q)}` : SEARCH_URL;
}
