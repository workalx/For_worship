/**
 * Миттєвий офлайн-пошук по індексу вбудованої бібліотеки без сторонніх залежностей:
 * назва, перший рядок, автор, теми й слова тексту. Усі слова запиту мають знайтися
 * (останнє — як початок слова, щоб шукати під час введення).
 */
import type { LibraryIndexEntry } from './catalogTypes';
import { normalizeSearch, searchTokens } from './searchText';

type Prepared = {
  entry: LibraryIndexEntry;
  title: string;
  titleWords: string[];
  firstLine: string;
  author: string;
  tags: string;
  words: string[];
};

export type LibrarySearcher = (query: string, limit?: number) => LibraryIndexEntry[];

const startsWithAny = (words: string[], token: string) => words.some((w) => w.startsWith(token));

/** Готує індекс до пошуку один раз; повертає функцію пошуку. */
export function createLibrarySearch(entries: LibraryIndexEntry[]): LibrarySearcher {
  const prepared: Prepared[] = entries.map((entry) => {
    const title = normalizeSearch(`${entry.title} ${entry.tune ?? ''}`);
    return {
      entry,
      title,
      titleWords: title.split(' '),
      firstLine: normalizeSearch(entry.firstLine),
      author: normalizeSearch(entry.author ?? ''),
      tags: normalizeSearch(entry.tags.join(' ')),
      words: entry.words ? entry.words.split(' ') : [],
    };
  });

  return (query, limit = 30) => {
    const q = normalizeSearch(query);
    const tokens = searchTokens(query);
    if (!tokens.length) return [];
    const scored: { entry: LibraryIndexEntry; score: number }[] = [];
    for (const p of prepared) {
      let score = 0;
      let all = true;
      for (const t of tokens) {
        const firstLineWords = p.firstLine.split(' ');
        let s = 0;
        if (p.titleWords.includes(t)) s = 3;
        else if (startsWithAny(p.titleWords, t)) s = 2.5;
        else if (firstLineWords.includes(t)) s = 2;
        else if (startsWithAny(firstLineWords, t)) s = 1.8;
        else if (startsWithAny(p.author.split(' '), t)) s = 1.5;
        else if (p.words.includes(t)) s = 1;
        else if (startsWithAny(p.words, t)) s = 0.8;
        else if (p.tags.includes(t)) s = 0.6;
        if (s === 0) {
          all = false;
          break;
        }
        score += s;
      }
      if (!all) continue;
      // Цілий запит як фраза важить більше за окремі слова.
      if (p.title.startsWith(q)) score += 6;
      else if (p.title.includes(q)) score += 4;
      else if (p.firstLine.includes(q)) score += 3;
      scored.push({ entry: p.entry, score });
    }
    scored.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'en'));
    return scored.slice(0, limit).map((s) => s.entry);
  };
}
