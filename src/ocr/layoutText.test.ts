import { describe, expect, it } from 'vitest';
import { AiError } from '../ai/provider';
import { layoutLines, ocrToCandidate, type OcrLine } from './layoutText';

const w = (text: string, x0: number) => ({ text, x0, x1: x0 + text.length * 10 });

describe('layoutLines', () => {
  it('places words at columns from x positions', () => {
    const out = layoutLines([{ words: [w('G', 0), w('Am', 50)] }]);
    expect(out).toBe('G    Am');
  });

  it('never glues words together', () => {
    const out = layoutLines([{ words: [w('ab', 0), w('cd', 21)] }]);
    expect(out).toBe('ab cd');
  });
});

describe('ocrToCandidate', () => {
  const song: OcrLine[] = [
    { words: [w('Моя', 0), w('пісня', 40)] },
    { words: [w('G', 0), w('D/F#', 120)] },
    { words: [w('Ти', 0), w('світло', 30), w('в', 100), w('темряві', 120)] },
  ];

  it('puts chords over their words', () => {
    const c = ocrToCandidate(song);
    expect(c.body).toContain('[G]Ти світло в [D/F#]темряві');
  });

  it('takes the title from the first line and removes it', () => {
    const c = ocrToCandidate(song);
    expect(c.title).toBe('Моя пісня');
    expect(c.body).not.toContain('Моя пісня');
    expect(c.key).toBe('G');
  });

  it('keeps chord over a gap or past the line end on its column', () => {
    const c = ocrToCandidate([
      { words: [w('Title', 0)] },
      { words: [w('C', 30), w('F', 90)] },
      { words: [w('аб', 0), w('вг', 50)] },
    ]);
    expect(c.body).toBe('аб [C]  вг  [F]');
  });

  it('keeps a section label as a label, not the title', () => {
    const c = ocrToCandidate([{ words: [w('Приспів', 0)] }, { words: [w('Слава', 0)] }]);
    expect(c.title).toBe('Слава');
    expect(c.body).toBe('Приспів');
  });

  it('throws empty on no text', () => {
    for (const input of [[], [{ words: [] }]]) {
      try {
        ocrToCandidate(input);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(AiError);
        expect((e as AiError).kind).toBe('empty');
      }
    }
  });
});
