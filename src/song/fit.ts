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

export type Cols = 1 | 2 | 3;
export type Layout = { cols: Cols; px: number; overflow: boolean };

/** Найменший шрифт, до якого стискаємо пісню, аби лише не вмикати прокрутку. */
export const HARD_MIN_PX = 12;

/**
 * 1. Пробує одну й дві колонки зі зручним шрифтом (від min) і бере ту, де шрифт більший
 *    (при рівності — одну колонку).
 * 2. Якщо так не влазить — щоб уникнути прокрутки, пробує три колонки, а також одну й дві
 *    з дрібнішим шрифтом (до hardMin); бере найбільший шрифт (при рівності — менше колонок).
 * 3. Якщо не влазить ніяк — одна колонка з прокруткою (читати зверху вниз зручніше).
 */
export function chooseLayout(
  fitsAt: (cols: Cols, px: number) => boolean,
  max = 28,
  min = 14,
  hardMin = HARD_MIN_PX,
): Layout {
  const one = fitFontSize((px) => fitsAt(1, px), max, min);
  const two = fitFontSize((px) => fitsAt(2, px), max, min);
  if (!two.overflow && (one.overflow || two.px > one.px)) return { cols: 2, ...two };
  if (!one.overflow) return { cols: 1, ...one };

  const low = Math.min(hardMin, min);
  const tight: Layout[] = [
    { cols: 1, ...fitFontSize((px) => fitsAt(1, px), min, low) },
    { cols: 2, ...fitFontSize((px) => fitsAt(2, px), min, low) },
    { cols: 3, ...fitFontSize((px) => fitsAt(3, px), max, low) },
  ];
  let best: Layout | null = null;
  for (const c of tight) if (!c.overflow && (!best || c.px > best.px)) best = c;
  return best ?? { cols: 1, px: min, overflow: true };
}

/** Чи влазить текст: висота без відступів контейнера і найширший рядок не ширший за колонку. */
export function contentFits(m: { contentHeight: number; availableHeight: number; maxLineWidth: number; columnWidth: number }): boolean {
  return m.contentHeight <= m.availableHeight + 0.5 && m.maxLineWidth <= m.columnWidth + 0.5;
}
