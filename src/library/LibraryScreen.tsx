import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteSong, getSong, listServices, listSongs, saveService, saveSong, type Service, type Song } from '../db/db';
import { guessKey } from '../music/chordpro';
import { SongScreen } from '../song/SongScreen';
import { nextSunday } from '../service/swipe';
import { SongEditor } from './SongEditor';
import { OnlineSearch } from './OnlineSearch';
import { PhotoImport } from './PhotoImport';
import { normalizeImportedText, songFromPastedText } from './importText';
import { openInBrowser } from './webSearch';
import type { Shared } from './shareTarget';
import { loadSettings } from '../settings/settings';
import { SettingsScreen } from '../settings/SettingsScreen';
import type { AiError, SongCandidate } from '../ai/provider';
import './Library.css';
import '../settings/Settings.css';

type Mode =
  | { kind: 'list' }
  | { kind: 'view'; id: string }
  | { kind: 'edit'; song?: Partial<Song> }
  | { kind: 'settings' };

function candidateToSong(c: SongCandidate): Partial<Song> {
  return {
    title: c.title,
    artist: c.artist,
    body: normalizeImportedText(c.body),
    originalKey: c.key,
    bpm: c.bpm,
    source: c.source,
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
};

function hasGeminiKey(): boolean {
  return loadSettings().geminiKey.trim() !== '';
}

export function LibraryScreen({ onPlay, onSongShown, shared }: Props) {
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
  const searchCache = useRef(new Map<string, SongCandidate[]>());
  const [aiError, setAiError] = useState<AiError | null>(null);

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
              ? async () => {
                  if (!confirm(`Видалити пісню «${editing.title}»?`)) return;
                  await deleteSong(editing.id!);
                  setMode({ kind: 'list' });
                }
              : undefined
          }
        />
        {toast && <div className="toast">{toast}</div>}
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
          onEdit={() => setMode({ kind: 'edit', song: viewSong })}
          actions={
            <>
              <button type="button" className="btn" onClick={() => void addToService(viewSong)}>
                Додати в служіння
              </button>
              <button type="button" className="icon-btn" aria-label="До списку пісень" onClick={() => setMode({ kind: 'list' })}>
                ✕
              </button>
            </>
          }
        />
        {toast && <div className="toast">{toast}</div>}
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
          ⚙
        </button>
      </header>
      <div className="library-body">
        <div className="panel" style={{ flex: 1.3 }}>
          <div className="row">
            <input
              className="field"
              style={{ flex: 1 }}
              aria-label="Пошук пісні"
              placeholder="🔍 Знайти пісню…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className="btn blue"
              disabled={!query.trim()}
              onClick={() => {
                const q = query.trim();
                if (!hasGeminiKey()) {
                  searchInBrowser(q);
                  return;
                }
                setBrowserHint(false);
                setAiError(null);
                searchCache.current.delete(q);
                setOnline((prev) => ({ query: q, nonce: (prev?.nonce ?? 0) + 1 }));
              }}
            >
              🔍 В інтернеті
            </button>
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
              + Нова пісня
            </button>
            <button type="button" className="btn" onClick={() => void pasteFromClipboard()}>
              📋 Вставити з буфера
            </button>
            <button type="button" className="btn" disabled={!query.trim()} onClick={() => searchInBrowser(query.trim())}>
              🌐 У браузері
            </button>
          </div>
          {browserHint && (
            <div className="online-status">
              <div>
                Пошук відкрито в браузері. Знайдіть пісню, виділіть і скопіюйте текст з акордами, поверніться сюди
                й натисніть «📋 Вставити з буфера». Або виділіть текст і виберіть «Поділитися» → For Worship.
              </div>
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
          {online !== null && (
            <>
              <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setOnline(null)}>
                ← Сховати результати пошуку
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
          <div className="panel-tag">Мої пісні</div>
          {songs.length === 0 && (
            <p style={{ color: 'var(--muted)' }}>
              {allSongs.length === 0 ? 'Ще немає пісень. Додайте першу: «+ Нова пісня».' : 'Нічого не знайдено.'}
            </p>
          )}
          {songs.map((s) => {
            const key = s.key || s.originalKey || guessKey(s.body);
            return (
              <button key={s.id} type="button" className="item" onClick={() => setMode({ kind: 'view', id: s.id })}>
                <span className="key-badge">{key ?? '—'}</span>
                <span className="grow">
                  <div>{s.title}</div>
                  <small>{[s.artist, s.bpm ? `${s.bpm} BPM` : ''].filter(Boolean).join(' · ')}</small>
                </span>
              </button>
            );
          })}
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
                  ▶ Почати
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
    </div>
  );
}
