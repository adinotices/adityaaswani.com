# 2026-10-11: theme toggle moved into the mobile menu

Aditya asked for this on 2026-10-11 at 14:25 EDT. His phone screenshot showed three circles in the bar: Support, the theme toggle and the menu button. Below 820 px the light/dark toggle now sits in the open menu as a final "Appearance" row. It is the same button, the same `theme` localStorage key and the same behaviour (a light/dark switch with `aria-pressed`, named "Dark mode", inside a group labelled "Appearance"). The bar shows only the wordmark, the Support pill and the menu button. At 820 px and wider nothing changes.

Preview: https://theme-in-menu.adityaaswani-preview.pages.dev (Cloudflare Pages, `adityaaswani-preview`, noindex). Checked with Steel (puppeteer-core) and axe-core 4.10, plus the Lighthouse 12 CLI on the box.

## Support pill

Without the 44 px toggle and its 8 px gap, the pill has room again. It shows "Support" from 340 to 439 px, so 360, 390 and 430 px all show the word. It shows "Support my work" from 440 px. It shows only the heart below 340 px (before this change, the heart-only cut-off was 385 px). Its accessible name is "Support my work" throughout.

## Steel checks: 194/196 pass (the 2 failures are an existing issue on live, see below)

- **360, 390, 430 and 768 px, light and dark, menu closed:** the bar has no theme toggle, the menu button is visible and rightmost, and the Support pill shows "Support" on one line. All bar items are vertically centred on one row. There is no horizontal overflow and the Appearance row is hidden. axe finds 0 violations.
- **The same widths and themes, menu open:** the Appearance row is visible and labelled. The toggle is 44 × 44 px and sits inside the viewport. There is no overflow. axe finds 0 violations.
- **Toggle from inside the menu:** the theme flips, it is stored under `theme`, and the menu stays open. `aria-pressed` stays in sync on both toggles (the bar's and the menu's). After a reload, the choice is still applied. All 8 width × theme combinations pass.
- **Keyboard at 390 px:** Enter on the menu button opens the menu and focuses "Building". Tabbing past the 5 links lands on the theme toggle, which shows a 3 px focus ring. Enter switches to dark and the menu stays open. Space switches back. Tab past the toggle closes the menu. Escape closes the menu and returns focus to the menu button.
- **Without JavaScript at 390 px:** the Appearance row and the menu button are hidden, and there is no overflow. This is the same no-JS fallback as before.
- **Desktop at 1280, 1024 and 820 px, light and dark:** the toggle stays in the bar, and the menu button and Appearance row are hidden. The header is **pixel-identical to live: 0 differing pixels** in all 6 cases. axe finds 0 violations at 1280 px in light and dark.
- **Already on live, not caused by this change:** at 1024 px, the home page overflows by 2 px. The cause is the decorative `svg.sprig` on the hero portrait, which sticks out past the right edge when the viewport is about 1009 px wide. Live shows the same overflow. This is left as is, because the brief asks for desktop to stay unchanged. It is a one-line fix if Aditya wants it.

## Lighthouse mobile, preview home page, 3 runs

98/100/100/69, 99/100/100/69, 99/100/100/69. CLS was 0.000 every time. The SEO score is 69 only because the preview is deliberately noindex.

## Tests

`npm test`: 38/38 pass. The toggle logic moved to `src/scripts/theme-toggle.js`, and `tests/theme-toggle.test.mjs` covers it (5 tests). There are 2 new mobile-nav tests: tapping the in-menu toggle keeps the menu open, and Tab onto it keeps the menu open while Tab past it closes the menu.

Screenshots: `img/2026-10-11-theme-in-menu-*.png`.
