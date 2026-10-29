# adityaaswani.com: feature matrix trend

One line per weekly matrix audit (`~/repos/briefs/feature-matrix-audit.md`). The report for each week is `~/repos/orchestrator-logs/REPORT-matrix-audit-adityaaswani.com-<date>.md`.

- **Rows** and **No test** come from `node scripts/check-feature-matrix.mjs --stats`. **Row coverage** = rows with a test / rows.
- **Per platform** = covered / applicable rows from `--summary` (e2e reports of the default and tablet lanes). android and ios are not applicable: the site has no native app.
- **e2e** = passed tests in the full run: default lane (5 projects, `@live` included, against the fresh build) / tablet lane / against prod. Failed and flaky are counted separately.

| Week | Rows | No test | Row coverage | web-desktop | web-phone | web-tablet | Platform-independent | e2e passed (build / tablet / prod) | Failed | Flaky | Nightly runs (failed) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-21 (baseline: matrix state after #43; no weekly audit yet) | 209 | 31 | 85.2% | not measured | not measured | no lane | not measured | 764 / – / 759 | 0 | 0 | 16 since 2026-10-14 (1: 2026-10-21 NAV-05 beacon, fixed by #42) |
| 2026-10-29 | 213 | 31 | 85.4% | 123/129 (95%) | 135/147 (92%) | 138/150 (92%) | 42/61 (69%) | 774 / 471 / 759 (+ tablet on prod 468) | 0 | 0 (build lane ×2: 1528/1528; tablet ×2: 936/936) | 8 of 8 since 2026-10-22, all PASS |
