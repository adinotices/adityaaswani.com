# Design previews

The six design variants of the home page (Editorial Light, Editorial Night, Zine, Mincho, 16-Bit, Shounen) and their index page are not on adityaaswani.com. They were removed from the public site on 2026-10-13 (review item AA-22, Aditya's call). They live on the `adityaaswani-preview` Cloudflare Pages project, which is noindex and has no analytics:

- Index: https://design-previews.adityaaswani-preview.pages.dev/previews/
- Variants: `/preview/`, `/preview-dark/`, `/preview-brutalist/`, `/preview-japanese/`, `/preview-pixel/`, `/preview-anime/` on the same host.

The old adityaaswani.com URLs return GitHub Pages' 404, which is the site's own 404 page. GitHub Pages cannot send a 301 or 410. The pages were already noindex and out of the sitemap, so a meta-refresh page would only have added a soft 200.

## Where the source lives

- `design-previews/pages/`: the seven `.astro` pages. They are outside `src/pages/`, so `npm run build` never ships them.
- `design-previews/data/previewContent.ts`: their content. It is derived from `src/data/site.ts` (products, meditation) and the Substack feed (latest three essays), so a rebuild always shows the current products and essays.
- `scripts/build-design-previews.mjs`: copies the repo to a temp directory, adds both folders to `src/`, and runs the normal build with `PUBLIC_PREVIEW=1`. It writes `dist-previews/` (gitignored) with a `_headers` file that sends `X-Robots-Tag: noindex`. The current site is built alongside, so the variants' nav links resolve and can be compared with the live pages.
- `scripts/design-previews-axe.mjs`: an axe-core 4.10.2 pass over the seven pages at 390 px and 1280 px, run in a Steel browser.

## Cadence: quarterly

The refresh runs every quarter: 2027-01-13 first, then each April 13, July 13, October 13 and January 13. The head session's quarterly reminder is in `~/repos/DECISIONS-TODO.md` ("adityaaswani.com design previews refresh"), and it points here. Each refresh keeps the variants comparable with the live site: same content, current nav, current copy.

1. **Bring the hand-written parts up to date.** Content from `previewContent.ts` updates itself. The rest is markup in each variant, so diff it against the live site:
   - Nav: each variant hard-codes its own nav (e.g. `<nav class="nav">` in `preview.astro`). Match the items and order to `nav` and `support` in `src/data/site.ts`.
   - Hero and intro copy: match `identity` in `src/data/site.ts` and the live home page.
   - Dated strings: "Spring 2026" in `previews.astro`, `preview-brutalist.astro` and `preview-japanese.astro`, and the © years in the footers.
2. **Build:**

       npm ci
       npm run build:previews     # prints "7 variant pages in dist-previews/" and fails otherwise

3. **Deploy** to the stable `design-previews` alias. Never create a project, never attach a domain. The token is parsed from the sutam `.env` and never printed:

       export CLOUDFLARE_API_TOKEN="$(node -e 'const {parseEnv}=require("node:util");process.stdout.write(parseEnv(require("fs").readFileSync(process.env.HOME+"/repos/sutam/.env","utf8")).CLOUDFLARE_API_TOKEN||"")')"
       npx wrangler@4 pages deploy dist-previews --project-name adityaaswani-preview --branch design-previews --commit-dirty=true

   Check that the output shows a new deployment id, and that `/previews/` and each variant return 200 on the alias.
4. **axe:**

       export STEEL_API_KEY=...   # parsed the same way from an .env that has it (e.g. ~/repos/sutam-gcp/.env)
       node scripts/design-previews-axe.mjs > docs/audits/<date>-design-previews/axe.json

   It borrows puppeteer-core from `~/repos/audits/font-size-tools` (`AUDIT_DEPS` overrides that). The variants are design mockups and sit outside the site's 0-violation bar. Compare against the previous quarter, and report any new violations.
5. **PSI** (mobile) on `/preview/` and the variant Aditya is leaning towards, via pagespeed.web.dev in Steel under `flock psi.lock`, as in `~/repos/WEB-AUDITS.md`. SEO reads low because the alias is noindex, so ignore it.
6. **Report:** add a section with the links above, the axe table and the PSI scores to the quarterly report. Add a row to `docs/audits/README.md`.

## Baseline (2026-10-13, deployment 49c96c04, axe-core 4.10.2, Steel)

| Page | 390 px | 1280 px |
|---|---|---|
| /previews/ | color-contrast 8 | color-contrast 8 |
| /preview/ | 0 | 0 |
| /preview-dark/ | 0 | 0 |
| /preview-brutalist/ | color-contrast 4, region 1 | color-contrast 4, region 1 |
| /preview-japanese/ | 0 | 0 |
| /preview-pixel/ | color-contrast 1 | color-contrast 1 |
| /preview-anime/ | color-contrast 9 | color-contrast 10 |

Full results: `docs/audits/2026-10-13-design-previews/axe.json`. PSI was not run on the variants for the baseline. The first quarterly refresh records it.
