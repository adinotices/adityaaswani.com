# Font-size audit

Imports resolve from the script directory, so run the copies in `~/repos/audits/font-size-tools` (identical to these). Runs in a Steel cloud browser (390 px and 1280 px, light and dark). Needs puppeteer-core + dotenv and STEEL_API_KEY; the deps live in `~/repos/audits/font-size-tools` (this repo's package.json is left alone).

    source ~/.nvm/nvm.sh
    cd ~/repos/audits/font-size-tools
    node fontaudit.mjs <repo>/scripts/font-size-audit/pages.mjs <repo>/docs/audits/2026-10-11-font-size/after
    node report.mjs before/results.json after/results.json > ../2026-10-11-font-size.md

Set `AUDIT_LOCAL=<repo>/dist` to audit a local build in place of the live origin.
