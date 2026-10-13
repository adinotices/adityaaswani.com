# Audits

PageSpeed Insights / Lighthouse + axe results per ~/repos/WEB-AUDITS.md. Newest first.

| Date | Page | Where | Perf (m/d) | A11y | Best pr. | SEO | axe serious/critical |
|---|---|---|---|---|---|---|---|
| 2026-10-13 (AA-22, design previews moved off prod) | 7 design variants on design-previews.adityaaswani-preview.pages.dev | preview (Pages), Steel + axe-core 4.10.2 | not run | n/a | n/a | n/a (noindex preview) | mockups, outside the bar: /previews/ 8, brutalist 4+1, pixel 1, anime 9–10 nodes; others 0 ([DESIGN-PREVIEWS](../DESIGN-PREVIEWS.md)). Prod dist byte-identical to main minus the 7 pages |
| 2026-10-12 (review fixes, Astro 7) | / and /support (PSI); 7 pages + Other state (axe) | preview (Pages), Steel + axe-core 4.10.2, PSI web | / 100, /support 100 (m) | 100 | 100 | n/a (noindex preview) | 0 in 32 states (390/1280 × light/dark); 0 CSP violations |
| 2026-10-11 (theme in menu) | header: theme toggle moved into the mobile menu, / | preview (Pages), Steel + axe-core 4.10, Lighthouse 12 | 99 / n/a | 100 | 100 | n/a (noindex preview) | 0 at 360/390/430/768 × light/dark × open/closed, and at 1280 |
| 2026-10-11 (mobile nav) | header hamburger menu, / and /contact | preview (Pages), Steel + axe-core 4.10.2, Lighthouse 12.8 | 98–99 / 100 | 100 | 100 | n/a (noindex preview) | 0 at 390 + 1280 px × light/dark × open/closed |
| 2026-10-11 (v2) | /support redesign + whole site (header button) | local build, Lighthouse 12.8 + axe-core 4.14 | /support 100 / 100; home 67 (m) | 100 | 100 (/support); 79 home, /links | 100 | 0 on all 10 page states × 2 themes × 2 viewports (after fixes) |
| 2026-10-11 | /support, /support/thanks | local build, Lighthouse CLI 12 + @axe-core/cli 4.10 | 100 / 100 | 100 | 100 | 100 | 0 (after fix) |

## 2026-10-11 06:27 UTC — live site after the C redesign and the support rewrite (head session)

| Page | Lighthouse mobile (perf/a11y/bp/seo) | Lighthouse desktop | axe (wcag2a/aa/21a/21aa/22aa/best-practice) |
|---|---|---|---|
| / | 97/100/100/100 | 100/100/100/100 | 0 violations |
| /support | 97/100/100/100 | 100/100/100/100 | 0 violations |
| /links | 98/100/100/100 | 100/100/100/100 | 0 violations |
| /learn-meditation | 98/100/100/91 → link-text fixed in this commit | 100/100/100/91 | 0 violations |
| /contact | 98/100/100/100 | 100/100/100/100 | 0 violations |

Home mobile: LCP 2.4 s, FCP 1.7 s, TBT 0 ms, CLS 0. PageSpeed Insights API was over its daily quota (the weekly audit cron used it); Lighthouse 12 CLI on the box is the same engine. Raw JSON: box ~/repos/orchestrator-logs/adityaaswani-audit-20261011-0627/.
