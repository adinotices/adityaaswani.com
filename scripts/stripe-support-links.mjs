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
const SUCCESS_URL = 'https://adityaaswani.com/support/thanks';
const SITE = 'adityaaswani.com';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/data/support-links.json');

const PRODUCTS = {
  one_time: { name: "Support Aditya's work", description: 'A one-time gift toward hosting, transcription GPUs and time for free projects.' },
  monthly: { name: 'Monthly support', description: 'A monthly gift toward hosting, transcription GPUs and time for free projects.' },
};

const PRICES = [
  { key: 'once_5', product: 'one_time', label: '$5', amount: 500 },
  { key: 'once_20', product: 'one_time', label: '$20', amount: 2000 },
  { key: 'once_50', product: 'one_time', label: '$50', amount: 5000 },
  { key: 'once_custom', product: 'one_time', label: 'Custom', custom: true },
  { key: 'monthly_5', product: 'monthly', label: '$5 / month', amount: 500, interval: 'month' },
  { key: 'monthly_10', product: 'monthly', label: '$10 / month', amount: 1000, interval: 'month' },
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
  if (spec.custom) params.custom_unit_amount = { enabled: true, minimum: 100, preset: 1000 };
  else params.unit_amount = spec.amount;
  if (spec.interval) params.recurring = { interval: spec.interval };
  return stripe('POST', 'prices', params);
}

async function ensureLink(spec, priceId, links) {
  const afterCompletion = { type: 'redirect', redirect: { url: SUCCESS_URL } };
  const existing = links.find((l) => ours(l, spec.key));
  if (existing) {
    if (existing.after_completion?.redirect?.url !== SUCCESS_URL) {
      return stripe('POST', `payment_links/${existing.id}`, { after_completion: afterCompletion });
    }
    return existing;
  }
  return stripe('POST', 'payment_links', {
    line_items: { 0: { price: priceId, quantity: 1 } },
    after_completion: afterCompletion,
    metadata: { site: SITE, support_key: spec.key },
  });
}

const products = {};
for (const key of Object.keys(PRODUCTS)) products[key] = await ensureProduct(key);

const links = await listAll('payment_links', { active: true });
const result = { mode: MODE, oneTime: [], monthly: [] };
for (const spec of PRICES) {
  const price = await ensurePrice(spec, products[spec.product].id);
  const link = await ensureLink(spec, price.id, links);
  const entry = { key: spec.key, label: spec.label, url: link.url };
  (spec.product === 'monthly' ? result.monthly : result.oneTime).push(entry);
  console.log(`${spec.key.padEnd(12)} ${link.url}`);
}

writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log(`wrote src/data/support-links.json (mode: ${MODE})`);
