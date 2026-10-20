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
