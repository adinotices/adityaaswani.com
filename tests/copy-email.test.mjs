import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyText, initCopyButtons } from '../src/scripts/copy-email.js';

// Minimal fake element on top of EventTarget. Supports just the selectors the helper uses.
class El extends EventTarget {
  constructor({ dataset = {}, classes = [], id = null, text = '', hidden = false, parent = null } = {}) {
    super();
    this.dataset = { ...dataset };
    this.classes = classes;
    this.id = id;
    this.textContent = text;
    this.hidden = hidden;
    this.kids = [];
    if (parent) parent.kids.push(this);
  }
  descendants() {
    return this.kids.flatMap((k) => [k, ...k.descendants()]);
  }
  matches(sel) {
    if (sel === '[data-copy]') return 'copy' in this.dataset;
    if (sel === '.copy-label') return this.classes.includes('copy-label');
    if (sel.startsWith('#')) return this.id === sel.slice(1);
    return false;
  }
  querySelectorAll(sel) { return this.descendants().filter((e) => e.matches(sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getElementById(id) { return this.descendants().find((e) => e.id === id) || null; }
}

// Records timeouts instead of scheduling them; the test decides when they fire.
function fakeTimers() {
  const timers = [];
  return {
    timers,
    setTimeout(fn, ms) {
      const t = { fn, ms, cleared: false, fired: false };
      timers.push(t);
      return t;
    },
    clearTimeout(t) { if (t) t.cleared = true; },
    pendingCount() { return timers.filter((t) => !t.cleared && !t.fired).length; },
    runPending() {
      for (const t of timers) {
        if (!t.cleared && !t.fired) { t.fired = true; t.fn(); }
      }
    },
  };
}

const okClipboard = () => ({
  calls: [],
  writeText(text) { this.calls.push(text); return Promise.resolve(); },
});
const failingClipboard = () => ({
  writeText() { return Promise.reject(new Error('permission denied')); },
});

// Lets pending promise continuations (the async click handler) run.
const flush = () => new Promise((r) => setImmediate(r));

// An explicit `clipboard` key (even undefined) overrides the default working clipboard.
function setup(opts = {}) {
  const clipboard = 'clipboard' in opts ? opts.clipboard : okClipboard();
  const root = new El();
  const button = new El({
    dataset: { copy: 'hello@example.com', status: 'email-status' },
    classes: ['copy-btn'],
    hidden: true,
    parent: root,
  });
  const label = new El({ classes: ['copy-label'], text: 'Copy', parent: button });
  const status = new El({ id: 'email-status', parent: root });
  const timers = fakeTimers();
  const count = initCopyButtons({
    root,
    clipboard,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    resetMs: 2000,
  });
  return { root, button, label, status, timers, clipboard, count };
}

test('copyText resolves true when the clipboard accepts the text', async () => {
  const cb = okClipboard();
  assert.equal(await copyText('a@b.co', cb), true);
  assert.deepEqual(cb.calls, ['a@b.co']);
});

test('copyText resolves false when writeText rejects', async () => {
  assert.equal(await copyText('a@b.co', failingClipboard()), false);
});

test('copyText resolves false without a clipboard and never throws', async () => {
  assert.equal(await copyText('a@b.co', undefined), false);
  assert.equal(await copyText('a@b.co', null), false);
  assert.equal(await copyText('a@b.co', {}), false);
});

test('success path writes the data-copy text, announces Copied, then resets after the timer', async () => {
  const s = setup();
  assert.equal(s.count, 1);
  assert.equal(s.button.hidden, false);

  s.button.dispatchEvent(new Event('click'));
  await flush();

  assert.deepEqual(s.clipboard.calls, ['hello@example.com']);
  assert.equal(s.status.textContent, 'Copied');
  assert.equal(s.label.textContent, 'Copied');
  assert.equal(s.timers.pendingCount(), 1);
  assert.equal(s.timers.timers[0].ms, 2000);

  s.timers.runPending();
  assert.equal(s.status.textContent, '');
  assert.equal(s.label.textContent, 'Copy');
});

test('failure path announces the failure message and leaves the label as Copy', async () => {
  const s = setup({ clipboard: failingClipboard() });
  s.button.dispatchEvent(new Event('click'));
  await flush();

  assert.equal(s.status.textContent, 'Copy failed. Select the address instead.');
  assert.equal(s.label.textContent, 'Copy');

  s.timers.runPending();
  assert.equal(s.status.textContent, '');
});

test('no clipboard: returns 0 and buttons stay hidden', () => {
  for (const clipboard of [undefined, null, {}]) {
    const s = setup({ clipboard });
    assert.equal(s.count, 0);
    assert.equal(s.button.hidden, true);
    s.button.dispatchEvent(new Event('click'));
    assert.equal(s.status.textContent, '');
    assert.equal(s.timers.timers.length, 0);
  }
});

test('two rapid clicks leave only one pending reset', async () => {
  const s = setup();
  s.button.dispatchEvent(new Event('click'));
  s.button.dispatchEvent(new Event('click'));
  await flush();

  assert.equal(s.clipboard.calls.length, 2);
  assert.equal(s.timers.timers.length, 2);
  assert.equal(s.timers.timers[0].cleared, true);
  assert.equal(s.timers.pendingCount(), 1);
  assert.equal(s.status.textContent, 'Copied');
});
