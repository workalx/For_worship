import { AiError, type AiProvider, type SongCandidate } from './provider';
import { photoPrompt, searchPrompt, urlPrompt } from './prompts';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

export type GeminiConfig = { apiKey: string; searchModel: string; photoModel: string };

type Part = { text?: string; inline_data?: { mime_type: string; data: string } };

/** Дістає JSON з відповіді моделі: прибирає ```-обгортки й текст до/після. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const src = fenced ? fenced[1] : text;
  const starts = [src.indexOf('['), src.indexOf('{')].filter((i) => i >= 0);
  if (starts.length === 0) return undefined;
  const start = Math.min(...starts);
  const end = Math.max(src.lastIndexOf(']'), src.lastIndexOf('}'));
  if (end <= start) return undefined;
  try {
    return JSON.parse(src.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function toCandidate(x: unknown): SongCandidate | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  const body = typeof o.body === 'string' ? o.body.trim() : '';
  if (!title || !body) return null;
  const c: SongCandidate = { title, body };
  if (typeof o.artist === 'string' && o.artist.trim()) c.artist = o.artist.trim();
  if (typeof o.key === 'string' && o.key.trim()) c.key = o.key.trim();
  if (typeof o.bpm === 'number' && o.bpm > 0) c.bpm = Math.round(o.bpm);
  if (typeof o.source === 'string' && o.source.trim()) c.source = o.source.trim();
  return c;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
  const bytes = new Uint8Array(buffer);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

function isUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim());
}

export function createGeminiProvider(cfg: GeminiConfig, fetchFn: typeof fetch = fetch): AiProvider {
  async function generate(model: string, parts: Part[], tools?: object[]): Promise<string> {
    let res: Response;
    try {
      res = await fetchFn(`${API}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], ...(tools ? { tools } : {}) }),
      });
    } catch (e) {
      throw new AiError('network', String(e));
    }
    const raw = await res.text();
    if (!res.ok) {
      if (res.status === 429) throw new AiError('quota', raw);
      if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(raw) || res.status === 401 || res.status === 403)
        throw new AiError('bad-key', raw);
      throw new AiError('unknown', raw);
    }
    try {
      const data = JSON.parse(raw) as { candidates?: { content?: { parts?: Part[] } }[] };
      return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    } catch {
      throw new AiError('unknown', raw);
    }
  }

  return {
    async searchSongs(query) {
      const q = query.trim();
      const url = isUrl(q);
      const text = url
        ? await generate(cfg.photoModel, [{ text: urlPrompt(q) }], [{ url_context: {} }])
        : await generate(cfg.searchModel, [{ text: searchPrompt(q) }], [{ google_search: {} }, { url_context: {} }]);
      const json = extractJson(text);
      const list = (Array.isArray(json) ? json : json ? [json] : []).map(toCandidate).filter((c): c is SongCandidate => !!c);
      if (list.length === 0) throw new AiError('empty');
      if (url) for (const c of list) c.source ??= q;
      return list;
    },

    async recognizePhoto(image) {
      const data = await blobToBase64(image);
      const text = await generate(cfg.photoModel, [
        { inline_data: { mime_type: image.type || 'image/jpeg', data } },
        { text: photoPrompt() },
      ]);
      const json = extractJson(text);
      const c = toCandidate(Array.isArray(json) ? json[0] : json);
      if (!c) throw new AiError('empty');
      return c;
    },
  };
}
