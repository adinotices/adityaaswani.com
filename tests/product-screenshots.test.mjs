// Home "Things I'm building" card screenshots (HOME-13, PAGE-05; AA-28). Reads src/data/site.ts directly
// (Node strips the types), so it needs no build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { products } from '../src/data/site.ts';

const PUBLIC = new URL('../public/', import.meta.url).pathname;
const shots = products.filter((p) => p.screenshot);

// Byte budgets: the sizes of the 2026-10-11 captures. A retake must fit, so PSI on / does not regress.
const BUDGET = {
  'savethedogs-1280': 56726, 'savethedogs-640': 23310,
  'sutam-1280': 24116, 'sutam-640': 9286,
  'pausepal-1280': 48086, 'pausepal-640': 19494,
  'amberhall-1280': 31594, 'amberhall-640': 11132,
};

// Width and height from a WebP header (lossy VP8, lossless VP8L or extended VP8X).
export function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') throw new Error('not a WebP file');
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
  }
  throw new Error(`unknown WebP chunk ${chunk}`);
}

test('webpSize reads the header of a lossy and a lossless WebP', () => {
  // 2x3 lossy (VP8) and 5x7 lossless (VP8L) headers, padded; only the header bytes matter.
  const vp8 = Buffer.alloc(40);
  vp8.write('RIFF', 0); vp8.write('WEBP', 8); vp8.write('VP8 ', 12); vp8.writeUInt16LE(2, 26); vp8.writeUInt16LE(3, 28);
  assert.deepEqual(webpSize(vp8), { width: 2, height: 3 });
  const vp8l = Buffer.alloc(40);
  vp8l.write('RIFF', 0); vp8l.write('WEBP', 8); vp8l.write('VP8L', 12); vp8l.writeUInt32LE((5 - 1) | ((7 - 1) << 14), 21);
  assert.deepEqual(webpSize(vp8l), { width: 5, height: 7 });
  assert.throws(() => webpSize(Buffer.from('not an image at all')), /not a WebP/);
});

test('every product with a site has a screenshot', () => {
  // Coming-soon cards without a site (Samvara) show a motif instead.
  for (const p of products) if (p.url) assert.ok(p.screenshot, `${p.slug}: has a url but no screenshot`);
  assert.ok(shots.length >= 4);
});

test('HOME-13 every product screenshot exists at 640x400 and 1280x800 as WebP, named for its product', () => {
  for (const { slug, screenshot } of shots) {
    for (const [key, w, h] of [['src640', 640, 400], ['src1280', 1280, 800]]) {
      const src = screenshot[key];
      assert.equal(src, `/products/${slug}-${w}.webp`, `${slug}.${key}`);
      const file = PUBLIC + src.slice(1);
      assert.ok(existsSync(file), `${src} is missing from public/`);
      assert.deepEqual(webpSize(readFileSync(file)), { width: w, height: h }, `${src} dimensions (the card reserves 16:10)`);
    }
  }
});

test('HOME-13 every product screenshot has a non-empty alt that names the product and quotes its hero text', () => {
  const alts = new Set();
  for (const { slug, name, screenshot } of shots) {
    const alt = screenshot.alt.trim();
    assert.ok(alt.length > 0, `${slug}: empty alt`);
    assert.ok(alt.startsWith(name), `${slug}: alt should start with "${name}": ${alt}`);
    assert.match(alt, /“[^”]+”/, `${slug}: alt should quote the hero text shown in the screenshot`);
    assert.ok(!alts.has(alt), `${slug}: alt duplicates another card's`);
    alts.add(alt);
  }
});

test('PAGE-05 every product screenshot stays under its byte budget', () => {
  for (const { slug } of shots) {
    for (const w of [640, 1280]) {
      const key = `${slug}-${w}`;
      assert.ok(BUDGET[key], `${key}: no byte budget; add one (the size of its first capture)`);
      const size = statSync(`${PUBLIC}products/${key}.webp`).size;
      assert.ok(size <= BUDGET[key], `${key}.webp is ${size} B, over its ${BUDGET[key]} B budget`);
    }
  }
});
