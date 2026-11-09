import { clampBpm, tapTempo, beatsPerBar } from './tempo';

test('clampBpm тримає 30–250 і округлює', () => {
  expect(clampBpm(10)).toBe(30);
  expect(clampBpm(300)).toBe(250);
  expect(clampBpm(72.4)).toBe(72);
  expect(clampBpm(NaN)).toBe(30);
});

test('tapTempo — середнє останніх інтервалів', () => {
  expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
  expect(tapTempo([0, 2000, 2600, 3200, 3800, 4400])).toBe(100);
});

test('tapTempo — замало натискань або довга пауза', () => {
  expect(tapTempo([0])).toBeNull();
  expect(tapTempo([0, 500, 3000])).toBeNull();
});

test('beatsPerBar', () => {
  expect(beatsPerBar('4/4')).toBe(4);
  expect(beatsPerBar('3/4')).toBe(3);
  expect(beatsPerBar('6/8')).toBe(6);
});
