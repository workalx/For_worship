import type { ChordsOrigin, TimeSig } from '../db/db';

/** Метадані пісні, які зберігаються в директивах файлу ChordPro. */
export type ChordProMeta = {
  title?: string;
  artist?: string;
  /** Тональність, у якій записані акорди тексту. */
  key?: string;
  bpm?: number;
  timeSig?: TimeSig;
  capo?: number;
  source?: string;
  sourceUrl?: string;
  license?: string;
  chordsOrigin?: ChordsOrigin;
};

const DIRECTIVE_RE = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i;
const TIME_SIGS: readonly TimeSig[] = ['4/4', '3/4', '6/8'];
const KEY_RE = /^[A-G][#b]?m?$/;

/** Розбирає `{meta: name value}` (ChordPro 6) на назву й значення. */
function splitMeta(value: string): [string, string] | null {
  const m = /^(\S+)\s+(.+)$/.exec(value.trim());
  return m ? [m[1].toLowerCase(), m[2].trim()] : null;
}

function applyMeta(meta: ChordProMeta, name: string, value: string): boolean {
  const v = value.trim();
  switch (name) {
    case 'title':
    case 't':
      if (v) meta.title = v;
      return true;
    case 'artist':
    case 'subtitle':
    case 'st':
      if (v) meta.artist ??= v;
      return true;
    case 'key':
      if (KEY_RE.test(v)) meta.key = v;
      return true;
    case 'tempo': {
      const n = Math.round(Number(v));
      if (Number.isFinite(n) && n > 0) meta.bpm = n;
      return true;
    }
    case 'time':
      if ((TIME_SIGS as readonly string[]).includes(v)) meta.timeSig = v as TimeSig;
      return true;
    case 'capo': {
      const n = Math.round(Number(v));
      if (Number.isFinite(n) && n >= 0 && n <= 11) meta.capo = n;
      return true;
    }
    case 'copyright':
    case 'license':
      if (v) meta.license = v;
      return true;
    case 'source':
      if (v) meta.source = v;
      return true;
    case 'sourceurl':
    case 'source_url':
    case 'url':
      if (/^https?:\/\/\S+$/i.test(v)) meta.sourceUrl = v;
      return true;
    case 'chords':
    case 'chords_origin':
      if (v === 'auto' || v === 'manual') meta.chordsOrigin = v;
      return true;
    default:
      return false;
  }
}

/**
 * Розбирає файл ChordPro: директиви з метаданими (`{title}`, `{artist}`, `{key}`, `{tempo}`, `{time}`,
 * `{capo}`, `{copyright}`, `{meta: …}`) переходять у `meta`, а решта (текст, акорди, мітки частин
 * на кшталт `{soc}` чи `{c: Приспів}`) лишається в `body`.
 */
export function parseChordProFile(text: string): { meta: ChordProMeta; body: string } {
  const meta: ChordProMeta = {};
  const body: string[] = [];
  for (const line of text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n')) {
    const d = DIRECTIVE_RE.exec(line);
    if (d) {
      const name = d[1].toLowerCase();
      const value = d[2] ?? '';
      if (name === 'meta') {
        const kv = splitMeta(value);
        if (kv && applyMeta(meta, kv[0], kv[1])) continue;
        if (kv) continue; // невідомий meta-рядок не показуємо в тексті пісні
      } else if (applyMeta(meta, name, value)) {
        continue;
      }
    }
    body.push(line);
  }
  return {
    meta,
    body: body.join('\n').replace(/^\s*\n/, '').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, ''),
  };
}

/** Пісня у файл ChordPro: спершу директиви з метаданими, далі текст з акордами. */
export function toChordProFile(song: ChordProMeta & { title: string; body: string }): string {
  const lines = [`{title: ${song.title}}`];
  if (song.artist) lines.push(`{artist: ${song.artist}}`);
  if (song.key) lines.push(`{key: ${song.key}}`);
  if (song.bpm) lines.push(`{tempo: ${song.bpm}}`);
  if (song.timeSig) lines.push(`{time: ${song.timeSig}}`);
  if (song.capo) lines.push(`{capo: ${song.capo}}`);
  if (song.source) lines.push(`{meta: source ${song.source}}`);
  if (song.sourceUrl) lines.push(`{meta: sourceurl ${song.sourceUrl}}`);
  if (song.license) lines.push(`{meta: license ${song.license}}`);
  if (song.chordsOrigin) lines.push(`{meta: chords ${song.chordsOrigin}}`);
  // Якщо в тексті вже є директиви з метаданими, не дублюємо їх.
  const { body } = parseChordProFile(song.body);
  return `${lines.join('\n')}\n\n${body}\n`;
}
