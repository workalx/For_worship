/**
 * Нормалізація тексту для пошуку в бібліотеці. Спільна для генератора (scripts/library) і застосунку,
 * щоб слова в індексі й у запиті приводилися однаково.
 */

/** Нижній регістр, без діакритики й апострофів, лише літери й цифри через один пробіл. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’ʼ`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function searchTokens(text: string): string[] {
  const n = normalizeSearch(text);
  return n ? n.split(' ') : [];
}

/** Текст пісні без акордів, директив і міток частин — для пошуку за фрагментом. */
export function lyricsPlainText(body: string): string {
  return body
    .split('\n')
    .filter((l) => !/^\s*\{.*\}\s*$/.test(l) && !/^\s*[^\s].*:\s*$/.test(l))
    .map((l) => l.replace(/\[[^\]]*\]/g, ''))
    .join(' ');
}

/**
 * Унікальні слова тексту пісні, яких немає в назві й першому рядку (вони шукаються окремо),
 * у порядку появи. Зберігаються в індексі, щоб шукати за фрагментом без завантаження всіх пісень.
 */
export function distinctWords(body: string, exclude: string[] = []): string {
  const skip = new Set(exclude.flatMap(searchTokens));
  const seen = new Set<string>();
  for (const w of searchTokens(lyricsPlainText(body))) {
    if (w.length < 2 || skip.has(w) || seen.has(w)) continue;
    seen.add(w);
  }
  return [...seen].join(' ');
}
