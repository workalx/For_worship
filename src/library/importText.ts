import type { Song, SongInput } from '../db/db';
import { guessKey, looksLikeChordPro } from '../music/chordpro';
import { parseChordProFile, toChordProFile } from '../music/chordproFile';
import { chordsOverLyricsToChordPro } from '../music/chordsOverLyrics';

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
export function songFromPastedText(text: string, title?: string, sourceUrl?: string): Partial<Song> {
  return { title: title?.trim() || undefined, body: normalizeImportedText(text), sourceUrl };
}

/** Назва пісні з імені файлу: «Amazing_Grace-New Britain.cho» → «Amazing Grace New Britain». */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Пісня з файлу ChordPro або простого тексту: метадані з директив, текст приводиться до ChordPro
 * (формат «акорди над рядком» теж розуміється). Повертає null, якщо в файлі немає тексту пісні.
 */
export function songFromChordProFile(text: string, fileName = ''): SongInput | null {
  const { meta, body } = parseChordProFile(text);
  const normalized = normalizeImportedText(body);
  if (!normalized.trim()) return null;
  const title = meta.title || titleFromFileName(fileName) || 'Без назви';
  const { key, ...rest } = meta;
  return { ...rest, title, body: normalized, originalKey: key ?? guessKey(normalized) };
}

/** Пісня у файл ChordPro (тональність — та, в якій записані акорди тексту). */
export function songToChordPro(song: Pick<Song, 'title' | 'body'> & Partial<Song>): string {
  return toChordProFile({
    title: song.title,
    body: song.body,
    artist: song.artist,
    key: song.originalKey,
    bpm: song.bpm,
    timeSig: song.timeSig,
    capo: song.capo,
    source: song.source,
    sourceUrl: song.sourceUrl,
    license: song.license,
    chordsOrigin: song.chordsOrigin,
  });
}
