export const SWIPE_MIN_PX = 80;

/** Горизонтальний свайп: |dx| ≥ 80 і рух переважно горизонтальний (|dx| > 2·|dy|). */
export function detectSwipe(dx: number, dy: number): 'next' | 'prev' | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= 2 * Math.abs(dy)) return null;
  return dx < 0 ? 'next' : 'prev';
}

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Найближча неділя у форматі YYYY-MM-DD (сьогодні, якщо сьогодні неділя). */
export function nextSunday(today: Date = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return iso(d);
}
