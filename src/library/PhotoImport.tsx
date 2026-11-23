import { useRef, useState } from 'react';
import { getProvider } from '../ai/getProvider';
import { AiError, type SongCandidate } from '../ai/provider';
import { Icon } from '../components/Icon';
import { Camera } from 'lucide-react';

const MAX_SIDE = 1600;

/** Зменшує фото до 1600px по довшій стороні (JPEG 0.85). Якщо не вдалося — повертає оригінал. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

type Props = {
  onResult: (c: SongCandidate, via: 'gemini' | 'tesseract') => void;
  onError: (e: AiError) => void;
};

const FALLBACK_KINDS: AiError['kind'][] = ['no-key', 'network', 'quota'];

function canFallBack(e: unknown): boolean {
  return e instanceof AiError && FALLBACK_KINDS.includes(e.kind);
}

export function PhotoImport({ onResult, onError }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const handle = async (file: File) => {
    setBusy(true);
    setOfflineMode(false);
    setProgress(null);
    try {
      const image = await shrink(file);
      let candidate: SongCandidate | null = null;
      if (navigator.onLine !== false) {
        try {
          candidate = await getProvider().recognizePhoto(image);
        } catch (e) {
          if (!canFallBack(e)) throw e;
        }
      }
      if (candidate) {
        onResult({ ...candidate, source: candidate.source ?? 'фото' }, 'gemini');
        return;
      }
      setOfflineMode(true);
      let c: SongCandidate;
      try {
        const { recognizeWithTesseract } = await import('../ocr/tesseract');
        c = await recognizeWithTesseract(image, (p) => setProgress(p));
      } catch (e) {
        throw e instanceof AiError ? e : new AiError('unknown', String(e));
      }
      onResult({ ...c, source: c.source ?? 'фото' }, 'tesseract');
    } catch (e) {
      onError(e instanceof AiError ? e : new AiError('unknown', String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn blue" onClick={() => input.current?.click()}>
        <Icon as={Camera} />
        Фото
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handle(f);
        }}
      />
      {busy && (
        <div className="busy-overlay">
          <div className="spinner" aria-hidden="true" />
          {offlineMode
            ? `Розпізнаю пісню з фото (без Gemini)…${progress != null ? ` ${Math.round(progress * 100)}%` : ''}`
            : 'Розпізнаю пісню з фото…'}
        </div>
      )}
    </>
  );
}
