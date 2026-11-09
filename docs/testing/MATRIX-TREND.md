# adityaaswani.com: feature matrix trend

One line per weekly matrix audit (`~/repos/briefs/feature-matrix-audit.md`). The report for each week is `~/repos/orchestrator-logs/REPORT-matrix-audit-adityaaswani.com-<date>.md`.

- **Rows** and **No test** come from `node scripts/check-feature-matrix.mjs --stats`. **Row coverage** = rows with a test / rows. From 2026-11-09 a Test cell that is only a manual check counts as no test (MATRIX-10); earlier lines counted it as a test.
- **Per platform** = covered / applicable rows from `--summary` (e2e reports of the default and tablet lanes). android and ios are not applicable: the site has no native app.
- **e2e** = passed tests in the full run: default lane (5 projects, `@live` included, against the fresh build) / tablet lane / against prod. Failed and flaky are counted separately.

| Week | Rows | No test | Row coverage | web-desktop | web-phone | web-tablet | Platform-independent | e2e passed (build / tablet / prod) | Failed | Flaky | Nightly runs (failed) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-21 (baseline: matrix state after #43; no weekly audit yet) | 209 | 31 | 85.2% | not measured | not measured | no lane | not measured | 764 / – / 759 | 0 | 0 | 16 since 2026-10-14 (1: 2026-10-21 NAV-05 beacon, fixed by #42) |
| 2026-10-29 | 213 | 31 | 85.4% | 123/129 (95%) | 135/147 (92%) | 138/150 (92%) | 42/61 (69%) | 774 / 471 / 759 (+ tablet on prod 468) | 0 | 0 (build lane ×2: 1528/1528; tablet ×2: 936/936) | 8 of 8 since 2026-10-22, all PASS |
| 2026-11-01 | 223 | 24 | 89.2% | 132/136 (97%) | 147/157 (94%) | 150/160 (94%) | 46/60 (77%) | 873 / 537 / 856 on the branch (main: 773 / 470 / 768; tablet on prod 534) | 1 site bug (PAGE-09, fixed), 1 harness defect (MATRIX-09, fixed); on prod only PAGE-09 ×12 until the fix deploys | 0 (build lane ×2: 1746/1746; tablet ×2: 1074/1074) | 7 of 7 since 2026-10-26; 1 failed (2026-10-31 EXT-02, transient Apple Podcasts 500, fixed by #53) |
| 2026-11-09 | 242 | 22 | 90.9% | 147/151 (97%) | 162/172 (94%) | 165/175 (94%) | 52/64 (81%) | 955 / 591 / 950 on the branch (main: 939 / 582 / 934; tablet on prod 588) | 0 site bugs, 0 failed on the box; 1 checker defect (MATRIX-10, fixed: manual checks counted as tests, so main's true numbers were 26 no test, desktop 96%, phone 93%, tablet 93%, independent 49/63); CI on main: 2 desktop-webkit timeouts after #56 (runner capacity, brief queued) | 0 (build lane ×2: 1910/1910; tablet ×2: 1182/1182) | 8 of 8 since 2026-11-02, all PASS (02:08 UTC from 11-03 under nightly-run-all.sh) |
