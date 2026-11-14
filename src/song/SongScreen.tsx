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
  /** Якщо задано, поруч з «Капо» з'являються кнопки − / +. */
  onCapoChange?: (capo: number) => void;
  subtitle?: string;
  footer?: ReactNode;
  onEdit?: () => void;
  actions?: ReactNode;
};

export const MAX_CAPO = 11;

export function SongScreen({ song, displayKey, onKeyChange, onCapoChange, subtitle, footer, onEdit, actions }: Props) {
  useWakeLock(true);
  const baseKey = song.originalKey || guessKey(song.body);
  const currentKey = displayKey || song.key || baseKey;
  const minor = currentKey ? isMinorKey(currentKey) : false;
  const capo = Math.min(Math.max(Math.round(song.capo ?? 0), 0), MAX_CAPO);
  // З каподастром на ладу N граємо акорди на N півтонів нижче: звучить та сама тональність.
  const shapeKey = currentKey && capo > 0 ? shiftKey(currentKey, -capo) : currentKey;

  const doc = useMemo(() => {
    const parsed = parseChordPro(song.body);
    if (!baseKey || !currentKey || !shapeKey) return parsed;
    const shift = semitonesBetween(baseKey, currentKey) - capo;
    return shift === 0 ? parsed : transposeDoc(parsed, shift, keyPrefersFlats(shapeKey));
  }, [song.body, baseKey, currentKey, shapeKey, capo]);

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
          Капо
          {onCapoChange && (
            <button
              type="button"
              className="round"
              aria-label="Капо нижче"
              disabled={capo <= 0}
              onClick={() => onCapoChange(capo - 1)}
            >
              −
            </button>
          )}
          <b>{capo}</b>
          {onCapoChange && (
            <button
              type="button"
              className="round"
              aria-label="Капо вище"
              disabled={capo >= MAX_CAPO}
              onClick={() => onCapoChange(capo + 1)}
            >
              +
            </button>
          )}
          {capo > 0 && shapeKey && <span className="capo-shape">акорди як у {shapeKey}</span>}
        </div>
      </header>
      <SongView doc={doc} />
      {footer}
    </div>
  );
}
