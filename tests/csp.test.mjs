// AA-S1: every inline <script> in dist must be allowed by its page's meta CSP. Run after `npm run build`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { applyCsp, CSP_PLACEHOLDER, GOOGLE_FONTS, SUBSTACK_EMBED, SUBSTACK_FRAME_SRC } from '../scripts/csp-integration.mjs';

const DIST = new URL('../dist/', import.meta.url).pathname;
const built = existsSync(join(DIST, 'index.html'));
const opts = built ? {} : { skip: 'dist/ not built; run npm run build first' };

function htmlFiles(dir = DIST) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? htmlFiles(p) : name.endsWith('.html') ? [p] : [];
  });
}
const pages = built ? htmlFiles().map((f) => ({ rel: relative(DIST, f), html: readFileSync(f, 'utf8') })) : [];
// Pages rendered through Layout.astro; the /zoom redirect is standalone and gets its policy inserted
// by the integration (AA-S13).
const layoutPages = pages.filter((p) => p.rel !== 'zoom/index.html');

const cspOf = (html) => html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1] ?? null;
const directives = (csp) => Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));

test('every Layout page has a meta CSP as the first element after the charset', opts, () => {
  assert.ok(layoutPages.length >= 7, `only ${layoutPages.length} layout pages`);
  for (const { rel, html } of layoutPages) {
    assert.match(html, /<head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="/, rel);
    assert.ok(!html.includes(CSP_PLACEHOLDER), `${rel}: placeholder left`);
  }
});

test('every HTML file in dist, the /zoom redirect included, has exactly one meta CSP (AA-S13)', opts, () => {
  for (const { rel, html } of pages) {
    assert.equal((html.match(/http-equiv="Content-Security-Policy"/g) || []).length, 1, rel);
    // Where there is a charset, the policy comes straight after it, ahead of every link it governs.
    if (/<meta charset=/i.test(html)) assert.match(html, /<meta charset="[^"]*"><meta http-equiv="Content-Security-Policy" content="/i, rel);
  }
});

test('Google Fonts and the Substack embed are allowed only on the pages that load them', opts, () => {
  for (const { rel, html } of pages) {
    const dirs = directives(cspOf(html));
    const fonts = html.includes(`href="${GOOGLE_FONTS.style}/`);
    const embed = html.includes(`src="${SUBSTACK_EMBED}/`);
    assert.deepEqual(dirs['style-src'], ["'self'", "'unsafe-inline'", ...(fonts ? [GOOGLE_FONTS.style] : [])], rel);
    assert.deepEqual(dirs['font-src'], ["'self'", ...(fonts ? [GOOGLE_FONTS.font] : [])], rel);
    assert.deepEqual(dirs['frame-src'], embed ? SUBSTACK_FRAME_SRC : undefined, rel);
  }
  for (const { rel, html } of pages) assert.ok(!html.includes(GOOGLE_FONTS.style), `${rel}: a prod page loads Google Fonts`);
});

test('every inline script hash appears in that page\'s CSP', opts, () => {
  let checked = 0;
  for (const { rel, html } of pages) {
    const csp = cspOf(html);
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\ssrc=/.test(m[1]) || /type="application\/ld\+json"/.test(m[1])) continue;
      const hash = 'sha256-' + createHash('sha256').update(m[2], 'utf8').digest('base64');
      assert.ok(csp, `${rel} has an inline script but no CSP`);
      assert.ok(csp.includes(`'${hash}'`), `${rel}: ${hash} missing for script starting ${JSON.stringify(m[2].slice(0, 60))}`);
      checked++;
    }
  }
  assert.ok(checked > 0, 'no inline scripts found; the test is not checking anything');
});

test('the policy carries the required directives and nothing unsafe for scripts', opts, () => {
  for (const { rel, html } of pages) {
    const dirs = directives(cspOf(html));
    assert.deepEqual(dirs['default-src'], ["'self'"], rel);
    assert.ok(!dirs['script-src'].includes("'unsafe-inline'") && !dirs['script-src'].includes("'unsafe-eval'"), rel);
    for (const src of ['https://plausible.io', 'https://static.cloudflareinsights.com']) assert.ok(dirs['script-src'].includes(src), rel);
    assert.deepEqual(dirs['connect-src'], ["'self'", 'https://plausible.io', 'https://cloudflareinsights.com', 'https://sutam.org'], rel);
    assert.deepEqual(dirs['form-action'], ["'self'", 'https://adityaaswani.substack.com'], rel);
    assert.deepEqual(dirs['object-src'], ["'none'"], rel);
    assert.deepEqual(dirs['base-uri'], ["'self'"], rel);
    assert.ok('upgrade-insecure-requests' in dirs, rel);
  }
});

test('every external script, stylesheet and frame origin is allowed', opts, () => {
  const kinds = [
    [/<script\b[^>]*\ssrc="([^"]+)"/g, 'script-src'],
    [/<link\b[^>]*rel="stylesheet"[^>]*\shref="([^"]+)"/g, 'style-src'],
    [/<iframe\b[^>]*\ssrc="([^"]+)"/g, 'frame-src'],
  ];
  for (const { rel, html } of pages) {
    const dirs = directives(cspOf(html));
    for (const [re, dir] of kinds) {
      for (const m of html.matchAll(re)) {
        if (m[1].startsWith('/')) continue;
        assert.ok((dirs[dir] ?? dirs['default-src']).includes(new URL(m[1]).origin), `${rel}: ${m[1]} not in ${dir}`);
      }
    }
  }
});

test('applyCsp hashes the scripts it finds and adds a referrer meta where missing', () => {
  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="__CSP__"><script>a()</script><script type="application/ld+json">{}</script><script type="module" src="/x.js"></script></head></html>';
  const out = applyCsp(html);
  const csp = cspOf(out);
  assert.ok(csp.includes("'" + 'sha256-' + createHash('sha256').update('a()').digest('base64') + "'"));
  assert.equal((csp.match(/sha256-/g) || []).length, 1);
  assert.match(out, /<meta name="referrer" content="strict-origin-when-cross-origin">/);
  assert.match(applyCsp('<!doctype html><title>x</title>'), /^<!doctype html><meta http-equiv="Content-Security-Policy" content="[^"]+"><meta name="referrer"/);
});

test('applyCsp gives a standalone page the policy, with its font and embed hosts only when it uses them', () => {
  const page = (body) => `<!DOCTYPE html><html><head><meta charset="UTF-8">${body}</head></html>`;
  const plain = directives(cspOf(applyCsp(page('<title>x</title>'))));
  assert.deepEqual(plain['font-src'], ["'self'"]);
  assert.equal(plain['frame-src'], undefined);
  const out = applyCsp(page(`<link rel="stylesheet" href="${GOOGLE_FONTS.style}/css2?family=X"><iframe src="${SUBSTACK_EMBED}/embed"></iframe><script>b()</script>`));
  assert.match(out, /<meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="[^"]+"><meta name="referrer"/);
  const dirs = directives(cspOf(out));
  assert.deepEqual(dirs['style-src'], ["'self'", "'unsafe-inline'", GOOGLE_FONTS.style]);
  assert.deepEqual(dirs['font-src'], ["'self'", GOOGLE_FONTS.font]);
  assert.deepEqual(dirs['frame-src'], [SUBSTACK_EMBED, 'https://essays.adityaaswani.com']);
  assert.ok(dirs['script-src'].includes("'sha256-" + createHash('sha256').update('b()').digest('base64') + "'"));
  assert.equal(applyCsp(out), out, 'applyCsp is not idempotent');
});
