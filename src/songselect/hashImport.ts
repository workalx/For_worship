import { isSongSelectImport } from './bridge';
import type { SongSelectImport } from './importSong';

/** Пісня зі SongSelect, яку букмарклет передав у хеші адреси: `#songselect=<z|r><base64url>`. */
const PREFIX = '#songselect=';

/** Забирає дані букмарклета з адреси (і прибирає їх з адресного рядка). */
export function takeSongSelectHash(): string | null {
  const { hash, pathname, search } = window.location;
  if (!hash.startsWith(PREFIX)) return null;
  window.history.replaceState(null, '', pathname + search);
  return hash.slice(PREFIX.length) || null;
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Response(bytes).body!.pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Розбирає дані букмарклета. Будь-які пошкоджені чи чужі дані → null. */
export async function decodeSongSelectHash(payload: string): Promise<SongSelectImport | null> {
  try {
    const mode = payload[0];
    if (mode !== 'z' && mode !== 'r') return null;
    let bytes = fromBase64Url(payload.slice(1));
    if (mode === 'z') bytes = await inflate(bytes);
    const data = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const msg = { ...data, type: 'for-worship/songselect-import', version: 1 };
    if (!isSongSelectImport(msg)) return null;
    if (!/^https:\/\/songselect\.ccli\.com\//.test(msg.pageUrl)) return null;
    return msg;
  } catch {
    return null;
  }
}
