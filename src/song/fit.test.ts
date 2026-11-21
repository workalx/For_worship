import { fitFontSize, chooseLayout, contentFits } from './fit';

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


describe('chooseLayout', () => {
  test('коротка пісня, що влазить в одну колонку на 28 — одна колонка', () => {
    expect(chooseLayout(() => true)).toEqual({ cols: 1, px: 28, overflow: false });
  });
  test('у дві колонки шрифт більший — дві колонки', () => {
    expect(chooseLayout((cols, px) => (cols === 1 ? px <= 17 : px <= 28))).toEqual({ cols: 2, px: 28, overflow: false });
  });
  test('однаково — перевага одній колонці', () => {
    expect(chooseLayout((_c, px) => px <= 20)).toEqual({ cols: 1, px: 20, overflow: false });
  });
  test('у дві колонки на 14 не влазить, на 12 влазить — дві колонки дрібнішим шрифтом, без прокрутки', () => {
    expect(chooseLayout((cols, px) => cols === 2 && px <= 12)).toEqual({ cols: 2, px: 12, overflow: false });
  });
  test('довга пісня з короткими рядками — три колонки замість прокрутки', () => {
    expect(chooseLayout((cols, px) => cols === 3 && px <= 16)).toEqual({ cols: 3, px: 16, overflow: false });
  });
  test('три колонки лише коли шрифт більший, ніж у двох', () => {
    expect(chooseLayout((cols, px) => cols >= 2 && px <= 13)).toEqual({ cols: 2, px: 13, overflow: false });
  });
  test('поки влазить у дві колонки зручним шрифтом — три не розглядаються', () => {
    expect(chooseLayout((cols, px) => (cols === 2 ? px <= 15 : cols === 3 ? px <= 24 : false))).toEqual({
      cols: 2,
      px: 15,
      overflow: false,
    });
  });
  test('не влазить ніяк — одна колонка з прокруткою', () => {
    expect(chooseLayout(() => false)).toEqual({ cols: 1, px: 14, overflow: true });
  });
});

describe('contentFits', () => {
  test('висота рахується без внутрішніх відступів', () => {
    expect(contentFits({ contentHeight: 590, availableHeight: 580, maxLineWidth: 100, columnWidth: 300 })).toBe(false);
    expect(contentFits({ contentHeight: 580, availableHeight: 580, maxLineWidth: 100, columnWidth: 300 })).toBe(true);
  });
  test('рядок ширший за колонку — не влазить', () => {
    expect(contentFits({ contentHeight: 100, availableHeight: 580, maxLineWidth: 320, columnWidth: 300 })).toBe(false);
  });
});
