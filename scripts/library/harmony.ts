/**
 * Визначення гітарних акордів з чотириголосся (SATB).
 * Для кожного такту пробуємо один акорд на весь такт або два (поділ на межі долі)
 * і беремо варіант з кращою оцінкою. Акорди: мажор, мінор, домінантсептакорд.
 */
import type { AbcTune, AbcVoice } from './abc';
import { meterInfo } from './abc';

export type ChordQuality = '' | 'm' | '7';
export type ChordEvent = { time: number; root: number; quality: ChordQuality };

const TEMPLATES: Record<ChordQuality, number[]> = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10] };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export type HarmonyOptions = {
  /** Штраф за другий акорд у такті (частка ваги такту). */
  changePenalty: number;
  /** Вага нот, що не входять в акорд. */
  outsideWeight: number;
};

export const DEFAULT_HARMONY: HarmonyOptions = { changePenalty: 0.12, outsideWeight: 0.8 };

function keyPc(key: string): { tonic: number; minor: boolean } {
  const m = /^([A-G])([#b]?)(m?)$/.exec(key);
  if (!m) return { tonic: 0, minor: false };
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return { tonic: (NOTE_PC[m[1]] + acc + 12) % 12, minor: m[3] === 'm' };
}

/** Наскільки акорд «свій» для тональності: 0 — діатонічний, більше — чужіший. */
function foreignness(root: number, quality: ChordQuality, key: { tonic: number; minor: boolean }): number {
  const deg = (root - key.tonic + 12) % 12;
  if (!key.minor) {
    const diatonic: Record<number, ChordQuality[]> = { 0: ['', '7'], 2: ['m', '7'], 4: ['m', '7'], 5: [''], 7: ['', '7'], 9: ['m', '7'] };
    if (diatonic[deg]?.includes(quality)) {
      // II7, III7, VI7 — вторинні домінанти: допустимі, але трохи рідші.
      return quality === '7' && deg !== 7 ? 0.5 : 0;
    }
    if ((deg === 2 || deg === 4 || deg === 9) && quality === '') return 0.5; // мажорні вторинні домінанти
    return 1;
  }
  const diatonic: Record<number, ChordQuality[]> = { 0: ['m'], 3: [''], 5: ['m'], 7: ['', '7', 'm'], 8: [''], 10: ['', '7'] };
  if (diatonic[deg]?.includes(quality)) return 0;
  if (deg === 0 && quality === '') return 0.3; // пікардійська терція в кінці
  return 1;
}

type Window = { weights: number[]; bass: number | null; total: number };

/** Сумарна вага кожного класу висоти у вікні [a, b) по всіх голосах. */
function collect(voices: AbcVoice[], a: number, b: number): Window {
  const weights = new Array<number>(12).fill(0);
  let bass: number | null = null;
  let bassAtStart: number | null = null;
  const lastVoice = voices.length - 1;
  voices.forEach((v, vi) => {
    for (const n of v.notes) {
      const s = Math.max(n.start, a);
      const e = Math.min(n.start + n.dur, b);
      if (e - s <= 1e-9) continue;
      let w = e - s;
      if (Math.abs(n.start - a) < 1e-9) w *= 1.25; // нота з'являється на долі
      if (vi === lastVoice) w *= 1.5; // бас
      for (const p of n.pitches) {
        weights[p % 12] += w;
        if (bass === null || p < bass) bass = p;
        if (n.start <= a + 1e-9 && n.start + n.dur > a + 1e-9 && (bassAtStart === null || p < bassAtStart)) bassAtStart = p;
      }
    }
  });
  const chosenBass = bassAtStart ?? bass;
  return { weights, bass: chosenBass === null ? null : chosenBass % 12, total: weights.reduce((x, y) => x + y, 0) };
}

/** Найкращий акорд для вікна й оцінка (у частках ваги вікна). */
function bestChord(win: Window, key: { tonic: number; minor: boolean }, opts: HarmonyOptions): { root: number; quality: ChordQuality; score: number } | null {
  if (win.total <= 1e-9) return null;
  let best: { root: number; quality: ChordQuality; score: number } | null = null;
  for (let root = 0; root < 12; root++) {
    for (const quality of ['', 'm', '7'] as ChordQuality[]) {
      const pcs = TEMPLATES[quality].map((x) => (root + x) % 12);
      let inside = 0;
      for (const pc of pcs) inside += win.weights[pc];
      const outside = win.total - inside;
      let score = (inside - opts.outsideWeight * outside) / win.total;
      if (quality === '7') {
        const seventh = (root + 10) % 12;
        if (win.weights[seventh] / win.total < 0.08) continue; // без септими — це тріада
        score -= 0.06;
      }
      if (win.weights[root] === 0) score -= 0.25;
      if (win.bass !== null) {
        if (win.bass === root) score += 0.2;
        else if (pcs.includes(win.bass)) score += 0.05;
        else score -= 0.25;
      }
      score -= 0.15 * foreignness(root, quality, key);
      if (!best || score > best.score + 1e-9) best = { root, quality, score };
    }
  }
  return best;
}

/** Акорди для всієї пісні: не більше двох на такт, лише в моменти зміни. */
export function harmonize(tune: AbcTune, opts: HarmonyOptions = DEFAULT_HARMONY): ChordEvent[] {
  const melody = tune.voices[0];
  if (!melody) return [];
  const { beat } = meterInfo(tune.meter);
  const key = keyPc(tune.key);
  const end = Math.max(...tune.voices.map((v) => v.end));
  const starts = melody.barStarts.filter((t, i, a) => i === 0 || t > a[i - 1] + 1e-9);
  const events: ChordEvent[] = [];
  let prev: { root: number; quality: ChordQuality } | null = null;

  for (let b = 0; b < starts.length; b++) {
    const a = starts[b];
    const z = b + 1 < starts.length ? starts[b + 1] : end;
    if (z - a <= 1e-9) continue;
    const whole = collect(tune.voices, a, z);
    const one = bestChord(whole, key, opts);
    if (!one) continue;
    const same = (c: { root: number; quality: ChordQuality }, d: { root: number; quality: ChordQuality } | null) =>
      !!d && c.root === d.root && c.quality === d.quality;
    let bestPlan: { score: number; parts: { time: number; root: number; quality: ChordQuality }[] } = {
      score: one.score + (same(one, prev) ? 0.03 : 0),
      parts: [{ time: a, root: one.root, quality: one.quality }],
    };
    // Поділ такту на межі долі (з урахуванням неповного першого такту — від кінця).
    const splits: number[] = [];
    for (let t = z - beat; t > a + 1e-9; t -= beat) splits.push(t);
    for (const t of splits) {
      const w1 = collect(tune.voices, a, t);
      const w2 = collect(tune.voices, t, z);
      const c1 = bestChord(w1, key, opts);
      const c2 = bestChord(w2, key, opts);
      if (!c1 || !c2 || same(c1, c2)) continue;
      const f1 = w1.total / whole.total;
      const f2 = w2.total / whole.total;
      const score = c1.score * f1 + c2.score * f2 - opts.changePenalty + (same(c1, prev) ? 0.03 : 0);
      if (score > bestPlan.score + 1e-9) {
        bestPlan = { score, parts: [{ time: a, ...c1 }, { time: t, ...c2 }] };
      }
    }
    for (const p of bestPlan.parts) {
      if (!same(p, prev)) events.push({ time: p.time, root: p.root, quality: p.quality });
      prev = p;
    }
  }
  return events;
}

/** Назва акорду з урахуванням тональності (дієзи чи бемолі). */
export function chordName(e: { root: number; quality: ChordQuality }, preferFlats: boolean): string {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[e.root] + e.quality;
}
