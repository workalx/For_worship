import type { LucideIcon, LucideProps } from 'lucide-react';

/**
 * Єдиний стиль іконок у програмі: лінійні іконки Lucide з однаковою товщиною лінії.
 * Іконка декоративна — підпис дає кнопка (текст або aria-label).
 */
export function Icon({ as: Glyph, size = 18, ...rest }: { as: LucideIcon } & LucideProps) {
  return <Glyph size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" className="icon" {...rest} />;
}
