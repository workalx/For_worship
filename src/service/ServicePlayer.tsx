import { useEffect, useRef, useState } from 'react';
import { getSong, saveService, saveSong, db, type Service, type Song } from '../db/db';
import { SongScreen } from '../song/SongScreen';
import { detectSwipe } from './swipe';
import './Service.css';

type Props = {
  serviceId: string;
  index: number;
  onExit: () => void;
  onSongShown?: (song: Song) => void;
  onIndexChange?: (index: number) => void;
};

export function ServicePlayer({ serviceId, index: startIndex, onExit, onSongShown, onIndexChange }: Props) {
  const [service, setService] = useState<Service | null>(null);
  const [songs, setSongs] = useState<(Song | undefined)[]>([]);
  const [index, setIndex] = useState(startIndex);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await db.services.get(serviceId);
      if (!s || !alive) return;
      const list = await Promise.all(s.items.map((i) => getSong(i.songId)));
      if (!alive) return;
      setService(s);
      setSongs(list);
    })();
    return () => {
      alive = false;
    };
  }, [serviceId]);

  const song = songs[index];
  useEffect(() => {
    if (song) onSongShown?.(song);
  }, [song, onSongShown]);

  if (!service) return <div className="placeholder-screen">Завантаження…</div>;
  const total = service.items.length;
  if (total === 0) {
    return (
      <div className="placeholder-screen column">
        У цьому служінні ще немає пісень.
        <button type="button" className="btn" onClick={onExit}>
          ← До списку
        </button>
      </div>
    );
  }

  const go = (dir: 'next' | 'prev') => {
    const next = dir === 'next' ? Math.min(index + 1, total - 1) : Math.max(index - 1, 0);
    if (next === index) return;
    setIndex(next);
    onIndexChange?.(next);
  };

  const changeKey = (key: string) => {
    const items = service.items.map((it, i) => (i === index ? { ...it, key } : it));
    const updated = { ...service, items };
    setService(updated);
    void saveService(updated);
  };

  const changeCapo = (capo: number) => {
    if (!song) return;
    void saveSong({ ...song, capo }).then((saved) => {
      setSongs((list) => list.map((s) => (s?.id === saved.id ? saved : s)));
    });
  };

  const titleAt = (i: number) => songs[i]?.title ?? '—';

  const footer = (
    <div className="player-foot">
      <button type="button" className="link" disabled={index === 0} onClick={() => go('prev')}>
        {index > 0 ? `← Попередня: ${titleAt(index - 1)}` : ''}
      </button>
      <div className="dots" aria-hidden="true">
        {service.items.map((_, i) => (
          <i key={i} className={i === index ? 'on' : undefined} />
        ))}
      </div>
      <button type="button" className="link right" disabled={index === total - 1} onClick={() => go('next')}>
        {index < total - 1 ? `Наступна: ${titleAt(index + 1)} →` : ''}
      </button>
    </div>
  );

  return (
    <div
      className="swipe-area"
      data-testid="swipe-area"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const dir = detectSwipe(e.clientX - s.x, e.clientY - s.y);
        if (dir) go(dir);
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    >
      {song ? (
        <SongScreen
          key={song.id + index}
          song={song}
          displayKey={service.items[index].key}
          onKeyChange={changeKey}
          onCapoChange={changeCapo}
          subtitle={`${service.title} · пісня ${index + 1} з ${total}`}
          footer={footer}
          actions={
            <button type="button" className="icon-btn" aria-label="До списку служінь" onClick={onExit}>
              ✕
            </button>
          }
        />
      ) : (
        <div className="placeholder-screen column">
          Пісню {index + 1} видалено з бібліотеки.
          {footer}
        </div>
      )}
    </div>
  );
}
