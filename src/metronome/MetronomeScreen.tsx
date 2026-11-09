import { useRef } from 'react';
import type { TimeSig } from '../db/db';
import { beatsPerBar, MAX_BPM, MIN_BPM, tapTempo } from './tempo';
import type { Metronome } from './useMetronome';
import './Metronome.css';

type Props = {
  metro: Metronome;
  songBpm?: number;
  songTitle?: string;
  songTimeSig?: TimeSig;
};

export function MetronomeScreen({ metro, songBpm, songTitle, songTimeSig }: Props) {
  const { bpm, setBpm, timeSig, setTimeSig, running, toggle, beat } = metro;
  const taps = useRef<number[]>([]);
  const n = beatsPerBar(timeSig);

  const onTap = () => {
    const now = performance.now();
    const last = taps.current[taps.current.length - 1];
    taps.current = last !== undefined && now - last > 2000 ? [now] : [...taps.current, now].slice(-5);
    const t = tapTempo(taps.current);
    if (t) setBpm(t);
  };

  return (
    <div className="metronome">
      <header className="topbar">
        <div className="topbar-title">Метроном</div>
        {songBpm ? (
          <button
            type="button"
            className="pill"
            onClick={() => {
              setBpm(songBpm);
              if (songTimeSig) setTimeSig(songTimeSig);
            }}
          >
            З пісні: <b>{`${songTitle ?? ''} · ${songBpm}`}</b>
          </button>
        ) : null}
      </header>
      <div className="metro-center">
        <div className="beats">
          {Array.from({ length: n }, (_, i) => (
            <i
              key={i}
              data-testid="beat-dot"
              className={`${i === 0 ? 'first' : ''}${running && beat === i ? ' on' : ''}`}
            />
          ))}
        </div>
        <div className="bpm">
          <span data-testid="bpm">{bpm}</span>
          <small>BPM</small>
        </div>
        <input
          className="bpm-slider"
          type="range"
          min={MIN_BPM}
          max={MAX_BPM}
          value={bpm}
          aria-label="Темп"
          onChange={(e) => setBpm(Number(e.target.value))}
        />
        <div className="row metro-row">
          <button type="button" className="btn" onClick={() => setBpm(bpm - 1)}>
            −1
          </button>
          <select className="btn" aria-label="Розмір" value={timeSig} onChange={(e) => setTimeSig(e.target.value as TimeSig)}>
            <option value="4/4">4/4</option>
            <option value="3/4">3/4</option>
            <option value="6/8">6/8</option>
          </select>
          <button type="button" className={`play${running ? ' stop' : ''}`} aria-label={running ? 'Стоп' : 'Старт'} onClick={toggle}>
            {running ? '■' : '▶'}
          </button>
          <button type="button" className="btn" onClick={onTap}>
            Tap
          </button>
          <button type="button" className="btn" onClick={() => setBpm(bpm + 1)}>
            +1
          </button>
        </div>
      </div>
    </div>
  );
}
