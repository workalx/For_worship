import { useEffect, useState } from 'react';
import { frequencyToNote, GUITAR_STRINGS, nearestString } from './notes';
import { useTuner } from './useTuner';
import { Icon } from '../components/Icon';
import { Mic } from 'lucide-react';
import './Tuner.css';

const IN_TUNE_CENTS = 5;

function centsWord(n: number): string {
  const a = Math.abs(n) % 100;
  const last = a % 10;
  if (a >= 11 && a <= 14) return 'центів';
  if (last === 1) return 'цент';
  if (last >= 2 && last <= 4) return 'центи';
  return 'центів';
}

export function TunerScreen() {
  const { start, freq, error, running } = useTuner();
  const [tuned, setTuned] = useState<Set<number>>(new Set());

  const note = freq ? frequencyToNote(freq) : null;
  const inTune = note ? Math.abs(note.cents) <= IN_TUNE_CENTS : false;
  const stringIdx = freq ? nearestString(freq) : -1;

  useEffect(() => {
    if (inTune && stringIdx >= 0 && note) {
      const s = GUITAR_STRINGS[stringIdx];
      if (s.name === note.name && s.octave === note.octave && !tuned.has(stringIdx)) {
        setTuned((prev) => new Set(prev).add(stringIdx));
      }
    }
  }, [inTune, stringIdx, note, tuned]);

  const cents = note ? Math.max(-50, Math.min(50, note.cents)) : 0;
  const sign = cents > 0 ? '+' : cents < 0 ? '−' : '';

  return (
    <div className="tuner">
      <header className="topbar">
        <div className="topbar-title">Тюнер</div>
        <div className="pill">
          Стрій <b>Standard</b>
        </div>
        <div className="pill">
          A = <b>440</b> Гц
        </div>
      </header>
      <div className="tuner-center">
        {error && <div className="error-text">{error}</div>}
        {!running ? (
          <button type="button" className="btn primary big-btn" onClick={() => void start()}>
            <Icon as={Mic} size={20} />
            Увімкнути мікрофон
          </button>
        ) : (
          <>
            <div data-testid="note" className={`tuner-note${inTune ? ' in-tune' : ''}${note ? '' : ' idle'}`}>
              {note ? (
                <>
                  {note.name}
                  <sub>{note.octave}</sub>
                </>
              ) : (
                '—'
              )}
            </div>
            <div className="tuner-info">
              {note && freq ? `${freq.toFixed(1)} Гц · ${sign}${Math.abs(cents)} ${centsWord(cents)}` : 'Зіграйте струну'}
            </div>
            <div className="gauge" aria-hidden="true">
              <div className="scale" />
              {[0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100].map((p) => (
                <div key={p} className={`tick${p === 50 ? ' mid' : ''}`} style={{ left: `${p}%` }} />
              ))}
              {note && (
                <div className={`needle${inTune ? ' in-tune' : ''}`} style={{ left: `${50 + cents}%` }} />
              )}
              <div className="lbl" style={{ left: '0%' }}>
                −50
              </div>
              <div className="lbl" style={{ left: '50%' }}>
                0
              </div>
              <div className="lbl" style={{ left: '100%' }}>
                +50
              </div>
            </div>
          </>
        )}
        <div className="strings">
          {GUITAR_STRINGS.map((s, i) => (
            <div
              key={i}
              aria-label={`Струна ${6 - i}: ${s.name}`}
              className={`string${i === stringIdx ? ' on' : ''}${tuned.has(i) ? ' done' : ''}`}
            >
              {s.name}
              <small>{6 - i}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
