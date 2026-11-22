import { useEffect, useMemo, useState } from 'react';
import type { Song } from '../db/db';
import { SongScreen } from '../song/SongScreen';
import type { LibraryIndexEntry, LibrarySong } from './catalogTypes';
import { createLibraryLoader } from './libraryData';
import { createLibrarySearch } from './librarySearch';

export type LibraryLoader = ReturnType<typeof createLibraryLoader>;

/** Стан індексу вбудованої бібліотеки: завантажується один раз при відкритті екрана «Пісні». */
export function useLibraryIndex(library: LibraryLoader) {
  const [entries, setEntries] = useState<LibraryIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    library
      .loadIndex()
      .then((i) => alive && setEntries(i.songs))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [library]);
  const search = useMemo(() => (entries ? createLibrarySearch(entries) : null), [entries]);
  return { entries, error, search };
}

const MAX_RESULTS = 20;

type ResultsProps = {
  query: string;
  entries: LibraryIndexEntry[] | null;
  error: string | null;
  search: ((q: string, limit?: number) => LibraryIndexEntry[]) | null;
  /** Пісні користувача, вже додані з бібліотеки, за id у бібліотеці. */
  added: Map<string, Song>;
  onOpen: (entry: LibraryIndexEntry) => void;
  onAdd: (entry: LibraryIndexEntry) => void;
  onOpenMine: (song: Song) => void;
};

/** Результати пошуку у вбудованій бібліотеці (під «Моїми піснями»). */
export function HymnResults({ query, entries, error, search, added, onOpen, onAdd, onOpenMine }: ResultsProps) {
  const q = query.trim();
  const results = useMemo(() => (search && q ? search(q, 200) : []), [search, q]);
  if (error) {
    return (
      <>
        <div className="panel-tag">Бібліотека гімнів</div>
        <p className="error-text">{error}</p>
      </>
    );
  }
  if (!entries) return null;
  if (!q) {
    return (
      <p className="hint library-hint">
        У вбудованій бібліотеці {entries.length} англійських гімнів (public domain). Введіть назву, рядок тексту або
        автора — пошук працює і без інтернету.
      </p>
    );
  }
  return (
    <>
      <div className="panel-tag">Бібліотека гімнів</div>
      {results.length === 0 && <p style={{ color: 'var(--muted)' }}>У бібліотеці нічого не знайдено.</p>}
      {results.slice(0, MAX_RESULTS).map((e) => {
        const mine = added.get(e.id);
        return (
          <div key={e.id} className="item">
            <button type="button" className="item-open" onClick={() => onOpen(e)}>
              <span className="key-badge">{e.key}</span>
              <span className="grow">
                <div>
                  {e.title}
                  {e.chordsOrigin === 'auto' && <span className="badge-auto">автоакорди</span>}
                </div>
                <small>{[e.author, e.firstLine].filter(Boolean).join(' · ')}</small>
              </span>
            </button>
            {mine ? (
              <button type="button" className="btn" onClick={() => onOpenMine(mine)}>
                ✓ У моїх піснях
              </button>
            ) : (
              <button type="button" className="btn blue" aria-label={`Додати «${e.title}» в мої пісні`} onClick={() => onAdd(e)}>
                + Додати
              </button>
            )}
          </div>
        );
      })}
      {results.length > MAX_RESULTS && (
        <p style={{ color: 'var(--muted)' }}>
          Показано {MAX_RESULTS} з {results.length}. Уточніть запит.
        </p>
      )}
    </>
  );
}

type CardProps = {
  entry: LibraryIndexEntry;
  library: LibraryLoader;
  mine?: Song;
  onAdd: (song: LibrarySong, view: { key?: string; capo?: number }) => void;
  onOpenMine: (song: Song) => void;
  onClose: () => void;
};

/** Картка пісні з бібліотеки: перегляд, транспонування й каподастр без збереження, «Додати в мої пісні». */
export function HymnCard({ entry, library, mine, onAdd, onOpenMine, onClose }: CardProps) {
  const [song, setSong] = useState<LibrarySong | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<string | undefined>();
  const [capo, setCapo] = useState(0);

  useEffect(() => {
    let alive = true;
    library
      .loadSong(entry)
      .then((s) => alive && setSong(s))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [library, entry]);

  const close = (
    <button type="button" className="icon-btn" aria-label="До списку пісень" onClick={onClose}>
      ✕
    </button>
  );
  if (error || !song) {
    return (
      <div className="placeholder-screen column">
        {error ? <span className="error-text">{error}</span> : 'Завантаження…'}
        <button type="button" className="btn" onClick={onClose}>
          ← До списку
        </button>
      </div>
    );
  }

  const asSong: Song = {
    id: song.id,
    title: song.title,
    artist: song.artist,
    body: song.body,
    originalKey: song.key,
    key,
    bpm: song.bpm,
    timeSig: song.timeSig,
    capo,
    chordsOrigin: song.chordsOrigin,
    createdAt: 0,
    updatedAt: 0,
  };
  return (
    <SongScreen
      song={asSong}
      onKeyChange={setKey}
      onCapoChange={setCapo}
      subtitle={[song.artist, `${song.source} · ${song.license}`].filter(Boolean).join(' · ')}
      actions={
        <>
          {mine ? (
            <button type="button" className="btn" onClick={() => onOpenMine(mine)}>
              ✓ У моїх піснях
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={() => onAdd(song, { key, capo })}>
              + Додати в мої пісні
            </button>
          )}
          {close}
        </>
      }
    />
  );
}
