export type ChordAt = { pos: number; chord: string };
export type SongLine = { lyrics: string; chords: ChordAt[] };
export type SongSection = { label: string; lines: SongLine[] };
export type SongDoc = { sections: SongSection[] };
