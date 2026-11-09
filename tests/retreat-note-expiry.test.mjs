// The Nov 2026 retreat note on /contact (FEATURES.md CONTACT-06, PAGE-13). The page decides at build time and
// /retreat-note.js decides again in the browser, so the two cutoffs must be the same instant. After the retreat the
// code and its rows go: this test fails from 2026-12-15 (a week's grace) until RETREAT-NOTE is removed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const PAGE = 'src/pages/contact.astro';
const SCRIPT = 'public/retreat-note.js';
const REMOVE_BY = Date.UTC(2026, 11, 15);
const cutoffs = (src) => [...src.matchAll(/Date\.UTC\(([\d,\s]+)\)/g)].map((m) => Date.UTC(...m[1].split(',').map(Number)));

test('contact.astro and retreat-note.js switch at the same instant (2026-12-08 05:00 UTC)', (t) => {
  if (!existsSync(SCRIPT)) return t.skip('the retreat note has been removed');
  const page = cutoffs(readFileSync(PAGE, 'utf8'));
  const script = cutoffs(readFileSync(SCRIPT, 'utf8'));
  assert.deepEqual(page, [Date.UTC(2026, 11, 8, 5)], `${PAGE} cutoff`);
  assert.deepEqual(script, page, `${SCRIPT} must use the same cutoff as ${PAGE}`);
});

test('the retreat note is removed by 2026-12-15', () => {
  if (Date.now() < REMOVE_BY) return;
  const left = [PAGE, SCRIPT].filter((f) => existsSync(f) && /RETREAT-NOTE|retreat-note\.js|data-retreat/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(left, [], 'the retreat is over: delete /retreat-note.js, the data-retreat lines in contact.astro, and rows CONTACT-06 and PAGE-13');
});
