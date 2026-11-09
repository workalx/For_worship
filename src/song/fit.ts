/**
 * Найбільший цілий розмір шрифту в [min, max], для якого fits(px) === true.
 * Якщо не влазить навіть min — повертає min і overflow: true (тоді вмикається прокрутка).
 */
export function fitFontSize(
  fits: (px: number) => boolean,
  max = 28,
  min = 14,
): { px: number; overflow: boolean } {
  if (!fits(min)) return { px: min, overflow: true };
  let lo = min;
  let hi = max;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return { px: lo, overflow: false };
}

export type Layout = { cols: 1 | 2; px: number; overflow: boolean };

/**
 * Пробує одну й дві колонки та бере ту, де шрифт більший (при рівності — одну колонку).
 * Якщо не влазить ніяк — одна колонка з прокруткою (читати зверху вниз зручніше).
 */
export function chooseLayout(fitsAt: (cols: 1 | 2, px: number) => boolean, max = 28, min = 14): Layout {
  const one = fitFontSize((px) => fitsAt(1, px), max, min);
  const two = fitFontSize((px) => fitsAt(2, px), max, min);
  if (one.overflow && two.overflow) return { cols: 1, px: min, overflow: true };
  if (!two.overflow && (one.overflow || two.px > one.px)) return { cols: 2, ...two };
  return { cols: 1, ...one };
}

/** Чи влазить текст: висота без відступів контейнера і найширший рядок не ширший за колонку. */
export function contentFits(m: { contentHeight: number; availableHeight: number; maxLineWidth: number; columnWidth: number }): boolean {
  return m.contentHeight <= m.availableHeight + 0.5 && m.maxLineWidth <= m.columnWidth + 0.5;
}
