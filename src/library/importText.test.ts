import { normalizeImportedText } from './importText';

test('«акорди над рядком» перетворюються на ChordPro', () => {
  const out = normalizeImportedText('Em  C\nСлово');
  expect(out).toContain('[Em]');
  expect(out).toContain('[C]');
});

test('ChordPro лишається як є (крім порожніх рядків)', () => {
  expect(normalizeImportedText('[G]Ти\n\n\n\n[D]світло')).toBe('[G]Ти\n\n[D]світло');
});

test('прибирає пробіли по краях і зайві порожні рядки', () => {
  expect(normalizeImportedText('\n\nКуплет 1\nG\nСлово\n\n\n\nПриспів\nC\nХвала\n\n')).toBe(
    'Куплет 1\n[G]Слово\n\nПриспів\n[C]Хвала',
  );
});
