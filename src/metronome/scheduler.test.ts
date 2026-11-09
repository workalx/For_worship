import { Scheduler } from './scheduler';

function run(s: Scheduler, clock: { t: number }, until: number) {
  while (clock.t < until - 1e-9) {
    clock.t = Math.round((clock.t + 0.025) * 1000) / 1000;
    s.tick();
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('120 BPM, 4/4: долі в 0, 0.5, 1.0 з номерами 0, 1, 2', () => {
  const clock = { t: 0 };
  const events: [number, number][] = [];
  const s = new Scheduler({ now: () => clock.t, schedule: (time, beat) => events.push([time, beat]) });
  s.setBpm(120);
  s.setBeats(4);
  s.start();
  s.tick();
  run(s, clock, 1.0);
  expect(events).toEqual([[0, 0], [0.5, 1], [1.0, 2]]);
  s.stop();
});

test('зміна темпу під час гри не дає двох доль ближче ніж 0.5 с', () => {
  const clock = { t: 0 };
  const times: number[] = [];
  const s = new Scheduler({ now: () => clock.t, schedule: (time) => times.push(time) });
  s.setBpm(120);
  s.setBeats(4);
  s.start();
  s.tick();
  run(s, clock, 0.6);
  s.setBpm(60);
  run(s, clock, 3);
  for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(0.5 - 1e-9);
  expect(times).toContain(1.5);
  s.stop();
});

test('після stop() нічого не планується', () => {
  const clock = { t: 0 };
  const times: number[] = [];
  const s = new Scheduler({ now: () => clock.t, schedule: (time) => times.push(time) });
  s.setBpm(120);
  s.start();
  s.tick();
  s.stop();
  run(s, clock, 2);
  expect(times).toEqual([0]);
});

test('розмір 3/4: номер долі повертається до 0', () => {
  const clock = { t: 0 };
  const beats: number[] = [];
  const s = new Scheduler({ now: () => clock.t, schedule: (_t, b) => beats.push(b) });
  s.setBpm(240);
  s.setBeats(3);
  s.start();
  s.tick();
  run(s, clock, 1.0);
  expect(beats.slice(0, 5)).toEqual([0, 1, 2, 0, 1]);
  s.stop();
});

test('різке прискорення не ставить долю в минуле', () => {
  const clock = { t: 0 };
  const seen: [number, number][] = [];
  const s = new Scheduler({ now: () => clock.t, schedule: (time) => seen.push([time, clock.t]) });
  s.setBpm(60);
  s.start();
  s.tick();
  run(s, clock, 1.4);
  s.setBpm(250);
  run(s, clock, 2.5);
  for (const [time, now] of seen) expect(time).toBeGreaterThanOrEqual(now - 1e-9);
  s.stop();
});
