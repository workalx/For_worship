import { useEffect, useState } from 'react';
import { getProvider } from '../ai/getProvider';
import { AiError, type AiProvider, type SongCandidate } from '../ai/provider';

type Props = {
  query: string;
  provider?: AiProvider;
  onPick: (c: SongCandidate) => void;
  onManual: () => void;
  onSettings: () => void;
  /** Результати попередніх пошуків, щоб не витрачати ліміт повторно. */
  cache?: Map<string, SongCandidate[]>;
  /** Зміна значення повторює пошук (наприклад, після помилки). */
  nonce?: number;
};

type State = { status: 'loading' } | { status: 'done'; list: SongCandidate[] } | { status: 'error'; error: AiError };

function hostOf(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function OnlineSearch({ query, provider, onPick, onManual, onSettings, cache, nonce }: Props) {
  const [state, setState] = useState<State>(() => {
    const hit = cache?.get(query);
    return hit ? { status: 'done', list: hit } : { status: 'loading' };
  });

  useEffect(() => {
    let alive = true;
    const hit = cache?.get(query);
    if (hit) {
      setState({ status: 'done', list: hit });
      return;
    }
    setState({ status: 'loading' });
    (async () => {
      try {
        const p = provider ?? getProvider();
        const list = await p.searchSongs(query);
        cache?.set(query, list);
        if (alive) setState({ status: 'done', list });
      } catch (e) {
        if (alive) setState({ status: 'error', error: e instanceof AiError ? e : new AiError('unknown', String(e)) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [query, provider, nonce]);

  if (state.status === 'loading') {
    return (
      <div className="online-status">
        <div className="spinner" aria-hidden="true" />
        Шукаю…
      </div>
    );
  }

  if (state.status === 'error') {
    const keyProblem = state.error.kind === 'no-key' || state.error.kind === 'bad-key';
    return (
      <div className="online-status">
        <div className="error-text">{state.error.message}</div>
        {keyProblem ? (
          <button type="button" className="btn primary" onClick={onSettings}>
            Відкрити налаштування
          </button>
        ) : (
          <button type="button" className="btn" onClick={onManual}>
            Вставити текст вручну
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="panel-tag">Знайдено в інтернеті</div>
      {state.list.map((c, i) => (
        <div key={i} className="item">
          <span className="key-badge">{c.key ?? '—'}</span>
          <span className="grow">
            <div>{c.title}</div>
            <small>{[c.artist, hostOf(c.source), c.bpm ? `${c.bpm} BPM` : ''].filter(Boolean).join(' · ')}</small>
          </span>
          <button type="button" className="btn blue" onClick={() => onPick(c)}>
            + Додати
          </button>
        </div>
      ))}
    </>
  );
}
