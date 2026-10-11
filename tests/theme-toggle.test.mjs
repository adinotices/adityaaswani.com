import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initThemeToggles, STORAGE_KEY } from '../src/scripts/theme-toggle.js';

class El extends EventTarget {
  constructor() { super(); this.attrs = new Map(); }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
}

function setup(theme = 'light') {
  const root = new El();
  root.setAttribute('data-theme', theme);
  const bar = new El();
  const menu = new El();
  const store = new Map();
  const storage = { setItem: (k, v) => store.set(k, v), getItem: (k) => store.get(k) ?? null };
  const t = initThemeToggles({ root, buttons: [bar, menu], storage });
  return { root, bar, menu, store, t };
}

test('persists under the same key the head script reads', () => {
  assert.equal(STORAGE_KEY, 'theme');
});

test('init syncs aria-pressed on every toggle', () => {
  const s = setup('dark');
  assert.equal(s.bar.getAttribute('aria-pressed'), 'true');
  assert.equal(s.menu.getAttribute('aria-pressed'), 'true');
});

test('clicking the menu toggle flips theme, persists, and syncs the bar toggle', () => {
  const s = setup('light');
  s.menu.dispatchEvent(new Event('click'));
  assert.equal(s.root.getAttribute('data-theme'), 'dark');
  assert.equal(s.store.get('theme'), 'dark');
  assert.equal(s.menu.getAttribute('aria-pressed'), 'true');
  assert.equal(s.bar.getAttribute('aria-pressed'), 'true');
  s.bar.dispatchEvent(new Event('click'));
  assert.equal(s.root.getAttribute('data-theme'), 'light');
  assert.equal(s.store.get('theme'), 'light');
  assert.equal(s.menu.getAttribute('aria-pressed'), 'false');
});

test('a throwing storage (private mode) still flips the theme', () => {
  const root = new El(); root.setAttribute('data-theme', 'light');
  const b = new El();
  initThemeToggles({ root, buttons: [b], storage: { setItem() { throw new Error('quota'); } } });
  b.dispatchEvent(new Event('click'));
  assert.equal(root.getAttribute('data-theme'), 'dark');
  assert.equal(b.getAttribute('aria-pressed'), 'true');
});

test('destroy removes listeners', () => {
  const s = setup('light');
  s.t.destroy();
  s.menu.dispatchEvent(new Event('click'));
  assert.equal(s.root.getAttribute('data-theme'), 'light');
});
