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
  /** Пошук пісні за назвою або читання сторінки за посиланням. */
  searchSongs(query: string): Promise<SongCandidate[]>;
  recognizePhoto(image: Blob): Promise<SongCandidate>;
}

export type AiErrorKind = 'no-key' | 'quota' | 'network' | 'empty' | 'bad-key' | 'unknown';

const MESSAGES: Record<AiErrorKind, string> = {
  'no-key': 'Додайте ключ Gemini в налаштуваннях',
  quota: 'Безкоштовний ліміт Gemini на сьогодні вичерпано. Спробуйте пізніше або вставте текст пісні вручну',
  network: 'Немає інтернету. Збережені пісні працюють, а для пошуку потрібна мережа',
  empty: 'Пісню не знайдено. Спробуйте іншу назву, додайте виконавця або вставте посилання на сторінку з акордами',
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
