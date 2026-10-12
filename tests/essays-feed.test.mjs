import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFeed, loadEssays } from '../scripts/essays-feed.mjs';

const read = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const good = read('substack-feed.xml');
const broken = read('substack-feed-broken.xml');
const fallback = [{ title: 'Fallback', subtitle: '', url: 'https://x.test/p/f', date: '2020-01-01', cover: '/f.webp' }];

const res = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
  arrayBuffer: async () => Buffer.from(body),
});
const okFetch = async (url) => (String(url).endsWith('/feed') ? res(good) : res('imgbytes'));
const resize = async (buf) => Buffer.concat([Buffer.from('webp:'), buf]);

async function run(fetchImpl) {
  const dir = await mkdtemp(join(tmpdir(), 'essays-'));
  const lines = [];
  const out = await loadEssays({
    feedUrl: 'https://essays.adityaaswani.com/feed', fetchImpl, fallback,
    coverDir: dir, coverUrlPrefix: '/writing/feed', resizeImage: resize, log: (l) => lines.push(l),
  });
  return { out, dir, lines };
}

test('parseFeed returns 6 newest in order with fields', () => {
  const e = parseFeed(good);
  assert.equal(e.length, 6);
  assert.deepEqual(e.map((x) => x.date), ['2026-06-18', '2026-06-04', '2026-03-29', '2025-11-01', '2025-09-17', '2025-09-09']);
  assert.equal(e[0].title, "I'm Barred From Speaking to at Least 13 Universities");
  assert.equal(e[0].subtitle, 'My Overly Broad Bail Conditions');
  assert.equal(e[0].slug, 'im-barred-from-speaking-to-at-least');
  assert.match(e[0].coverUrl, /^https:\/\/substackcdn\.com\//);
  assert.equal(parseFeed(good, { limit: 2 }).length, 2);
});

test('parseFeed decodes entities and CDATA', () => {
  const e = parseFeed(good);
  const dog = e.find((x) => x.slug === 'a-dog-was-taken-from-my-arms');
  assert.equal(dog.title, 'A dog was taken from my arms & I couldn’t stop it');
  assert.equal(dog.subtitle, 'What happened next & why it matters');
  const rock = e.find((x) => x.slug === 'rock-and-roll-a-note');
  assert.equal(rock.title, 'Rock & Roll — a note');
  assert.equal(rock.subtitle, 'Plain description with <b> entity ’s');
  assert.equal(e.find((x) => x.slug === 'the-day-the-police-brought-tear-gas').subtitle, 'A "peaceful" protest, recounted');
});

test('parseFeed strips query string and hash from urls', () => {
  for (const x of parseFeed(good)) assert.ok(!/[?#]/.test(x.url), x.url);
  assert.equal(parseFeed(good)[0].url, 'https://essays.adityaaswani.com/p/im-barred-from-speaking-to-at-least');
});

test('parseFeed: missing enclosure gives null coverUrl', () => {
  assert.equal(parseFeed(good).find((x) => x.slug === 'rock-and-roll-a-note').coverUrl, null);
});

test('parseFeed rejects non-https urls and invalid items', () => {
  const xml = '<rss><channel><item><title>A</title><link>http://a.test/p/a</link><pubDate>Thu, 18 Jun 2026 14:04:38 GMT</pubDate></item></channel></rss>';
  assert.throws(() => parseFeed(xml), /no valid items/);
});

test('parseFeed throws on broken or non-RSS input', () => {
  assert.throws(() => parseFeed(broken));
  assert.throws(() => parseFeed('<html></html>'), /RSS/);
  assert.throws(() => parseFeed('<rss><channel></channel></rss>'), /no valid items/);
});

test('loadEssays returns feed essays and writes covers', async () => {
  const { out, dir, lines } = await run(okFetch);
  try {
    assert.equal(out.source, 'feed');
    assert.equal(out.essays.length, 6);
    assert.deepEqual(Object.keys(out.essays[0]).sort(), ['cover', 'date', 'subtitle', 'title', 'url']);
    assert.equal(out.essays[0].cover, '/writing/feed/im-barred-from-speaking-to-at-least.webp');
    assert.equal(out.essays.find((x) => x.url.endsWith('rock-and-roll-a-note')).cover, null);
    assert.equal((await readdir(dir)).length, 5);
    assert.ok((await readdir(dir)).includes('im-barred-from-speaking-to-at-least.webp'));
    assert.equal(lines.length, 1);
    assert.match(lines[0], /source=feed/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

for (const [name, fetchImpl, reason] of [
  ['broken feed', async () => res(broken), /RSS|valid/],
  ['HTTP 500', async () => res('err', 500), /500/],
  ['fetch rejection', async () => { throw new Error('ECONNRESET'); }, /ECONNRESET/],
  ['cover download failure', async (u) => (String(u).endsWith('/feed') ? res(good) : res('', 404)), /Cover download failed/],
]) {
  test(`loadEssays falls back on ${name}`, async () => {
    const { out, dir, lines } = await run(fetchImpl);
    try {
      assert.equal(out.source, 'fallback');
      assert.equal(out.essays, fallback);
      assert.match(out.reason, reason);
      assert.equal(lines.length, 1);
      assert.match(lines[0], /source=fallback/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
}
