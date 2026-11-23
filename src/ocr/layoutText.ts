import { AiError, type SongCandidate } from '../ai/provider';
import { isChordLine } from '../music/chordsOverLyrics';
import { isChord } from '../music/chords';
import { guessKey, sectionLabel } from '../music/chordpro';

export type OcrWord = { text: string; x0: number; x1: number };
export type OcrLine = {
  words: OcrWord[];
  y0?: number;
  y1?: number;
  /** Рядок починає новий абзац (між абзацами буде порожній рядок). */
  paragraphStart?: boolean;
};

export const DEFAULT_TITLE = 'Фото пісні';

const HOMOGLYPHS: Record<string, string> = {
  А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', М: 'M', К: 'K', О: 'O', Р: 'P', Т: 'T', Х: 'X',
  а: 'a', е: 'e', с: 'c', о: 'o', р: 'p', х: 'x',
};

function toLatin(text: string): string {
  return text.replace(/[А-яЁё]/g, (ch) => HOMOGLYPHS[ch] ?? ch);
}

type Row = {
  words: OcrWord[];
  chordWords: OcrWord[] | null; // слова-акорди (нормалізовані), якщо рядок акордів
  paragraphStart: boolean;
};

const joinText = (words: OcrWord[]) => words.map((w) => w.text).join(' ');

function makeRow(line: OcrLine): Row | null {
  const words = line.words
    .map((w) => ({ ...w, text: w.text.trim() }))
    .filter((w) => w.text !== '')
    .sort((a, b) => a.x0 - b.x0);
  if (words.length === 0) return null;
  let chordWords: OcrWord[] | null = null;
  if (isChordLine(joinText(words))) chordWords = words;
  else {
    const latin = words.map((w) => ({ ...w, text: toLatin(w.text) }));
    if (isChordLine(joinText(latin))) chordWords = latin;
  }
  return { words, chordWords, paragraphStart: !!line.paragraphStart };
}

function chordsOf(words: OcrWord[]): { chord: string; x0: number }[] {
  const out: { chord: string; x0: number }[] = [];
  for (const w of words) {
    const core = w.text.replace(/^\(+|\)+$/g, '');
    if (isChord(core)) out.push({ chord: core, x0: w.x0 });
  }
  return out;
}

function isLyric(row: Row | undefined): row is Row {
  return !!row && !row.chordWords && sectionLabel(joinText(row.words)) === null;
}

function mergeChords(chordWords: OcrWord[], lyric: OcrWord[]): string {
  const starts: number[] = [];
  let pos = 0;
  for (const w of lyric) {
    starts.push(pos);
    pos += w.text.length + 1;
  }
  const inserts = chordsOf(chordWords).map(({ chord, x0 }) => {
    let idx = lyric.findIndex((w) => x0 >= w.x0 && x0 <= w.x1);
    if (idx < 0) {
      let prev = -1;
      lyric.forEach((w, i) => {
        if (w.x1 < x0) prev = i;
      });
      if (prev < 0) return { at: 0, chord };
      const next = prev + 1;
      // у проміжку між словами: до ближчого краю (до наступного слова, якщо воно ближче)
      if (next < lyric.length && lyric[next].x0 - x0 < x0 - lyric[prev].x1) return { at: starts[next], chord };
      return { at: starts[prev] + lyric[prev].text.length, chord };
    }
    const w = lyric[idx];
    const span = Math.max(1, w.x1 - w.x0);
    const off = Math.min(w.text.length, Math.max(0, Math.round(((x0 - w.x0) / span) * w.text.length)));
    return { at: starts[idx] + off, chord };
  });
  let s = joinText(lyric);
  inserts.sort((a, b) => a.at - b.at);
  for (const ins of [...inserts].reverse()) s = s.slice(0, ins.at) + `[${ins.chord}]` + s.slice(ins.at);
  return s;
}

export function ocrToCandidate(lines: OcrLine[]): SongCandidate {
  const ordered = lines.every((l) => l.y0 !== undefined)
    ? [...lines].sort((a, b) => a.y0! - b.y0!)
    : lines;
  const rows = ordered.map(makeRow).filter((r): r is Row => r !== null);
  if (rows.length === 0) throw new AiError('empty');

  let title = DEFAULT_TITLE;
  const first = rows[0];
  if (!first.chordWords && sectionLabel(joinText(first.words)) === null) {
    title = joinText(first.words);
    rows.shift();
  }

  const out: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.paragraphStart && out.length > 0 && out[out.length - 1] !== '') out.push('');
    if (row.chordWords) {
      const next = rows[i + 1];
      if (isLyric(next)) {
        out.push(mergeChords(row.chordWords, next.words));
        i++;
      } else {
        out.push(chordsOf(row.chordWords).map((c) => `[${c.chord}]`).join(' '));
      }
    } else {
      out.push(joinText(row.words));
    }
  }
  const body = out.join('\n');
  return { title, body, key: guessKey(body) };
}
