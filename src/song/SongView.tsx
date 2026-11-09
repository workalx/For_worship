import { useLayoutEffect, useRef, useState } from 'react';
import type { SongDoc, SongLine } from '../music/song';
import { chooseColumns, fitFontSize } from './fit';
import './SongView.css';

type Segment = { chord?: string; text: string };

function toSegments(line: SongLine): Segment[] {
  const segs: Segment[] = [];
  const first = line.chords[0]?.pos ?? line.lyrics.length;
  if (first > 0 || line.chords.length === 0) segs.push({ text: line.lyrics.slice(0, first) });
  line.chords.forEach((c, i) => {
    const end = line.chords[i + 1]?.pos ?? line.lyrics.length;
    segs.push({ chord: c.chord, text: line.lyrics.slice(c.pos, Math.max(c.pos, end)) });
  });
  return segs;
}

function Line({ line }: { line: SongLine }) {
  const hasChords = line.chords.length > 0;
  if (!hasChords) return <div className="song-line lyrics-only">{line.lyrics || ' '}</div>;
  if (!line.lyrics) {
    return (
      <div className="song-line chords-only">
        {line.chords.map((c, i) => (
          <span key={i} className="ch">
            {c.chord}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="song-line">
      {toSegments(line).map((s, i) => (
        <span key={i} className="seg">
          <span className="ch">{s.chord ?? ' '}</span>
          <span className="ly">{s.text}</span>
        </span>
      ))}
    </div>
  );
}

export function SongView({ doc }: { doc: SongDoc }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ px: 28, overflow: false });
  const lineCount = doc.sections.reduce((n, s) => n + s.lines.length + (s.label ? 1 : 0), 0);
  const cols = chooseColumns(lineCount);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const result = fitFontSize((px) => {
        i.style.fontSize = `${px}px`;
        return i.scrollHeight <= o.clientHeight + 1 && i.scrollWidth <= i.clientWidth + 1;
      });
      i.style.fontSize = `${result.px}px`;
      setFit((prev) => (prev.px === result.px && prev.overflow === result.overflow ? prev : result));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    return () => ro.disconnect();
  }, [doc, cols]);

  return (
    <div
      ref={outer}
      className={`song-view${fit.overflow ? ' overflow' : ''}`}
      data-font-px={fit.px}
      data-testid="song-view"
    >
      <div ref={inner} className="song-columns" style={{ columnCount: cols, fontSize: `${fit.px}px` }}>
        {doc.sections.map((s, si) => (
          <section key={si} className="song-section">
            {s.label && <div className="song-label">{s.label}</div>}
            {s.lines.map((l, li) => (
              <Line key={li} line={l} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
