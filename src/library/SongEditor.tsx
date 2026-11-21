import { useMemo, useRef, useState } from 'react';
import { saveSong, type Song, type TimeSig } from '../db/db';
import { ALL_KEYS } from '../music/chords';
import { parseChordPro } from '../music/chordpro';
import { SongView } from '../song/SongView';
import { guessKey, normalizeImportedText } from './importText';
import './Library.css';

type Props = {
  initial?: Partial<Song>;
  onSave: (song: Song) => void;
  onCancel: () => void;
  onDelete?: () => void;
};

const KEY_OPTIONS = [...ALL_KEYS, ...ALL_KEYS.map((k) => `${k}m`)];

export function SongEditor({ initial, onSave, onCancel, onDelete }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [artist, setArtist] = useState(initial?.artist ?? '');
  const [originalKey, setOriginalKey] = useState(initial?.originalKey ?? '');
  const [bpm, setBpm] = useState(initial?.bpm ? String(initial.bpm) : '');
  const [timeSig, setTimeSig] = useState<TimeSig>(initial?.timeSig ?? '4/4');
  const [capo, setCapo] = useState(initial?.capo ? String(initial.capo) : '0');
  const [body, setBody] = useState(initial?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const doc = useMemo(() => parseChordPro(normalizeImportedText(body)), [body]);

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + normalizeImportedText(pasted) + body.slice(end));
  };

  const save = async () => {
    if (!title.trim()) {
      setError('Вкажіть назву пісні');
      return;
    }
    const finalBody = normalizeImportedText(body);
    const bpmNum = Number(bpm);
    const capoNum = Number(capo);
    const song = await saveSong({
      ...(initial?.id ? { id: initial.id } : {}),
      ...(initial?.createdAt ? { createdAt: initial.createdAt } : {}),
      title: title.trim(),
      artist: artist.trim() || undefined,
      body: finalBody,
      originalKey: originalKey || guessKey(finalBody),
      key: initial?.key,
      bpm: bpmNum > 0 ? Math.round(bpmNum) : undefined,
      timeSig,
      capo: capoNum > 0 ? Math.round(capoNum) : undefined,
      source: initial?.source,
      sourceUrl: initial?.sourceUrl,
      license: initial?.license,
      chordsOrigin: initial?.chordsOrigin,
    });
    onSave(song);
  };

  return (
    <div className="editor">
      <header className="topbar">
        <div className="topbar-title">{initial?.id ? 'Редагування пісні' : 'Нова пісня'}</div>
        {onDelete && (
          <button type="button" className="btn" onClick={onDelete}>
            Видалити
          </button>
        )}
        <button type="button" className="btn" onClick={onCancel}>
          Скасувати
        </button>
        <button type="button" className="btn primary" onClick={() => void save()}>
          Зберегти
        </button>
      </header>
      <div className="editor-body">
        <div className="editor-form">
          {error && <div className="error-text">{error}</div>}
          <label className="field-row">
            <span>Назва</span>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field-row">
            <span>Виконавець</span>
            <input className="field" value={artist} onChange={(e) => setArtist(e.target.value)} />
          </label>
          <div className="row">
            <label className="field-row small">
              <span>Тональність</span>
              <select className="field" value={originalKey} onChange={(e) => setOriginalKey(e.target.value)}>
                <option value="">авто</option>
                {KEY_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-row small">
              <span>BPM</span>
              <input className="field" type="number" min={30} max={250} value={bpm} onChange={(e) => setBpm(e.target.value)} />
            </label>
            <label className="field-row small">
              <span>Розмір</span>
              <select className="field" value={timeSig} onChange={(e) => setTimeSig(e.target.value as TimeSig)}>
                <option value="4/4">4/4</option>
                <option value="3/4">3/4</option>
                <option value="6/8">6/8</option>
              </select>
            </label>
            <label className="field-row small">
              <span>Капо</span>
              <input className="field" type="number" min={0} max={12} value={capo} onChange={(e) => setCapo(e.target.value)} />
            </label>
          </div>
          <label className="field-row grow">
            <span>Текст пісні</span>
            <textarea
              ref={area}
              className="field mono"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onPaste={onPaste}
              spellCheck={false}
              placeholder={'Вставте пісню з сайту з акордами\nабо пишіть так: [G]Ти світло в [D]темряві'}
            />
          </label>
        </div>
        <div className="editor-preview">
          <SongView doc={doc} />
        </div>
      </div>
    </div>
  );
}
