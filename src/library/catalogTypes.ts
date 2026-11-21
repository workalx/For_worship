import type { ChordsOrigin, TimeSig } from '../db/db';

/** Запис індексу вбудованої бібліотеки (public/library/index.json) — усе потрібне для пошуку. */
export type LibraryIndexEntry = {
  id: string;
  title: string;
  /** Перший рядок першого куплету без акордів. */
  firstLine: string;
  author?: string;
  key: string;
  tags: string[];
  chordsOrigin: ChordsOrigin;
  /**
   * Файл частини з повною піснею: public/library/songs-<chunk>.json. Назва містить хеш вмісту
   * («a-1f2e3d4c»), тож змінена частина — це новий файл і кеш ніколи не віддасть застарілу.
   */
  chunk: string;
  /** Унікальні слова тексту (без назви й першого рядка), нормалізовані — для пошуку за фрагментом. */
  words: string;
  /** Назва мелодії (якщо в гімну їх кілька). */
  tune?: string;
};

export type LibraryIndex = {
  version: 1;
  source: { name: string; repo: string; commit: string };
  songs: LibraryIndexEntry[];
};

/** Повна пісня з бібліотеки: текст у ChordPro і метадані. */
export type LibrarySong = {
  id: string;
  title: string;
  artist?: string;
  key: string;
  bpm?: number;
  timeSig?: TimeSig;
  body: string;
  source: string;
  sourceUrl: string;
  license: string;
  chordsOrigin: ChordsOrigin;
};

export type LibraryChunk = { version: 1; songs: Record<string, LibrarySong> };
