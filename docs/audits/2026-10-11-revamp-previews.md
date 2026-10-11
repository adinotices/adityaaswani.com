# 2026-10-11: site revamp, three design previews (a, b, c)

Three design directions for the revamp, each a complete static build deployed to the Cloudflare Pages project `adityaaswani-preview` (preview builds are `noindex` and don't load Plausible). Nothing is merged; `main` and PR #1 are untouched.

| Variant | Branch / head | URL |
|---|---|---|
| (a) quiet editorial | `revamp-a` e51c94f | https://a.adityaaswani-preview.pages.dev |
| (b) builder's portfolio | `revamp-b` 63401ea | https://b.adityaaswani-preview.pages.dev |
| (c) warm personal | `revamp-c` 70e956e | https://c.adityaaswani-preview.pages.dev |

## axe-core 4.10 via Steel, on the deployed previews

Tags wcag2a/2aa/21a/21aa/22aa/best-practice. Pages: /, /links, /support, /support/thanks, /contact, /learn-meditation, /404, each in light and dark at phone (390×844) and desktop (1280×900) sizes. **84 of 84 runs: 0 violations.** Variant (a) was re-checked on /, /links and /support after its CSS-inlining commit: still 0.

## Lighthouse 12, mobile, against the deployed previews

| Page | Perf | A11y | Best pr. | SEO* | LCP |
|---|---|---|---|---|---|
| a / | 95 → 100 after e51c94f | 100 | 100 | 69 | 2.4 s → 1.5–1.7 s |
| a /links | 99 | 100 | 100 | 69 | 2.0 s |
| a /support | 97 | 100 | 100 | 66 | 2.1 s |
| b / | 100 | 100 | 100 | 69 | 1.2 s |
| b /links | 99 | 100 | 100 | 69 | 1.8 s |
| b /support | 99 | 100 | 100 | 66 | 1.8 s |
| c / | 97 | 100 | 100 | 69 | 2.3 s |
| c /links | 98 | 100 | 100 | 69 | 2.2 s |
| c /support | 98 | 100 | 100 | 66 | 2.1 s |

\*SEO is low only because preview builds are deliberately `noindex` (`is-crawlable`). The other remaining flags: the `/links` → `/links/` trailing-slash redirect on Cloudflare, plus non-scored insights.

For comparison, the current production home scored 67 mobile in the earlier audit, because it serves a 13 MB portrait. All three variants serve 320/640/960 px WebP versions of it instead.

## Deferred

- PSI (pagespeed.web.dev) was not run. Lighthouse CLI against the public preview URLs was used instead; run PSI on the chosen variant once it's on staging/production.
