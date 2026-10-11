#!/usr/bin/env node
// Creates (or reuses) the Stripe products, prices and Payment Links behind /support,
// then writes them to src/data/support-links.json.
//
//   node scripts/stripe-support-links.mjs          # test mode: STRIPE_SECRET_KEY from ~/repos/amberhall/.env
//   node scripts/stripe-support-links.mjs --live   # live mode: STRIPE_SECRET_KEY_LIVE from ~/repos/.env
//
// Idempotent: every object is tagged with metadata.support_key and looked up by it before
// anything is created, so re-running only fills in what is missing. Prints URLs only; the
// key is never printed or written anywhere.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIVE = process.argv.includes('--live');
const MODE = LIVE ? 'live' : 'test';
const ENV_FILE = LIVE ? join(homedir(), 'repos/.env') : join(homedir(), 'repos/amberhall/.env');
const KEY_NAME = LIVE ? 'STRIPE_SECRET_KEY_LIVE' : 'STRIPE_SECRET_KEY';
const SUCCESS_BASE = 'https://adityaaswani.com/support/thanks';
const SUBMIT_MESSAGE = "This is personal support for Aditya's independent work, not a charitable donation, so it isn't tax-deductible.";
// Standard US card pricing (2.9% + 30 cents). Must be checked against the account's real rate.
const FEE_PERCENT = 2.9;
const FEE_FIXED_CENTS = 30;
const grossUp = (c) => Math.ceil((c + FEE_FIXED_CENTS) / (1 - FEE_PERCENT / 100));
const SITE = 'adityaaswani.com';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/data/support-links.json');

const PRODUCTS = {
  one_time: { name: "Support Aditya's work", description: 'A one-time gift toward hosting, transcription GPUs and time for free projects.' },
  monthly: { name: 'Monthly support', description: 'A monthly gift toward hosting, transcription GPUs and time for free projects.' },
  monthly_fees: { name: 'Monthly support (plus card fees)', description: 'A monthly gift toward hosting, transcription GPUs and time for free projects. Includes a small amount to cover card fees, so the full chosen amount reaches Aditya.' },
};

const TIERS = [300, 500, 1000, 2500];
const ONCE_MIN = 100;
const ONCE_PRESET = 1000;
const ONCE_MAX = 1000000;
const ONCE_AMOUNTS = [500, 1000, 2500, 5000];

const PRICES = [
  { key: 'once_custom', product: 'one_time', custom: true, type: 'once' },
  ...TIERS.map((c) => ({ key: `monthly_${c / 100}`, product: 'monthly', amount: c, interval: 'month', type: 'monthly' })),
  ...TIERS.map((c) => ({ key: `monthly_${c / 100}_fees`, product: 'monthly_fees', amount: grossUp(c), interval: 'month', type: 'monthly' })),
];

function readEnvKey(file, name) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`Cannot read ${file}`);
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^export\s+/, '');
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1 || line.slice(0, eq).trim() !== name) continue;
    let value = line.slice(eq + 1).trim();
    const q = value[0];
    if ((q === '"' || q === "'") && value.indexOf(q, 1) > 0) value = value.slice(1, value.indexOf(q, 1));
    else value = value.replace(/\s+#.*$/, '');
    return value;
  }
  throw new Error(`${name} not found in ${file}`);
}

const KEY = readEnvKey(ENV_FILE, KEY_NAME);
const expectedPrefix = LIVE ? /^(sk|rk)_live_/ : /^(sk|rk)_test_/;
if (!expectedPrefix.test(KEY)) {
  throw new Error(`${KEY_NAME} in ${ENV_FILE} is not a ${MODE}-mode key; refusing to continue.`);
}

function encode(params, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object') encode(v, name, out);
    else out.append(name, String(v));
  }
  return out;
}

async function stripe(method, path, params) {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  const init = { method, headers: { Authorization: `Bearer ${KEY}` } };
  if (params && method === 'GET') url.search = encode(params).toString();
  else if (params) {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = encode(params).toString();
  }
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(`Stripe ${method} ${path}: ${body.error?.message ?? res.status}`);
  return body;
}

async function listAll(path, params = {}) {
  const items = [];
  let starting_after;
  for (;;) {
    const page = await stripe('GET', path, { limit: 100, ...params, starting_after });
    items.push(...page.data);
    if (!page.has_more) return items;
    starting_after = page.data.at(-1).id;
  }
}

const ours = (obj, key) => obj.metadata?.site === SITE && obj.metadata?.support_key === key;

async function ensureProduct(key) {
  const existing = (await listAll('products', { active: true })).find((p) => ours(p, key));
  if (existing) return existing;
  return stripe('POST', 'products', { ...PRODUCTS[key], metadata: { site: SITE, support_key: key } });
}

async function ensurePrice(spec, productId) {
  const existing = (await listAll('prices', { product: productId, active: true })).find((p) => ours(p, spec.key));
  if (existing) return existing;
  const params = { product: productId, currency: 'usd', metadata: { site: SITE, support_key: spec.key } };
  if (spec.custom) params.custom_unit_amount = { enabled: true, minimum: ONCE_MIN, preset: ONCE_PRESET };
  else params.unit_amount = spec.amount;
  if (spec.interval) params.recurring = { interval: spec.interval };
  return stripe('POST', 'prices', params);
}

async function ensureLink(spec, priceId, links) {
  const redirectUrl = `${SUCCESS_BASE}?type=${spec.type}`;
  const afterCompletion = { type: 'redirect', redirect: { url: redirectUrl } };
  const customText = { submit: { message: SUBMIT_MESSAGE } };
  const submitType = spec.type === 'once' ? 'donate' : undefined;
  const existing = links.find((l) => ours(l, spec.key));
  if (existing) {
    const drift = {};
    if (existing.after_completion?.redirect?.url !== redirectUrl) drift.after_completion = afterCompletion;
    if (existing.custom_text?.submit?.message !== SUBMIT_MESSAGE) drift.custom_text = customText;
    const submitDrift = submitType && existing.submit_type !== submitType;
    if (submitDrift) drift.submit_type = submitType;
    if (!Object.keys(drift).length) return existing;
    try {
      return await stripe('POST', `payment_links/${existing.id}`, drift);
    } catch (err) {
      if (!submitDrift) throw err;
      console.log(`submit_type not updatable on ${spec.key} (${err.message}); creating replacement`);
      const fresh = await stripe('POST', 'payment_links', {
        line_items: { 0: { price: priceId, quantity: 1 } },
        after_completion: afterCompletion,
        custom_text: customText,
        submit_type: submitType,
        metadata: { site: SITE, support_key: spec.key },
      });
      await stripe('POST', `payment_links/${existing.id}`, { active: false });
      return fresh;
    }
  }
  return stripe('POST', 'payment_links', {
    line_items: { 0: { price: priceId, quantity: 1 } },
    after_completion: afterCompletion,
    custom_text: customText,
    submit_type: submitType,
    metadata: { site: SITE, support_key: spec.key },
  });
}

async function ensurePortal() {
  const params = {
    business_profile: { headline: 'Manage your monthly support for Aditya Aswani' },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'immediately' },
    },
    login_page: { enabled: true },
  };
  const all = await listAll('billing_portal/configurations');
  const existing = all.find((c) => ours(c, 'portal'));
  if (existing) {
    if (existing.login_page?.url && existing.active) return existing;
    return stripe('POST', `billing_portal/configurations/${existing.id}`, { ...params, active: true });
  }
  return stripe('POST', 'billing_portal/configurations', { ...params, metadata: { site: SITE, support_key: 'portal' } });
}

const products = {};
for (const key of Object.keys(PRODUCTS)) products[key] = await ensureProduct(key);

const links = await listAll('payment_links', { active: true });
const urls = {};
for (const spec of PRICES) {
  const price = await ensurePrice(spec, products[spec.product].id);
  const link = await ensureLink(spec, price.id, links);
  urls[spec.key] = link.url;
  console.log(`${spec.key.padEnd(16)} ${link.url}`);
}

const portal = await ensurePortal();
const portalUrl = portal.login_page?.url;
if (!portalUrl) throw new Error('Stripe returned no login_page.url for the portal configuration; stopping.');
console.log(`portal           ${portalUrl}`);

// Preserve the hand-maintained Worker checkout config across regenerations.
let existingCheckout;
try { existingCheckout = JSON.parse(readFileSync(OUT, 'utf8')).checkout; } catch { /* first run */ }

const result = {
  mode: MODE,
  fees: { percent: FEE_PERCENT, fixedCents: FEE_FIXED_CENTS },
  portalUrl,
  oneTime: { url: urls.once_custom, minCents: ONCE_MIN, maxCents: ONCE_MAX, amounts: ONCE_AMOUNTS, defaultCents: ONCE_PRESET },
  monthly: {
    defaultCents: 500,
    tiers: TIERS.map((c) => ({ cents: c, url: urls[`monthly_${c / 100}`], feeCents: grossUp(c), feeUrl: urls[`monthly_${c / 100}_fees`] })),
  },
  ...(existingCheckout ? { checkout: existingCheckout } : {}),
};
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log(`wrote src/data/support-links.json (mode: ${MODE})`);
