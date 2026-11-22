/**
 * Масовий імпорт власних пісень з файлів .cho / .chordpro / .txt у «Мої пісні».
 * Пісні зберігаються лише в локальній базі пристрою й нікуди не надсилаються.
 */
import { saveSong, type Song } from '../db/db';
import { songFromChordProFile } from './importText';
import { normalizeSearch } from './searchText';

export const IMPORT_EXTENSIONS = ['.cho', '.chordpro', '.chopro', '.crd', '.pro', '.txt'];
export const IMPORT_ACCEPT = [...IMPORT_EXTENSIONS, 'text/plain'].join(',');
const MAX_FILE_BYTES = 1024 * 1024;

/** Мінімум від File, потрібний імпорту (зручно підставляти в тестах). */
export type ImportFile = { name: string; size: number; arrayBuffer?: () => Promise<ArrayBuffer> };

/** Байти файлу: Blob.arrayBuffer(), а де його немає (старі WebView) — FileReader. */
function readBytes(f: ImportFile): Promise<ArrayBuffer> {
  if (typeof f.arrayBuffer === 'function') return f.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(f as unknown as Blob);
  });
}

export type ImportReport = {
  added: Song[];
  skipped: { name: string; reason: string }[];
};

/** Текст файлу: UTF-8 (з BOM чи без), а якщо байти не UTF-8 — Windows-1251 (старі кириличні .txt). */
export function decodeText(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1251').decode(bytes);
  }
}

const songKey = (s: Pick<Song, 'title' | 'body'>) => `${normalizeSearch(s.title)}\n${normalizeSearch(s.body)}`;

/** Імпортує файли по черзі; пропущені файли повертає з причиною. Однакові пісні двічі не додаються. */
export async function importSongFiles(files: ImportFile[], existing: Pick<Song, 'title' | 'body'>[]): Promise<ImportReport> {
  const report: ImportReport = { added: [], skipped: [] };
  const known = new Set(existing.map(songKey));
  for (const f of files) {
    const ext = /\.[^.]+$/.exec(f.name.toLowerCase())?.[0] ?? '';
    if (!IMPORT_EXTENSIONS.includes(ext)) {
      report.skipped.push({ name: f.name, reason: 'не текстовий файл пісні (.cho, .chordpro, .txt)' });
      continue;
    }
    if (f.size > MAX_FILE_BYTES) {
      report.skipped.push({ name: f.name, reason: 'файл завеликий для пісні (понад 1 МБ)' });
      continue;
    }
    let input;
    try {
      input = songFromChordProFile(decodeText(await readBytes(f)), f.name);
    } catch {
      report.skipped.push({ name: f.name, reason: 'не вдалося прочитати файл' });
      continue;
    }
    if (!input) {
      report.skipped.push({ name: f.name, reason: 'у файлі немає тексту пісні' });
      continue;
    }
    const key = songKey(input);
    if (known.has(key)) {
      report.skipped.push({ name: f.name, reason: 'така пісня вже є в «Моїх піснях»' });
      continue;
    }
    known.add(key);
    report.added.push(await saveSong(input));
  }
  return report;
}
