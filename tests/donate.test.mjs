import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MIN_CENTS, MAX_CENTS, CHECKOUT_URL, RANGE_ERROR,
  parseAmount, feeCents, fmt, nearestLine, startCheckout, errorMessage,
} from '../src/scripts/donate.js';

const links = JSON.parse(readFileSync(new URL('../src/data/support-links.json', import.meta.url), 'utf8'));

test('constants', () => {
  assert.equal(MIN_CENTS, 100);
  assert.equal(MAX_CENTS, 100000);
  assert.equal(CHECKOUT_URL, 'https://sutam.org/api/donate/checkout');
  assert.equal(RANGE_ERROR, 'Please choose an amount between $1 and $1,000.');
  assert.deepEqual(links.checkout, {
    endpoint: CHECKOUT_URL, site: 'aditya',
    portalUrl: links.checkout.portalUrl, minCents: MIN_CENTS, maxCents: MAX_CENTS,
  });
});

test('parseAmount accepts valid values', () => {
  for (const [raw, cents] of [['7', 700], ['7.5', 750], ['7.52', 752], [' 7 ', 700], ['1', 100], ['1000', 100000], ['1000.00', 100000], ['0.1', null]]) {
    const r = parseAmount(raw);
    if (cents === null) assert.equal(r.ok, false, raw);
    else assert.deepEqual(r, { ok: true, cents }, raw);
  }
  assert.equal(parseAmount('19.99').cents, 1999);
  assert.equal(parseAmount('1.15').cents, 115);
});

test('parseAmount rejects invalid values', () => {
  for (const raw of ['0.99', '1000.01', '1.234', 'abc', '1e3', '-5', 'NaN', 'Infinity', '0', '5,5', '$5', '.5', '5.']) {
    assert.deepEqual(parseAmount(raw), { ok: false, error: RANGE_ERROR, empty: false }, raw);
  }
  for (const raw of ['', '   ', null, undefined]) {
    assert.deepEqual(parseAmount(raw), { ok: false, error: RANGE_ERROR, empty: true }, String(raw));
  }
});

test('feeCents matches the contract examples', () => {
  assert.equal(feeCents(500), 46);
  assert.equal(feeCents(1000), 61);
  assert.equal(feeCents(2500), 106);
  assert.equal(feeCents(700), 52);
  assert.equal(feeCents(300), 40);
});

test('feeCents matches the contract formula across the range', () => {
  for (let c = MIN_CENTS; c <= MAX_CENTS; c++) {
    const exact = Math.ceil((c * 1000 + 30000) / 971) - c;
    assert.equal(feeCents(c), exact, String(c));
  }
});

test('monthly preset fees equal support-links.json feeCents', () => {
  for (const t of links.monthly.tiers) assert.equal(t.cents + feeCents(t.cents), t.feeCents, String(t.cents));
});

test('fmt', () => {
  assert.equal(fmt(700), '$7');
  assert.equal(fmt(752), '$7.52');
  assert.equal(fmt(750), '$7.50');
  assert.equal(fmt(100000), '$1000');
});

test('nearestLine', () => {
  const lines = { 300: 'a', 500: 'b', 1000: 'c', 2500: 'd' };
  assert.equal(nearestLine(lines, 100, 'fb'), 'a');
  assert.equal(nearestLine(lines, 100000, 'fb'), 'd');
  assert.equal(nearestLine(lines, 400, 'fb'), 'a', 'tie goes to lower tier');
  assert.equal(nearestLine(lines, 700, 'fb'), 'b');
  assert.equal(nearestLine(lines, 800, 'fb'), 'c');
  assert.equal(nearestLine(lines, 1000, 'fb'), 'c');
  assert.equal(nearestLine(lines, null, 'fb'), 'fb');
  assert.equal(nearestLine({ 500: 'x', other: 'y' }, 600, 'fb'), 'x', 'non-numeric keys ignored');
});

test('errorMessage', () => {
  assert.equal(errorMessage('invalid_amount'), RANGE_ERROR);
  assert.equal(errorMessage('rate_limited'), 'Too many attempts; please wait a minute.');
  assert.equal(errorMessage('unavailable'), "Checkout couldn't open just now.");
  assert.equal(errorMessage('network'), "Checkout couldn't open just now.");
  assert.equal(errorMessage(undefined), "Checkout couldn't open just now.");
});

const reply = (status, json) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => json });
const body = { site: 'aditya', amount_cents: 500, interval: 'month', cover_fees: false };

test('startCheckout success sends the right request', async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 200, json: async () => ({ ok: true, url: 'https://checkout.stripe.com/c/pay/cs_test_1', id: 'cs_test_1' }) };
  };
  const r = await startCheckout(body, { fetchImpl });
  assert.deepEqual(r, { ok: true, url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
  assert.equal(seen.url, CHECKOUT_URL);
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(seen.init.body), body);
});

test('startCheckout rejects non-checkout urls', async () => {
  for (const url of ['https://evil.example/x', 'http://checkout.stripe.com/x', 'https://checkout.stripe.com.evil.example/x', 123, undefined]) {
    const r = await startCheckout(body, { fetchImpl: reply(200, { ok: true, url }) });
    assert.equal(r.ok, false, String(url));
    assert.equal(r.url, undefined);
  }
});

test('startCheckout 400 invalid_amount', async () => {
  const r = await startCheckout(body, { fetchImpl: reply(400, { ok: false, error: 'invalid_amount' }) });
  assert.deepEqual(r, { ok: false, error: 'invalid_amount', status: 400 });
});

test('startCheckout 429', async () => {
  const r = await startCheckout(body, { fetchImpl: reply(429, { ok: false, error: 'rate_limited' }) });
  assert.deepEqual(r, { ok: false, error: 'rate_limited', status: 429 });
});

test('startCheckout non-JSON error body', async () => {
  const fetchImpl = async () => ({ ok: false, status: 502, json: async () => { throw new Error('bad'); } });
  assert.deepEqual(await startCheckout(body, { fetchImpl }), { ok: false, error: 'unavailable', status: 502 });
});

test('startCheckout network throw', async () => {
  const r = await startCheckout(body, { fetchImpl: async () => { throw new TypeError('fail'); } });
  assert.deepEqual(r, { ok: false, error: 'network' });
});

test('startCheckout times out when fetch never resolves', async () => {
  const fetchImpl = (url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
  const r = await startCheckout(body, { fetchImpl, timeoutMs: 20 });
  assert.deepEqual(r, { ok: false, error: 'network' });
});
