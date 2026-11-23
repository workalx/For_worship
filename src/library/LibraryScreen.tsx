import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteSong, getSong, listServices, listSongs, saveService, saveSong, type Service, type Song } from '../db/db';
import { guessKey } from '../music/chordpro';
import { SongScreen } from '../song/SongScreen';
import { nextSunday } from '../service/swipe';
import { SongEditor } from './SongEditor';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { OnlineSearch } from './OnlineSearch';
import { PhotoImport } from './PhotoImport';
import { normalizeImportedText, songFromPastedText } from './importText';
import { openInBrowser } from './webSearch';
import { songSelectSearchUrl } from '../songselect/searchUrl';
import type { Shared } from './shareTarget';
import { loadSettings } from '../settings/settings';
import { SettingsScreen } from '../settings/SettingsScreen';
import { HymnCard, HymnResults, useLibraryIndex, type LibraryLoader } from './HymnLibrary';
import { libraryLoader, librarySongToInput } from './libraryData';
import type { LibraryIndexEntry, LibrarySong } from './catalogTypes';
import { IMPORT_ACCEPT, importSongFiles, type ImportReport } from './bulkImport';
import type { AiError, SongCandidate } from '../ai/provider';
import './Library.css';
import '../settings/Settings.css';
import { Icon } from '../components/Icon';
import { ArrowLeft, ClipboardPaste, ExternalLink, FolderInput, Play, Plus, Search, Settings, Trash2, X } from 'lucide-react';

type Mode =
  | { kind: 'list' }
  | { kind: 'view'; id: string }
  | { kind: 'edit'; song?: Partial<Song> }
  | { kind: 'settings' }
  | { kind: 'hymn'; entry: LibraryIndexEntry };

function candidateToSong(c: SongCandidate): Partial<Song> {
  return {
    title: c.title,
    artist: c.artist,
    body: normalizeImportedText(c.body),
    originalKey: c.key,
    bpm: c.bpm,
    ...(c.source && /^https?:\/\//i.test(c.source) ? { sourceUrl: c.source } : { source: c.source }),
  };
}

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Найближче майбутнє служіння, а якщо таких немає — останнє. */
function nearestService(services: Service[]): Service | undefined {
  const today = todayIso();
  const upcoming = services.filter((s) => s.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] ?? services[0];
}

type Props = {
  onPlay: (serviceId: string, index: number) => void;
  onSongShown?: (song: Song) => void;
  /** Текст або посилання, якими поділилися з програмою з браузера. */
  shared?: Shared | null;
  /** Вбудована бібліотека гімнів (для тестів можна підставити свою). */
  library?: LibraryLoader;
  /** Відкрити пісню за id (наприклад, щойно імпортовану зі SongSelect). */
  openSongId?: string;
  /** Змінюється за кожного нового запиту, щоб повторно відкрити ту саму пісню. */
  openSongNonce?: number;
  /** Запит на відкриття пісні виконано: батько має його скинути, щоб він не повторювався після перемонтування. */
  onOpenedSong?: () => void;
};

function hasGeminiKey(): boolean {
  return loadSettings().geminiKey.trim() !== '';
}

export function LibraryScreen({ onPlay, onSongShown, shared, library = libraryLoader, openSongId, openSongNonce, onOpenedSong }: Props) {
  const [mode, setMode] = useState<Mode>(() =>
    shared?.kind === 'text'
      ? { kind: 'edit', song: songFromPastedText(shared.text, shared.title, shared.source) }
      : { kind: 'list' },
  );
  const [query, setQuery] = useState(shared?.kind === 'url' ? shared.url : '');
  const [songs, setSongs] = useState<Song[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [service, setService] = useState<Service | undefined>();
  const [viewSong, setViewSong] = useState<Song | undefined>();
  const [toast, setToast] = useState<string | null>(
    shared?.kind === 'url' && !hasGeminiKey()
      ? 'Отримано лише посилання. Виділіть на сторінці текст пісні й поділіться ним'
      : null,
  );
  const [online, setOnline] = useState<{ query: string; nonce: number } | null>(() =>
    shared?.kind === 'url' && hasGeminiKey() ? { query: shared.url, nonce: 1 } : null,
  );
  const [browserHint, setBrowserHint] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null);
  const searchCache = useRef(new Map<string, SongCandidate[]>());
  const [aiError, setAiError] = useState<AiError | null>(null);
  const hymns = useLibraryIndex(library);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const addedFromLibrary = useMemo(
    () => new Map(allSongs.filter((s) => s.libraryId).map((s) => [s.libraryId!, s] as const)),
    [allSongs],
  );

  const reload = useCallback(async () => {
    const [found, all, services] = await Promise.all([listSongs(query), listSongs(), listServices()]);
    setSongs(found);
    setAllSongs(all);
    setService(nearestService(services));
  }, [query]);

  useEffect(() => {
    void reload();
  }, [reload, mode]);

  useEffect(() => {
    if (!openSongId) return;
    setMode({ kind: 'view', id: openSongId });
    onOpenedSong?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSongId, openSongNonce]);

  useEffect(() => {
    if (mode.kind !== 'view') return;
    let alive = true;
    void getSong(mode.id).then((s) => {
      if (!alive) return;
      setViewSong(s);
      if (s) onSongShown?.(s);
    });
    return () => {
      alive = false;
    };
  }, [mode, onSongShown]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const addToService = async (song: Song) => {
    const target = service ?? (await saveService({ title: 'Неділя', date: nextSunday(), items: [] }));
    const updated = { ...target, items: [...target.items, { songId: song.id }] };
    await saveService(updated);
    setService(updated);
    setToast(`Додано в «${updated.title}»`);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { id } = toDelete;
    await deleteSong(id);
    setToDelete(null);
    // Прибираємо рядок одразу, не чекаючи перечитування бази.
    setSongs((list) => list.filter((x) => x.id !== id));
    setAllSongs((list) => list.filter((x) => x.id !== id));
    if (mode.kind === 'list') await reload();
    else setMode({ kind: 'list' });
  };

  /** «Додати в мої пісні»: пісня з бібліотеки стає звичайною піснею користувача. */
  const addHymn = async (entry: LibraryIndexEntry, loaded?: LibrarySong, view?: { key?: string; capo?: number }) => {
    try {
      const song = loaded ?? (await library.loadSong(entry));
      const saved = await saveSong({ ...librarySongToInput(song), key: view?.key, capo: view?.capo || undefined });
      setAllSongs((list) => [...list, saved]);
      setToast(`«${saved.title}» додано в мої пісні`);
      await reload();
      return saved;
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Не вдалося додати пісню');
      return null;
    }
  };

  /** Масовий імпорт файлів .cho / .chordpro / .txt у «Мої пісні» (лише на цьому пристрої). */
  const importFiles = async (files: File[]) => {
    if (!files.length) return;
    setImporting(true);
    try {
      const report = await importSongFiles(files, allSongs);
      setImportReport(report);
      setToast(`Імпортовано пісень: ${report.added.length}${report.skipped.length ? `, пропущено: ${report.skipped.length}` : ''}`);
      await reload();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Не вдалося імпортувати файли');
    } finally {
      setImporting(false);
    }
  };

  const searchOnline = () => {
    const q = query.trim();
    if (!q) return;
    if (!hasGeminiKey()) {
      searchInBrowser(q);
      return;
    }
    setBrowserHint(false);
    setAiError(null);
    searchCache.current.delete(q);
    setOnline((prev) => ({ query: q, nonce: (prev?.nonce ?? 0) + 1 }));
  };

  const searchInBrowser = (q: string) => {
    setAiError(null);
    setOnline(null);
    openInBrowser(q, loadSettings().searchEngine);
    setBrowserHint(true);
  };

  const pasteFromClipboard = async () => {
    let text = '';
    try {
      text = (await navigator.clipboard.readText()) ?? '';
    } catch {
      /* доступ до буфера заборонено або не підтримується */
    }
    setBrowserHint(false);
    if (!text.trim()) {
      setToast('Не вдалося прочитати буфер. Вставте текст у поле «Текст пісні» вручну');
      setMode({ kind: 'edit', song: { title: query.trim() || undefined } });
      return;
    }
    setMode({ kind: 'edit', song: songFromPastedText(text, query.trim()) });
  };

  if (mode.kind === 'hymn') {
    return (
      <>
        <HymnCard
          entry={mode.entry}
          library={library}
          mine={addedFromLibrary.get(mode.entry.id)}
          onAdd={async (song, view) => {
            const saved = await addHymn(mode.entry, song, view);
            if (saved) setMode({ kind: 'view', id: saved.id });
          }}
          onOpenMine={(s) => setMode({ kind: 'view', id: s.id })}
          onClose={() => setMode({ kind: 'list' })}
        />
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  if (mode.kind === 'settings') {
    return <SettingsScreen onClose={() => setMode({ kind: 'list' })} />;
  }

  if (mode.kind === 'edit') {
    const editing = mode.song;
    return (
      <>
        <SongEditor
          initial={editing}
          onSave={(s) => setMode({ kind: 'view', id: s.id })}
          onCancel={() => setMode(editing?.id ? { kind: 'view', id: editing.id } : { kind: 'list' })}
          onDelete={
            editing?.id
              ? () => setToDelete({ id: editing.id!, title: editing.title ?? '' })
              : undefined
          }
        />
        {toast && <div className="toast">{toast}</div>}
        {toDelete && (
          <ConfirmDialog
            message={`Видалити пісню «${toDelete.title}»?`}
            onCancel={() => setToDelete(null)}
            onConfirm={() => void confirmDelete()}
          />
        )}
      </>
    );
  }

  if (mode.kind === 'view') {
    if (!viewSong || viewSong.id !== mode.id) return <div className="placeholder-screen">Завантаження…</div>;
    return (
      <>
        <SongScreen
          song={viewSong}
          onKeyChange={(key) => {
            void saveSong({ ...viewSong, key }).then(setViewSong);
          }}
          onCapoChange={(capo) => {
            void saveSong({ ...viewSong, capo }).then(setViewSong);
          }}
          onEdit={() => setMode({ kind: 'edit', song: viewSong })}
          actions={
            <>
              <button type="button" className="btn" onClick={() => void addToService(viewSong)}>
                Додати в служіння
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Видалити пісню"
                onClick={() => setToDelete({ id: viewSong.id, title: viewSong.title })}
              >
                <Icon as={Trash2} />
              </button>
              <button type="button" className="icon-btn" aria-label="До списку пісень" onClick={() => setMode({ kind: 'list' })}>
                <Icon as={X} />
              </button>
            </>
          }
        />
        {toast && <div className="toast">{toast}</div>}
        {toDelete && (
          <ConfirmDialog
            message={`Видалити пісню «${toDelete.title}»?`}
            onCancel={() => setToDelete(null)}
            onConfirm={() => void confirmDelete()}
          />
        )}
      </>
    );
  }

  return (
    <div className="library">
      <header className="topbar">
        <div className="topbar-title">Пісні</div>
        <div className="pill">
          Збережено <b>{allSongs.length}</b>
        </div>
        <button type="button" className="icon-btn" aria-label="Налаштування" onClick={() => setMode({ kind: 'settings' })}>
          <Icon as={Settings} />
        </button>
      </header>
      <div className="library-body">
        <div className="panel" style={{ flex: 1.3 }}>
          <div className="row">
            <label className="search-field">
              <Icon as={Search} />
              <input
              className="field"
              aria-label="Пошук пісні"
              placeholder="Назва, рядок тексту або автор…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <PhotoImport
              onResult={(c) => {
                setAiError(null);
                setMode({ kind: 'edit', song: candidateToSong(c) });
              }}
              onError={setAiError}
            />
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={() => setMode({ kind: 'edit' })}>
              <Icon as={Plus} />
              Нова пісня
            </button>
            <button type="button" className="btn" onClick={() => void pasteFromClipboard()}>
              <Icon as={ClipboardPaste} />
              Вставити з буфера
            </button>
            <button type="button" className="btn" disabled={importing} onClick={() => fileInput.current?.click()}>
              <Icon as={FolderInput} />
              {importing ? 'Імпортую…' : 'Імпорт файлів'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => window.open(songSelectSearchUrl(query), '_blank', 'noopener')}
            >
              <Icon as={ExternalLink} />
              Шукати на SongSelect
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={IMPORT_ACCEPT}
              hidden
              aria-label="Імпорт файлів пісень"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = '';
                void importFiles(files);
              }}
            />
          </div>
          {importReport && (
            <div className="online-status import-report">
              <div>
                Імпортовано пісень: <b>{importReport.added.length}</b>
                {importReport.skipped.length > 0 && <>, пропущено: <b>{importReport.skipped.length}</b></>}. Пісні
                зберігаються лише на цьому пристрої.
              </div>
              {importReport.skipped.length > 0 && (
                <ul>
                  {importReport.skipped.map((x, i) => (
                    <li key={i}>
                      {x.name} — {x.reason}
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="btn" onClick={() => setImportReport(null)}>
                Сховати
              </button>
            </div>
          )}
          {aiError && (
            <div className="online-status">
              <div className="error-text">{aiError.message}</div>
              {aiError.kind === 'no-key' || aiError.kind === 'bad-key' ? (
                <button type="button" className="btn primary" onClick={() => setMode({ kind: 'settings' })}>
                  Відкрити налаштування
                </button>
              ) : null}
            </div>
          )}
          <div className="panel-tag">Мої пісні</div>
          {songs.length === 0 && (
            <p style={{ color: 'var(--muted)' }}>
              {allSongs.length === 0 ? 'Ще немає пісень. Додайте першу: «Нова пісня».' : 'Нічого не знайдено.'}
            </p>
          )}
          {songs.map((s) => {
            const key = s.key || s.originalKey || guessKey(s.body);
            return (
              <div key={s.id} className="item">
                <button type="button" className="item-open" onClick={() => setMode({ kind: 'view', id: s.id })}>
                  <span className="key-badge">{key ?? '—'}</span>
                  <span className="grow">
                    <div>{s.title}</div>
                    <small>{[s.artist, s.bpm ? `${s.bpm} BPM` : ''].filter(Boolean).join(' · ')}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Видалити «${s.title}»`}
                  onClick={() => setToDelete({ id: s.id, title: s.title })}
                >
                  <Icon as={Trash2} />
                </button>
              </div>
            );
          })}
          <HymnResults
            query={query}
            entries={hymns.entries}
            error={hymns.error}
            search={hymns.search}
            added={addedFromLibrary}
            onOpen={(entry) => setMode({ kind: 'hymn', entry })}
            onAdd={(entry) => void addHymn(entry)}
            onOpenMine={(s) => setMode({ kind: 'view', id: s.id })}
          />
          <div className="row">
            <button type="button" className="btn blue" disabled={!query.trim()} onClick={searchOnline}>
              <Icon as={Search} />
              Шукати в інтернеті
            </button>
            <button type="button" className="btn" disabled={!query.trim()} onClick={() => searchInBrowser(query.trim())}>
              <Icon as={ExternalLink} />
              У браузері
            </button>
          </div>
          {browserHint && (
            <div className="online-status">
              <div>
                Пошук відкрито в браузері. Знайдіть пісню, виділіть і скопіюйте текст з акордами, поверніться сюди
                й натисніть «Вставити з буфера». Або виділіть текст і виберіть «Поділитися» → For Worship.
              </div>
            </div>
          )}
          {online !== null && (
            <>
              <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setOnline(null)}>
                <Icon as={ArrowLeft} />
                Сховати результати пошуку
              </button>
              <OnlineSearch
                query={online.query}
                nonce={online.nonce}
                cache={searchCache.current}
                onPick={(c) => {
                  setMode({ kind: 'edit', song: candidateToSong(c) });
                }}
                onManual={() => {
                  setOnline(null);
                  setMode({ kind: 'edit', song: { title: online.query } });
                }}
                onSettings={() => {
                  setOnline(null);
                  setMode({ kind: 'settings' });
                }}
              />
            </>
          )}
        </div>
        <div className="panel" style={{ flex: 1 }}>
          {service ? (
            <>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3>{service.title}</h3>
                <button
                  type="button"
                  className="btn primary"
                  disabled={service.items.length === 0}
                  onClick={() => onPlay(service.id, 0)}
                >
                  <Icon as={Play} />
                  Почати
                </button>
              </div>
              <small style={{ color: 'var(--muted)' }}>{service.date}</small>
              {service.items.map((it, i) => {
                const s = allSongs.find((x) => x.id === it.songId);
                return (
                  <button key={`${it.songId}-${i}`} type="button" className="item" onClick={() => onPlay(service.id, i)}>
                    <span className="num">{i + 1}</span>
                    <span className="grow">
                      <div>{s?.title ?? 'Пісню видалено'}</div>
                      <small>{[it.key || s?.key || s?.originalKey, s?.bpm ? `${s.bpm} BPM` : ''].filter(Boolean).join(' · ')}</small>
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Служінь ще немає. Відкрийте пісню й натисніть «Додати в служіння».</p>
          )}
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
      {toDelete && (
        <ConfirmDialog
          message={`Видалити пісню «${toDelete.title}»?`}
          onCancel={() => setToDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}
