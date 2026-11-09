import type { TimeSig } from '../db/db';

export const MIN_BPM = 30;
export const MAX_BPM = 250;
const TAP_RESET_MS = 2000;
const TAP_INTERVALS = 4;

export function clampBpm(n: number): number {
  if (!Number.isFinite(n)) return MIN_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(n)));
}

/** Темп за часом натискань «Tap» (мс). null — якщо натискань < 2 або після паузи > 2 с. */
export function tapTempo(timesMs: number[]): number | null {
  if (timesMs.length < 2) return null;
  const intervals: number[] = [];
  for (let i = 1; i < timesMs.length; i++) intervals.push(timesMs[i] - timesMs[i - 1]);
  if (intervals[intervals.length - 1] > TAP_RESET_MS) return null;
  const recent = intervals.slice(-TAP_INTERVALS);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  return Math.round(60000 / avg);
}

export function beatsPerBar(sig: TimeSig): number {
  return sig === '3/4' ? 3 : sig === '6/8' ? 6 : 4;
}
