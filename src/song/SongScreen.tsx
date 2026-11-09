import { useMemo, type ReactNode } from 'react';
import type { Song } from '../db/db';
import { ALL_KEYS, isMinorKey, keyPrefersFlats, semitonesBetween, shiftKey } from '../music/chords';
import { guessKey, parseChordPro, transposeDoc } from '../music/chordpro';
import { useWakeLock } from '../hooks/useWakeLock';
import { SongView } from './SongView';
import './SongScreen.css';

type Props = {
  song: Song;
  displayKey?: string;
  onKeyChange: (key: string) => void;
  subtitle?: string;
  footer?: ReactNode;
  onEdit?: () => void;
  actions?: ReactNode;
};

export function SongScreen({ song, displayKey, onKeyChange, subtitle, footer, onEdit, actions }: Props) {
  useWakeLock(true);
  const baseKey = song.originalKey || guessKey(song.body);
  const currentKey = displayKey || song.key || baseKey;
  const minor = currentKey ? isMinorKey(currentKey) : false;

  const doc = useMemo(() => {
    const parsed = parseChordPro(song.body);
    if (!baseKey || !currentKey) return parsed;
    const shift = semitonesBetween(baseKey, currentKey);
    return shift === 0 ? parsed : transposeDoc(parsed, shift, keyPrefersFlats(currentKey));
  }, [song.body, baseKey, currentKey]);

  return (
    <div className="song-screen">
      <header className="topbar">
        {onEdit && (
          <button type="button" className="icon-btn" aria-label="Редагувати" onClick={onEdit}>
            ✎
          </button>
        )}
        <div className="topbar-title">
          {song.title}
          {subtitle && <small>{subtitle}</small>}
        </div>
        {actions}
        {currentKey && (
          <div className="pill">
            Тон
            <select
              aria-label="Тональність"
              className="key-select"
              value={currentKey}
              onChange={(e) => onKeyChange(e.target.value)}
            >
              {ALL_KEYS.map((k) => {
                const v = k + (minor ? 'm' : '');
                return (
                  <option key={v} value={v}>
                    {v}
                  </option>
                );
              })}
              {!ALL_KEYS.some((k) => k + (minor ? 'm' : '') === currentKey) && (
                <option value={currentKey}>{currentKey}</option>
              )}
            </select>
            <button type="button" className="round" aria-label="Тон нижче" onClick={() => onKeyChange(shiftKey(currentKey, -1))}>
              −
            </button>
            <button type="button" className="round" aria-label="Тон вище" onClick={() => onKeyChange(shiftKey(currentKey, 1))}>
              +
            </button>
          </div>
        )}
        {song.bpm ? (
          <div className="pill">
            ♩ <b>{song.bpm}</b> BPM
          </div>
        ) : null}
        <div className="pill">
          Капо <b>{song.capo ?? 0}</b>
        </div>
      </header>
      <SongView doc={doc} />
      {footer}
    </div>
  );
}
