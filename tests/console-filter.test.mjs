// e2e/console-filter.mjs (FEATURES.md MATRIX-05).
import test from 'node:test';
import assert from 'node:assert/strict';
import { isIgnoredConsoleError } from '../e2e/console-filter.mjs';

const font = (status) =>
  `[JavaScript Error: "downloadable font: download failed (font-family: "Fraunces" style:normal weight:100..900 width:100 src index:0): status=${status} source: https://adityaaswani.com/_astro/fraunces-latin-soft-normal.C-lS_vzd.woff2"]`;

test('ignores a navigation-aborted font load (NS_BINDING_ABORTED)', () => {
  assert.equal(isIgnoredConsoleError(font(2152398850)), true);
});

test('still fails every other font error', () => {
  assert.equal(isIgnoredConsoleError(font(2152398878)), false); // NS_ERROR_UNKNOWN_HOST
  assert.equal(isIgnoredConsoleError(font(21523988500)), false);
  assert.equal(isIgnoredConsoleError('downloadable font: rejected by sanitizer (font-family: "Fraunces"): status=2152398850'), false);
  assert.equal(isIgnoredConsoleError('downloadable font: download failed (font-family: "Fraunces"): bad URI or cross-site access not allowed'), false);
});

test('still fails unrelated errors that mention the status code', () => {
  assert.equal(isIgnoredConsoleError('TypeError: x is undefined (status=2152398850)'), false);
});
