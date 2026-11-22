/**
 * Розбір файлів ABC (підмножина ABC 2.1, яку використовує Open Hymnal Project):
 * заголовки, голоси, ноти з тривалостями, такти, слова куплетів (w:) і додаткові куплети (W:).
 * Час рахується в частках цілої ноти від початку пісні.
 */

export type AbcNote = {
  /** Початок у цілих нотах від початку пісні. */
  start: number;
  dur: number;
  /** MIDI-висоти (кілька — якщо в голосі акорд `[DF]`). */
  pitches: number[];
  /** Номер такту (0 — перший, можливо неповний, такт). */
  bar: number;
  /** Номер музичного рядка цього голосу у файлі. */
  line: number;
  /** Нота з накладення голосу (`&`): звучить паралельно, слова під неї не ставляться. */
  overlay?: boolean;
};

export type AbcVoice = {
  id: string;
  notes: AbcNote[];
  /** Час початку кожного такту. */
  barStarts: number[];
  /** Кінець останньої ноти або паузи. */
  end: number;
  /** Час початку кожного музичного рядка голосу (для перевірки, що голоси йдуть разом). */
  lineStarts: number[];
};

export type AbcTune = {
  title: string;
  /** Рядки `C:` (автори, джерело музики, авторські права). */
  credits: string[];
  /** Текст після `C: copyright:` (без початкового слова), або undefined. */
  copyright?: string;
  meter: string;
  /** Тональність з `K:` у вигляді «G», «Eb», «F#m». */
  key: string;
  tempo?: number;
  /** Коментарі Open Hymnal `%OHAUTHOR …` → { AUTHOR: '…' }. */
  meta: Record<string, string>;
  voices: AbcVoice[];
  /** Для кожного музичного рядка мелодії — рядки `w:` по черзі (куплет 1, 2, …). */
  lyrics: Map<number, string[]>;
  /** Куплети з рядків `W:` (без нот), кожен — масив рядків тексту. */
  extraVerses: string[][];
};

const LETTER_SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MAJOR_FIFTHS: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
};
const MODE_SHIFT: Record<string, number> = { maj: 0, ion: 0, m: -3, min: -3, aeo: -3, mix: -1, dor: -2, phr: -4, lyd: 1, loc: -5 };
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
const FIFTHS_TO_MAJOR = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];

/** Ключові знаки тональності: літера → зсув у півтонах; плюс назва тональності «G» / «Em». */
export function parseKey(value: string): { accidentals: Record<string, number>; name: string } {
  const m = /^\s*([A-G])([#b]?)\s*([A-Za-z]*)/.exec(value);
  const accidentals: Record<string, number> = {};
  if (!m) return { accidentals, name: 'C' };
  const root = m[1] + m[2];
  const modeWord = m[3].toLowerCase();
  const mode = modeWord === '' ? 'maj' : modeWord.startsWith('maj') ? 'maj' : modeWord.slice(0, 3) === 'min' || modeWord === 'm' ? 'm' : modeWord.slice(0, 3);
  const base = MAJOR_FIFTHS[root];
  const shift = MODE_SHIFT[mode] ?? 0;
  if (base === undefined) return { accidentals, name: root };
  // Тональність з тими самими знаками: для мінору — від кореня мінору, для решти ладів — як мажор.
  let fifths = base + shift;
  if (mode === 'm') {
    // У MAJOR_FIFTHS кількість знаків для мажору з цим коренем; мінор має на 3 знаки менше.
    fifths = base - 3;
  }
  fifths = Math.max(-7, Math.min(7, fifths));
  if (fifths > 0) for (const l of SHARP_ORDER.slice(0, fifths)) accidentals[l] = 1;
  if (fifths < 0) for (const l of FLAT_ORDER.slice(0, -fifths)) accidentals[l] = -1;
  const name = mode === 'm' ? `${root}m` : mode === 'maj' ? root : FIFTHS_TO_MAJOR[fifths + 7];
  return { accidentals, name };
}

function parseFraction(s: string): number {
  const m = /^\s*(\d+)\s*\/\s*(\d+)/.exec(s);
  if (m) return Number(m[1]) / Number(m[2]);
  return 1 / 8;
}

/** Одиниця долі для метра: 3/4 → 1/4, 6/8 → 3/8, 2/2 → 1/2. Також повна довжина такту. */
export function meterInfo(meter: string): { beat: number; bar: number } {
  const t = meter.trim();
  if (t === 'C') return { beat: 1 / 4, bar: 1 };
  if (t === 'C|') return { beat: 1 / 2, bar: 1 };
  const m = /^(\d+)\s*\/\s*(\d+)/.exec(t);
  if (!m) return { beat: 1 / 4, bar: 1 };
  const num = Number(m[1]);
  const den = Number(m[2]);
  const compound = den === 8 && num % 3 === 0 && num > 3;
  return { beat: compound ? 3 / den : 1 / den, bar: num / den };
}

type VoiceState = {
  voice: AbcVoice;
  time: number;
  bar: number;
  line: number;
  barAcc: Map<string, number>;
};

/** Розбирає один файл ABC (перша мелодія у файлі). */
export function parseAbc(text: string): AbcTune {
  const tune: AbcTune = {
    title: '',
    credits: [],
    meter: '4/4',
    key: 'C',
    meta: {},
    voices: [],
    lyrics: new Map(),
    extraVerses: [],
  };
  let unit = 1 / 8;
  let unitSet = false;
  let keyAcc: Record<string, number> = {};
  const states = new Map<string, VoiceState>();
  let current: VoiceState | null = null;
  let melodyId: string | null = null;
  let lastMelodyLine = -1;
  let extra: string[] = [];
  /** Тіло мелодії починається після K:; до того рядки без поля (PostScript тощо) ігноруються. */
  let inBody = false;

  const voiceState = (id: string): VoiceState => {
    let st = states.get(id);
    if (!st) {
      const voice: AbcVoice = { id, notes: [], barStarts: [0], end: 0, lineStarts: [] };
      tune.voices.push(voice);
      st = { voice, time: 0, bar: 0, line: -1, barAcc: new Map() };
      states.set(id, st);
      melodyId ??= id;
    }
    return st;
  };

  const setMeter = (v: string) => {
    tune.meter = v.trim();
    if (!unitSet) {
      // Типова одиниця: 1/16 для метрів менших за 3/4, інакше 1/8 (ABC 2.1).
      const m = /^(\d+)\s*\/\s*(\d+)/.exec(tune.meter);
      unit = m && Number(m[1]) / Number(m[2]) < 0.75 ? 1 / 16 : 1 / 8;
    }
  };

  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    if (line.startsWith('%OH')) {
      const m = /^%OH([A-Z]+)\s*(.*)$/.exec(line);
      if (m) tune.meta[m[1]] = m[2].trim();
      continue;
    }
    if (line.trim() === '') {
      if (inBody) break; // порожній рядок завершує мелодію (ABC 2.1); далі — пояснення тощо
      continue;
    }
    if (line.startsWith('%')) continue;

    const field = /^([A-Za-z]):\s?(.*)$/.exec(line);
    if (field && !line.startsWith('[')) {
      const [, f, rawValue] = field;
      const value = f === 'w' || f === 'W' ? rawValue : rawValue.replace(/\s%.*$/, '').trim();
      switch (f) {
        case 'T':
          if (!tune.title) tune.title = value;
          break;
        case 'C':
          tune.credits.push(value);
          {
            const c = /^copyright:\s*(.*)$/i.exec(value);
            if (c) tune.copyright = c[1].trim();
          }
          break;
        case 'M':
          setMeter(value);
          break;
        case 'L':
          unit = parseFraction(value);
          unitSet = true;
          break;
        case 'Q': {
          const q = /=\s*(\d+)/.exec(value) ?? /^(\d+)$/.exec(value);
          if (q) tune.tempo = Number(q[1]);
          break;
        }
        case 'K': {
          const k = parseKey(value);
          keyAcc = k.accidentals;
          tune.key = k.name;
          inBody = true;
          break;
        }
        case 'V': {
          const id = value.split(/\s+/)[0];
          // У заголовку V: лише оголошує голос; у тілі — перемикає на нього.
          current = voiceState(id);
          break;
        }
        case 'w':
          if (current && current.voice.id === melodyId && lastMelodyLine >= 0) {
            const list = tune.lyrics.get(lastMelodyLine) ?? [];
            list.push(value);
            tune.lyrics.set(lastMelodyLine, list);
          }
          break;
        case 'W': {
          const t = value.trim();
          if (t === '') {
            if (extra.length) tune.extraVerses.push(extra);
            extra = [];
          } else {
            extra.push(t);
          }
          break;
        }
        default:
          break;
      }
      continue;
    }

    // Музичний рядок. Може починатися з [V: id]. Рядок без голосу й без тактової риски — не ноти.
    if (!inBody) continue;
    let body = line;
    const v = /^\s*\[V:\s*([^\]\s]+)[^\]]*\]/.exec(body);
    if (!v && !body.includes('|')) continue;
    if (v) {
      current = voiceState(v[1]);
      body = body.slice(v[0].length);
    }
    if (!current) current = voiceState('1');
    current.line++;
    current.voice.lineStarts[current.line] = current.time;
    if (current.voice.id === melodyId) lastMelodyLine = current.line;
    const k = parseMusic(body, current, unit, keyAcc, tune);
    keyAcc = k;
  }
  if (extra.length) tune.extraVerses.push(extra);
  for (const st of states.values()) st.voice.end = st.time;
  return tune;
}

/** Розбирає ноти одного рядка й дописує їх у голос. Повертає ключові знаки (можуть змінитися через [K:]). */
function parseMusic(
  body: string,
  st: VoiceState,
  unitIn: number,
  keyAccIn: Record<string, number>,
  tune: AbcTune,
): Record<string, number> {
  let unit = unitIn;
  let keyAcc = keyAccIn;
  const s = body;
  let i = 0;
  let tupletLeft = 0;
  let tupletFactor = 1;
  let brokenNext = 1;
  let lastNote: AbcNote | null = null;
  /** Накладення `&`: ноти після нього звучать від початку такту; час основного голосу — тут. */
  let overlayFrom: number | null = null;

  const newBar = () => {
    if (overlayFrom !== null) {
      st.time = Math.max(st.time, overlayFrom);
      overlayFrom = null;
    }
    st.bar++;
    st.voice.barStarts[st.bar] = st.time;
    st.barAcc.clear();
  };

  /** Читає множник тривалості: «2», «3/2», «/», «//», «/4». */
  const readLength = (): number => {
    let num = '';
    while (i < s.length && /\d/.test(s[i])) num += s[i++];
    let factor = num ? Number(num) : 1;
    while (s[i] === '/') {
      i++;
      let den = '';
      while (i < s.length && /\d/.test(s[i])) den += s[i++];
      factor /= den ? Number(den) : 2;
    }
    return factor;
  };

  /** Читає одну висоту (з альтерацією й октавою). Повертає null, якщо тут не нота. */
  const readPitch = (): number | null => {
    let acc: number | null = null;
    const start = i;
    while (s[i] === '^' || s[i] === '_' || s[i] === '=') {
      if (s[i] === '=') acc = 0;
      else acc = (acc ?? 0) + (s[i] === '^' ? 1 : -1);
      i++;
    }
    const ch = s[i];
    if (!ch || !/[A-Ga-g]/.test(ch)) {
      i = start;
      return null;
    }
    i++;
    const letter = ch.toUpperCase();
    let octave = ch === letter ? 0 : 1;
    while (s[i] === ',' || s[i] === "'") {
      octave += s[i] === ',' ? -1 : 1;
      i++;
    }
    const natural = 60 + 12 * octave + LETTER_SEMI[letter];
    const accKey = `${letter}${octave}`;
    if (acc !== null) st.barAcc.set(accKey, acc);
    const applied = acc ?? st.barAcc.get(accKey) ?? keyAcc[letter] ?? 0;
    return natural + applied;
  };

  const addNote = (pitches: number[], lengthFactor: number) => {
    let dur = unit * lengthFactor;
    if (tupletLeft > 0) {
      dur *= tupletFactor;
      tupletLeft--;
    }
    dur *= brokenNext;
    brokenNext = 1;
    const note: AbcNote = { start: st.time, dur, pitches, bar: st.bar, line: st.line };
    if (overlayFrom !== null) note.overlay = true;
    st.voice.notes.push(note);
    st.time += dur;
    lastNote = note;
  };

  const advanceRest = (lengthFactor: number) => {
    let dur = unit * lengthFactor;
    if (tupletLeft > 0) {
      dur *= tupletFactor;
      tupletLeft--;
    }
    dur *= brokenNext;
    brokenNext = 1;
    st.time += dur;
    lastNote = null;
  };

  while (i < s.length) {
    const c = s[i];
    if (c === '%') break;
    if (c === '&') {
      // Накладення в межах такту: наступні ноти звучать разом з уже записаними.
      if (overlayFrom === null) overlayFrom = st.time;
      st.time = st.voice.barStarts[st.bar] ?? st.time;
      lastNote = null;
      i++;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '`' || c === '\\' || c === '$' || c === '.' || c === '~' || c === ')') {
      i++;
      continue;
    }
    if (c === '"') {
      const j = s.indexOf('"', i + 1);
      i = j < 0 ? s.length : j + 1;
      continue;
    }
    if (c === '!' || c === '+') {
      const j = s.indexOf(c, i + 1);
      i = j < 0 ? s.length : j + 1;
      continue;
    }
    if (c === '{') {
      const j = s.indexOf('}', i + 1);
      i = j < 0 ? s.length : j + 1;
      continue;
    }
    if (c === '(') {
      i++;
      if (/\d/.test(s[i] ?? '')) {
        const m = /^(\d+)(?::(\d*))?(?::(\d*))?/.exec(s.slice(i))!;
        i += m[0].length;
        const p = Number(m[1]);
        const qDefault = p === 2 || p === 4 || p === 8 ? 3 : p === 3 || p === 6 ? 2 : 2;
        const q = m[2] ? Number(m[2]) : qDefault;
        tupletFactor = q / p;
        tupletLeft = m[3] ? Number(m[3]) : p;
      }
      continue;
    }
    if (c === '-') {
      i++; // зв'язка: для гармонії й слів нота однаково окрема
      continue;
    }
    if (c === '>' || c === '<') {
      let n = 0;
      while (s[i] === c) {
        n++;
        i++;
      }
      const long = 2 - 1 / 2 ** n;
      const short = 1 / 2 ** n;
      const prev = lastNote as AbcNote | null;
      if (prev) {
        const newDur = prev.dur * (c === '>' ? long : short);
        st.time += newDur - prev.dur;
        prev.dur = newDur;
      }
      brokenNext = c === '>' ? short : long;
      continue;
    }
    if (c === '|' || c === ':' || (c === '[' && /[|\d]/.test(s[i + 1] ?? ''))) {
      // Тактова риска з усіма варіантами: | || |] [| |: :| :: [1 |2
      let sawBar = false;
      while (i < s.length && /[|:\[\]\d,]/.test(s[i])) {
        if (s[i] === '|' || s[i] === ']') sawBar = true;
        if (s[i] === '[' && !/[|\d]/.test(s[i + 1] ?? '')) break;
        i++;
      }
      if (sawBar) newBar();
      continue;
    }
    if (c === '[' && /[A-Za-z]:/.test(s.slice(i + 1, i + 3))) {
      const j = s.indexOf(']', i);
      const inner = s.slice(i + 1, j < 0 ? s.length : j);
      i = j < 0 ? s.length : j + 1;
      const f = inner[0];
      const val = inner.slice(2).trim();
      if (f === 'K') {
        const k = parseKey(val);
        keyAcc = k.accidentals;
      } else if (f === 'L') {
        unit = parseFraction(val);
      } else if (f === 'M') {
        tune.meter = val;
      } else if (f === 'Q') {
        const q = /=\s*(\d+)/.exec(val);
        if (q && tune.tempo === undefined) tune.tempo = Number(q[1]);
      }
      continue;
    }
    if (c === '[') {
      // Акорд у межах голосу: [DF]2
      i++;
      const pitches: number[] = [];
      let innerLen = 1;
      while (i < s.length && s[i] !== ']') {
        const p = readPitch();
        if (p === null) {
          i++;
          continue;
        }
        const l = readLength();
        if (pitches.length === 0) innerLen = l;
        pitches.push(p);
        while (s[i] === '-') i++;
      }
      i++; // ]
      const outer = readLength();
      if (pitches.length) addNote(pitches, innerLen * outer);
      continue;
    }
    if (c === 'z' || c === 'x') {
      i++;
      advanceRest(readLength());
      continue;
    }
    if (c === 'Z') {
      i++;
      const n = readLength();
      const bar = meterInfo(tune.meter).bar;
      for (let k = 0; k < n; k++) {
        st.time += bar;
        if (k < n - 1) newBar();
      }
      lastNote = null;
      continue;
    }
    const p = readPitch();
    if (p !== null) {
      addNote([p], readLength());
      continue;
    }
    // Літери-прикраси (H — фермата тощо), y-пропуск та інше — пропускаємо.
    i++;
  }
  return keyAcc;
}

/** Елемент рядка слів `w:`. */
export type LyricItem =
  | { kind: 'syl'; text: string; wordEnd: boolean }
  | { kind: 'skip' }
  | { kind: 'hold' }
  | { kind: 'bar' };

/** Розбирає рядок `w:` за правилами ABC 2.1: «-» між складами, «_» тягнути, «*» пропустити ноту, «~» пробіл, «|» до такту. */
export function parseLyricLine(text: string): LyricItem[] {
  const out: LyricItem[] = [];
  let cur = '';
  const push = (wordEnd: boolean) => {
    if (cur !== '') out.push({ kind: 'syl', text: cur, wordEnd });
    cur = '';
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && text[i + 1] === '-') {
      cur += '-';
      i++;
    } else if (c === ' ' || c === '\t') {
      push(true);
    } else if (c === '-') {
      if (cur !== '') push(false);
      else {
        const last = out[out.length - 1];
        if (last && last.kind === 'syl' && !last.wordEnd) out.push({ kind: 'hold' });
        else if (last && last.kind === 'syl') last.wordEnd = false;
      }
    } else if (c === '_') {
      push(true);
      out.push({ kind: 'hold' });
    } else if (c === '*') {
      push(true);
      out.push({ kind: 'skip' });
    } else if (c === '~') {
      cur += ' ';
    } else if (c === '|') {
      push(true);
      out.push({ kind: 'bar' });
    } else {
      cur += c;
    }
  }
  push(true);
  return out;
}

/** Текст файлу ABC: UTF-8, а якщо байти не UTF-8 — Latin-1 (старі файли Open Hymnal). */
export function decodeAbc(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('latin1').decode(bytes);
  }
}
