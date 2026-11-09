import { fitFontSize, chooseColumns } from './fit';

test('найбільший розмір, що влазить', () => {
  expect(fitFontSize((px) => px <= 20)).toEqual({ px: 20, overflow: false });
});

test('якщо влазить усе — максимум 28', () => {
  expect(fitFontSize(() => true)).toEqual({ px: 28, overflow: false });
});

test('дуже довга пісня: мінімум 14 і прокрутка', () => {
  expect(fitFontSize(() => false)).toEqual({ px: 14, overflow: true });
});

test('рівно на мінімумі — без прокрутки', () => {
  expect(fitFontSize((px) => px <= 14)).toEqual({ px: 14, overflow: false });
});

test('chooseColumns', () => {
  expect(chooseColumns(10)).toBe(1);
  expect(chooseColumns(14)).toBe(1);
  expect(chooseColumns(30)).toBe(2);
});
