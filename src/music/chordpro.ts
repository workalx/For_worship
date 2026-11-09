import { isChord, parseChord, transposeChord } from './chords';
import type { ChordAt, SongDoc, SongLine, SongSection } from './song';

const SECTION_WORDS = [
  'куплет', 'приспів', 'припев', 'пре-?приспів', 'пре-?припев', 'брідж', 'бридж', 'мост',
  'вступ', 'вступление', 'інтро', 'интро', 'програш', 'проигрыш', 'кода', 'кінцівка', 'кінець',
  'окончание', 'концовка', 'verse', 'chorus', 'pre-?chorus', 'bridge', 'intro', 'outro',
  'interlude', 'instrumental', 'tag', 'ending', 'refrain',
].join('|');

const SECTION_RE = new RegExp(
  String.raw`^\s*(?:\d+[.)]?\s*)?(?:${SECTION_WORDS})(?:\s*\d+)?(?:\s*\(?\s*[x×х]\s*\d+\s*\)?)?\s*:?\s*$`,
  'iu',
);

/** Якщо рядок — мітка частини пісні («Куплет 1:», «Chorus x2»), повертає її без двокрапки. */
export function sectionLabel(line: string): string | null {
  if (!SECTION_RE.test(line)) return null;
  return line.trim().replace(/\s*:$/, '');
}

const DIRECTIVE_RE = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i;
const BRACKET_RE = /\[([^\]]+)\]/g;

export function looksLikeChordPro(text: string): boolean {
  for (const m of text.matchAll(BRACKET_RE)) if (isChord(m[1])) return true;
  return false;
}

function parseLine(raw: string): SongLine {
  const chords: ChordAt[] = [];
  let lyrics = '';
  let last = 0;
  for (const m of raw.matchAll(BRACKET_RE)) {
    const idx = m.index ?? 0;
    lyrics += raw.slice(last, idx);
    if (isChord(m[1])) chords.push({ pos: lyrics.length, chord: m[1] });
    else lyrics += m[0];
    last = idx + m[0].length;
  }
  lyrics += raw.slice(last);
  lyrics = lyrics.replace(/\s+$/, '');
  if (lyrics.trim() === '') lyrics = '';
  return { lyrics, chords };
}

export function parseChordPro(text: string): SongDoc {
  const sections: SongSection[] = [];
  let current: SongSection | null = null;
  const start = (label: string) => {
    current = { label, lines: [] };
    sections.push(current);
  };

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (raw.trim() === '') continue;
    const d = DIRECTIVE_RE.exec(raw);
    if (d) {
      const name = d[1].toLowerCase();
      if (name === 'c' || name === 'comment' || name === 'ci') start(d[2] ?? '');
      else if (name === 'soc' || name === 'start_of_chorus') start(d[2] || 'Приспів');
      else if (name === 'sov' || name === 'start_of_verse') start(d[2] || 'Куплет');
      else if (name === 'sob' || name === 'start_of_bridge') start(d[2] || 'Брідж');
      continue;
    }
    const label = sectionLabel(raw);
    if (label !== null) {
      start(label);
      continue;
    }
    if (!current) start('');
    current!.lines.push(parseLine(raw));
  }
  return { sections: sections.filter((s) => s.lines.length > 0 || s.label !== '') };
}

export function transposeDoc(doc: SongDoc, semitones: number, preferFlats: boolean): SongDoc {
  return {
    sections: doc.sections.map((s) => ({
      label: s.label,
      lines: s.lines.map((l) => ({
        lyrics: l.lyrics,
        chords: l.chords.map((c) => ({ pos: c.pos, chord: transposeChord(c.chord, semitones, preferFlats) })),
      })),
    })),
  };
}

/** Тональність за першим акордом пісні: корінь + «m», якщо акорд мінорний. */
export function guessKey(body: string): string | undefined {
  for (const m of body.matchAll(BRACKET_RE)) {
    const p = parseChord(m[1]);
    if (p) return p.root + (/^m(?!aj)/.test(p.quality) ? 'm' : '');
  }
  return undefined;
}
