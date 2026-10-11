// Pure helpers for the donate flow. No DOM access at import time.

export const MIN_CENTS = 100;
export const MAX_CENTS = 100000;
export const CHECKOUT_URL = 'https://sutam.org/api/donate/checkout';
export const RANGE_ERROR = 'Please choose an amount between $1 and $1,000.';

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

export function parseAmount(raw) {
  const v = String(raw ?? '').trim();
  if (v === '') return { ok: false, error: RANGE_ERROR, empty: true };
  if (!AMOUNT_RE.test(v)) return { ok: false, error: RANGE_ERROR, empty: false };
  const cents = Math.round(parseFloat(v) * 100);
  if (!Number.isFinite(cents) || cents < MIN_CENTS || cents > MAX_CENTS) {
    return { ok: false, error: RANGE_ERROR, empty: false };
  }
  return { ok: true, cents };
}

// Contract: total = ceil((amount + 30) / (1 - 0.029)); fee = total - amount.
// Done in integers (2.9% = 29/1000) so float error cannot nudge the ceiling.
export function feeCents(amountCents) {
  const num = (amountCents + 30) * 1000;
  return Math.floor((num + 970) / 971) - amountCents;
}

export function fmt(cents) {
  return '$' + (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
}

export function nearestLine(lines, cents, fallback) {
  if (cents === null || cents === undefined) return fallback;
  let best = null;
  for (const key of Object.keys(lines)) {
    const tier = Number(key);
    if (!Number.isFinite(tier)) continue;
    if (best === null) { best = tier; continue; }
    const d = Math.abs(tier - cents);
    const bd = Math.abs(best - cents);
    if (d < bd || (d === bd && tier < best)) best = tier;
  }
  return best === null ? fallback : lines[best];
}

export async function startCheckout(body, { fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(CHECKOUT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j && j.ok && typeof j.url === 'string' && j.url.startsWith('https://checkout.stripe.com/')) {
      return { ok: true, url: j.url };
    }
    return { ok: false, error: (j && j.error) || 'unavailable', status: r.status };
  } catch {
    return { ok: false, error: 'network' };
  } finally {
    clearTimeout(t);
  }
}

export function errorMessage(error) {
  if (error === 'invalid_amount') return RANGE_ERROR;
  if (error === 'rate_limited') return 'Too many attempts; please wait a minute.';
  return "Checkout couldn't open just now.";
}
