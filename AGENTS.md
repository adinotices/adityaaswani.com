# AGENTS


## Fresh-user end-to-end testing (owner rule, 2026-10-11)

After the first complete iOS/Android build of this product, and again after every major feature change and on a standing cadence (at least monthly, paired with the weekly PSI/axe audits), run the whole product end to end as a brand-new user would: sign-up through every feature, on a real device or emulator for the apps and in a real browser (Steel) for the web, with screenshots and timings. Write up the learnings, bugs and feedback as a report, turn them into a fix brief, implement the fixes, and re-test. Treat the report like user feedback: what confused, what stalled, what broke. Never skip this because the unit tests are green.

## Feature test matrix (owner rule, 2026-10-13)

Every feature or fix ships with its FEATURES.md rows and tests. `docs/testing/FEATURES.md` lists every feature, every state and edge case, the invariant that must hold afterwards, and the test that covers each row (or NONE, with the reason).
- A bug a visitor reports becomes a matrix row before it is fixed. The row's test must fail on the old code and pass on the fix.
- Tests are real end-to-end runs: Playwright in Chromium, Firefox and WebKit, desktop and phone (`npm run build && npm run test:e2e`). Rows that call live services are tagged `@live` and run nightly (`~/repos/testing/nightly-adityaaswani.com.sh`, 03:00 UTC, against prod).
- CI (`.github/workflows/e2e.yml`) fails a PR that changes a feature's files without a new or edited row for that feature. The path map is `docs/testing/feature-paths.json`. A dependency bump or pure refactor can carry a `Matrix-Skip: <reason>` commit trailer. A PR whose commits are all authored by `dependabot[bot]` is skipped automatically (it cannot add the trailer); one human commit brings the check back.
- Flaky = broken: no retries. Fix the cause.
