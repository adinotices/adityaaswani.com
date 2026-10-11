import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initMobileNav } from '../src/scripts/mobile-nav.js';

// Minimal fake element on top of EventTarget.
class El extends EventTarget {
  constructor(doc, name, parent = null) {
    super();
    this.doc = doc; this.name = name; this.parent = parent; this.attrs = new Map(); this.kids = [];
    if (parent) parent.kids.push(this);
  }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  removeAttribute(k) { this.attrs.delete(k); }
  hasAttribute(k) { return this.attrs.has(k); }
  contains(n) { for (let x = n; x; x = x.parent) if (x === this) return true; return false; }
  closest(sel) { for (let x = this; x; x = x.parent) if (x.tag === sel) return x; return null; }
  focus() { this.doc.activeElement = this; }
  querySelector(sel) { return sel === 'a' ? this.kids.find((k) => k.tag === 'a') || null : null; }
}

function setup() {
  const doc = new EventTarget();
  doc.activeElement = null;
  const header = new El(doc, 'header');
  const button = new El(doc, 'button', header);
  button.setAttribute('aria-expanded', 'false');
  const panel = new El(doc, 'panel', header);
  const a1 = new El(doc, 'a1', panel); a1.tag = 'a';
  const a2 = new El(doc, 'a2', panel); a2.tag = 'a';
  const outside = new El(doc, 'outside');
  const mql = new EventTarget(); mql.matches = true;
  const nav = initMobileNav({ header, button, panel, mql, doc });
  return { doc, header, button, panel, a1, a2, outside, mql, nav };
}

const ev = (type, props = {}) => {
  const e = new Event(type, { bubbles: true });
  for (const [k, v] of Object.entries(props)) Object.defineProperty(e, k, { value: v });
  return e;
};
// Fakes don't bubble on their own: dispatch on the element and each ancestor.
const fire = (el, type, props = {}) => {
  for (let x = el; x; x = x.parent) x.dispatchEvent(ev(type, { target: el, ...props }));
};
const click = (el) => { fire(el, 'click'); el.doc.dispatchEvent(ev('click', { target: el })); };
const opened = (s) => s.header.hasAttribute('data-menu-open') && s.button.getAttribute('aria-expanded') === 'true';

test('starts closed', () => {
  const s = setup();
  assert.equal(s.nav.isOpen(), false);
  assert.equal(s.header.hasAttribute('data-menu-open'), false);
  assert.equal(s.button.getAttribute('aria-expanded'), 'false');
});

test('open sets attributes and focuses first link', () => {
  const s = setup();
  s.nav.open();
  assert.ok(opened(s));
  assert.equal(s.nav.isOpen(), true);
  assert.equal(s.doc.activeElement, s.a1);
});

test('button click toggles; closing refocuses the button', () => {
  const s = setup();
  click(s.button);
  assert.ok(opened(s));
  s.doc.activeElement = s.a2;
  click(s.button);
  assert.equal(s.nav.isOpen(), false);
  assert.equal(s.button.getAttribute('aria-expanded'), 'false');
  assert.equal(s.doc.activeElement, s.button);
});

test('Escape closes and refocuses the button', () => {
  const s = setup();
  s.nav.open();
  s.doc.dispatchEvent(ev('keydown', { key: 'Escape' }));
  assert.equal(s.nav.isOpen(), false);
  assert.equal(s.doc.activeElement, s.button);
});

test('Escape when closed does nothing', () => {
  const s = setup();
  s.doc.activeElement = s.outside;
  s.doc.dispatchEvent(ev('keydown', { key: 'Escape' }));
  assert.equal(s.nav.isOpen(), false);
  assert.equal(s.doc.activeElement, s.outside);
});

test('other keys do not close', () => {
  const s = setup();
  s.nav.open();
  s.doc.dispatchEvent(ev('keydown', { key: 'a' }));
  assert.equal(s.nav.isOpen(), true);
});

test('link click closes without moving focus', () => {
  const s = setup();
  s.nav.open();
  s.doc.activeElement = s.a2;
  click(s.a2);
  assert.equal(s.nav.isOpen(), false);
  assert.equal(s.button.getAttribute('aria-expanded'), 'false');
  assert.equal(s.doc.activeElement, s.a2);
});

test('outside click closes without moving focus', () => {
  const s = setup();
  s.nav.open();
  s.doc.activeElement = s.outside;
  click(s.outside);
  assert.equal(s.nav.isOpen(), false);
  assert.equal(s.doc.activeElement, s.outside);
});

test('click inside header (not a link) does not close', () => {
  const s = setup();
  s.nav.open();
  s.doc.dispatchEvent(ev('click', { target: s.panel }));
  assert.equal(s.nav.isOpen(), true);
});

test('focusout to outside closes without moving focus', () => {
  const s = setup();
  s.nav.open();
  s.doc.activeElement = s.outside;
  fire(s.a2, 'focusout', { relatedTarget: s.outside });
  assert.equal(s.nav.isOpen(), false);
  assert.equal(s.doc.activeElement, s.outside);
});

test('focusout to an inside link does not close', () => {
  const s = setup();
  s.nav.open();
  fire(s.a1, 'focusout', { relatedTarget: s.a2 });
  assert.equal(s.nav.isOpen(), true);
});

test('focusout to another header control (Support pill) closes', () => {
  const s = setup();
  const pill = new El(s.doc, 'support', s.header);
  s.nav.open();
  fire(s.a2, 'focusout', { relatedTarget: pill });
  assert.equal(s.nav.isOpen(), false);
});

test('focusout from a link to the toggle does not close', () => {
  const s = setup();
  s.nav.open();
  fire(s.a1, 'focusout', { relatedTarget: s.button });
  assert.equal(s.nav.isOpen(), true);
});

test('mql change to not matching closes without moving focus', () => {
  const s = setup();
  s.nav.open();
  s.mql.dispatchEvent(ev('change', { matches: false }));
  assert.equal(s.nav.isOpen(), false);
  assert.equal(s.doc.activeElement, s.a1);
});

test('destroy removes listeners', () => {
  const s = setup();
  s.nav.destroy();
  click(s.button);
  assert.equal(s.nav.isOpen(), false);
  s.nav.open();
  s.doc.dispatchEvent(ev('keydown', { key: 'Escape' }));
  click(s.outside);
  s.mql.dispatchEvent(ev('change', { matches: false }));
  fire(s.a1, 'focusout', { relatedTarget: s.outside });
  assert.equal(s.nav.isOpen(), true);
});
