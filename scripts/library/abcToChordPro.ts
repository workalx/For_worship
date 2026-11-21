/**
 * ABC → ChordPro: слова з рядків `w:` розставляються по нотах мелодії, акорди з harmonize()
 * ставляться над складом, на який припадає зміна акорду. Куплети з `W:` (без нот) — лише текст.
 */
import { toChordProFile } from '../../src/music/chordproFile';
import { keyPrefersFlats } from '../../src/music/chords';
import { parseLyricLine, type AbcNote, type AbcTune } from './abc';
import { chordName, harmonize, type ChordEvent } from './harmony';

type Syl = { time: number; text: string; wordEnd: boolean; pre: string[]; post: string[] };

export type ConvertedSong = {
  title: string;
  artist?: string;
  key: string;
  timeSig?: '4/4' | '3/4' | '6/8';
  bpm?: number;
  /** Текст з акордами (ChordPro) без директив заголовка. */
  body: string;
  /** Повний файл ChordPro з метаданими. */
  chordpro: string;
  /** Скільки акордів вийшло і скільки тактів — для звіту. */
  stats: { chords: number; bars: number; distinct: string[]; verses: number; extraVerses: number; warnings: string[] };
};

/** «Newton, John (1725-1807);Excell, E. O.» → «John Newton, E. O. Excell». */
export function formatAuthors(raw: string | undefined): string | undefined {
  if (!raw || /^(none|unknown|anonymous)?$/i.test(raw.trim())) return undefined;
  const names = raw
    .split(';')
    .map((p) => p.replace(/\(.*?\)/g, '').trim())
    .filter(Boolean)
    .map((p) => {
      const [last, first] = p.split(',').map((x) => x.trim());
      return first ? `${first} ${last}` : last;
    });
  return names.length ? names.join(', ') : undefined;
}

const NAMED_METERS: Record<string, number[]> = { CM: [8, 6, 8, 6], LM: [8, 8, 8, 8], SM: [6, 6, 8, 6] };

/** Віршовий розмір Open Hymnal («8 6 8 6», «C M D», «8 7 8 7 D») → кількість складів у рядках. */
export function metricalPattern(raw: string | undefined): number[] | null {
  if (!raw) return null;
  const t = raw.toUpperCase().replace(/\./g, ' ').replace(/WITH REFRAIN.*$/, '').trim();
  const tokens = t.split(/\s+/).filter(Boolean);
  const doubled = tokens[tokens.length - 1] === 'D';
  const core = doubled ? tokens.slice(0, -1) : tokens;
  let pattern: number[] | null = null;
  if (core.length === 2 && NAMED_METERS[core.join('')]) pattern = NAMED_METERS[core.join('')];
  else if (core.length && core.every((x) => /^\d+$/.test(x))) pattern = core.map(Number);
  if (!pattern) return null;
  return doubled ? [...pattern, ...pattern] : pattern;
}

function lineRanges(notes: AbcNote[], end: number): Map<number, [number, number]> {
  const firstByLine = new Map<number, number>();
  for (const n of notes) if (!firstByLine.has(n.line)) firstByLine.set(n.line, n.start);
  const lines = [...firstByLine.keys()].sort((a, b) => a - b);
  const ranges = new Map<number, [number, number]>();
  lines.forEach((l, i) => ranges.set(l, [firstByLine.get(l)!, i + 1 < lines.length ? firstByLine.get(lines[i + 1])! : end]));
  return ranges;
}

/** Склади одного рядка `w:` на нотах цього музичного рядка. */
function alignLine(notes: AbcNote[], lyric: string): Syl[] {
  const out: Syl[] = [];
  let idx = 0;
  for (const item of parseLyricLine(lyric)) {
    if (idx >= notes.length) break;
    if (item.kind === 'syl') {
      out.push({ time: notes[idx].start, text: item.text, wordEnd: item.wordEnd, pre: [], post: [] });
      idx++;
    } else if (item.kind === 'skip' || item.kind === 'hold') {
      idx++;
    } else if (idx > 0) {
      const bar = notes[idx - 1].bar;
      while (idx < notes.length && notes[idx].bar === bar) idx++;
    }
  }
  return out;
}

/** Розставляє акорди: на склад, що починається в момент зміни, або одразу після складу, що звучить. */
function placeChords(syls: Syl[], chords: { time: number; name: string }[]) {
  for (const c of chords) {
    let k = -1;
    for (let i = 0; i < syls.length; i++) if (syls[i].time <= c.time + 1e-9) k = i;
    if (k < 0) {
      syls[0]?.pre.push(c.name);
    } else if (Math.abs(syls[k].time - c.time) < 1e-9) {
      syls[k].pre.push(c.name);
    } else {
      syls[k].post.push(c.name);
    }
  }
}

function render(syls: Syl[]): string {
  let s = '';
  for (const x of syls) {
    s += x.pre.map((c) => `[${c}]`).join('') + x.text + x.post.map((c) => `[${c}]`).join('');
    if (x.wordEnd) s += ' ';
  }
  return s.trim();
}

const PUNCT = /[,;:.!?]["'’”)]*$/;

/**
 * Ділить склади куплета на рядки. З віршовим розміром: кожен рядок ≈ потрібна кількість складів
 * (±2), розрив на кінці слова, перевага — після розділового знака. Без розміру — за розділовими знаками.
 */
function breakLines(syls: Syl[], pattern: number[] | null): Syl[][] {
  if (syls.length === 0) return [];
  if (pattern && pattern.every((n) => n > 0)) {
    const out: Syl[][] = [];
    let i = 0;
    let k = 0;
    while (i < syls.length) {
      const target = pattern[k % pattern.length];
      k++;
      if (syls.length - i <= target + 2) {
        out.push(syls.slice(i));
        break;
      }
      let best = -1;
      let bestCost = Infinity;
      for (let n = Math.max(1, target - 2); n <= target + 2 && i + n <= syls.length; n++) {
        const last = syls[i + n - 1];
        if (!last.wordEnd) continue;
        const cost = Math.abs(n - target) - (PUNCT.test(last.text) ? 1.5 : 0);
        if (cost < bestCost) {
          bestCost = cost;
          best = n;
        }
      }
      if (best < 0) best = Math.min(target, syls.length - i);
      out.push(syls.slice(i, i + best));
      i += best;
    }
    return out;
  }
  const lines: Syl[][] = [];
  let cur: Syl[] = [];
  for (const x of syls) {
    cur.push(x);
    const punct = PUNCT.test(x.text);
    if (x.wordEnd && ((punct && cur.length >= 5) || cur.length >= 12)) {
      lines.push(cur);
      cur = [];
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

const VERSE_NUMBER = /^\s*\d+\.\s*/;

/** Конвертує розібраний гімн у ChordPro з автоматичними акордами. */
export function abcToChordPro(
  tune: AbcTune,
  info: { source?: string; sourceUrl?: string; license?: string } = {},
  chordEvents: ChordEvent[] = harmonize(tune),
): ConvertedSong {
  const melody = tune.voices[0];
  const end = Math.max(...tune.voices.map((v) => v.end));
  const flats = keyPrefersFlats(tune.key);
  const chords = chordEvents.map((e) => ({ time: e.time, name: chordName(e, flats) }));
  const ranges = lineRanges(melody.notes, end);
  const lyricLines = [...tune.lyrics.keys()].sort((a, b) => a - b);
  const verses = Math.max(0, ...lyricLines.map((l) => tune.lyrics.get(l)!.length));
  // Рядок з одним `w:` при кількох куплетах — приспів (однаковий для всіх куплетів).
  const isRefrain = (l: number) => verses > 1 && tune.lyrics.get(l)!.length === 1;
  const pattern = metricalPattern(tune.meta.METRICAL);

  const sectionFor = (lines: number[], v: number): Syl[] => {
    const syls: Syl[] = [];
    const sectionChords: { time: number; name: string }[] = [];
    for (const l of lines) {
      const text = tune.lyrics.get(l)![isRefrain(l) ? 0 : v];
      if (text === undefined) continue;
      const lineSyls = alignLine(melody.notes.filter((n) => n.line === l), text);
      syls.push(...lineSyls);
      const [a, b] = ranges.get(l) ?? [0, 0];
      sectionChords.push(...chords.filter((c) => c.time >= a - 1e-9 && c.time < b - 1e-9));
    }
    if (syls.length) syls[0].text = syls[0].text.replace(VERSE_NUMBER, '');
    placeChords(syls, sectionChords);
    return syls.filter((s) => s.text !== '' || s.pre.length || s.post.length);
  };

  const verseLines = lyricLines.filter((l) => !isRefrain(l));
  const refrainLines = lyricLines.filter(isRefrain);
  /** Затакт приспіву («It is» після «…with my soul.») відрізаємо від куплету. */
  const splitPickup = (syls: Syl[]): [Syl[], Syl[]] => {
    if (!refrainLines.length) return [syls, []];
    let cut = -1;
    for (let i = syls.length - 1; i >= Math.max(0, syls.length - 6); i--) {
      if (/[.!?;]["'’”)]*$/.test(syls[i].text)) {
        cut = i + 1;
        break;
      }
    }
    return cut > 0 && cut < syls.length ? [syls.slice(0, cut), syls.slice(cut)] : [syls, []];
  };
  const parts: string[] = [];
  for (let v = 0; v < verses; v++) {
    const [syls, pickup] = splitPickup(sectionFor(verseLines, v));
    if (!syls.length) continue;
    const lines = breakLines(syls, pattern);
    parts.push(`Verse ${v + 1}:\n` + lines.map(render).join('\n'));
    if (v === 0 && refrainLines.length) {
      const r = [...pickup, ...sectionFor(refrainLines, 0)];
      // Віршовий розмір Open Hymnal охоплює куплет і приспів: решта рядків розміру — для приспіву.
      const refrainPattern = pattern && pattern.length > lines.length ? pattern.slice(lines.length) : null;
      if (r.length) parts.push('Refrain:\n' + breakLines(r, refrainPattern).map(render).join('\n'));
    }
  }
  tune.extraVerses.forEach((lines, i) => {
    const m = /^\s*(\d+)\./.exec(lines[0] ?? '');
    const n = m ? Number(m[1]) : verses + i + 1;
    const text = lines.map((l, j) => (j === 0 ? l.replace(VERSE_NUMBER, '') : l)).join('\n');
    parts.push(`Verse ${n}:\n${text}`);
  });

  const body = parts.join('\n\n');
  const meter = tune.meter === 'C' ? '4/4' : tune.meter;
  const timeSig = meter === '4/4' || meter === '3/4' || meter === '6/8' ? meter : undefined;
  const title = tune.title.trim();
  const artist = formatAuthors(tune.meta.AUTHOR);
  const chordpro = toChordProFile({
    title,
    artist,
    key: tune.key,
    bpm: tune.tempo,
    timeSig,
    source: info.source,
    sourceUrl: info.sourceUrl,
    license: info.license,
    chordsOrigin: 'auto',
    body,
  });
  const bars = melody.barStarts.filter((t, i, a) => i === 0 || t > a[i - 1] + 1e-9).length;
  const warnings: string[] = [];
  const ends = tune.voices.map((v) => v.end);
  if (Math.max(...ends) - Math.min(...ends) > 1e-6) warnings.push(`голоси різної довжини: ${ends.map((e) => e.toFixed(3)).join(', ')}`);
  if (tune.voices.length < 3) warnings.push(`голосів лише ${tune.voices.length}`);
  if (verses === 0) warnings.push('немає слів під нотами (w:)');
  return {
    title,
    artist,
    key: tune.key,
    timeSig,
    bpm: tune.tempo,
    body,
    chordpro,
    stats: {
      chords: chords.length,
      bars,
      distinct: [...new Set(chords.map((c) => c.name))],
      verses,
      extraVerses: tune.extraVerses.length,
      warnings,
    },
  };
}
