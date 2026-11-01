// The build marker and the nightly's check of what is deployed (FEATURES.md DEPLOY-06, DEPLOY-07, ESSAY-08).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseMarker, verdict } from '../scripts/check-deploy-marker.mjs';

const sha = 'a'.repeat(40);
const other = 'b'.repeat(40);
const now = Date.parse('2026-11-03T03:00:00Z');
const min = 60_000;
const day = 864e5;
const marker = (s = sha, age = day) => ({ sha: s, builtAt: new Date(now - age).toISOString() });

test('parseMarker reads the sha and build time, and refuses anything else', () => {
  assert.deepEqual(parseMarker(`<head><meta name="build" content="${sha} 2026-11-01T09:00:00.000Z"></head>`), { sha, builtAt: '2026-11-01T09:00:00.000Z' });
  assert.equal(parseMarker('<head></head>'), null);
  assert.equal(parseMarker('<meta name="build" content="abc 2026-11-01T09:00:00.000Z">'), null);
  assert.equal(parseMarker(`<meta name="build" content="${sha} never">`), null);
});

test('DEPLOY-06 the live commit equals main: passes', () => {
  assert.equal(verdict({ marker: marker(), headSha: sha, headTime: now - 3 * day, now }).ok, true);
});

test('DEPLOY-06 the live commit is behind main an hour after the merge: the deploy did not land', () => {
  const r = verdict({ marker: marker(other), headSha: sha, headTime: now - 90 * min, now });
  assert.equal(r.ok, false);
  assert.match(r.detail, /did not land/);
});

test('DEPLOY-06 a merge minutes ago may still be deploying', () => {
  assert.equal(verdict({ marker: marker(other), headSha: sha, headTime: now - 5 * min, now }).ok, true);
  assert.equal(verdict({ marker: null, headSha: sha, headTime: now - 5 * min, now }).ok, true);
});

test('DEPLOY-06 no marker on the live site, long after the merge: fails', () => {
  const r = verdict({ marker: null, headSha: sha, headTime: now - 2 * day, now });
  assert.equal(r.ok, false);
  assert.match(r.detail, /no build marker/);
});

test('DEPLOY-07 a live build over 8 days old: the Monday rebuild did not run', () => {
  const r = verdict({ marker: marker(sha, 8.5 * day), headSha: sha, headTime: now - 30 * day, now });
  assert.equal(r.ok, false);
  assert.match(r.detail, /Monday rebuild did not run/);
  // A rebuild that GitHub started hours late, seen on the eve of the next one, is fine (run of 2026-10-26: 15:43 UTC).
  assert.equal(verdict({ marker: marker(sha, 7.5 * day), headSha: sha, headTime: now - 30 * day, now }).ok, true);
});

const index = new URL('../dist/index.html', import.meta.url);
test('DEPLOY-06 a deploy build carries the marker; a local build has none', { skip: existsSync(index) ? false : 'dist/ not built; run npm run build first' }, () => {
  const m = parseMarker(readFileSync(index, 'utf8'));
  if (process.env.GITHUB_SHA) assert.equal(m?.sha, process.env.GITHUB_SHA);
  else assert.equal(m, null);
});
