import type { Song } from '../db/db';
import { importSongSelect, type SongSelectImport } from './importSong';

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function isSongSelectImport(data: unknown): data is SongSelectImport {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    d.type === 'for-worship/songselect-import' &&
    d.version === 1 &&
    nonEmpty(d.html) &&
    typeof d.pageUrl === 'string' &&
    nonEmpty(d.ccliNumber)
  );
}

export type SongSelectResult =
  | { type: 'for-worship/songselect-result'; version: 1; ccliNumber: string; ok: true; title: string }
  | { type: 'for-worship/songselect-result'; version: 1; ccliNumber: string; ok: false; error: string };

export function isSongSelectResult(data: unknown): data is SongSelectResult {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    d.type === 'for-worship/songselect-result' &&
    d.version === 1 &&
    nonEmpty(d.ccliNumber) &&
    typeof d.ok === 'boolean'
  );
}

const postResult = (result: SongSelectResult) => window.postMessage(result, window.location.origin);

// Розширення повторно надсилає імпорт, доки не отримає результат. Дублікати за номером CCLI
// не запускають другий імпорт: під час виконання ігноруються, а після завершення (короткий час)
// лише повторно надсилають той самий результат.
const RESULT_CACHE_MS = 3000;

/** Слухає повідомлення від розширення (лише з того ж origin). Повертає функцію відписки. */
export function listenForSongSelect(onImported: (song: Song) => void, onError: (e: Error) => void): () => void {
  const seen = new Map<string, SongSelectResult | null>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const finish = (ccli: string, result: SongSelectResult) => {
    seen.set(ccli, result);
    postResult(result);
    const t = setTimeout(() => {
      timers.delete(t);
      seen.delete(ccli);
    }, RESULT_CACHE_MS);
    timers.add(t);
  };
  const handler = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const msg = event.data;
    if (!isSongSelectImport(msg)) return;
    const ccli = msg.ccliNumber;
    if (seen.has(ccli)) {
      const done = seen.get(ccli);
      if (done) postResult(done);
      return;
    }
    seen.set(ccli, null);
    importSongSelect(msg).then(
      (song) => {
        finish(ccli, { type: 'for-worship/songselect-result', version: 1, ccliNumber: ccli, ok: true, title: song.title });
        onImported(song);
      },
      (e) => {
        const err = e instanceof Error ? e : new Error(String(e));
        finish(ccli, { type: 'for-worship/songselect-result', version: 1, ccliNumber: ccli, ok: false, error: err.message });
        onError(err);
      },
    );
  };
  window.addEventListener('message', handler);
  return () => {
    window.removeEventListener('message', handler);
    timers.forEach(clearTimeout);
  };
}
