// Keeps docs/testing/FEATURES.md alive (AGENTS.md: every feature or fix ships with its rows and tests).
//
//   node scripts/check-feature-matrix.mjs <base-ref>   fail if a changed feature path has no new/edited row
//   node scripts/check-feature-matrix.mjs --stats      print rows and gaps per feature
//
// A commit in the range with a "Matrix-Skip: <reason>" trailer skips the row check (dependency
// bumps, pure refactors). The path map lives in docs/testing/feature-paths.json.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export const MATRIX = 'docs/testing/FEATURES.md';
export const MAP = 'docs/testing/feature-paths.json';

const matches = (pattern, file) => (pattern.endsWith('/') ? file.startsWith(pattern) : file === pattern);

// Features a file belongs to: every matching entry, the longest prefix match first.
export function featuresFor(file, map) {
  const hits = Object.keys(map.paths).filter((p) => matches(p, file)).sort((a, b) => b.length - a.length);
  return [...new Set(hits.flatMap((p) => map.paths[p]))];
}

// Row ids (e.g. "GIVE-06") on added or removed lines of the FEATURES.md diff.
export function touchedRowIds(matrixDiff) {
  const ids = new Set();
  for (const line of matrixDiff.split('\n')) {
    if (!/^[+-]\|/.test(line) || /^(\+\+\+|---)/.test(line)) continue;
    const m = line.match(/^[+-]\|\s*([A-Z0-9]+-[0-9]+[a-z]?)\s*\|/);
    if (m) ids.add(m[1]);
  }
  return ids;
}

// Pure check. Returns { ok, problems }.
export function checkMatrix({ changed, matrixDiff, skipReason, map }) {
  if (skipReason) return { ok: true, problems: [], skipped: skipReason };
  const touched = touchedRowIds(matrixDiff);
  const touchedFeature = (f) => map.features[f].prefixes.some((pre) => [...touched].some((id) => id.startsWith(pre + '-')));
  const problems = [];
  for (const file of changed) {
    if (file === MATRIX) continue;
    const feats = featuresFor(file, map);
    if (feats.length === 0) {
      if (map.mustMap.some((p) => file.startsWith(p))) problems.push(`${file}: not in ${MAP}; map it to a feature`);
      continue;
    }
    if (!feats.some(touchedFeature)) {
      const want = feats.map((f) => `${map.features[f].name} (${map.features[f].prefixes.map((p) => p + '-*').join(', ')})`).join(' or ');
      problems.push(`${file}: add or update a row in ${MATRIX} for ${want}`);
    }
  }
  return { ok: problems.length === 0, problems };
}

// Per-feature counts from FEATURES.md: rows, rows that had no test before the matrix ("Was" = NONE),
// rows still without a test now ("Test" = NONE...).
export function stats(markdown, map) {
  const out = {};
  for (const [key, f] of Object.entries(map.features)) out[key] = { name: f.name, rows: 0, wasNone: 0, nowNone: 0 };
  for (const line of markdown.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 6 || !/^[A-Z0-9]+-[0-9]+[a-z]?$/.test(cells[1])) continue;
    const id = cells[1];
    const key = Object.keys(map.features).find((k) => map.features[k].prefixes.some((p) => id.startsWith(p + '-')));
    if (!key) throw new Error(`row ${id} has no feature prefix in ${MAP}`);
    const was = cells[cells.length - 3];
    const test = cells[cells.length - 2];
    out[key].rows++;
    if (/^NONE/.test(was)) out[key].wasNone++;
    if (/^NONE/.test(test)) out[key].nowNone++;
  }
  return out;
}

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const map = JSON.parse(readFileSync(new URL(`../${MAP}`, import.meta.url), 'utf8'));
  if (process.argv[2] === '--stats') {
    const s = stats(readFileSync(new URL(`../${MATRIX}`, import.meta.url), 'utf8'), map);
    let t = { rows: 0, wasNone: 0, nowNone: 0 };
    console.log('feature | rows | no test before | no test now');
    for (const v of Object.values(s)) {
      console.log(`${v.name} | ${v.rows} | ${v.wasNone} | ${v.nowNone}`);
      for (const k of Object.keys(t)) t[k] += v[k];
    }
    console.log(`TOTAL | ${t.rows} | ${t.wasNone} | ${t.nowNone}`);
    process.exit(0);
  }
  const base = process.argv[2];
  if (!base) {
    console.error('usage: check-feature-matrix.mjs <base-ref> | --stats');
    process.exit(2);
  }
  const range = `${base}...HEAD`;
  const changed = git('diff', '--name-only', range).split('\n').filter(Boolean);
  const matrixDiff = git('diff', '--unified=0', range, '--', MATRIX);
  const log = git('log', '--format=%B', `${base}..HEAD`);
  const skipReason = log.match(/^Matrix-Skip:\s*(.+)$/m)?.[1];
  const r = checkMatrix({ changed, matrixDiff, skipReason, map });
  if (r.skipped) console.log(`feature matrix check skipped: ${r.skipped}`);
  else if (r.ok) console.log(`feature matrix: ${changed.length} changed files, rows present for every feature touched`);
  else {
    console.error('Feature matrix check failed (AGENTS.md: every feature or fix ships with its FEATURES.md rows and tests):');
    for (const p of r.problems) console.error(`  - ${p}`);
    console.error('If the change really needs no row (dependency bump, pure refactor), add a commit trailer "Matrix-Skip: <reason>".');
    process.exit(1);
  }
}
