// Astro integration: after the build, fills each page's meta CSP with the sha256 hashes of the
// inline scripts actually in that page, so a copy edit can never silently break a hash.
// Layout.astro emits <meta http-equiv="Content-Security-Policy" content="__CSP__"> right after
// the charset (production builds only). Pages not built on Layout (the /zoom redirect and the
// /preview* design pages) get the same policy and the referrer meta added here, so every page in
// dist carries both. The /preview* pages also load Google Fonts and the Substack embed; those
// origins are allowed only on the pages that use them (AA-S13).
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CSP_PLACEHOLDER = '__CSP__';
export const REFERRER_META = '<meta name="referrer" content="strict-origin-when-cross-origin">';

export const GOOGLE_FONTS = { style: 'https://fonts.googleapis.com', font: 'https://fonts.gstatic.com' };
export const SUBSTACK_EMBED = 'https://adityaaswani.substack.com';
// The embed 301s to the custom domain, and frame-src is checked again after a redirect.
export const SUBSTACK_FRAME_SRC = [SUBSTACK_EMBED, 'https://essays.adityaaswani.com'];

export function policy(hashes, { googleFonts = false, substackEmbed = false } = {}) {
  return [
    "default-src 'self'",
    ["script-src 'self'", ...hashes.map((h) => `'${h}'`), 'https://plausible.io', 'https://static.cloudflareinsights.com'].join(' '),
    "connect-src 'self' https://plausible.io https://cloudflareinsights.com https://sutam.org",
    "img-src 'self' data:",
    ["style-src 'self' 'unsafe-inline'", ...(googleFonts ? [GOOGLE_FONTS.style] : [])].join(' '),
    ["font-src 'self'", ...(googleFonts ? [GOOGLE_FONTS.font] : [])].join(' '),
    ...(substackEmbed ? [['frame-src', ...SUBSTACK_FRAME_SRC].join(' ')] : []),
    "form-action 'self' https://adityaaswani.substack.com",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

// Inline <script> bodies the browser would execute (no src, JavaScript type).
export function inlineScripts(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    if (/\ssrc\s*=/i.test(attrs)) continue;
    const type = attrs.match(/\stype\s*=\s*["']?([^"'\s>]+)/i)?.[1]?.toLowerCase();
    if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) continue;
    out.push(m[2]);
  }
  return out;
}

export const sha256 = (text) => 'sha256-' + createHash('sha256').update(text, 'utf8').digest('base64');

const cspMeta = (content) => `<meta http-equiv="Content-Security-Policy" content="${content}">`;

export function applyCsp(html) {
  let out = html;
  const hashes = () => [...new Set(inlineScripts(out).map(sha256))];
  if (out.includes(CSP_PLACEHOLDER)) {
    out = out.replace(`content="${CSP_PLACEHOLDER}"`, `content="${policy(hashes())}"`);
  } else if (!out.includes('http-equiv="Content-Security-Policy"')) {
    // Standalone page: insert the policy right after the charset (else first), before anything it governs.
    const meta = cspMeta(policy(hashes(), {
      googleFonts: out.includes(`href="${GOOGLE_FONTS.style}/`),
      substackEmbed: out.includes(`src="${SUBSTACK_EMBED}/`),
    }));
    const charset = /<meta charset="[^"]*">/i;
    out = charset.test(out) ? out.replace(charset, (m) => m + meta)
      : /^<!doctype html>/i.test(out) ? out.replace(/^<!doctype html>/i, (m) => m + meta) : meta + out;
  }
  if (!out.includes('<meta name="referrer"')) {
    // After the CSP meta (which must stay first after the charset), else after the charset, else first.
    const anchor = [/<meta http-equiv="Content-Security-Policy" content="[^"]*">/, /<meta charset="[^"]*">/i, /^<!doctype html>/i]
      .find((re) => re.test(out));
    out = anchor ? out.replace(anchor, (m) => m + REFERRER_META) : REFERRER_META + out;
  }
  return out;
}

async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

export default function csp() {
  return {
    name: 'inline-script-csp',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const files = await htmlFiles(fileURLToPath(dir));
        let withCsp = 0;
        for (const file of files) {
          const html = await readFile(file, 'utf8');
          const out = applyCsp(html);
          if (out.includes(CSP_PLACEHOLDER)) throw new Error(`CSP placeholder left in ${file}`);
          if (out !== html) await writeFile(file, out);
          if (out.includes('http-equiv="Content-Security-Policy"')) withCsp++;
        }
        logger.info(`CSP hashes written to ${withCsp} of ${files.length} pages`);
      },
    },
  };
}
