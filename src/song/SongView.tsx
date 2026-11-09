import { useLayoutEffect, useRef, useState } from 'react';
import type { SongDoc, SongLine } from '../music/song';
import { chooseLayout, contentFits, type Layout } from './fit';
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
  const [layout, setLayout] = useState<Layout>({ cols: 1, px: 28, overflow: false });

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const cs = getComputedStyle(o);
      const availableHeight = o.clientHeight - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0');
      const apply = (cols: 1 | 2, px: number) => {
        i.style.columnCount = String(cols);
        i.style.fontSize = `${px}px`;
      };
      const result = chooseLayout((cols, px) => {
        apply(cols, px);
        const gap = cols > 1 ? parseFloat(getComputedStyle(i).columnGap || '0') || 0 : 0;
        const columnWidth = (i.clientWidth - gap * (cols - 1)) / cols;
        let maxLineWidth = 0;
        i.querySelectorAll<HTMLElement>('.song-line').forEach((l) => {
          maxLineWidth = Math.max(maxLineWidth, l.scrollWidth);
        });
        return contentFits({ contentHeight: i.scrollHeight, availableHeight, maxLineWidth, columnWidth });
      });
      apply(result.cols, result.px);
      setLayout((prev) =>
        prev.cols === result.cols && prev.px === result.px && prev.overflow === result.overflow ? prev : result,
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    return () => ro.disconnect();
  }, [doc]);

  return (
    <div
      ref={outer}
      className={`song-view${layout.overflow ? ' overflow' : ''}`}
      data-font-px={layout.px}
      data-cols={layout.cols}
      data-testid="song-view"
    >
      <div ref={inner} className="song-columns" style={{ columnCount: layout.cols, fontSize: `${layout.px}px` }}>
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
