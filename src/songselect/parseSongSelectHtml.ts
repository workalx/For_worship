import type { SongInput, TimeSig } from '../db/db';

const TIME_SIGS: TimeSig[] = ['4/4', '3/4', '6/8'];

const text = (el: Element | null | undefined) => (el?.textContent ?? '').trim();

function lineText(line: Element): string {
  let out = '';
  for (const node of Array.from(line.childNodes)) {
    if (node.nodeType === 3) {
      out += node.textContent ?? '';
    } else if (node.nodeType === 1) {
      const el = node as Element;
      if (el.classList.contains('chordWrapper')) {
        const code = el.querySelector('code.chord');
        const name = code?.getAttribute('data-chordname') || text(code);
        if (name) out += `[${name}]`;
        out += el.querySelector('.chordLyrics')?.textContent ?? '';
      } else if (el.classList.contains('cproDirectionWrapper')) {
        out += el.querySelector('.cproDirection')?.textContent ?? '';
      } else {
        out += el.textContent ?? '';
      }
    }
  }
  return out.trimEnd();
}

/** Перетворює HTML аркуша акордів SongSelect (поле payload з GetSongChordsHTML) на пісню з тілом у ChordPro. */
export function parseSongSelectHtml(html: string, pageUrl: string, ccliNumber: string): SongInput {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = text(doc.querySelector('.cproTitle'));
  if (!title) throw new Error('SongSelect: немає назви пісні');

  const blocks: string[] = [];
  for (const section of Array.from(doc.querySelectorAll('.cproSongBody .cproSongSection'))) {
    const lines: string[] = [];
    const label = text(section.querySelector('.cproComment'));
    if (label) lines.push(`{c: ${label}}`);
    for (const line of Array.from(section.querySelectorAll('.cproSongLine'))) lines.push(lineText(line));
    blocks.push(lines.join('\n'));
  }
  const hasText = blocks.some((b) => b.split('\n').some((l) => l.trim() !== '' && !l.startsWith('{c:')));
  if (!hasText) throw new Error('SongSelect: не знайдено тексту пісні');

  const song: SongInput = {
    title,
    body: blocks.join('\n\n'),
    source: 'SongSelect',
    sourceUrl: pageUrl,
    ccliNumber,
    chordsOrigin: 'manual',
  };

  const artist = text(doc.querySelector('.cproAuthors'))
    .split('|')
    .map((a) => a.trim())
    .filter(Boolean)
    .join(', ');
  if (artist) song.artist = artist;

  const key = doc.querySelector('code.cproSongKey')?.getAttribute('data-chordname')?.trim();
  if (key) song.originalKey = key;

  const tt = text(doc.querySelector('.cproTempoTimeWrapper'));
  const bpm = /Tempo\s*-\s*(\d+)/i.exec(tt);
  if (bpm) song.bpm = Number(bpm[1]);
  const sig = /Time\s*-\s*(\d+\/\d+)/i.exec(tt)?.[1] as TimeSig | undefined;
  if (sig && TIME_SIGS.includes(sig)) song.timeSig = sig;

  const license = Array.from(doc.querySelectorAll('.copyright-info ul.copyright li'))
    .map((li) => text(li))
    .filter(Boolean)
    .join(' | ');
  if (license) song.license = license;

  return song;
}
