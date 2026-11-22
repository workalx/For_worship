/**
 * Прототип: акорди з ABC для 10 відомих гімнів.
 * Запуск: npx vite-node scripts/library/prototype.ts [папка-з-openhymnal]
 * Результат: scripts/out/prototype/*.cho і короткий звіт у консолі.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeAbc, parseAbc } from './abc';
import { abcToChordPro } from './abcToChordPro';

const root = process.argv[2] ?? 'scripts/.cache/openhymnal';
const out = 'scripts/out/prototype';
const FILES = [
  'Amazing_Grace/Amazing_Grace-New_Britain.abc',
  'Holy_Holy_Holy/Holy_Holy_Holy-Nicaea.abc',
  'A_Mighty_Fortress_Is_Our_God/A_Mighty_Fortress_Is_Our_God-Ein_Feste_Burg_Isorhythmic.abc',
  'It_Is_Well_With_My_Soul/It_Is_Well_With_My_Soul-It_Is_Well-Ville_Du_Havre.abc',
  'Be_Thou_My_Vision/Be_Thou_My_Vision-Slane.abc',
  'Come_Thou_Fount/Come_Thou_Fount-Nettleton.abc',
  'Rock_of_Ages/Rock_of_Ages-Toplady.abc',
  'Blessed_Assurance/Blessed_Assurance-Blessed_Assurance-Assurance.abc',
  'Crown_Him_With_Many_Crowns/Crown_Him_With_Many_Crowns-Diademata.abc',
  'What_A_Friend_We_Have_In_Jesus/What_A_Friend_We_Have_In_Jesus-untitled.abc',
];

mkdirSync(out, { recursive: true });
for (const f of FILES) {
  const tune = parseAbc(decodeAbc(readFileSync(join(root, 'Complete', f))));
  const song = abcToChordPro(tune, { source: 'Open Hymnal Project', license: 'public domain' });
  const name = f.split('/')[1].replace(/\.abc$/, '.cho');
  writeFileSync(join(out, name), song.chordpro);
  const s = song.stats;
  console.log(`\n=== ${song.title} — ${song.key}, ${tune.meter}; тактів ${s.bars}, акордів ${s.chords} (${(s.chords / s.bars).toFixed(2)}/такт), куплетів ${s.verses}+${s.extraVerses}`);
  console.log(`акорди: ${s.distinct.join(' ')}${s.warnings.length ? `\n⚠ ${s.warnings.join('; ')}` : ''}`);
  console.log(song.body.split('\n\n').slice(0, 2).join('\n\n'));
}
