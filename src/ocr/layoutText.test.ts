import { describe, expect, it } from 'vitest';
import { AiError } from '../ai/provider';
import { ocrToCandidate, type OcrLine, type OcrWord } from './layoutText';

// Рядок з 7 слів, неоднакові ширини літер і проміжки ~0.4 символа (cw = 9.3)
const CW = 9.3;
function lyricWords(texts: string[], startX = 100): OcrWord[] {
  const out: OcrWord[] = [];
  let x = startX;
  texts.forEach((t, i) => {
    const cw = CW * (0.85 + (i % 3) * 0.15); // змінна ширина літер
    out.push({ text: t, x0: x, x1: x + t.length * cw });
    x += t.length * cw + 0.4 * CW;
  });
  return out;
}

describe('ocrToCandidate geometry', () => {
  it('places a chord over the 6th word of a proportional line', () => {
    const words = lyricWords(['Ти', 'є', 'світло', 'в', 'моїй', 'темряві', 'завжди']);
    const sixth = words[5];
    const chordX = sixth.x0 + (sixth.x1 - sixth.x0) * 0.45; // ~ 3-тя літера
    const c = ocrToCandidate([
      { words: [{ text: 'Назва', x0: 100, x1: 150 }], y0: 0 },
      { words: [{ text: 'Am', x0: chordX, x1: chordX + 18 }], y0: 30 },
      { words: words, y0: 60 },
    ]);
    expect(c.title).toBe('Назва');
    expect(c.body).toMatch(/в моїй те\[Am\]мряві завжди$/);
  });

  it('chord font wider than lyrics still lands on the right word', () => {
    const words = lyricWords(['Ти', 'світло', 'в', 'темряві']);
    const c = ocrToCandidate([
      { words: [{ text: 'Т', x0: 0, x1: 10 }], y0: 0 },
      { words: [{ text: 'G', x0: words[0].x0, x1: words[0].x0 + 14 }, { text: 'D/F#', x0: words[3].x0, x1: words[3].x0 + 70 }], y0: 30 },
      { words, y0: 60 },
    ]);
    expect(c.body).toBe('[G]Ти світло в [D/F#]темряві');
    expect(c.key).toBe('G');
  });

  it('chord before first word and past the last word', () => {
    const words = lyricWords(['Слава', 'Тобі']);
    const end = words[1].x1 + 40;
    const c = ocrToCandidate([
      { words: [{ text: 'Назва', x0: 0, x1: 40 }], y0: 0 },
      { words: [{ text: 'C', x0: words[0].x0 - 30, x1: words[0].x0 - 20 }, { text: 'F', x0: end, x1: end + 10 }], y0: 30 },
      { words, y0: 60 },
    ]);
    expect(c.body).toBe('[C]Слава Тобі[F]');
  });

  it('cropped photo starting with a chord line has no title', () => {
    const words = lyricWords(['Господь', 'мій']);
    const c = ocrToCandidate([
      { words: [{ text: 'Em', x0: words[0].x0, x1: words[0].x0 + 20 }], y0: 0 },
      { words, y0: 30 },
    ]);
    expect(c.title).toBe('Фото пісні');
    expect(c.body).toBe('[Em]Господь мій');
  });

  it('homoglyph chord line is normalized, lyrics untouched', () => {
    const words = lyricWords(['Слава', 'Богу']);
    const c = ocrToCandidate([
      { words: [{ text: 'Х', x0: 0, x1: 8 }], y0: 0 },
      { words: [{ text: 'Аm', x0: words[0].x0, x1: words[0].x0 + 20 }, { text: 'С', x0: words[1].x0, x1: words[1].x0 + 10 }], y0: 30 },
      { words, y0: 60 },
    ]);
    expect(c.body).toBe('[Am]Слава [C]Богу');
  });

  it('keeps a section label as a label and a chord-only line', () => {
    const c = ocrToCandidate([
      { words: [{ text: 'Назва', x0: 0, x1: 50 }] },
      { words: [{ text: 'Приспів:', x0: 0, x1: 80 }] },
      { words: [{ text: 'G', x0: 0, x1: 10 }, { text: 'D', x0: 50, x1: 60 }] },
    ]);
    expect(c.body).toBe('Приспів:\n[G] [D]');
  });

  it('title is not a section label', () => {
    const c = ocrToCandidate([{ words: [{ text: 'Приспів', x0: 0, x1: 70 }] }, { words: [{ text: 'Слава', x0: 0, x1: 50 }] }]);
    expect(c.title).toBe('Фото пісні');
    expect(c.body).toBe('Приспів\nСлава');
  });

  it('orders rows by y when present and separates paragraphs', () => {
    const lines: OcrLine[] = [
      { words: [{ text: 'Два', x0: 0, x1: 30 }], y0: 100, paragraphStart: true },
      { words: [{ text: 'Назва', x0: 0, x1: 50 }], y0: 0 },
      { words: [{ text: 'Один', x0: 0, x1: 40 }], y0: 50, paragraphStart: true },
    ];
    expect(ocrToCandidate(lines).body).toBe('Один\n\nДва');
  });

  it('throws empty on no text', () => {
    for (const input of [[], [{ words: [] }], [{ words: [{ text: ' ', x0: 0, x1: 1 }] }]]) {
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
