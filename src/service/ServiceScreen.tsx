import { useCallback, useEffect, useState } from 'react';
import { deleteService, listServices, listSongs, saveService, type Service, type Song } from '../db/db';
import { ALL_KEYS, isMinorKey } from '../music/chords';
import { guessKey } from '../music/chordpro';
import { nextSunday } from './swipe';
import './Service.css';

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function ServiceScreen({ onPlay }: { onPlay: (serviceId: string, index: number) => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('Неділя');
  const [newDate, setNewDate] = useState(nextSunday());
  const [pick, setPick] = useState('');

  const reload = useCallback(async () => {
    const [sv, sg] = await Promise.all([listServices(), listSongs()]);
    setServices(sv);
    setSongs(sg);
    setSelectedId((cur) => cur ?? sv[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = services.find((s) => s.id === selectedId) ?? null;
  const songById = (id: string) => songs.find((s) => s.id === id);

  const update = async (s: Service) => {
    setServices((list) => list.map((x) => (x.id === s.id ? s : x)));
    await saveService(s);
  };

  const create = async () => {
    const s = await saveService({ title: newTitle.trim() || 'Служіння', date: newDate, items: [] });
    setCreating(false);
    setSelectedId(s.id);
    await reload();
  };

  const move = (i: number, dir: -1 | 1) => {
    if (!selected) return;
    const j = i + dir;
    if (j < 0 || j >= selected.items.length) return;
    const items = [...selected.items];
    [items[i], items[j]] = [items[j], items[i]];
    void update({ ...selected, items });
  };

  return (
    <div className="services">
      <div className="panel" style={{ flex: 1 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>Служіння</h3>
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            + Нове служіння
          </button>
        </div>
        {creating && (
          <div className="item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <label className="row">
              <span style={{ width: 70 }}>Назва</span>
              <input
                className="field grow"
                aria-label="Назва служіння"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </label>
            <label className="row">
              <span style={{ width: 70 }}>Дата</span>
              <input className="field" type="date" aria-label="Дата служіння" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </label>
            <div className="row">
              <button type="button" className="btn primary" onClick={() => void create()}>
                Створити
              </button>
              <button type="button" className="btn" onClick={() => setCreating(false)}>
                Скасувати
              </button>
            </div>
          </div>
        )}
        {services.length === 0 && !creating && <p style={{ color: 'var(--muted)' }}>Ще немає жодного служіння.</p>}
        {services.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`item${s.id === selectedId ? ' selected' : ''}`}
            onClick={() => setSelectedId(s.id)}
          >
            <div className="grow">
              <div>{s.title}</div>
              <small>
                {formatDate(s.date)} · пісень: {s.items.length}
              </small>
            </div>
          </button>
        ))}
      </div>

      <div className="panel" style={{ flex: 1.3 }}>
        {!selected ? (
          <p style={{ color: 'var(--muted)' }}>Створіть служіння, щоб скласти список пісень.</p>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h3>{selected.title}</h3>
                <small style={{ color: 'var(--muted)' }}>{formatDate(selected.date)}</small>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    if (!confirm(`Видалити служіння «${selected.title}»?`)) return;
                    await deleteService(selected.id);
                    setSelectedId(null);
                    await reload();
                  }}
                >
                  Видалити
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={selected.items.length === 0}
                  onClick={() => onPlay(selected.id, 0)}
                >
                  ▶ Почати
                </button>
              </div>
            </div>

            {selected.items.map((it, i) => {
              const song = songById(it.songId);
              const base = song?.originalKey || (song ? guessKey(song.body) : undefined);
              const key = it.key || song?.key || base || '';
              const minor = key ? isMinorKey(key) : false;
              return (
                <div key={`${it.songId}-${i}`} className="item">
                  <span className="num">{i + 1}</span>
                  <button type="button" className="grow" style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0 }} onClick={() => onPlay(selected.id, i)}>
                    <div>{song?.title ?? 'Пісню видалено'}</div>
                    <small>
                      {song?.bpm ? `${song.bpm} BPM` : ''}
                      {base && key !== base ? ` · оригінал ${base}` : ''}
                    </small>
                  </button>
                  {key && (
                    <select
                      className="field"
                      aria-label={`Тональність пісні ${i + 1}`}
                      value={key}
                      onChange={(e) => {
                        const items = selected.items.map((x, j) => (j === i ? { ...x, key: e.target.value } : x));
                        void update({ ...selected, items });
                      }}
                    >
                      {ALL_KEYS.map((k) => k + (minor ? 'm' : '')).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                      {!ALL_KEYS.some((k) => k + (minor ? 'm' : '') === key) && <option value={key}>{key}</option>}
                    </select>
                  )}
                  <button type="button" className="mini" aria-label="Вище" disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button type="button" className="mini" aria-label="Нижче" disabled={i === selected.items.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className="mini"
                    aria-label="Прибрати"
                    onClick={() => void update({ ...selected, items: selected.items.filter((_, j) => j !== i) })}
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            <div className="row" style={{ marginTop: 6 }}>
              <select className="field grow" aria-label="Пісня для додавання" value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1 }}>
                <option value="">— виберіть пісню —</option>
                {songs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn"
                disabled={!pick}
                onClick={() => {
                  void update({ ...selected, items: [...selected.items, { songId: pick }] });
                }}
              >
                Додати
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
