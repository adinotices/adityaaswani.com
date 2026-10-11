# 2026-10-11 — mobile hamburger menu (header)

Preview: https://mobile-nav.adityaaswani-preview.pages.dev (Cloudflare Pages, `adityaaswani-preview`, noindex). Verified with Steel (puppeteer-core) and axe-core 4.10.2. Lighthouse 12.8 CLI on the box (the PageSpeed Insights API was over its daily quota).

## Breakpoint (measured on the live site at 1280 px)

Wordmark 101 px + links 341 px + actions 235 px + 2 × 32 px gaps + 40 px page padding = **≈781 px** for one row. The header already switched to two rows below 820 px, so the menu collapses at `max-width: 819.98px`. At ≥ 820 px nothing changes.

## Steel checks: 124/124 pass

- 360, 390, 430 and 768 px, light and dark, closed and open: the wordmark, Support pill, theme toggle and menu button sit on one row with the menu button rightmost. The Support pill stays on one line. The open panel is full-width under the bar, with 5 links each ≥ 44 px tall (52 px). Focus goes to "Building" on open. Escape closes and returns focus to the button. A tap outside closes. Resizing to 1280 closes and shows the inline links. Horizontal overflow is 0 everywhere.
- Tapping a link closes the menu: "Contact" navigates, and "#writing" scrolls to the section with the menu closed.
- On /contact, the current page is marked: clay-ink text, a 4 px clay bar and a soft background.
- Keyboard: Tab reaches the button and shows a 3 px focus ring. Enter opens with focus on the first link, and Tab past the last link closes.
- With `prefers-reduced-motion: reduce`, transition and animation durations are ≤ 0.01 s.
- Without JavaScript, at 390 and 360 px, the current wrapped links show, the menu button is hidden, and there is no overflow.
- The desktop header at 1280, 1024 and 820 px, light and dark, is **pixel-identical to live**: 0 differing pixels.

## axe (wcag2a/aa, 21a/aa, 22aa, best-practice): 0 violations

/ at 390 px (light and dark, closed and open), /contact at 390 px (light and dark, open), and / at 1280 px (light and dark).

## Lighthouse (median of 3)

| Page | Preview mobile (perf/a11y/bp/seo) | Live mobile | Preview desktop |
|---|---|---|---|
| / | 98/100/100/69* | 98/100/100/100 | 100/100/100/69* |
| /contact/ | 99/100/100/66* | 98/100/100/100 | 100/100/100/66* |

\* The preview's SEO score is low only because it is deliberately noindex (meta robots and X-Robots-Tag). CLS is 0.000 on every run, because the `js` class is set in the head before first paint, so the collapsed header never shifts.

## Fixed along the way

- No header link was ever marked as the current page: static builds see `/contact/`, but the nav hrefs are `/contact`. The comparison now ignores the trailing slash.
- At 421–440 px the full "Support my work" label wrapped once the menu button was added. On JS-enabled pages below 520 px the pill now shows "Support", and below 386 px it shows just the heart, keeping "Support my work" as its accessible name.

## Not covered

- /links has its own layout without this header, so it is unchanged.

Screenshots: `img/2026-10-11-mobilenav-*.png`.
