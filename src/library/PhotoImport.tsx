import { useRef, useState } from 'react';
import { getProvider } from '../ai/getProvider';
import { AiError, type SongCandidate } from '../ai/provider';

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

type Props = { onResult: (c: SongCandidate) => void; onError: (e: AiError) => void };

export function PhotoImport({ onResult, onError }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (file: File) => {
    setBusy(true);
    try {
      const provider = getProvider();
      const c = await provider.recognizePhoto(await shrink(file));
      onResult({ ...c, source: c.source ?? 'фото' });
    } catch (e) {
      onError(e instanceof AiError ? e : new AiError('unknown', String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn blue" onClick={() => input.current?.click()}>
        📷 Фото
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
          Розпізнаю пісню з фото…
        </div>
      )}
    </>
  );
}
