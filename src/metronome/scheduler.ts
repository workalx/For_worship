type Options = {
  /** Поточний час у секундах (AudioContext.currentTime). */
  now: () => number;
  /** Запланувати клік долі `beat` на момент `time` (с). */
  schedule: (time: number, beat: number) => void;
  /** Наскільки наперед планувати, с. */
  lookahead?: number;
};

const TICK_MS = 25;

/** Планувальник з випередженням: звуки ставляться в чергу Web Audio заздалегідь, тож ритм не «пливе». */
export class Scheduler {
  private bpm = 120;
  private beats = 4;
  private beat = 0;
  private nextTime = 0;
  private lastTime: number | null = null;
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly lookahead: number;

  constructor(private readonly opts: Options) {
    this.lookahead = opts.lookahead ?? 0.1;
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
    if (this.running && this.lastTime !== null) this.nextTime = this.lastTime + 60 / bpm;
  }

  setBeats(n: number): void {
    this.beats = n;
    this.beat %= n;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.beat = 0;
    this.lastTime = null;
    this.nextTime = this.opts.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick(): void {
    if (!this.running) return;
    const horizon = this.opts.now() + this.lookahead;
    while (this.nextTime < horizon) {
      this.opts.schedule(this.nextTime, this.beat);
      this.lastTime = this.nextTime;
      this.nextTime += 60 / this.bpm;
      this.beat = (this.beat + 1) % this.beats;
    }
  }
}
