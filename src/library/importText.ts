import { looksLikeChordPro } from '../music/chordpro';
import { chordsOverLyricsToChordPro } from '../music/chordsOverLyrics';

import type { Song } from '../db/db';

export { guessKey } from '../music/chordpro';

/**
 * Готує вставлений текст пісні: якщо це ще не ChordPro — перетворює «акорди над рядком»,
 * прибирає зайві пробіли в кінці рядків і залишає не більше одного порожнього рядка підряд.
 */
export function normalizeImportedText(text: string): string {
  let t = text.replace(/\r\n?/g, '\n');
  if (!looksLikeChordPro(t)) t = chordsOverLyricsToChordPro(t);
  return t
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

/** Чернетка пісні зі вставленого або поширеного тексту (тональність редактор визначить сам). */
export function songFromPastedText(text: string, title?: string, source?: string): Partial<Song> {
  return { title: title?.trim() || undefined, body: normalizeImportedText(text), source };
}
