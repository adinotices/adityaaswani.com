// Build-time loader for the latest essays from the Substack RSS feed.
// Pure ESM, no dependencies. Image resizing is injected by the caller.
import { mkdir, writeFile } from 'node:fs/promises';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(s) {
  return s.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos));/g, (m, dec, hex, name) => {
    if (name) return ENTITIES[name];
    const cp = dec ? parseInt(dec, 10) : parseInt(hex, 16);
    try { return String.fromCodePoint(cp); } catch { return m; }
  });
}

function stripTags(s) {
  return s.replace(/<[^>]*>/g, '');
}

// Returns inner text of the first <tag>, CDATA unwrapped; `html` mode strips tags.
function tagText(block, tag, { html = false } = {}) {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  if (!m) return '';
  let out = '';
  let rest = m[1];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
  let last = 0;
  let c;
  const piece = (plain) => (html ? decodeEntities(stripTags(plain)) : decodeEntities(plain));
  while ((c = re.exec(rest))) {
    out += piece(rest.slice(last, c.index));
    out += piece(c[1]); // CDATA is decoded too: Substack emits entities inside it
    last = c.index + c[0].length;
  }
  out += piece(rest.slice(last));
  return out.trim();
}

function attr(tagSrc, name) {
  const m = tagSrc.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`));
  return m ? decodeEntities(m[1] ?? m[2]) : null;
}

function cleanUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return null;
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

export function parseFeed(xml, { limit = 6 } = {}) {
  if (typeof xml !== 'string' || !/<rss[\s>]/.test(xml) || !/<channel[\s>]/.test(xml)) {
    throw new Error('Not an RSS document with a <channel>');
  }
  const items = [];
  for (const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const title = tagText(block, 'title');
    const url = cleanUrl(tagText(block, 'link'));
    const ts = Date.parse(tagText(block, 'pubDate'));
    if (!title || !url || Number.isNaN(ts)) continue;
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop();
    if (!slug) continue;
    let coverUrl = null;
    const enc = block.match(/<enclosure\b[^>]*>/);
    if (enc) {
      const type = attr(enc[0], 'type') || '';
      const eu = attr(enc[0], 'url');
      if (eu && /^image\//i.test(type) && /^https:\/\//i.test(eu)) coverUrl = eu;
    }
    items.push({
      ts,
      essay: {
        title,
        subtitle: tagText(block, 'description', { html: true }),
        url,
        date: new Date(ts).toISOString().slice(0, 10),
        coverUrl,
        slug,
      },
    });
  }
  if (items.length === 0) throw new Error('Feed contains no valid items');
  items.sort((a, b) => b.ts - a.ts);
  return items.slice(0, limit).map((i) => i.essay);
}

export async function loadEssays({
  feedUrl,
  fetchImpl = fetch,
  fallback,
  coverDir,
  coverUrlPrefix,
  resizeImage,
  limit = 6,
  timeoutMs = 10000,
  log = console.log,
} = {}) {
  try {
    const res = await fetchImpl(feedUrl, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`Feed request failed: HTTP ${res.status}`);
    const parsed = parseFeed(await res.text(), { limit });
    await mkdir(coverDir, { recursive: true });
    const essays = [];
    for (const { coverUrl, slug, ...rest } of parsed) {
      let cover = null;
      if (coverUrl) {
        const cres = await fetchImpl(coverUrl, { signal: AbortSignal.timeout(timeoutMs) });
        if (!cres.ok) throw new Error(`Cover download failed for ${slug}: HTTP ${cres.status}`);
        const buf = Buffer.from(await cres.arrayBuffer());
        const out = await resizeImage(buf);
        await writeFile(`${coverDir}/${slug}.webp`, out);
        cover = `${coverUrlPrefix}/${slug}.webp`;
      }
      essays.push({ ...rest, cover });
    }
    log(`[essays] source=feed (${essays.length} posts from ${feedUrl})`);
    return { source: 'feed', essays };
  } catch (err) {
    const reason = err && err.message ? err.message : String(err);
    log(`[essays] source=fallback (site.ts) reason=${reason}`);
    return { source: 'fallback', essays: fallback, reason };
  }
}
