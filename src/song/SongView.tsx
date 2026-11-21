import { useLayoutEffect, useRef, useState } from 'react';
import type { SongDoc, SongLine } from '../music/song';
import { chooseLayout, contentFits, type Cols, type Layout } from './fit';
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
          <span className={s.chord ? 'ch' : 'ch none'}>{s.chord ?? ' '}</span>
          <span className="ly">{s.text}</span>
        </span>
      ))}
    </div>
  );
}

export function SongView({ doc }: { doc: SongDoc }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  // split: частину пісні (куплет) дозволено розірвати між колонками, якщо цілими частинами не влазить.
  const [layout, setLayout] = useState<Layout & { split: boolean }>({ cols: 1, px: 28, overflow: false, split: false });

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const cs = getComputedStyle(o);
      const availableHeight = o.clientHeight - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0');
      const apply = (cols: Cols, px: number, split: boolean) => {
        i.style.columnCount = String(cols);
        i.style.fontSize = `${px}px`;
        i.classList.toggle('split', split);
      };
      const fitsWith = (cols: Cols, px: number, split: boolean) => {
        apply(cols, px, split);
        const gap = cols > 1 ? parseFloat(getComputedStyle(i).columnGap || '0') || 0 : 0;
        const columnWidth = (i.clientWidth - gap * (cols - 1)) / cols;
        let maxLineWidth = 0;
        i.querySelectorAll<HTMLElement>('.song-line').forEach((l) => {
          maxLineWidth = Math.max(maxLineWidth, l.scrollWidth);
        });
        return contentFits({ contentHeight: i.scrollHeight, availableHeight, maxLineWidth, columnWidth });
      };
      // В одній колонці розривати нічого; у кількох спершу пробуємо цілими частинами.
      const fitsAt = (cols: Cols, px: number) => fitsWith(cols, px, false) || (cols > 1 && fitsWith(cols, px, true));
      const result = chooseLayout(fitsAt);
      const split = !result.overflow && result.cols > 1 && !fitsWith(result.cols, result.px, false);
      apply(result.cols, result.px, split);
      setLayout((prev) =>
        prev.cols === result.cols && prev.px === result.px && prev.overflow === result.overflow && prev.split === split
          ? prev
          : { ...result, split },
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
      <div
        ref={inner}
        className={`song-columns${layout.split ? ' split' : ''}`}
        style={{ columnCount: layout.cols, fontSize: `${layout.px}px` }}
      >
        {doc.sections.map((s, si) => (
          <section key={si} className="song-section">
            {/* Назва частини не відривається від свого першого рядка. */}
            <div className="song-head">
              {s.label && <div className="song-label">{s.label}</div>}
              {s.lines[0] && <Line line={s.lines[0]} />}
            </div>
            {s.lines.slice(1).map((l, li) => (
              <Line key={li} line={l} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
