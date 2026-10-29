// Keeps docs/testing/FEATURES.md alive (AGENTS.md: every feature or fix ships with its rows and tests).
//
//   node scripts/check-feature-matrix.mjs <base-ref>   fail if a changed feature path has no new/edited row
//   node scripts/check-feature-matrix.mjs --stats      print rows and gaps per feature
//   node scripts/check-feature-matrix.mjs --summary    covered/applicable rows per platform, from the e2e reports
//   node scripts/check-feature-matrix.mjs --gaps <platform>   the uncovered rows on web-desktop|web-phone|web-tablet
//   node scripts/check-feature-matrix.mjs --sync       rewrite FEATURES.md "Coverage by platform" from the reports
//
// A commit in the range with a "Matrix-Skip: <reason>" trailer skips the row check (dependency
// bumps, pure refactors), and so does a range whose commits are all by Dependabot, which cannot
// add the trailer (AA-S14). The path map lives in docs/testing/feature-paths.json.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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

export const DEPENDABOT = 'dependabot[bot]';

// Why the range needs no row, or undefined. `log` is `git log --format=%B`, `authors` one `%an` per commit.
// A single human commit (a hand fix on a Dependabot branch included) brings the row check back.
export function skipReasonFor({ log, authors }) {
  const trailer = log.match(/^Matrix-Skip:\s*(.+)$/m)?.[1];
  if (trailer) return trailer;
  if (authors.length > 0 && authors.every((a) => a === DEPENDABOT)) return 'dependency bump (Dependabot)';
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

// Matrix rows as { id, feature, kase, test }.
export function rows(markdown, map) {
  const out = [];
  for (const line of markdown.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 6 || !/^[A-Z0-9]+-[0-9]+[a-z]?$/.test(cells[1])) continue;
    const feature = Object.keys(map.features).find((k) => map.features[k].prefixes.some((p) => cells[1].startsWith(p + '-')));
    out.push({ id: cells[1], feature, kase: cells[2], test: cells[cells.length - 2] });
  }
  return out;
}

// Per-project outcome of every e2e test in Playwright JSON reports: [{ id, project, ok }].
// `id` is the row id the test title starts with (e.g. "NAV-05"); ok means it ran and passed.
export function e2eResults(reports) {
  const out = [];
  const walk = (suite) => {
    for (const s of suite.suites ?? []) walk(s);
    for (const spec of suite.specs ?? []) {
      const id = spec.title.match(/^([A-Z0-9]+-[0-9]+[a-z]?) /)?.[1];
      for (const t of spec.tests ?? []) out.push({ id, project: t.projectName, ok: t.status === 'expected' });
    }
  };
  for (const r of reports) for (const s of r.suites ?? []) walk(s);
  return out;
}

// Coverage per platform (BOX-RULES 2026-10-20: web-desktop, web-phone, web-tablet, android, ios).
// A row is platform-independent when its feature is build/CI-only or it cites no e2e test; those
// are counted once, not per platform. A web row is covered on a platform when a test it cites
// (`x.spec › ID`, or the fixtures guard, which every test runs) passed in a project of that platform.
export function platformCoverage(markdown, map, reports) {
  const cfg = map.platforms;
  const platformOf = (project) => Object.entries(cfg.projectPrefixes).find(([pre]) => project.startsWith(pre))?.[1];
  const passed = {}; // platform -> Set of ids, '*' when any test passed there
  for (const r of e2eResults(reports)) {
    const p = platformOf(r.project);
    if (!p || !r.ok) continue;
    passed[p] ??= new Set();
    passed[p].add('*');
    if (r.id) passed[p].add(r.id);
  }
  const ran = Object.keys(passed);
  const result = { any: { rows: 0, covered: 0 }, web: {}, ran };
  for (const p of cfg.web) result.web[p] = { applicable: 0, covered: 0, gaps: [] };
  for (const row of rows(markdown, map)) {
    const none = /^NONE/.test(row.test);
    const cites = [...row.test.matchAll(/[a-z0-9-]+\.spec › ([A-Z0-9]+-[0-9]+[a-z]?)/g)].map((m) => m[1]);
    if (/fixtures\.mjs guard/.test(row.test)) cites.push('*');
    if (cfg.anyFeatures.includes(row.feature) || cfg.anyRows.includes(row.id) || (!none && cites.length === 0)) {
      result.any.rows++;
      if (!none) result.any.covered++;
      continue;
    }
    for (const p of cfg.only[row.id] ?? cfg.web) {
      const slot = result.web[p];
      slot.applicable++;
      if (cites.some((id) => passed[p]?.has(id))) slot.covered++;
      else slot.gaps.push(row);
    }
  }
  return result;
}

export const COVERAGE_START = '<!-- coverage-by-platform:start (node scripts/check-feature-matrix.mjs --sync) -->';
export const COVERAGE_END = '<!-- coverage-by-platform:end -->';

export function coverageTable(cov, map, date) {
  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
  return [
    COVERAGE_START,
    `Last synced ${date} from the e2e reports of: ${cov.ran.length ? cov.ran.join(', ') : 'no e2e run'}.`,
    '',
    '| Platform | Covered | Applicable | Coverage |',
    '|---|---|---|---|',
    ...map.platforms.web.map((p) => `| ${p} | ${cov.web[p].covered} | ${cov.web[p].applicable} | ${pct(cov.web[p].covered, cov.web[p].applicable)} |`),
    `| platform-independent (build, CI, unit) | ${cov.any.covered} | ${cov.any.rows} | ${pct(cov.any.covered, cov.any.rows)} |`,
    ...map.platforms.native.map((p) => `| ${p} | – | 0 | not applicable: ${map.platforms.nativeReason} |`),
    COVERAGE_END,
  ].join('\n');
}

// What the check needs from git for <base>...HEAD in the checkout at `cwd`.
export function readRange(base, cwd = root) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  const range = `${base}...HEAD`;
  return {
    changed: git('diff', '--name-only', range).split('\n').filter(Boolean),
    matrixDiff: git('diff', '--unified=0', range, '--', MATRIX),
    log: git('log', '--format=%B', `${base}..HEAD`),
    authors: git('log', '--format=%an', `${base}..HEAD`).split('\n').filter(Boolean),
  };
}

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
  if (['--summary', '--gaps', '--sync'].includes(process.argv[2])) {
    // Reports: E2E_REPORTS (comma-separated) or every e2e-report/e2e*.json from the last runs.
    const dir = new URL('../e2e-report/', import.meta.url);
    const files = process.env.E2E_REPORTS
      ? process.env.E2E_REPORTS.split(',')
      : existsSync(dir) ? readdirSync(dir).filter((f) => /^e2e.*\.json$/.test(f)).map((f) => fileURLToPath(new URL(f, dir))) : [];
    if (files.length === 0) {
      console.error('no e2e reports: run npm run test:e2e (and E2E_PROFILE=tablet npm run test:e2e) first, or set E2E_REPORTS');
      process.exit(2);
    }
    const md = readFileSync(new URL(`../${MATRIX}`, import.meta.url), 'utf8');
    const cov = platformCoverage(md, map, files.map((f) => JSON.parse(readFileSync(f, 'utf8'))));
    if (process.argv[2] === '--gaps') {
      const p = process.argv[3];
      if (!cov.web[p]) {
        console.error(`usage: --gaps <${map.platforms.web.join('|')}>`);
        process.exit(2);
      }
      const rank = Object.keys(map.features);
      const gaps = [...cov.web[p].gaps].sort((a, b) => rank.indexOf(a.feature) - rank.indexOf(b.feature));
      console.log(`${p}: ${gaps.length} gaps of ${cov.web[p].applicable} applicable rows (by feature, user impact first)`);
      for (const g of gaps) console.log(`${g.id} | ${map.features[g.feature].name} | ${g.kase} | ${g.test}`);
      process.exit(0);
    }
    const table = coverageTable(cov, map, new Date().toISOString().slice(0, 10));
    if (process.argv[2] === '--sync') {
      const re = new RegExp(`${COVERAGE_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${COVERAGE_END}`);
      if (!re.test(md)) throw new Error(`${MATRIX} has no coverage-by-platform markers`);
      writeFileSync(new URL(`../${MATRIX}`, import.meta.url), md.replace(re, table));
    }
    console.log(table.split('\n').slice(1, -1).join('\n'));
    process.exit(0);
  }
  const base = process.argv[2];
  if (!base) {
    console.error('usage: check-feature-matrix.mjs <base-ref> | --stats | --summary | --gaps <platform> | --sync');
    process.exit(2);
  }
  const { changed, matrixDiff, log, authors } = readRange(base);
  const skipReason = skipReasonFor({ log, authors });
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
