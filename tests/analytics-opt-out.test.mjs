// Scripts that open pages in a Steel browser opt out of Plausible on every page (FEATURES.md
// A11Y-08, PREV-04). A cloud browser may hide navigator.webdriver, and then Layout.astro cannot tell it from a person.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function assertOptsOut(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const opened = lines.flatMap((l, i) => (/\.newPage\(\)/.test(l) ? [i] : []));
  assert.ok(opened.length > 0, 'no newPage() found: update this test');
  for (const i of opened) {
    assert.match(lines.slice(i + 1, i + 3).join('\n'), /evaluateOnNewDocument\(.*localStorage\.setItem\(["']plausible_ignore["'], ["']true["']\)/);
  }
}

test('the font-size audit sets plausible_ignore on every page', () => assertOptsOut('scripts/font-size-audit/fontaudit.mjs'));
test('the design-preview axe run sets plausible_ignore on every page', () => assertOptsOut('scripts/design-previews-axe.mjs'));
