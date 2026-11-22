/**
 * Генерація вбудованої бібліотеки: завантаження Open Hymnal → розбір ABC → фільтр ліцензій →
 * автоакорди → ChordPro → public/library/index.json і songs-<літера>.json.
 *
 * Запуск: npm run library:build
 * Звіти: scripts/out/skipped.txt (що пропущено і чому), scripts/out/library-report.txt (розміри).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { decodeAbc } from './abc';
import { buildCatalog, OPEN_HYMNAL, type SourceFile } from './catalog';

const CACHE = 'scripts/.cache/openhymnal';
const OUT_DIR = 'public/library';
const REPORT_DIR = 'scripts/out';
/** Бюджет: індекс входить в офлайн-кеш одразу, тож він не має роздувати встановлення. */
const INDEX_BUDGET = 300 * 1024;
const TOTAL_BUDGET = 15 * 1024 * 1024;

function git(args: string[], cwd?: string) {
  execFileSync('git', args, { cwd, stdio: 'inherit' });
}

function ensureSource() {
  if (!existsSync(join(CACHE, '.git'))) {
    mkdirSync('scripts/.cache', { recursive: true });
    git(['clone', '--quiet', `${OPEN_HYMNAL.repo}.git`, CACHE]);
  }
  git(['-c', 'advice.detachedHead=false', 'checkout', '--quiet', OPEN_HYMNAL.commit], CACHE);
}

function readSources(): SourceFile[] {
  const base = join(CACHE, 'Complete');
  const files: SourceFile[] = [];
  for (const dir of readdirSync(base, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const f of readdirSync(join(base, dir.name))) {
      if (!f.toLowerCase().endsWith('.abc')) continue;
      const full = join(base, dir.name, f);
      files.push({ path: relative(CACHE, full).split('\\').join('/'), text: decodeAbc(readFileSync(full)) });
    }
  }
  return files;
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} КБ`;

function main() {
  ensureSource();
  const sources = readSources();
  const { index, chunks, skipped } = buildCatalog(sources);

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const indexJson = JSON.stringify(index);
  writeFileSync(join(OUT_DIR, 'index.json'), indexJson);
  let total = Buffer.byteLength(indexJson);
  let totalGz = gzipSync(indexJson).length;
  const chunkLines: string[] = [];
  for (const [key, chunk] of [...chunks].sort(([a], [b]) => a.localeCompare(b))) {
    const json = JSON.stringify(chunk);
    writeFileSync(join(OUT_DIR, `songs-${key}.json`), json);
    const size = Buffer.byteLength(json);
    total += size;
    totalGz += gzipSync(json).length;
    chunkLines.push(`  songs-${key}.json: ${Object.keys(chunk.songs).length} пісень, ${kb(size)}`);
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(
    join(REPORT_DIR, 'skipped.txt'),
    skipped.map((s) => `${s.path}\t${s.reason}`).join('\n') + (skipped.length ? '\n' : ''),
  );
  const indexSize = Buffer.byteLength(indexJson);
  const report = [
    `Джерело: ${OPEN_HYMNAL.repo} @ ${OPEN_HYMNAL.commit}`,
    `Файлів ABC: ${sources.length}; у бібліотеці: ${index.songs.length}; пропущено: ${skipped.length}`,
    `index.json: ${kb(indexSize)} (gzip ${kb(gzipSync(indexJson).length)}), бюджет ${kb(INDEX_BUDGET)}`,
    `Уся бібліотека: ${kb(total)} (gzip ${kb(totalGz)}), бюджет ${kb(TOTAL_BUDGET)}`,
    `Частини:`,
    ...chunkLines,
  ].join('\n');
  writeFileSync(join(REPORT_DIR, 'library-report.txt'), report + '\n');
  console.log(report);
  const reasons = new Map<string, number>();
  for (const s of skipped) {
    const r = s.reason.replace(/«.*$/, '').replace(/:.*$/, '').trim();
    reasons.set(r, (reasons.get(r) ?? 0) + 1);
  }
  console.log('Пропущено за причинами:');
  for (const [r, n] of reasons) console.log(`  ${n} — ${r}`);

  if (indexSize > INDEX_BUDGET || total > TOTAL_BUDGET) {
    console.error('Перевищено бюджет розміру бібліотеки');
    process.exit(1);
  }
}

main();
