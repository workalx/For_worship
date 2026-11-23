import { useRef, useState } from 'react';
import { checkKey } from '../ai/gemini';
import { exportAll, importAll } from '../db/backup';
import { DEFAULT_PHOTO_MODEL, loadSettings, saveSettings } from './settings';
import { SEARCH_ENGINES, type SearchEngine } from '../library/webSearch';
import './Settings.css';
import { Icon } from '../components/Icon';
import { X } from 'lucide-react';

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const initial = loadSettings();
  const [key, setKey] = useState(initial.geminiKey);
  const [show, setShow] = useState(false);
  const [photoModel, setPhotoModel] = useState(initial.photoModel);
  const [searchEngine, setSearchEngine] = useState<SearchEngine>(initial.searchEngine);
  const [status, setStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const save = () => {
    saveSettings({
      provider: 'gemini',
      geminiKey: key.trim(),
      photoModel: photoModel.trim() || DEFAULT_PHOTO_MODEL,
      searchEngine,
    });
    setStatus('Збережено');
  };

  const check = async () => {
    setChecking(true);
    setStatus(null);
    const ok = await checkKey(key.trim());
    setChecking(false);
    setStatus(ok ? 'Ключ працює ✓' : 'Ключ не підходить або немає інтернету');
  };

  const download = async () => {
    const json = await exportAll();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `for-worship-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Копію збережено в «Завантаження»');
  };

  const restore = async (file: File) => {
    try {
      const r = await importAll(await file.text());
      setStatus(`Відновлено: пісень ${r.songs}, служінь ${r.services}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Не вдалося відновити копію');
    }
  };

  return (
    <div className="settings">
      <header className="topbar">
        <div className="topbar-title">Налаштування</div>
        <button type="button" className="icon-btn" aria-label="Закрити налаштування" onClick={onClose}>
          <Icon as={X} />
        </button>
      </header>
      <div className="settings-body">
        <section className="panel">
          <h3>Розпізнавання фото (Google Gemini)</h3>
          <p className="hint">
            Безкоштовний ключ: відкрийте <b>aistudio.google.com</b>, увійдіть з Google-акаунтом, натисніть
            «Get API key» → «Create API key», скопіюйте ключ і вставте сюди. Ключ зберігається лише на цьому планшеті.
          </p>
          <div className="row">
            <input
              className="field"
              style={{ flex: 1 }}
              aria-label="Ключ Gemini"
              type={show ? 'text' : 'password'}
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="AIza…"
            />
            <button type="button" className="btn" onClick={() => setShow((v) => !v)}>
              {show ? 'Сховати' : 'Показати'}
            </button>
          </div>
          <details>
            <summary className="hint">Модель (для досвідчених)</summary>
            <label className="field-row">
              <span>Модель для фото</span>
              <input className="field" value={photoModel} onChange={(e) => setPhotoModel(e.target.value)} />
            </label>
          </details>
          <div className="row">
            <button type="button" className="btn primary" onClick={save}>
              Зберегти
            </button>
            <button type="button" className="btn" disabled={!key.trim() || checking} onClick={() => void check()}>
              {checking ? 'Перевіряю…' : 'Перевірити ключ'}
            </button>
          </div>
        </section>
        <section className="panel">
          <h3>Пошук в інтернеті</h3>
          <p className="hint">
            Кнопка «Шукати в інтернеті» відкриває в браузері пошук «назва chords». Скопіюйте там текст пісні з акордами
            й натисніть у програмі «Вставити з буфера».
          </p>
          <label className="field-row">
            <span>Пошукова система</span>
            <select
              className="field"
              aria-label="Пошукова система"
              value={searchEngine}
              onChange={(e) => setSearchEngine(e.target.value as SearchEngine)}
            >
              {SEARCH_ENGINES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <button type="button" className="btn" onClick={save}>
              Зберегти вибір
            </button>
          </div>
        </section>
        <section className="panel">
          <h3>Резервна копія</h3>
          <p className="hint">Збережіть усі пісні й служіння в один файл, щоб не втратити їх.</p>
          <div className="row">
            <button type="button" className="btn" onClick={() => void download()}>
              Зберегти копію бази
            </button>
            <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
              Відновити з копії
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void restore(f);
                e.target.value = '';
              }}
            />
          </div>
        </section>
        {status && <div className="settings-status">{status}</div>}
      </div>
    </div>
  );
}
