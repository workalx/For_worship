import { isWebUrl } from './webSearch';

/** Те, чим поділилися з програмою через меню «Поділитися» на Android. */
export type Shared =
  | { kind: 'text'; text: string; title?: string; source?: string }
  | { kind: 'url'; url: string; title?: string };

/** Розбирає параметри адреси, з якими Android відкриває програму (див. share_target у маніфесті). */
export function parseShared(search: string): Shared | null {
  const p = new URLSearchParams(search);
  const title = p.get('title')?.trim() || undefined;
  const url = p.get('url')?.trim() ?? '';
  let text = (p.get('text') ?? '').replace(/\r\n?/g, '\n').trim();

  // Chrome часто передає адресу сторінки останнім рядком тексту.
  let source = isWebUrl(url) ? url : undefined;
  const lines = text.split('\n');
  const last = lines[lines.length - 1]?.trim() ?? '';
  if (isWebUrl(last)) {
    source ??= last;
    text = lines.slice(0, -1).join('\n').trim();
  }

  if (text) return { kind: 'text', text, title, source };
  if (source) return { kind: 'url', url: source, title };
  return null;
}

/** Читає поширений вміст з адреси сторінки й прибирає його з адресного рядка. */
export function takeShared(): Shared | null {
  const shared = parseShared(window.location.search);
  if (shared) window.history.replaceState(null, '', window.location.pathname);
  return shared;
}
