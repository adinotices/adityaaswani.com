// scripts/check-feature-matrix.mjs (FEATURES.md MATRIX-*), plus a consistency check of the real matrix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { checkMatrix, featuresFor, touchedRowIds, stats, MATRIX, MAP } from '../scripts/check-feature-matrix.mjs';

const root = new URL('../', import.meta.url);
const map = JSON.parse(readFileSync(new URL(MAP, root), 'utf8'));
const matrix = readFileSync(new URL(MATRIX, root), 'utf8');

const diff = (...rows) => ['--- a/docs/testing/FEATURES.md', '+++ b/docs/testing/FEATURES.md', ...rows].join('\n');

test('a feature change without a row fails and names the feature', () => {
  const r = checkMatrix({ changed: ['src/pages/support/index.astro'], matrixDiff: '', map });
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /src\/pages\/support\/index\.astro: add or update a row .*Support: give flow \(SUP-\*, GIVE-\*/);
});

test('a changed or added row of the feature passes', () => {
  const added = diff('+| GIVE-09 | New case | Expected | NONE | support.spec › GIVE-09 |');
  assert.equal(checkMatrix({ changed: ['src/pages/support/index.astro', MATRIX], matrixDiff: added, map }).ok, true);
  const edited = diff('-| SUP-01 | Old | x | NONE | y |', '+| SUP-01 | New | x | NONE | y |');
  assert.equal(checkMatrix({ changed: ['src/pages/support/index.astro'], matrixDiff: edited, map }).ok, true);
});

test('a row of a different feature does not satisfy the check', () => {
  const r = checkMatrix({ changed: ['src/scripts/mobile-nav.js'], matrixDiff: diff('+| GIVE-09 | x | x | NONE | y |'), map });
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /NAV-\*/);
});

test('a shared file is satisfied by a row of any of its features', () => {
  const r = checkMatrix({ changed: ['src/data/site.ts'], matrixDiff: diff('+| NEWS-15 | x | x | NONE | y |'), map });
  assert.equal(r.ok, true);
});

test('an unmapped source file fails', () => {
  const r = checkMatrix({ changed: ['src/pages/new-page.astro'], matrixDiff: '', map });
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /not in docs\/testing\/feature-paths\.json/);
});

test('docs, tests and dependency files need no row', () => {
  const r = checkMatrix({ changed: ['README.md', 'tests/donate.test.mjs', 'e2e/support.spec.mjs', 'package-lock.json', 'docs/OBSERVABILITY.md'], matrixDiff: '', map });
  assert.equal(r.ok, true);
});

test('Matrix-Skip skips the check', () => {
  const r = checkMatrix({ changed: ['src/pages/support/index.astro'], matrixDiff: '', skipReason: 'astro bump', map });
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 'astro bump');
});

test('touchedRowIds reads only table rows on +/- lines', () => {
  const ids = touchedRowIds(diff('+| THX-13 | a | b | NONE | c |', ' | THX-01 | unchanged |', '+Some prose mentioning | GIVE-01 |', '-| MENU-08 | a | b | NONE | c |'));
  assert.deepEqual([...ids].sort(), ['MENU-08', 'THX-13']);
});

test('featuresFor uses exact paths and directory prefixes', () => {
  assert.deepEqual(featuresFor('src/scripts/donate.js', map), ['give', 'thanks']);
  assert.ok(featuresFor('public/.well-known/security.txt', map).includes('security'));
  assert.deepEqual(featuresFor('README.md', map), []);
});

test('every file under the must-map directories is mapped', () => {
  const walk = (dir) => readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}${e.name}/`) : [`${dir}${e.name}`]);
  const unmapped = map.mustMap.flatMap((d) => walk(d)).filter((f) => featuresFor(f, map).length === 0);
  assert.deepEqual(unmapped, []);
});

test('every row id in FEATURES.md is unique and belongs to a feature', () => {
  const ids = [...matrix.matchAll(/^\|\s*([A-Z0-9]+-[0-9]+[a-z]?)\s*\|/gm)].map((m) => m[1]);
  assert.ok(ids.length >= 150, `only ${ids.length} rows`);
  assert.equal(new Set(ids).size, ids.length, 'duplicate row ids');
  assert.doesNotThrow(() => stats(matrix, map));
});

test('every e2e test id is a row in FEATURES.md', () => {
  const rows = new Set([...matrix.matchAll(/^\|\s*([A-Z0-9]+-[0-9]+[a-z]?)\s*\|/gm)].map((m) => m[1]));
  const specs = readdirSync(new URL('e2e/', root)).filter((f) => f.endsWith('.spec.mjs'));
  const missing = [];
  for (const f of specs) {
    const src = readFileSync(new URL(`e2e/${f}`, root), 'utf8');
    for (const m of src.matchAll(/test\(\s*[`'"]([A-Z0-9]+-[0-9]+[a-z]?) /g)) if (!rows.has(m[1])) missing.push(`${f}: ${m[1]}`);
  }
  assert.deepEqual(missing, []);
});

test('every test a row cites exists', () => {
  const missing = [];
  const specSrc = Object.fromEntries(readdirSync(new URL('e2e/', root)).filter((f) => f.endsWith('.mjs')).map((f) => [f.replace(/\.mjs$/, ''), readFileSync(new URL(`e2e/${f}`, root), 'utf8')]));
  const unitSrc = Object.fromEntries(readdirSync(new URL('tests/', root)).filter((f) => f.endsWith('.test.mjs')).map((f) => [f.replace(/\.mjs$/, ''), readFileSync(new URL(`tests/${f}`, root), 'utf8').replace(/\\'/g, "'")]));
  for (const line of matrix.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 6 || !/^[A-Z0-9]+-[0-9]+/.test(cells[1])) continue;
    for (const ref of cells[cells.length - 2].split(';').map((s) => s.trim())) {
      const m = ref.match(/^([a-z0-9-]+\.(?:spec|test)) › (.+?)(?: \(.*\))?$/);
      if (!m) continue;
      const [, file, name] = m;
      const src = file.endsWith('.spec') ? specSrc[file] : unitSrc[file];
      // Test names may be built in a loop: match the first words before any " / " alternatives.
      const needle = name.split(' / ')[0].replace(/^loadEssays falls back on .*/, 'loadEssays falls back on');
      if (!src || !src.includes(needle)) missing.push(`${cells[1]}: ${ref}`);
    }
  }
  assert.deepEqual(missing, []);
});
