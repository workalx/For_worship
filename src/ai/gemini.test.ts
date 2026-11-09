import { checkKey, createGeminiProvider, extractJson } from './gemini';
import { AiError } from './provider';

function reply(text: string, status = 200) {
  return vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify(status === 200 ? { candidates: [{ content: { parts: [{ text }] } }] } : { error: { message: text, status: 'X' } }), { status }),
  );
}

const make = (fetchFn: ReturnType<typeof reply>) =>
  createGeminiProvider({ apiKey: 'secret-key', searchModel: 'search-m', photoModel: 'photo-m' }, fetchFn as unknown as typeof fetch);

test('пошук: правильна адреса, ключ у заголовку, не в URL; інструменти пошуку', async () => {
  const f = reply('[{"title":"A","body":"[G]x"}]');
  await make(f).searchSongs('Світло в темряві');
  const [url, init] = f.mock.calls[0];
  expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/search-m:generateContent');
  expect(url).not.toContain('secret-key');
  expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe('secret-key');
  const body = JSON.parse(init!.body as string);
  expect(body.tools).toEqual([{ google_search: {} }, { url_context: {} }]);
  expect(body.contents[0].parts[0].text).toContain('Світло в темряві');
});

test('посилання замість назви — читається сторінка моделлю для фото без пошуку Google', async () => {
  const f = reply('[{"title":"A","body":"[G]x"}]');
  const out = await make(f).searchSongs('https://example.com/song/1');
  const [url, init] = f.mock.calls[0];
  expect(url).toContain('/models/photo-m:generateContent');
  expect(JSON.parse(init!.body as string).tools).toEqual([{ url_context: {} }]);
  expect(out[0].source).toBe('https://example.com/song/1');
});

test('відповідь у ```json-обгортці дає кандидата', async () => {
  const out = await make(reply('Ось результат:\n```json\n[{"title":"A","body":"[G]x"}]\n```')).searchSongs('A');
  expect(out).toEqual([{ title: 'A', body: '[G]x' }]);
});

test('порожній масив або текст без JSON — «не знайдено»', async () => {
  await expect(make(reply('[]')).searchSongs('A')).rejects.toMatchObject({ kind: 'empty' });
  await expect(make(reply('На жаль, не знайшов.')).searchSongs('A')).rejects.toMatchObject({ kind: 'empty' });
});

test('кандидати без тексту пісні відкидаються', async () => {
  const out = await make(reply('[{"title":"A","body":""},{"title":"B","body":"[C]b"}]')).searchSongs('A');
  expect(out.map((c) => c.title)).toEqual(['B']);
});

test('429 — ліміт', async () => {
  const err = await make(reply('quota', 429)).searchSongs('A').catch((e) => e);
  expect(err).toBeInstanceOf(AiError);
  expect(err.kind).toBe('quota');
  expect(err.message).toContain('ліміт');
});

test('400 з поганим ключем — bad-key', async () => {
  const f = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'API key not valid', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }), { status: 400 }));
  await expect(make(f as never).searchSongs('A')).rejects.toMatchObject({ kind: 'bad-key' });
});

test('немає мережі — network', async () => {
  const f = vi.fn(async () => {
    throw new TypeError('Failed to fetch');
  });
  await expect(make(f as never).searchSongs('A')).rejects.toMatchObject({ kind: 'network' });
});

test('фото: inline_data з base64 і одна пісня', async () => {
  const f = reply('{"title":"Фото","body":"[Am]a"}');
  const out = await make(f).recognizePhoto(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
  const [url, init] = f.mock.calls[0];
  expect(url).toContain('/models/photo-m:generateContent');
  const part = JSON.parse(init!.body as string).contents[0].parts.find((p: { inline_data?: unknown }) => p.inline_data);
  expect(part.inline_data).toEqual({ mime_type: 'image/jpeg', data: 'AQID' });
  expect(out.title).toBe('Фото');
});

test('extractJson', () => {
  expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  expect(extractJson('text [1,2] tail')).toEqual([1, 2]);
  expect(extractJson('нічого')).toBeUndefined();
});

test('checkKey: 200 — ключ робочий, 400 — ні, ключ у заголовку', async () => {
  const ok = vi.fn(async (_u: string, _i?: RequestInit) => new Response('{"models":[]}', { status: 200 }));
  expect(await checkKey('k1', ok as unknown as typeof fetch)).toBe(true);
  expect(ok.mock.calls[0][0]).toBe('https://generativelanguage.googleapis.com/v1beta/models');
  expect((ok.mock.calls[0][1]!.headers as Record<string, string>)['x-goog-api-key']).toBe('k1');
  const bad = vi.fn(async () => new Response('{}', { status: 400 }));
  expect(await checkKey('k2', bad as unknown as typeof fetch)).toBe(false);
});

test('тональність від Gemini перевіряється: погана відкидається, акорд зводиться до тональності', async () => {
  const out = await make(reply('[{"title":"A","key":"Ми мінор","body":"[Em]a"},{"title":"B","key":"F#m7","body":"[F#m]b"},{"title":"C","key":"am","body":"[Am]c"}]')).searchSongs('x');
  expect(out.map((c) => c.key)).toEqual([undefined, 'F#m', undefined]);
});
