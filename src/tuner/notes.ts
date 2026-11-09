const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export type NoteReading = { name: string; octave: number; cents: number; midi: number };

export function frequencyToNote(freq: number, a4 = 440): NoteReading {
  const exact = 69 + 12 * Math.log2(freq / a4);
  const midi = Math.round(exact);
  return {
    name: NAMES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    cents: Math.round((exact - midi) * 100),
    midi,
  };
}

export const GUITAR_STRINGS = [
  { name: 'E', octave: 2, freq: 82.41 },
  { name: 'A', octave: 2, freq: 110.0 },
  { name: 'D', octave: 3, freq: 146.83 },
  { name: 'G', octave: 3, freq: 196.0 },
  { name: 'B', octave: 3, freq: 246.94 },
  { name: 'E', octave: 4, freq: 329.63 },
];

/** Індекс струни (0–5), найближчої за висотою (у центах). */
export function nearestString(freq: number): number {
  let best = 0;
  let bestDist = Infinity;
  GUITAR_STRINGS.forEach((s, i) => {
    const d = Math.abs(Math.log2(freq / s.freq));
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

export type PitchReading = { freq: number; clarity: number; rms: number };

const MIN_CLARITY = 0.9;
const MIN_RMS = 0.01;
const WINDOW = 5;
const MAX_REJECTED = 10;

/** Відкидає нечіткі й тихі зчитування та показує медіану останніх 5 прийнятих частот. */
export class PitchSmoother {
  private buf: number[] = [];
  private rejected = 0;

  push(reading: PitchReading | null): number | null {
    if (reading && reading.clarity >= MIN_CLARITY && reading.rms >= MIN_RMS && Number.isFinite(reading.freq)) {
      this.rejected = 0;
      this.buf.push(reading.freq);
      if (this.buf.length > WINDOW) this.buf.shift();
    } else {
      this.rejected++;
      if (this.rejected >= MAX_REJECTED) this.buf = [];
    }
    if (this.buf.length === 0) return null;
    const sorted = [...this.buf].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
}
