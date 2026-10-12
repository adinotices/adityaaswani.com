// Run before `astro build`. Never exits non-zero because of a feed problem.
import { mkdir, rm, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadEssays } from './essays-feed.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const FEED_URL = 'https://essays.adityaaswani.com/feed';
const generated = `${root}src/data/essays.generated.json`;
const coverDir = `${root}public/writing/feed`;

async function clearDir(dir) {
  await mkdir(dir, { recursive: true });
  for (const f of await readdir(dir)) await rm(`${dir}/${f}`, { recursive: true, force: true });
}

try {
  const sharp = (await import('sharp')).default;
  await clearDir(coverDir);
  const result = await loadEssays({
    feedUrl: FEED_URL,
    fallback: null,
    coverDir,
    coverUrlPrefix: '/writing/feed',
    resizeImage: (buf) => sharp(buf).resize(800, 500, { fit: 'cover' }).webp({ quality: 72 }).toBuffer(),
  });
  if (result.source === 'feed') {
    await writeFile(generated, JSON.stringify({ source: 'feed', fetchedAt: new Date().toISOString(), essays: result.essays }, null, 2) + '\n');
  } else {
    await rm(generated, { force: true });
    await clearDir(coverDir);
  }
} catch (err) {
  console.log(`[essays] source=fallback (site.ts) reason=${err && err.message ? err.message : err}`);
  try { await rm(generated, { force: true }); } catch {}
}
process.exit(0);
