const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Тональності для вибору й для результату кнопок − / + (для мінорної пісні додається «m»). */
export const ALL_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

const QUALITY = String.raw`(?:m|maj|min|dim|aug|sus|add|M)?\d*(?:sus\d|add\d+|b\d+|#\d+|maj\d*|\([^)]*\))*`;
const CHORD_RE = new RegExp(`^([A-G][#b]?)(${QUALITY})(?:/([A-G][#b]?))?$`);

export type ParsedChord = { root: string; quality: string; bass?: string };

export function parseChord(s: string): ParsedChord | null {
  const m = CHORD_RE.exec(s.trim());
  if (!m) return null;
  const parsed: ParsedChord = { root: m[1], quality: m[2] };
  if (m[3]) parsed.bass = m[3];
  return parsed;
}

export function isChord(s: string): boolean {
  return parseChord(s) !== null;
}

export function noteIndex(note: string): number {
  const i = SHARPS.indexOf(note);
  return i >= 0 ? i : FLATS.indexOf(note);
}

function shiftNote(note: string, semitones: number, preferFlats: boolean): string {
  const i = noteIndex(note);
  if (i < 0) return note;
  const j = (((i + semitones) % 12) + 12) % 12;
  return (preferFlats ? FLATS : SHARPS)[j];
}

export function transposeChord(chord: string, semitones: number, preferFlats: boolean): string {
  const p = parseChord(chord);
  if (!p) return chord;
  const root = shiftNote(p.root, semitones, preferFlats);
  const bass = p.bass ? `/${shiftNote(p.bass, semitones, preferFlats)}` : '';
  return root + p.quality + bass;
}

/** Корінь тональності: «F#m» → «F#». */
export function keyRoot(key: string): string {
  return /^[A-G][#b]?/.exec(key)?.[0] ?? key;
}

export function isMinorKey(key: string): boolean {
  return /^[A-G][#b]?m(?!aj)/.test(key);
}

export function keyPrefersFlats(key: string): boolean {
  return FLAT_KEYS.has(key) || /^[A-G]b/.test(key);
}

/** Найкоротший зсув у півтонах від однієї тональності до іншої (−5…+6). */
export function semitonesBetween(fromKey: string, toKey: string): number {
  const a = noteIndex(keyRoot(fromKey));
  const b = noteIndex(keyRoot(toKey));
  if (a < 0 || b < 0) return 0;
  let d = (((b - a) % 12) + 12) % 12;
  if (d > 6) d -= 12;
  return d;
}

/** Тональність, зсунута на n півтонів, у написанні з ALL_KEYS (мінор зберігає «m»). */
export function shiftKey(key: string, semitones: number): string {
  const i = noteIndex(keyRoot(key));
  if (i < 0) return key;
  const j = (((i + semitones) % 12) + 12) % 12;
  return ALL_KEYS[j] + (isMinorKey(key) ? 'm' : '');
}
