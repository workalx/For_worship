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

/** Коротка пісня — одна колонка, довша — дві. */
export function chooseColumns(lineCount: number): 1 | 2 {
  return lineCount <= 14 ? 1 : 2;
}
