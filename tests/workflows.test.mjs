// .github/workflows (FEATURES.md DEPLOY-09): every action is pinned to a commit SHA with its release
// tag in a comment, and one action is pinned to the same release everywhere (AA-S15).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../.github/workflows/', import.meta.url);
const uses = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).flatMap((f) =>
  readFileSync(new URL(f, dir), 'utf8').split('\n')
    .map((line, i) => ({ where: `${f}:${i + 1}`, m: line.match(/^\s*(?:-\s+)?uses:\s*(\S+?)@(\S+)(.*)$/) }))
    .filter((u) => u.m)
    .map(({ where, m }) => ({ where, action: m[1], ref: m[2], comment: m[3].trim() })));

test('every action in the workflows is pinned to a full commit SHA with a # vX.Y.Z comment', () => {
  assert.ok(uses.length >= 10, `only ${uses.length} uses: lines found`);
  const bad = uses.filter((u) => !/^[0-9a-f]{40}$/.test(u.ref) || !/^# v\d+\.\d+\.\d+$/.test(u.comment));
  assert.deepEqual(bad.map((u) => `${u.where}: ${u.action}@${u.ref} ${u.comment}`), []);
});

test('each action is pinned to one SHA and one release across the workflows', () => {
  const pins = new Map();
  for (const u of uses) pins.set(u.action, (pins.get(u.action) ?? new Set()).add(`${u.ref} ${u.comment}`));
  const split = [...pins].filter(([, s]) => s.size > 1).map(([a, s]) => `${a}: ${[...s].join(' | ')}`);
  assert.deepEqual(split, []);
});

// DEPLOY-08: the self-hosted runner keeps old Node builds in its tool cache, so a bare "22" resolved
// to 22.23.3 and astro 7.4.2 (engines >= 22.23.4) failed on dependabot #37 (2026-10-26).
test('every setup-node takes the newest release of its line (check-latest: true)', () => {
  const steps = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).flatMap((f) =>
    readFileSync(new URL(f, dir), 'utf8').split(/\n(?=\s*- (?:name|uses|run):)/)
      .filter((s) => /uses:\s*actions\/setup-node@/.test(s))
      .map((s) => ({ f, s })));
  assert.ok(steps.length >= 3, `only ${steps.length} setup-node steps found`);
  assert.deepEqual(steps.filter(({ s }) => !/^\s*check-latest:\s*true\s*$/m.test(s)).map(({ f }) => f), []);
});

// DEPLOY-11 (AA-S18): #49's `cancel-in-progress: true` in e2e.yml also applied to pushes to main, so
// 5dccd63's merge cancelled phone-webkit on 128f961 (run 40897311377). Only stale PR runs may be cancelled.
test('pushes to main are never cancelled in progress (cancel-in-progress only for pull_request)', () => {
  const lines = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).flatMap((f) =>
    readFileSync(new URL(f, dir), 'utf8').split('\n')
      .map((line, i) => ({ where: `${f}:${i + 1}`, m: line.match(/^\s*cancel-in-progress:\s*(.+?)\s*$/) }))
      .filter((l) => l.m));
  assert.ok(lines.length >= 2, `only ${lines.length} cancel-in-progress: lines found`);
  const ok = new Set(['false', "${{ github.event_name == 'pull_request' }}"]);
  assert.deepEqual(lines.filter((l) => !ok.has(l.m[1])).map((l) => `${l.where}: ${l.m[1]}`), []);
});
