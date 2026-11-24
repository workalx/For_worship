export type SongCandidate = {
  title: string;
  artist?: string;
  key?: string;
  bpm?: number;
  /** Текст у форматі ChordPro. */
  body: string;
  source?: string;
};

export interface AiProvider {
  recognizePhoto(image: Blob): Promise<SongCandidate>;
}

export type AiErrorKind = 'no-key' | 'quota' | 'network' | 'empty' | 'ocr' | 'bad-key' | 'unknown';

const MESSAGES: Record<AiErrorKind, string> = {
  'no-key': 'Додайте ключ Gemini в налаштуваннях',
  quota: 'Безкоштовний ліміт Gemini на сьогодні вичерпано. Спробуйте пізніше або вставте текст пісні вручну',
  network: 'Немає інтернету. Збережені пісні працюють, а для розпізнавання фото потрібна мережа',
  empty: 'Не вдалося розпізнати пісню на фото. Спробуйте чіткіше фото або вставте текст пісні вручну',
  ocr: 'Не вдалося розпізнати фото на пристрої. Спробуйте чіткіше фото або вставте текст пісні вручну',
  'bad-key': 'Ключ Gemini не підходить. Перевірте його в налаштуваннях',
  unknown: 'Gemini не зміг виконати запит. Спробуйте ще раз або вставте текст пісні вручну',
};

export class AiError extends Error {
  constructor(public readonly kind: AiErrorKind, detail?: string) {
    super(MESSAGES[kind]);
    this.name = 'AiError';
    if (detail) this.detail = detail;
  }
  detail?: string;
}
