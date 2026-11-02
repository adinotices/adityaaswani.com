# adityaaswani.com feature matrix

Every user-facing feature of the site, every state it can be in, the edge cases a real visitor hits, and the test that covers each row. Started 2026-10-13 (brief `feature-test-matrix.md`). The model is the Amberhall kick matrix (`~/repos/orchestrator-logs/REPORT-amberhall-kick.md`).

**Rules (AGENTS.md, BOX-RULES):**
- Every feature or fix ships with its rows here and its tests.
- A bug a visitor reports becomes a row *before* it is fixed.
- CI enforces this: `scripts/check-feature-matrix.mjs` fails a PR that changes a feature's files without adding or editing one of that feature's rows. The path map is `docs/testing/feature-paths.json`.

**What "data invariant" means here.** The site is static (GitHub Pages) and has no database. The state that must hold afterwards is:
- the browser's `localStorage` (only `theme`) and cookies (none of ours);
- the exact JSON the page sends to the donate Worker (`https://sutam.org/api/donate/checkout`, which creates the Stripe Checkout Session);
- the Stripe Payment Links and portal URLs in `src/data/support-links.json`;
- the built files in `dist/`.

**Columns:**
- **Was** is what covered the row before 2026-10-13:
  - `NONE` means no test;
  - `unit` means a Node test with a fake DOM (`tests/*.test.mjs`);
  - `build` means a check on `dist/` (`tests/build-output.test.mjs`, `tests/csp.test.mjs`).
- **Test** is what covers it now:
  - `x.spec › ID` is the test whose name starts with ID in `e2e/x.spec.mjs` (Playwright: Chromium, Firefox and WebKit, desktop 1280 px, Pixel 7 and iPhone 14). Web-tablet rows (iPad portrait 820x1180 and landscape 1180x820, Android tablet 800x1280) set the viewport inside the test, so they run in all five projects. Since 2026-10-29 the whole suite also runs as the **web-tablet lane**: `E2E_PROFILE=tablet` swaps the five projects for `tablet-ipad-portrait` (WebKit, 820x1180), `tablet-ipad-landscape` (WebKit, 1180x820) and `tablet-android` (Chromium, 800x1280), all touch. `E2E_PROFILE=ipad-portrait` (or `ipad-landscape`, `android-tablet`) runs one. Tests that need the phone menu key off the viewport (< 820 px), so the Android tablet gets the menu and the iPads the desktop nav;
  - `x.test › name` is in `tests/x.test.mjs`;
  - `NONE` is a gap still open, with the reason.
- `@live` rows call real third-party services. They run in the nightly box run, not in CI.

**How to run:**
- `npm run build && npm run test:e2e` runs all five browser projects against `dist/`. `e2e/serve.mjs` serves it over HTTPS, as GitHub Pages would.
- Add `E2E_LIVE=1` to include the `@live` rows.
- Add `E2E_BASE_URL=https://adityaaswani.com` to test prod. The nightly does both: `~/repos/testing/nightly-adityaaswani.com.sh`.
- `node scripts/check-feature-matrix.mjs --stats` prints the counts below.
- `E2E_PROFILE=tablet npm run test:e2e` runs the web-tablet lane; screenshots go to `E2E_SHOTS_DIR` (default `test-results/tablet-shots/`).
- `node scripts/check-feature-matrix.mjs --summary` and `--gaps <web-desktop|web-phone|web-tablet>` read the JSON reports in `e2e-report/` (one per lane: `e2e.json`, `e2e-tablet.json`) and print coverage per platform; `--sync` rewrites the table below.

## Gaps by feature (ordered by user impact)

Counts are from `--stats` on 2026-10-13, after this run; updated 2026-10-20 (MATRIX-06, MATRIX-07, DEPLOY-09) and 2026-10-20 run 4 (HOME-08–11, A11Y-07: web-tablet hero, AA-27); 2026-10-21 run 5 (HOME-13: product screenshots, AA-28); 2026-10-29 weekly audit (PAGE-10 tablet lane, PAGE-08 now tested, CONTACT-04, DEPLOY-10); 2026-11-01 weekly audit (see MATRIX-TREND); checked against `--stats` on 2026-11-02. Week-on-week numbers: docs/testing/MATRIX-TREND.md.

| # | Feature | Rows | No test before | No test now | Why it ranks here |
|---|---|---|---|---|---|
| 1 | Support: give flow | 45 | 31 | 4 | Money. A broken button loses a gift silently. |
| 2 | Newsletter subscribe | 14 | 14 | 5 | The main call to action on three pages. It was broken in every browser (NEWS-12). |
| 3 | Support: thank-you page | 13 | 12 | 1 | The upsell and the manage-or-cancel link after paying. |
| 4 | Header, mobile menu, footer | 29 | 18 | 1 | Every page, every phone. |
| 5 | Light/dark theme | 13 | 10 | 2 | Every page. A flash or a lost choice is visible at once. |
| 6 | Page rendering and layout | 12 | 10 | 1 | Broken images, sideways scroll, fonts. |
| 7 | Accessibility | 8 | 7 | 1 | Contrast and labels on every page. |
| 8 | Home page content | 15 | 14 | 0 | First impression. |
| 9 | Writing feed (build time) | 9 | 3 | 1 | Wrong or stale essays. Build-time only, so no visitor-facing failure mode. |
| 10 | /links page | 6 | 6 | 1 | The social bio link. |
| 11 | /contact and /learn-meditation | 9 | 9 | 1 | Mail links and booking. |
| 12 | Copy-email buttons | 6 | 1 | 0 | Small. |
| 13 | Security headers and CSP | 9 | 3 | 1 | Silent breakage of other features (NEWS-12 was a CSP gap). |
| 14 | Search and sharing | 10 | 6 | 2 | Indexing and share cards. |
| 15 | 404 and redirects | 5 | 4 | 0 | Stripe's return URL depends on the slash redirect. |
| 16 | Analytics | 8 | 8 | 1 | Owner-facing only. |
| 17 | Build and deploy | 14 | 13 | 0 | Owner-facing; a bad deploy is caught by the nightly. |
| 18 | Design previews (off-site) | 4 | 3 | 2 | Off the public site. |
| 19 | Test matrix upkeep | 9 | 9 | 0 | Keeps this file honest. |
| | **Total** | **238** | **181** | **24** | |

## Coverage by platform

Platforms are web-desktop, web-phone and web-tablet (BOX-RULES 2026-10-20); the site has no native app, so android and ios have no rows. A web row counts as covered on a platform when a test it cites passed in that platform's projects in the last run. Rows that cite only unit or build tests, and the build/CI features (Writing feed, Build and deploy, Design previews, Matrix upkeep), are counted once as platform-independent. `only` in feature-paths.json limits a row to where it can apply (the phone menu, the tablet hero rows).

<!-- coverage-by-platform:start (node scripts/check-feature-matrix.mjs --sync) -->
Last synced 2026-11-01 from the e2e reports of: web-tablet, web-desktop, web-phone.

| Platform | Covered | Applicable | Coverage |
|---|---|---|---|
| web-desktop | 136 | 140 | 97% |
| web-phone | 151 | 161 | 94% |
| web-tablet | 154 | 164 | 94% |
| platform-independent (build, CI, unit) | 48 | 62 | 77% |
| android | – | 0 | not applicable: web-only site, no native app; real-device rows (GIVE-07, MENU-16, A11Y-06) are the monthly fresh-user pass |
| ios | – | 0 | not applicable: web-only site, no native app; real-device rows (GIVE-07, MENU-16, A11Y-06) are the monthly fresh-user pass |
<!-- coverage-by-platform:end -->

## 1. Support: give flow (`/support/`)

The Give card sends `{site:'aditya', amount_cents, interval, cover_fees}` to the donate Worker on sutam.org, which opens Stripe Checkout. Without JS, or when the Worker fails, the visitor falls back to Stripe Payment Links.

**Invariants:**
- `amount_cents` is always the base amount, never the fee-inclusive total. The Worker adds the fee itself, so the Payment Link `feeCents` must equal base + `feeCents(base)`.
- Amounts are always whole cents from 100 to 100000.
- No request is sent for an invalid amount.
- One click sends at most one request.
- The page only ever navigates to `https://checkout.stripe.com/` or a Payment Link from support-links.json.

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| SUP-01 | First visit, JS on | Monthly selected, $5 marked Suggested, button "Give $5 a month", callout and "Cancel anytime" shown, fee box unchecked. The button is a `role=button` with no href, so it can't bypass the Worker. The test badge appears only in test mode. | NONE | support.spec › SUP-01 |
| SUP-02 | Each monthly tier ($3/$5/$10/$25), fees off and on | The button shows the tier price, and with fees the Payment Link fee total ($3.40, $5.46, $10.61, $26.06) | unit | support.spec › SUP-02; donate.test › monthly preset fees equal support-links.json feeCents |
| SUP-03 | Switch to One-time and back | Own ladder with $10 suggested. Every preset labels "Give $X once". The callout and cancel note are hidden. Switching back restores the monthly selection. | NONE | support.spec › SUP-03 |
| SUP-04 | Impact line per amount | Every preset has its own line, and it changes with the amount | NONE | support.spec › SUP-04 |
| SUP-05 | Fee checkbox label | "Add $X to cover card fees, so the full $Y reaches me" tracks the chosen amount in both frequencies | NONE | support.spec › SUP-05 |
| SUP-06 | Fee formula at the edges | fee = ceil((a+30)/(1-0.029)) - a, in integers, for every amount from $1 to $1000 | unit | donate.test › feeCents matches the contract formula across the range; donate.test › feeCents matches the contract examples |
| SUP-07 | Price formatting | $5, $7.50, $12.34 (no ".00" on whole dollars) | unit | donate.test › fmt |
| SUP-08 | Build guard | The build fails if a tier's `feeCents` in support-links.json disagrees with the formula | NONE | NONE (build-time throw in support/index.astro; exercised by every build, no negative test) |
| SUP-10 | Other, nothing typed | Button "Enter an amount", aria-disabled. Click and Enter send nothing. Generic fee label. | NONE | support.spec › SUP-10 |
| SUP-11 | Other: 0.5, 0.99, 1000.01, 5000, 12.345, -5, 1e3 | Range error "between $1 and $1,000", `aria-invalid=true`, Give blocked, no request | unit | support.spec › SUP-11 (7 values); donate.test › parseAmount rejects invalid values |
| SUP-12 | Other: 1, 1000, 7.5, 12.34 | Accepted, no error, button shows the formatted amount | unit | support.spec › SUP-12 (4 values); donate.test › parseAmount accepts valid values |
| SUP-13 | Fix an invalid Other amount | The error clears as soon as the value is valid | NONE | support.spec › SUP-13 |
| SUP-14 | Other typed, switch frequency and back | One-time keeps its own preset (Other box hidden). Back on Monthly the typed value is still there and labelled. | NONE | support.spec › SUP-14 |
| SUP-15 | Other plus fees | Total = amount + fee. Impact line is the nearest tier's. | unit | support.spec › SUP-15; donate.test › nearestLine |
| SUP-16 | Other on a phone | Numeric keypad (`inputmode=decimal`), no sideways scroll | NONE | support.spec › SUP-16; pages.spec › PAGE-02 |
| SUP-20 | No JavaScript | Ladder hidden. The Give button is the $5 monthly Payment Link. The noscript list has the one-time link, then each tier's plain and fee link, in order. The first link opens. | NONE | support.spec › SUP-20 |
| SUP-30 | Manage or cancel | The link is the Worker account's Stripe customer portal | NONE | support.spec › SUP-30 |
| SUP-31 | Project links | Open in a new tab with noopener | NONE | support.spec › SUP-31 |
| SUP-32 | What a gift is (2026-11-01: the copy had no row) | "Not a charitable donation, so it isn't tax-deductible" and "Secure checkout by Stripe." are on the page | NONE | support.spec › SUP-32 |
| SUP-33 | Live-mode money links (2026-11-01: SUP-01 only checked that the badge matches the mode, so a test-mode file would have shipped with every test green) | `mode` is `live`, no Stripe URL has `/test_`, no test badge, on the build and on prod | NONE | support.spec › SUP-33 |
| SUP-35 | Monthly/One-time tabs with text at 200% on a 390 px phone (fresh-user pass 2026-11-01) | Both labels stay inside the pill; the tabs stack when they no longer fit side by side. **Bug found 2026-11-01:** "One-time" spilled out of the pill and over the edge of the card, on the page's main control. | NONE | support.spec › SUP-35 (Chromium and WebKit) |
| SUP-36 | /support states Sutam's size truthfully (fresh-user pass 2026-11-01) | The Sutam line does not claim "thousands" of talks. sutam.org's own home page says "Over 1,400 Dharma talks" as read on 2026-11-01. | NONE | support.spec › SUP-36 |
| GIVE-01 | Give: monthly preset, preset+fees, one-time preset, custom monthly, custom one-time+fees at $1000 | Exactly one POST with the base amount, the interval and cover_fees, then navigation to checkout.stripe.com | unit | support.spec › GIVE-01 (5 cases); donate.test › startCheckout success sends the right request |
| GIVE-02 | Double click, or a click while "Opening secure checkout…" | One request. The button shows busy (`aria-busy`). | NONE | support.spec › GIVE-02 |
| GIVE-03 | Keyboard: Enter and Space on the focused button | Each starts checkout | NONE | support.spec › GIVE-03 |
| GIVE-04 | Back from Stripe (bfcache or reload) | The button is not stuck on "Opening secure checkout…" and works again | NONE | support.spec › GIVE-04 |
| GIVE-05 | Worker answers ok with a non-Stripe URL | Never followed. Error message shown. | unit | support.spec › GIVE-05; donate.test › startCheckout rejects non-checkout urls |
| GIVE-06 | Type an Other amount, then press Give once (Safari) | **Bug found 2026-10-13:** WebKit dropped the first click, because `change` re-rendered the button text between mousedown and mouseup. Fixed by writing text only when it changes. One press now opens checkout in every engine. | NONE | support.spec › GIVE-06 (monthly + one-time) |
| GIVE-07 | Tap on a real iPhone or Android phone | Same as GIVE-01 with touch events | NONE | NONE (no native app; WebKit/Chromium phone emulation only. Real-device pass is the monthly fresh-user run in AGENTS.md) |
| GIVE-08 | Two tabs giving at once | Independent requests. Each tab opens its own session. | NONE | support.spec › GIVE-08 |
| ERR-01 | Worker 429 rate_limited | "Too many attempts; please wait a minute." No direct link. Button recovers. | unit | support.spec › ERR-01; donate.test › startCheckout 429; donate.test › errorMessage |
| ERR-02 | Worker 400 invalid_amount | The range message, no direct link | unit | support.spec › ERR-02; donate.test › startCheckout 400 invalid_amount |
| ERR-03 | Worker down (503) on a monthly preset, fees off and on | "Checkout couldn't open just now." plus a direct link to that tier's plain or fee Payment Link. The link opens. | NONE | support.spec › ERR-03 (fees off, on) |
| ERR-04 | Worker down on one-time | The direct link is the one-time Payment Link with `prefilled_amount` = the total | NONE | support.spec › ERR-04 |
| ERR-05 | Worker down on a custom monthly amount | No link (no Payment Link for custom monthly). The pick-a-preset hint is shown. | NONE | support.spec › ERR-05 |
| ERR-06 | Network failure (offline, DNS, CORS) | Same as ERR-03. The button recovers. | unit | support.spec › ERR-06; donate.test › startCheckout network throw |
| ERR-07 | Worker never answers | Times out after 10 s with the direct link | unit | support.spec › ERR-07 (Chromium); donate.test › startCheckout times out when fetch never resolves |
| ERR-08 | Change the amount after an error | The status message clears | NONE | support.spec › ERR-08 |
| ERR-09 | Worker error body is not JSON | Treated as unavailable | unit | support.spec › ERR-09; donate.test › startCheckout non-JSON error body |
| LIVE-01 | @live Give from an origin the Worker refuses (preview, localhost) | The real Worker refuses the preflight (403). The page shows the error and the direct Payment Link. | NONE | support.spec › LIVE-01 (skipped against prod: it would open a live session) |
| LIVE-02 | @live Worker validation for adityaaswani.com | amount 50 and 100001 give 400 invalid_amount without a Stripe call. A foreign origin gets 403. | NONE | support.spec › LIVE-02 |
| LIVE-03 | @live Every Payment Link and portal URL in support-links.json | Each answers 200 at Stripe (a deleted or renamed link gives 404) | NONE | support.spec › LIVE-03 |
| LIVE-04 | @live Real checkout from adityaaswani.com reaches Stripe | A live-mode session opens with the right amount | NONE | NONE (would create a live Checkout Session each night; the Worker side is covered in sutam's suite) |
| STRIPE-01 | Payment Links exist, match the tiers and redirect to /support/thanks?type= | `scripts/stripe-support-links.mjs` reports no drift | NONE | NONE (needs the live Stripe key; run by hand when tiers change) |
| STRIPE-02 | Constants | MIN $1, MAX $1000 and the checkout URL match the Worker's limits | unit | donate.test › constants |

## 2. Newsletter subscribe (home `#newsletter`, `/links/`, `/support/thanks/`)

Plain HTML forms. Each POSTs `email` to Substack's no-JS endpoint (`newsletter.formAction` in src/data/site.ts) in a new tab.

**Invariants:**
- The form posts to `https://essays.adityaaswani.com/api/v1/free?nojs=true`.
- That origin is in the CSP `form-action`.
- No request is sent for an empty or invalid address.

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| NEWS-01 | Valid email, press Enter (home, /links, /thanks) | One POST `email=…` to the endpoint in a new tab. The site tab stays put. | NONE | newsletter.spec › NEWS-01 (3 pages) |
| NEWS-02 | Empty, "not-an-email", "a@" | Browser validation stops it. No request, no new tab, the field is invalid. | NONE | newsletter.spec › NEWS-02 (3 values × 3 pages) |
| NEWS-03 | Labels and autocomplete | type=email, autocomplete=email, required, one label | NONE | newsletter.spec › NEWS-03 |
| NEWS-04 | "Get notified" on a coming-soon product card | Scrolls to the newsletter form | NONE | newsletter.spec › NEWS-04 |
| NEWS-05 | On a phone | Input and button reachable, 44 px targets, no sideways scroll | NONE | newsletter.spec › NEWS-05 (3 forms, phone and tablet profiles); pages.spec › PAGE-02 |
| NEWS-06 | Dark mode | Readable (axe contrast) | NONE | pages.spec › A11Y-01 (dark) |
| NEWS-07 | No JavaScript | Works (no JS needed) | NONE | newsletter.spec › NEWS-07 (3 forms, JavaScript off) |
| NEWS-08 | Pop-up blocker or in-app browser (Instagram) refuses target=_blank | Falls back to the same tab in most in-app browsers | NONE | NONE (needs real in-app browsers; monthly fresh-user pass) |
| NEWS-09 | Already subscribed address | Substack's "already subscribed" page | NONE | NONE (would need a real subscriber; Substack-side behaviour) |
| NEWS-10 | Double submit | Two tabs. Substack dedupes the address. | NONE | NONE (low risk; Substack-side) |
| NEWS-11 | The form-action origin is allowed by the CSP | Every `<form action>` origin is in `form-action` | NONE | csp.test › every external script, stylesheet, frame and form origin is allowed |
| NEWS-12 | @live Real POST reaches Substack in every browser | **Bug found 2026-10-13:** the form posted to adityaaswani.substack.com, which 301s to essays.adityaaswani.com. Chrome blocked the redirect by CSP form-action (nothing happened). Firefox and Safari turned the POST into a GET (Substack 404). Nobody could subscribe from the site. Fixed: the form posts to the custom domain, and the CSP allows it. The probe sends "e2e@invalid"; Substack answering "Please enter a valid email" proves the POST arrived. | NONE | newsletter.spec › NEWS-12 |
| NEWS-13 | Real subscription succeeds and confirms | The new subscriber gets the welcome email | NONE | NONE (creates a real subscriber; one manual check after deploy, see the report) |
| NEWS-14 | Subscribe on the design previews | Not applicable: they embed Substack's iframe | NONE | NONE (off-site; see PREV) |

## 3. Support: thank-you page (`/support/thanks/`)

Where Stripe returns the donor. The page reads `type` (`once` or `monthly`) and `session_id` from the query string.

**Invariants:**
- noindex, and left out of the sitemap.
- The upsell sends a $5 monthly Worker checkout, falling back to the $5 Payment Link.
- The portal link matches how the gift was made: Payment Link portal with no `session_id`, Worker account portal with one.

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| THX-01 | No type | Thanks only. No upsell, no portal note, noindex, no canonical. | NONE | thanks.spec › THX-01 |
| THX-02 | type=once | The $5-a-month upsell shows. "No thanks" hides it. | NONE | thanks.spec › THX-02 |
| THX-03 | Upsell Yes | One Worker POST of 500 cents monthly without fees, then Stripe | NONE | thanks.spec › THX-03 |
| THX-04 | Upsell Yes, Worker down | Goes to the $5 monthly Payment Link | NONE | thanks.spec › THX-04 |
| THX-05 | Upsell Yes clicked twice | One request | NONE | thanks.spec › THX-05 |
| THX-06 | type=monthly from a Payment Link (no session_id) | The note shows. The portal link is the Payment Link portal. | NONE | thanks.spec › THX-06 |
| THX-07 | type=monthly from the Worker (session_id) | The portal link is the Worker account's portal | NONE | thanks.spec › THX-07 |
| THX-08 | Stripe's return URL has no trailing slash | The 301 to /support/thanks/ keeps type and session_id (GitHub Pages and the local server) | NONE | thanks.spec › THX-08 |
| THX-09 | Unknown or hostile type (`<script>`) | Neither block shows. Nothing is injected. | NONE | thanks.spec › THX-09 |
| THX-10 | Back from the upsell checkout | The Yes button is usable again, not stuck | NONE | thanks.spec › THX-10 |
| THX-11 | Not in the sitemap | `/support/thanks` is absent | build | pages.spec › SEO-01; build-output.test › the sitemap lists only the public pages and no /preview page |
| THX-12 | A refresh or second visit days later | Same page, no double charge (nothing is charged here) | NONE | NONE (stateless page; nothing to assert beyond THX-01..09) |
| THX-13 | /support/thanks with text at 200% on a 390 px phone (2026-11-01) | Words stay whole. **Bug found 2026-11-01:** `Unconditiona / lly.` | NONE | pages.spec › THX-13 (Chromium and WebKit) |

## 4. Header, mobile menu, footer

**Invariants:**
- Menu state is `data-menu-open` on the header plus `aria-expanded` on the button, and the two always agree.
- Only one nav link has `aria-current=page`.

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| NAV-01 | Each header link from /contact/ (Building, Writing, Meditation, Links, Contact) | Lands on the right page or section, and the section is in view | NONE | nav.spec › NAV-01 (5 links) |
| NAV-02 | Section links on the home page | In-page anchors (#writing) that scroll. On a phone the menu closes. | NONE | nav.spec › NAV-02 |
| NAV-03 | Current page marking | Meditation and Contact mark themselves with aria-current | NONE | nav.spec › NAV-03 |
| NAV-04 | Support button state | aria-current on /support/ and /support/thanks/ only | NONE | nav.spec › NAV-04 |
| NAV-05 | Wordmark | Goes home from every page | NONE | nav.spec › NAV-05 |
| NAV-06 | Skip link | First Tab stop, visible on focus, moves focus to main (Chromium, Firefox; Safari needs Option+Tab) | NONE | nav.spec › NAV-06 |
| MENU-01 | Phone: open | Starts closed. A tap opens it, aria-expanded=true, focus on the first link. | unit | nav.spec › MENU-01; mobile-nav.test › starts closed; mobile-nav.test › open sets attributes and focuses first link |
| MENU-02 | Escape | Closes and returns focus to the button. Escape when closed does nothing. Other keys don't close. | unit | nav.spec › MENU-02; mobile-nav.test › Escape closes and refocuses the button; mobile-nav.test › Escape when closed does nothing; mobile-nav.test › other keys do not close |
| MENU-03 | Tap outside | Closes without moving focus | unit | nav.spec › MENU-03; mobile-nav.test › outside click closes without moving focus |
| MENU-04 | Theme switch inside the menu | Switches the theme and keeps the menu open | unit | nav.spec › MENU-04; mobile-nav.test › clicking the Appearance toggle inside the panel keeps the menu open |
| MENU-05 | Rotate or resize past 820 px while open | The menu closes and the desktop nav shows. Back at 390 px it is closed. | unit | nav.spec › MENU-05; mobile-nav.test › mql change to not matching closes without moving focus |
| MENU-06 | Open menu overlays content | No sideways scroll | NONE | nav.spec › MENU-06 |
| MENU-07 | Touch targets | Menu links, theme switch, menu button and Support pill are at least 44 px tall | NONE | nav.spec › MENU-07 |
| MENU-08 | Support pill at 320, 390, 440 px | Heart only, "Support", "Support my work". Always labelled for screen readers. Fits the bar. | NONE | nav.spec › MENU-08 (3 widths) |
| MENU-09 | No JavaScript on a phone | No menu button. Nav links shown inline. | NONE | nav.spec › MENU-09 |
| MENU-10 | Tab past the last item | Tabbing from the last link to the theme switch keeps it open; tabbing past it closes | unit | nav.spec › MENU-10; mobile-nav.test › Tab from the last link to the Appearance toggle keeps the menu open; Tab past it closes |
| MENU-11 | Focus moves to the Support pill | Closes | unit | nav.spec › MENU-11; mobile-nav.test › focusout to another header control (Support pill) closes |
| MENU-12 | Link inside the menu | Closes without stealing focus, so hash links still scroll | unit | nav.spec › NAV-02 (phone); mobile-nav.test › link click closes without moving focus |
| MENU-13 | Click inside the header but not on a link | Stays open | unit | nav.spec › MENU-13; mobile-nav.test › click inside header (not a link) does not close |
| MENU-14 | Focus moving within the menu | Stays open | unit | nav.spec › MENU-14; mobile-nav.test › focusout to an inside link does not close; mobile-nav.test › focusout from a link to the toggle does not close |
| MENU-15 | Listener cleanup | destroy() removes every listener | unit | mobile-nav.test › destroy removes listeners |
| MENU-16 | Real iOS Safari tap and VoiceOver | Same as MENU-01..05 | NONE | NONE (emulated iPhone WebKit only; monthly fresh-user pass on a device) |
| FOOT-01 | Footer links | Building, Writing, Meditation, Links, Contact and Support, in order. Support opens /support/. | NONE | nav.spec › FOOT-01 |
| FOOT-02 | Social links | All 12 open in a new tab with noopener and an "(opens in a new tab)" label | NONE | nav.spec › FOOT-02 |
| FOOT-03 | Copyright year | The current year. Built at deploy, so it can be stale until the Monday rebuild in the first week of January; the nightly flags it. | NONE | nav.spec › FOOT-03 |
| FOOT-04 | Footer on /links/ | /links has its own footer (blessing and home link) | NONE | content.spec › LINKS-03 |
| FOOT-05 | Footer wordmark | Goes home | NONE | nav.spec › NAV-05 |
| FOOT-06 | Footer in dark mode | Readable | NONE | pages.spec › A11Y-01 (dark) |
| FOOT-07 | Social links with text at 200% on a 390 px phone (2026-11-01) | The row stays inside the page. Its negative margin is px and no wider than the page gutter. | NONE | pages.spec › FOOT-07 (Chromium and WebKit) |

## 5. Light/dark theme

**Invariants:**
- `localStorage.theme` is `light`, `dark` or absent.
- It is the only key the site writes.
- The site sets no cookies.
- `data-theme` is set before first paint.

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| THEME-01 | First visit, OS dark | Dark from first paint. Nothing stored. Toggle aria-pressed=true. | NONE | theme.spec › THEME-01 |
| THEME-02 | First visit, OS light | Light, aria-pressed=false | NONE | theme.spec › THEME-02 |
| THEME-03 | Toggle | Stored, and survives a reload and every page | unit | theme.spec › THEME-03; theme-toggle.test › persists under the same key the head script reads |
| THEME-04 | Stored choice vs OS | The stored choice wins | NONE | theme.spec › THEME-04 |
| THEME-05 | No flash | `data-theme` is dark before DOMContentLoaded on a dark visit, and the body is not cream | NONE | theme.spec › THEME-05 |
| THEME-06 | Second tab opened after a change | Gets the new theme | NONE | theme.spec › THEME-06 |
| THEME-07 | Toggle twice | Back to light, light stored | NONE | theme.spec › THEME-07 |
| THEME-08 | Storage throws (Safari private mode, blocked storage) | The theme still switches for the page | unit | theme.spec › THEME-08; theme-toggle.test › a throwing storage (private mode) still flips the theme |
| THEME-09 | Data invariant | After visiting every page and toggling, localStorage keys are exactly `['theme']` and there are no first-party cookies | NONE | theme.spec › THEME-09 |
| THEME-10 | Several toggles on a page (bar + menu, /links top bar) | All report the same aria-pressed | unit | theme.spec › THEME-10; theme-toggle.test › init syncs aria-pressed on every toggle; theme-toggle.test › clicking the menu toggle flips theme, persists, and syncs the bar toggle |
| THEME-11 | An already open tab when another tab changes the theme | Keeps its theme until reloaded (there is no `storage` listener) | NONE | NONE (by design; noted, low impact) |
| THEME-12 | Browser chrome colour in dark mode | `theme-color` stays cream (#f8f1e3) in dark mode, so the phone status bar doesn't match | NONE | NONE (known cosmetic gap, listed in the report; not a test target until a decision) |
| THEME-13 | Menu theme button with text at 200% (2026-11-01) | Stays round. **Bug found 2026-11-01:** the Appearance row squeezed it into an oval. | NONE | pages.spec › THEME-13 (Chromium and WebKit) |

## 6. Page rendering and layout

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| PAGE-01 | Every page loads | 200, one h1 with the right text, one `main#main`. Every visible image decodes (lazy ones scrolled into view). **2026-10-30 (AA-S19):** desktop-webkit `/` hit the 30 s timeout at `scrollIntoViewIfNeeded` on the gcp runner (runs 40958564083, 40999679375). Cause: its "stable" check counts animation frames and a CPU-starved WebKit barely paints (5 screencast frames in the failed trace's 30 s), so the first two of 12 images took 6.5 s and 10.8 s. Not hover: the test never moves the mouse, the hero portrait has no transition and stalled too, and `mouse.move(0, 0)` still timed out 3 of 4. Reproduced on the box, pinned to 2 CPUs with 7 busy loops: old 0/8, fix 8/8 (9-15 s). The test now scrolls with `behavior: 'instant'` (the site's smooth scroll would still be moving) and waits for the image's `load` or `error`, because WebKit rejects `decode()` on a lazy image whose load has not started. Corrupt covers still fail it on all 5 projects. No retries; the timeout is unchanged. | NONE | pages.spec › PAGE-01 (6 pages × 5 projects) |
| PAGE-02 | No sideways scroll | At the device width and at 320 px, on every page | NONE | pages.spec › PAGE-02 |
| PAGE-03 | Fonts | Nunito Sans is loaded (self-hosted woff2) | NONE | pages.spec › PAGE-03 |
| PAGE-04 | No console errors, page errors, CSP violations or failed same-origin requests | On every test of every page (guard fixture) | NONE | fixtures.mjs guard (all e2e tests) |
| PAGE-05 | Images are not oversized | No dist file over 1 MB. Each home product screenshot stays within its byte budget, the size of its 2026-10-11 capture (AA-28, 2026-10-21), so a retake cannot slow `/`. | build | build-output.test › no file in dist is over 1 MB (AA-24: source photos stay out of public/); product-screenshots.test › PAGE-05 every product screenshot stays under its byte budget |
| PAGE-06 | Internal links resolve | Every internal href/src/srcset maps to a file, with a trailing slash | build | build-output.test › every internal href/src/srcset maps to a file in dist, with no trailing-slash redirect; build-output.test › no internal link lacks its trailing slash |
| PAGE-07 | Slow 3G / PSI | LCP under 2.5 s on mobile | NONE | NONE (PSI is the weekly audit in ~/repos/audits, not a test) |
| PAGE-08 | Reduced motion | No transition or animation over 0.01 ms on any page, the open phone menu included; without the preference the cards do animate (2026-10-29) | NONE | pages.spec › PAGE-08 |
| PAGE-09 | Text at 200% (root 32 px; WCAG 1.4.4) on every page | No sideways scroll and no clipped text, on desktop, phone and tablet. **Bug found 2026-11-01:** on a 390 px phone every page scrolled sideways (449–505 px wide): the header's Support pill and menu button could not wrap, the /links and /thanks email fields kept a 12–14rem basis, and a product badge and long links could not break. 150% was already clean. Fixed: the phone header bar wraps, the fields shrink, text breaks. Layout at normal size is unchanged (pixel diff, audit report). | NONE | pages.spec › PAGE-09 (6 pages, Chromium and WebKit) |
| PAGE-10 | Every page on web-tablet: iPad portrait 820x1180, iPad landscape 1180x820, Android tablet 800x1280 (touch) (2026-10-29) | Loads with its h1, no sideways scroll, no control under 24 px (WCAG 2.5.8; inline text links excepted). Controls under 44 px are listed "for review" in the log, not failed. A full-page screenshot per page per profile goes to the nightly's tablet-<stamp>/ folder. | NONE | tablet.spec › PAGE-10 (6 pages × 3 profiles) |
| PAGE-11 | Critical bytes on `/` and /support/ (2026-11-01; PAGE-07 is a timed PSI number that can't run on a loaded box) | Bytes needed for the first screen (document, CSS, preloaded fonts, LCP image; gzipped text) stay within a budget derived from PSI Slow 4G. The portrait is not lazy. No third-party script blocks parsing. | NONE | pages.spec › PAGE-11 (Chromium) |
| PAGE-12 | Text at 200% on a 390 px phone: words stay readable on /support/, /links/ and /learn-meditation/ (fresh-user pass 2026-11-01) | Body text, buttons and links keep their words whole. Gutters and card padding were rem, so they doubled and took the width from the text. They are px now; layout at normal size is unchanged (pixel diff, PR #61). Headings are out of scope: at 50 px and up, one long word can be wider than a phone. Inline addresses in a sentence may still wrap anywhere: a break point there would split them at normal size too. PAGE-09 could not see this: nothing overflows, the words just break. | NONE | pages.spec › PAGE-12 (Chromium and WebKit) |

## 7. Accessibility

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| A11Y-01 | axe (WCAG 2.1 A/AA + best practice) on every page, light and dark, desktop and phone | 0 violations. The thank-you page is checked with the upsell showing. | NONE | pages.spec › A11Y-01 (6 pages × 2 schemes × Chromium desktop + phone) |
| A11Y-02 | /support Other field error | Described by the error, which is aria-live; no axe violations with the error showing | NONE | pages.spec › A11Y-02 |
| A11Y-03 | Keyboard-only giving | Tab to an amount, arrows to change, Tab to Give, Enter | NONE | support.spec › A11Y-03 (Chromium and Firefox, Safari needs Option+Tab); support.spec › GIVE-03 |
| A11Y-04 | Copy status announced | role=status gets "Copied" | unit | content.spec › COPY-01; copy-email.test › success path writes the data-copy text, announces Copied, then resets after the timer |
| A11Y-05 | New-tab links announced | "(opens in a new tab)" on footer socials and forms | NONE | nav.spec › FOOT-02; newsletter.spec › NEWS-03 (form buttons) |
| A11Y-06 | Real screen readers (VoiceOver, TalkBack) | Reads in order | NONE | NONE (manual; monthly fresh-user pass) |
| A11Y-07 | axe on `/` at web-tablet iPad portrait 820x1180, light and dark (AA-27) | 0 violations | NONE | content.spec › A11Y-07 |
| A11Y-08 | The font-size audit opens live pages in Steel, which may hide webdriver | Every page it opens sets `plausible_ignore` first, so an audit is not a visit. This holds for `scripts/font-size-audit/fontaudit.mjs` and for the copy in `~/repos/audits/font-size-tools`, which is the one to run; the test reads only the repo script. | NONE | analytics-opt-out.test › the font-size audit sets plausible_ignore on every page |

## 8. Home page content (`/`)

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| HOME-01 | Product cards | 5 cards. Live ones link out over https. Coming-soon ones without a site link to #newsletter. | NONE | content.spec › HOME-01 |
| HOME-02 | Writing section | 1–6 essays, newest first, each linking to essays.adityaaswani.com/p/… | NONE | content.spec › HOME-02 |
| HOME-03 | Hero buttons | Scroll to Building and Writing | NONE | content.spec › HOME-03 |
| HOME-04 | Meditation and Support sections | Book opens cal.com in a new tab. Support goes to /support/. | NONE | content.spec › HOME-04 |
| HOME-05 | Person JSON-LD | Parses, `@type` Person, `sameAs` equals the footer socials | build | content.spec › HOME-05; build-output.test › the home page has valid Person JSON-LD |
| HOME-06 | Portrait | srcset 320/640/960 decodes | NONE | content.spec › HOME-06; pages.spec › PAGE-01 |
| HOME-07 | Contact line copy button | See COPY | NONE | content.spec › COPY-02 |
| HOME-08 | Hero order, web-phone (390x844) | Headline, then intro, then both CTAs, then the portrait; "See what I'm building" is on the first screen | NONE | content.spec › HOME-08 |
| HOME-09 | Hero order, web-tablet portrait: iPad 820x1180, iPad mini 768x1024, Android tablet 800x1280 (AA-27) | Same order as phone up to the two-column hero at 860 px. The intro and both CTAs end above y=600 and above the portrait. Was: a ~500 px portrait between headline and intro, CTAs at y≈952. | NONE | content.spec › HOME-09 (×3 profiles) |
| HOME-10 | Hero, web-tablet landscape (iPad 1180x820) | Two columns: text left, portrait right; both CTAs on the first screen | NONE | content.spec › HOME-10 |
| HOME-11 | Hero, single-column tablet band (600, 768, 820, 859 px) | No sideways scroll at any of the four widths | NONE | content.spec › HOME-11 |
| HOME-12 | Product card status and last-changed month (2026-10-21) | Badge is Live, Private beta or Coming soon; a product with an `updated` month shows "Updated <Month YYYY>" under its pitch | NONE | content.spec › HOME-12 |
| HOME-13 | Product card screenshots (AA-28, 2026-10-21; no dated banners, AA-29, 2026-10-29) | Every product with a site has a screenshot at `/products/<slug>-640.webp` (640x400) and `-1280.webp` (1280x800), both in public/. Its alt is non-empty, starts with the product name, quotes the hero text shown in the picture, and is unique. When a pitch changes, the screenshot is retaken (Steel, 1280x800, light) and the alt updated: the card copy and its picture must not disagree (PausePal showed "Every week." after #43). No dated banners: a capture shows no event ticker or dated call to action that can go stale (SaveTheDogs showed "Oct 23–25: Global Weekend of Action" after 10-25; its capture is cropped below the ticker, since the frozen site would show it again on a retake). | NONE | product-screenshots.test › HOME-13 every product screenshot exists at 640x400 and 1280x800 as WebP, named for its product; product-screenshots.test › HOME-13 every product screenshot has a non-empty alt that names the product and quotes its hero text; product-screenshots.test › HOME-13 no dated banner: the SaveTheDogs capture starts below the site’s red event ticker (AA-29); pages.spec › PAGE-01 (the images decode) |
| HOME-17 | Smaller home links (2026-11-01: no row) | "How I teach" opens /learn-meditation/, "All essays" goes to essays.adityaaswani.com, the contact line links /contact/ and mailto | NONE | content.spec › HOME-17 |
| HOME-18 | Home with text at 200% on a 390 px phone (2026-11-01) | Body text and links keep their words whole, and each card's screenshot still meets the card edges, because its bleed matches the card padding. | NONE | pages.spec › HOME-18 (Chromium and WebKit) |

## 9. Writing feed (build time)

`scripts/fetch-essays.mjs` pulls the latest 6 posts from the Substack RSS before each build (and the Monday rebuild). It falls back to `site.ts` if anything fails.

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| ESSAY-01 | Feed OK | 6 newest, in order, with fields; covers resized to 800×500 webp | unit | essays-feed.test › parseFeed returns 6 newest in order with fields; essays-feed.test › loadEssays returns feed essays and writes covers |
| ESSAY-02 | Entities and CDATA | Decoded | unit | essays-feed.test › parseFeed decodes entities and CDATA |
| ESSAY-03 | Tracking query/hash in URLs | Stripped | unit | essays-feed.test › parseFeed strips query string and hash from urls |
| ESSAY-04 | Post without a cover | Null cover, no broken image | unit | essays-feed.test › parseFeed: missing enclosure gives null coverUrl |
| ESSAY-05 | Non-https or malformed item | Rejected | unit | essays-feed.test › parseFeed rejects non-https urls and invalid items |
| ESSAY-06 | Broken feed, HTTP 500, network error, cover 404 | Falls back to site.ts. The build never fails. | unit | essays-feed.test › parseFeed throws on broken or non-RSS input; essays-feed.test › loadEssays falls back on broken feed / HTTP 500 / fetch rejection / cover download failure |
| ESSAY-07 | Built site shows the essays with covers that load | Covers decode on the live page | NONE | pages.spec › PAGE-01 (home); content.spec › HOME-02 |
| ESSAY-08 | A new essay appears within a week without a commit | The Monday 09:00 UTC rebuild picks it up. The nightly fails if the live build is over 8 days old (DEPLOY-07). | NONE | deploy-marker.test › DEPLOY-07 a live build over 8 days old |
| ESSAY-09 | Curation (excluding a post) | Not supported (AA-26 decision pending) | NONE | NONE (feature not built) |

## 10. /links page

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| LINKS-01 | Main cards | 4 cards. External ones open in a new tab with noopener. Support stays on the site and opens /support/. | NONE | content.spec › LINKS-01 |
| LINKS-02 | Build list | 5 products. Ones without a site go to /#newsletter in view. | NONE | content.spec › LINKS-02 |
| LINKS-03 | Own top bar | No site header. Support pill and theme switch present. og:image is og-links.jpg. | NONE | content.spec › LINKS-03 |
| LINKS-04 | Social tiles | 12 tiles, new tab, noopener | NONE | content.spec › LINKS-04 |
| LINKS-05 | Subscribe form | See NEWS-01..03 | NONE | newsletter.spec › NEWS-01 (/links/) |
| LINKS-06 | Opened from Instagram/TikTok in-app browsers | Loads and links work | NONE | NONE (needs the real apps; monthly fresh-user pass) |

## 11. /contact and /learn-meditation

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| CONTACT-01 | Mail links and the anonymous form | hello@ twice and support@ once as mailto. Tally opens in a new tab. | NONE | content.spec › CONTACT-01 |
| CONTACT-02 | Deep link #share-feedback | Scrolls into view | NONE | content.spec › CONTACT-02 |
| CONTACT-03 | Copy buttons for both addresses | See COPY | NONE | content.spec › COPY-01 |
| CONTACT-04 | "Through someone else" (2026-10-29: the feature had no row) | Two intermediary cards, each with a name, an outbound link (website or YouTube, new tab, noopener) and a mailto | NONE | content.spec › CONTACT-04 |
| CONTACT-05 | /contact with text at 200% on a 390 px phone (2026-11-01) | The mail buttons break only at the @ or a dot. **Bug found 2026-11-01:** `hello@a / dityaas / wani.co / m`. | NONE | pages.spec › CONTACT-05 (Chromium and WebKit) |
| MED-01 | Booking and questions | Two cal.com links. "Ask Questions" goes to /contact/. | NONE | content.spec › MED-01 |
| EXT-01 | Every external link in the page bodies | target=_blank always has noopener | NONE | content.spec › EXT-01 |
| EXT-02 | @live Link rot (desktop-chromium only; one sweep per run) | Every non-social outbound link answers below 400. Retries a 5xx or network error once after 2 s (a transient upstream 500 is not rot; Apple Podcasts, nightly 2026-10-31); a 4xx fails at once. The failure lists every bad link. | NONE | content.spec › EXT-02; link-check.test › 500 then 301 passes / 404 fails at once |
| EXT-03 | Social network links | Still the right profiles | NONE | NONE (they refuse scripted requests; monthly fresh-user pass) |

## 12. Copy-email buttons (home, /contact)

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| COPY-01 | Copy (Chromium with clipboard permission) | The clipboard holds the address. Label and status say Copied, and only for that button. Reset after 2 s. | unit | content.spec › COPY-01; copy-email.test › success path writes the data-copy text, announces Copied, then resets after the timer |
| COPY-02 | Copy in every engine | Either Copied or the failure message; never silent | NONE | content.spec › COPY-02 |
| COPY-03 | No clipboard API (old browser, http) | Buttons hidden. The mailto link is still there. | unit | content.spec › COPY-03; copy-email.test › no clipboard: returns 0 and buttons stay hidden |
| COPY-04 | Clipboard refuses | "Copy failed. Select the address instead." The label stays Copy. | unit | content.spec › COPY-04; copy-email.test › failure path announces the failure message and leaves the label as Copy |
| COPY-05 | Rapid clicks | One pending reset | unit | copy-email.test › two rapid clicks leave only one pending reset |
| COPY-06 | copyText never throws | Resolves false without a clipboard | unit | copy-email.test › copyText resolves true when the clipboard accepts the text; copy-email.test › copyText resolves false when writeText rejects; copy-email.test › copyText resolves false without a clipboard and never throws |

## 13. Security headers and CSP

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| SEC-01 | Every page has exactly one meta CSP right after the charset, /zoom included | Present | build | csp.test › every Layout page has a meta CSP as the first element after the charset; csp.test › every HTML file in dist, the /zoom redirect included, has exactly one meta CSP (AA-S13) |
| SEC-02 | Inline scripts hashed | Every inline script's hash is in that page's script-src. No unsafe-inline or unsafe-eval. | build | csp.test › every inline script hash appears in that page's CSP; csp.test › the policy carries the required directives and nothing unsafe for scripts |
| SEC-03 | External origins allowed | Script, style, frame and form origins are all in the policy | build | csp.test › every external script, stylesheet, frame and form origin is allowed |
| SEC-04 | No violations in real browsers | 0 securitypolicyviolation events on every e2e test | NONE | fixtures.mjs guard (all e2e tests) |
| SEC-05 | Referrer policy | strict-origin-when-cross-origin on every page | build | build-output.test › every page in dist sends strict-origin-when-cross-origin as its referrer policy |
| SEC-06 | security.txt | Published, with an expiry more than 30 days away | build | build-output.test › security.txt is published with contact, expiry and language; pages.spec › SEO-02 |
| SEC-07 | Fonts and embed hosts only where used | Google Fonts and the Substack frame only on the pages that load them | build | csp.test › Google Fonts and the Substack embed are allowed only on the pages that load them; csp.test › applyCsp gives a standalone page the policy, with its font and embed hosts only when it uses them |
| SEC-08 | Redirect targets of allowed origins | A form or frame whose origin redirects is still allowed after the redirect | NONE | newsletter.spec › NEWS-12 (@live) |
| SEC-09 | HSTS and other response headers | GitHub Pages sends its own; there are no custom headers | NONE | NONE (platform-controlled) |

## 14. Search and sharing

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| SEO-01 | Sitemap | Every listed URL is https://adityaaswani.com/… and answers 200. The thank-you page is not listed. | build | pages.spec › SEO-01; build-output.test › the sitemap lists only the public pages and no /preview page |
| SEO-02 | robots.txt, security.txt, manifest | Served. robots points at the sitemap. | build | pages.spec › SEO-02; build-output.test › robots.txt allows all and points at the sitemap |
| SEO-03 | Share cards | og:title, description, image and url on every page. The image answers 200. | build | pages.spec › SEO-03; build-output.test › every og:image is absolute and resolves to a file in dist |
| SEO-04 | Default share image | 1200×630, under 300 KB; no page shares the original photo | build | build-output.test › the default share image is 1200x630 and under 300 KB, and no page shares the original photo |
| SEO-05 | Canonical and indexing on public pages (2026-11-01: the old citation only checked that the thank-you page has none) | Each public page has its own canonical and no robots noindex, on the build and on prod; noindex pages have no canonical | NONE | pages.spec › SEO-05; thanks.spec › THX-01 |
| SEO-06 | noindex | /support/thanks/ and the 404 page carry noindex | NONE | thanks.spec › THX-01; pages.spec › ERR404-01 |
| SEO-07 | Preview builds | noindex and no analytics (PUBLIC_PREVIEW=1) | NONE | NONE (checked by curl in review runs; see PREV-02) |
| SEO-08 | /links share card | og-links.jpg | NONE | content.spec › LINKS-03 |
| SEO-09 | Search Console / rich results | Valid | NONE | NONE (external tool, manual) |
| SEO-10 | Favicons and web-manifest icons (2026-11-01: PAGE-06 checks HTML references, not the manifest) | Every icon a page or site.webmanifest names answers 200 as an image; the manifest is valid JSON | NONE | pages.spec › SEO-10 |

## 15. 404 and redirects

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| ERR404-01 | Unknown URL | Status 404, the site 404 page with noindex, "Go home" works | NONE | pages.spec › ERR404-01 |
| ERR404-02 | Retired URLs (/preview/, /previews/, /preview-pixel/, /aditya-photo-new.jpg) | 404 | build | pages.spec › ERR404-02; build-output.test › the /preview* design pages are not on the public site (AA-22; they live on adityaaswani-preview) |
| ERR404-03 | Path without a trailing slash | 301 to the slash, keeping the query (see THX-08) | NONE | thanks.spec › THX-08 |
| ZOOM-01 | /zoom | Sends the visitor to the Zoom room | NONE | pages.spec › ZOOM-01 |
| ZOOM-02 | /zoom with JS off | The meta refresh still redirects | NONE | pages.spec › ZOOM-02 (JavaScript off) |

## 16. Analytics

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| ANA-01 | @live Plausible and the Cloudflare beacon load under the CSP | Both scripts 200, `window.plausible` defined, no CSP violation, and the real beacon's rum POST carries the site token from the tag the bootstrap adds. Skipped on preview builds, which have no analytics by design; never skipped against prod, where noindex is a failure (2026-11-01). | NONE | analytics.spec › ANA-01 |
| ANA-02 | Test runs never count as visits (owner saw 7 uniques on /support/thanks with no donations, 2026-11-01) | Every Playwright context sets `localStorage.plausible_ignore`, so no page loads the Plausible script or the Cloudflare beacon, and no request reaches Cloudflare; any event is answered locally by the guard fixture. The flag is the fixture's: THEME-09 ignores it, the site never writes it. | NONE | analytics.spec › ANA-02 |
| ANA-05 | A real visitor (no webdriver, no opt-out) | The Plausible and Cloudflare tags are both in the page, same src, async, not blocked by the CSP, and the Cloudflare tag keeps its `data-cf-beacon` token; `window.plausible` works | NONE | analytics.spec › ANA-05 |
| ANA-06 | Automated browser (`navigator.webdriver` true) | Neither script is loaded and no request reaches Cloudflare (the beacon has no webdriver check of its own); `window.plausible` is still a function, so a call cannot throw | NONE | analytics.spec › ANA-06 |
| ANA-07 | Browser that hides webdriver but has `localStorage.plausible_ignore = "true"` (Plausible's documented opt-out, which the bootstrap also applies to Cloudflare) | Neither script is loaded and no request reaches Cloudflare | NONE | analytics.spec › ANA-07 |
| ANA-08 | A person whose browser blocks localStorage | Reading the opt-out throws, is caught, and the visit is still counted: both scripts load | NONE | analytics.spec › ANA-08 |
| ANA-04 | The Cloudflare beacon never fails a test that is not about analytics (nightly 2026-10-13 and 2026-10-21: NAV-05 on phone-webkit, `pageerror: …/cdn-cgi/rum due to access control checks`) | Outside ANA-01 the beacon gets an empty script, even with E2E_LIVE=1, so no /cdn-cgi/rum POST is ever cut off by a navigation. ANA-01 runs the real beacon (`realBeacon` option) and sees its rum POST answered locally. Test defect, not a site bug: real visitors' beacons talk to Cloudflare. Harness (`E2E_LIVE=1 npx playwright test e2e/nav.spec.mjs -g NAV-05 --project=phone-webkit --repeat-each=1000 --workers=8`, box load ~50): before 11 failed of 888 (run stopped at its time cap), after 0 failed of 1000. | NONE | analytics.spec › ANA-01; nav.spec › NAV-05 |
| ANA-03 | A real visit is counted | The Plausible dashboard shows the page view | NONE | NONE (owner checks the dashboard; AA-23 decides whether both stay) |

## 17. Build and deploy

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| DEPLOY-01 | PR build | npm test, build, dist tests | build | .github/workflows/deploy.yml (Build job) |
| DEPLOY-02 | PR e2e | All non-live e2e rows in Chromium, Firefox and WebKit | NONE | .github/workflows/e2e.yml |
| DEPLOY-03 | PR matrix check | Fails a PR that changes a feature without a row | NONE | .github/workflows/e2e.yml (matrix job); feature-matrix.test |
| DEPLOY-04 | Artifact includes .well-known | The Pages tarball contains security.txt | NONE | deploy.yml "Check the artifact includes .well-known/security.txt" step |
| DEPLOY-10 | PR and main E2E finish on the self-hosted gcp runner (AA-S16) | The E2E jobs end green or red, never cancelled. **Open 2026-10-20 to 2026-10-30:** every E2E run was cancelled at the 15-min cap after #40. Cause: the runner VM ci-runner-1 (e2-standard-4) hosts the runners of five repos and runs their jobs at the same time, so 3 Playwright workers starved for CPU. Fixed by #47 (one job per engine, 2 workers, a browser warm-up, a 30-min cap) and #51 (PAGE-01). **Accepted 2026-10-31:** main green in runs 41114915822, 41137836632, 41184511842. The margin is thin while the VM co-schedules. **2026-11-01 (AA-S21):** PRs #54 and #55 went red on desktop-webkit and phone-webkit (runs 41283759336, 41291487197, 41296443242): HOME-03, NAV-05, GIVE-01, GIVE-06, ERR-04, all at the 30 s timeout. Confirmed starvation, not assumed: VM CPU 98-100% through all four red jobs, load 13-19 on 4 vCPUs at their start against 4-7 on the calm 10-31 morning, run queue 10-19, iowait about 0, no steal, 6 GB free. No test hung: each click paid 3-10 s of "stable" wait, and 3-14 frames painted per failed test. Trigger: a sixth runner, gcp-samvara-product-2, came online 06:13 UTC; concurrent jobs averaged 1.39 before it and 3.67 after, and minutes with 4 or more jobs went from 2% to 52%. Each runner service has cpu.weight 100, so a busy VM gives this repo a share of the CPU however many workers it starts. Fix: 1 worker for WebKit on CI, keyed off PW_ENGINE, no workflow change. At the same capped share (80% of one box CPU), 2 workers against 1 on 45 slow tests: same 372 s wall, p50 14.0 s to 7.2 s, slowest 29.8 s to 13.5 s. On 2 CPUs with 12 busy loops: 5 failed to 0 failed. The 30 s timeout and 30-min cap stay, no retries. The cause stays open: ci-runner-1 needs fewer concurrent jobs or more CPU; one job at a time cannot keep up (2,279 job-minutes on 10-31 is 1.6 jobs on average). | NONE | workflows.test › each required E2E context is its own job (no matrix), gated on changes; e2e.yml on main (the three runs); workflows.test › WebKit runs one worker on CI; other engines two; the box six; workflows.test › both WebKit E2E jobs set PW_ENGINE: webkit, which the one-worker rule keys off; CI-only acceptance: green desktop-webkit and phone-webkit runs on the runner |
| DEPLOY-05 | Nightly against prod with live rows | Runs 03:00 UTC, emails dev@ on failure. Its `deploy-marker` step checks what is live (DEPLOY-06). | NONE | ~/repos/testing/nightly-adityaaswani.com.sh |
| DEPLOY-06 | Deploy proves the artefact changed (BOX-RULES 2026-10-13) | Every page of a deploy build carries `<meta name="build" content="<sha> <built at>">`. The nightly fails if the live commit is not main's an hour after the merge, or there is no marker. A 200 is not proof. | NONE | deploy-marker.test › DEPLOY-06 the live commit is behind main an hour after the merge; deploy-marker.test › DEPLOY-06 no marker on the live site; deploy-marker.test › DEPLOY-06 a deploy build carries the marker |
| DEPLOY-07 | Weekly rebuild | Monday 09:00 UTC rebuild succeeds (10-19 and 10-26 ran, GitHub starting them hours late). The nightly fails if the live build is over 8 days old, which also catches GitHub switching a schedule off. | NONE | deploy-marker.test › DEPLOY-07 a live build over 8 days old |
| DEPLOY-08 | Node version | Node 22 in CI, new enough for every package's `engines`. **Found 2026-10-29:** on the self-hosted runner `node-version: "22"` resolved to the cached 22.23.3, so dependabot #37 (astro 7.4.2, `engines` >= 22.23.4) failed Build and E2E. Fixed by #47: `check-latest: true` on every setup-node. | NONE | workflows.test › every setup-node takes the newest release of its line |
| DEPLOY-09 | GitHub Actions pinned (AA-S15, 2026-10-20: checkout v7.0.1, setup-node v7.1.0, configure-pages v6.0.0, deploy-pages v5.0.1, cache v6.1.0) | Every `uses:` is a full release commit SHA with a `# vX.Y.Z` comment, one pin per action across deploy.yml and e2e.yml; majors are taken in a review brief, release notes read for changed defaults | NONE | workflows.test › every action in the workflows is pinned to a full commit SHA with a # vX.Y.Z comment; workflows.test › each action is pinned to one SHA and one release across the workflows |
| DEPLOY-11 | A push to main is never cancelled by the next push (AA-S18) | Each merge to main runs E2E to green or red; only a stale PR run may be cancelled (`cancel-in-progress: ${{ github.event_name == 'pull_request' }}` in every workflow, as deploy.yml already had). **Found 2026-10-29 (review run 8):** #49 set `cancel-in-progress: true` in e2e.yml, so 5dccd63's merge cancelled phone-webkit on 128f961 at 15:38:47 UTC (run 40897311377). Required checks under branch protection (AA-S6) must never be left cancelled on main. | NONE | workflows.test › pushes to main are never cancelled in progress (cancel-in-progress only for pull_request) |
| DEPLOY-12 | A docs-only change never strands the required E2E checks (AA-S20) | `E2E (chromium)`, `E2E (firefox)`, `E2E (desktop-webkit)` and `E2E (phone-webkit)` report on every PR and push: run when any changed file is outside `**.md` and `docs/**`, skipped (which passes a required check) when all are, and on Dependabot PRs. e2e.yml has no trigger-level path filter; a `changes` job gates the four jobs. They are separate jobs, not a matrix: **found 2026-10-30,** a matrix job skipped by a job-level `if` reports one check literally named `E2E (${{ matrix.name }})`, so the four contexts would stay "Expected" (probe run 41129264256; separate jobs report their names, probe run 41129471522). If `changes` fails, E2E runs instead of being skipped. | NONE | workflows.test › e2e.yml has no trigger-level paths filter; workflows.test › each required E2E context is its own job (no matrix), gated on changes; workflows.test › the changes job fetches full history and the feature matrix job does not depend on it; workflows.test › changes: code=false only when every changed file is **.md or docs/**; workflows.test › changes: a rename out of code, an empty diff and a manual run all still run E2E |
| DEPLOY-13 | Every workflow job has its own `timeout-minutes` (#49, 2026-10-29; shipped without a row) | A hung job ends by itself instead of holding the shared runner | NONE | workflows.test › every job in every workflow has its own timeout-minutes |
| DEPLOY-14 | ci-runner-1 disk housekeeping (2026-11-02) | `runner-housekeeping.yml` prunes Docker on ci-runner-1 every Sunday 05:30 UTC and gauges `/` daily at 05:00 UTC; either fails, naming the percentage, when `/` is above 80 %. It removes only stopped containers older than 1 h, anonymous volumes no container references, dangling images older than 1 h and build cache beyond 10 GB, so the five other repos' running jobs are untouched; `sudo -n` never waits for a password; it never runs twice at once and never uses a GitHub-hosted runner. **Found 2026-11-01/02:** ~700 orphaned Postgres volumes filled the 96 GB disk (`/var/lib/docker` 62 GB) and all six runners were offline ~16 h until a manual prune. | NONE | workflows.test › housekeeping: weekly prune Sunday 05:30 UTC, daily gauge 05:00 UTC, manual run, never twice, self-hosted; workflows.test › housekeeping: prunes only stopped/orphaned/dangling resources, sudo never prompts, every step has a timeout; workflows.test › housekeeping: the gauge fails above 80 % and names the number |

## 18. Design previews (off-site)

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| PREV-01 | Not on the public site | /preview* answers 404 | build | pages.spec › ERR404-02 |
| PREV-02 | Preview deploy | noindex header, no analytics, fonts load | NONE | NONE (scripts/design-previews-axe.mjs by hand; quarterly refresh, docs/DESIGN-PREVIEWS.md) |
| PREV-03 | axe baseline on the variants | Matches the recorded baseline | NONE | NONE (scripts/design-previews-axe.mjs by hand) |
| PREV-04 | The axe run opens pages in Steel, which may hide webdriver | Every page it opens sets `plausible_ignore` first, so pointing it at a live origin is not a visit | NONE | analytics-opt-out.test › the design-preview axe run sets plausible_ignore on every page |

## 19. Test matrix upkeep

| ID | Case | Expected (and invariant) | Was | Test |
|---|---|---|---|---|
| MATRIX-01 | PR changes a feature path with no row edit | Check fails and names the feature and its row prefixes | NONE | feature-matrix.test › a feature change without a row fails and names the feature |
| MATRIX-02 | PR adds or edits a row of that feature | Passes | NONE | feature-matrix.test › a changed or added row of the feature passes |
| MATRIX-03 | New source file not in the path map | Fails until it is mapped. `.github/` is outside `mustMap`, but every workflow file is still mapped so a change to it needs a row (2026-11-02: `runner-housekeeping.yml` and `.github/actionlint.yaml` → deploy, DEPLOY-14) | NONE | feature-matrix.test › an unmapped source file fails |
| MATRIX-04 | Matrix-Skip trailer | Passes, with the reason printed | NONE | feature-matrix.test › Matrix-Skip skips the check |
| MATRIX-05 | Firefox aborts a font download when a test navigates away (`downloadable font: download failed … status=2152398850`, NS_BINDING_ABORTED) | console-error check ignores navigation-aborted font loads (Firefox NS_BINDING_ABORTED); every other font error and console error still fails the test | NONE | console-filter.test › ignores a navigation-aborted font load; console-filter.test › still fails every other font error |
| MATRIX-06 | Dependabot PR (every commit in the range authored by `dependabot[bot]`) touches a mapped path, e.g. an Actions bump in e2e.yml (#36 failed on 2026-10-19; AA-S14) | Skipped with "dependency bump (Dependabot)"; Dependabot cannot add the Matrix-Skip trailer | NONE | feature-matrix.test › a range of only Dependabot commits is skipped as a dependency bump; feature-matrix.test › readRange reads authors from real git history |
| MATRIX-07 | Dependabot PR plus a human commit that changes a feature without a row | Not skipped: the check fails and names the feature; an empty range or a look-alike author name never skips | NONE | feature-matrix.test › a Dependabot range with one human commit touching a feature without a row still fails; feature-matrix.test › an empty range or a look-alike author is not a Dependabot skip |
| MATRIX-08 | Coverage per platform (2026-10-29): `--summary`, `--gaps <platform>`, `--sync` read the e2e JSON reports of the default and tablet lanes | A web row counts on a platform only where a test it cites passed in that platform's projects (a failed or skipped test is a gap); `only` limits rows to the platforms they apply to (EXT-02 is web-desktop only: a plain-HTTP sweep that runs in one lane, 2026-10-31; MENU-10, 11, 13 and 14 are phone and tablet only since they run in real browsers, 2026-11-01: the menu does not exist on web-desktop); build/CI rows count once as platform-independent; android and ios show as not applicable | NONE | feature-matrix.test › a web row is covered on a platform only where its cited test passed; feature-matrix.test › the coverage table lists every platform and marks android and ios not applicable; feature-matrix.test › FEATURES.md carries the coverage-by-platform markers |
| MATRIX-09 | Chromium cancels a page's loads with `net::ERR_NETWORK_CHANGED` (2026-11-01: PR #55 run 41291487197, NAV-01 on the gcp runner, its own assertions passing; a local image load, so the machine's interfaces changed, most likely a neighbouring job on the shared VM; not proven, no ssh to it) | The guard ignores that exact error in the console and in failed requests, so a neighbour's job cannot fail a test. Every other `net::` error, failed request and 404 still fails it. No retries. | NONE | console-filter.test › ignores a load the machine's network change cancelled; console-filter.test › still fails every other request failure and net:: error; console-filter.test › navigation and test aborts stay ignored in every engine |
