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
  | { type: 'for-worship/songselect-result'; version: 1; ok: true; title: string }
  | { type: 'for-worship/songselect-result'; version: 1; ok: false; error: string };

export function isSongSelectResult(data: unknown): data is SongSelectResult {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.type === 'for-worship/songselect-result' && d.version === 1 && typeof d.ok === 'boolean';
}

const postResult = (result: SongSelectResult) => window.postMessage(result, window.location.origin);

/** Слухає повідомлення від розширення (лише з того ж origin). Повертає функцію відписки. */
export function listenForSongSelect(onImported: (song: Song) => void, onError: (e: Error) => void): () => void {
  const handler = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (!isSongSelectImport(event.data)) return;
    importSongSelect(event.data).then(
      (song) => {
        postResult({ type: 'for-worship/songselect-result', version: 1, ok: true, title: song.title });
        onImported(song);
      },
      (e) => {
        const err = e instanceof Error ? e : new Error(String(e));
        postResult({ type: 'for-worship/songselect-result', version: 1, ok: false, error: err.message });
        onError(err);
      },
    );
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
