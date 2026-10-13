// Builds the design variants (design-previews/) for the adityaaswani-preview Cloudflare Pages
// project. They are not part of the public site (AA-22): this copies the repo to a temp dir, adds
// the variant pages and their content module to src/, and runs the normal build there with
// PUBLIC_PREVIEW=1 (noindex, no analytics). The whole current site is built alongside, so the
// variants' nav links resolve and can be compared with the live pages. Output: dist-previews/.
// Deploy: see docs/DESIGN-PREVIEWS.md.
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'dist-previews');
const skip = new Set(['node_modules', 'dist', 'dist-previews', '.git', '.astro', 'design-previews']);

const tmp = await mkdtemp(join(tmpdir(), 'aa-design-previews-'));
try {
  await cp(root, tmp, { recursive: true, filter: (src) => !skip.has(relative(root, src).split('/')[0]) });
  await symlink(join(root, 'node_modules'), join(tmp, 'node_modules'), 'dir');
  await cp(join(root, 'design-previews/pages'), join(tmp, 'src/pages'), { recursive: true });
  await cp(join(root, 'design-previews/data'), join(tmp, 'src/data'), { recursive: true });

  execFileSync('npm', ['run', 'build'], { cwd: tmp, stdio: 'inherit', env: { ...process.env, PUBLIC_PREVIEW: '1' } });
  // Cloudflare Pages reads _headers; the meta robots tag only covers Layout pages.
  await writeFile(join(tmp, 'dist/_headers'), '/*\n  X-Robots-Tag: noindex\n');

  await rm(out, { recursive: true, force: true });
  await cp(join(tmp, 'dist'), out, { recursive: true });
  const variants = (await readdir(out)).filter((n) => /^previews?(-|$)/.test(n)).sort();
  console.log(`[design-previews] ${variants.length} variant pages in dist-previews/: ${variants.join(', ')}`);
  if (variants.length !== 7) throw new Error('expected 7 variant pages (/previews/ plus 6 designs)');
} finally {
  await rm(tmp, { recursive: true, force: true });
}
