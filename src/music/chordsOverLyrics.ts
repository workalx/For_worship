import { isChord } from './chords';
import { sectionLabel } from './chordpro';

const FILLER_RE = /^(?:\||-|[x×х]\d+|\d+[x×х]|\(|\))$/i;

function stripParens(token: string): string {
  return token.replace(/^\(+|\)+$/g, '');
}

/** Рядок складається лише з акордів (і символів на кшталт «|», «x2»), і хоча б один акорд є. */
export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  let chords = 0;
  for (const t of tokens) {
    const core = stripParens(t);
    if (isChord(core)) chords++;
    else if (!FILLER_RE.test(t) && !FILLER_RE.test(core) && core !== '') return false;
  }
  return chords > 0;
}

function chordTokens(line: string): { col: number; chord: string }[] {
  const out: { col: number; chord: string }[] = [];
  for (const m of line.matchAll(/\S+/g)) {
    const core = stripParens(m[0]);
    if (isChord(core)) out.push({ col: (m.index ?? 0) + m[0].indexOf(core), chord: core });
  }
  return out;
}

function merge(chordLine: string, lyric: string): string {
  const tokens = chordTokens(chordLine);
  const width = Math.max(lyric.length, ...tokens.map((t) => t.col));
  let s = lyric.padEnd(width, ' ');
  for (const t of [...tokens].reverse()) s = s.slice(0, t.col) + `[${t.chord}]` + s.slice(t.col);
  return s.replace(/\s+$/, '');
}

function isLyricLine(line: string | undefined): line is string {
  return (
    line !== undefined &&
    line.trim() !== '' &&
    !isChordLine(line) &&
    sectionLabel(line) === null &&
    !/\[[^\]]+\]/.test(line)
  );
}

/** Перетворює формат «акорди над рядком» (як на сайтах з акордами) у ChordPro. */
export function chordsOverLyricsToChordPro(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isChordLine(line)) {
      const next = lines[i + 1];
      if (isLyricLine(next)) {
        out.push(merge(line, next));
        i++;
      } else {
        out.push(merge(line, ''));
      }
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}
