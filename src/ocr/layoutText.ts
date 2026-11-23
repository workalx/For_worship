import { AiError, type SongCandidate } from '../ai/provider';
import { chordsOverLyricsToChordPro, isChordLine } from '../music/chordsOverLyrics';
import { guessKey, sectionLabel } from '../music/chordpro';

export type OcrWord = { text: string; x0: number; x1: number };
export type OcrLine = { words: OcrWord[] };

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Відтворює горизонтальні позиції слів пробілами (моноширинна сітка). */
export function layoutLines(lines: OcrLine[]): string {
  const all = lines.flatMap((l) => l.words).filter((w) => w.text.trim() !== '');
  if (all.length === 0) return '';
  const minX = Math.min(...all.map((w) => w.x0));
  const widths = all.map((w) => (w.x1 - w.x0) / w.text.trim().length).filter((v) => v > 0);
  const charWidth = widths.length ? median(widths) : 1;

  const out: string[] = [];
  for (const line of lines) {
    const words = line.words.filter((w) => w.text.trim() !== '').sort((a, b) => a.x0 - b.x0);
    if (words.length === 0) continue;
    let s = '';
    for (const w of words) {
      const text = w.text.trim();
      const col = Math.round((w.x0 - minX) / charWidth);
      if (s === '') s = ' '.repeat(Math.max(0, col));
      else s += ' '.repeat(Math.max(1, col - s.length));
      s += text;
    }
    out.push(s);
  }
  return out.join('\n');
}

export function ocrToCandidate(lines: OcrLine[]): SongCandidate {
  const rows = layoutLines(lines).split('\n').filter((r) => r.trim() !== '');
  if (rows.length === 0) throw new AiError('empty');
  const titleIdx = rows.findIndex((r) => !isChordLine(r) && sectionLabel(r) === null);
  let title = '';
  if (titleIdx >= 0) {
    title = rows[titleIdx].trim();
    rows.splice(titleIdx, 1);
  }
  const body = chordsOverLyricsToChordPro(rows.join('\n'));
  return { title, body, key: guessKey(body) };
}
