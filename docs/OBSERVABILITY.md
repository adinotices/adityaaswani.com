# Observability runbook

## Where it runs
- adityaaswani.com: Astro static site on GitHub Pages (custom domain via `public/CNAME`), deployed by `.github/workflows/deploy.yml` on push to `main`, on a Monday 09:00 UTC rebuild and on a manual run. Its jobs run on the self-hosted gcp runner, so nothing deploys while that runner is offline. No server runtime.

## Web analytics
- Cloudflare Web Analytics (cookieless): Cloudflare dash > Analytics & Logs > Web Analytics > site `adityaaswani.com`.
- Beacon is added at runtime by the inline bootstrap in `src/layouts/Layout.astro` (token `cfcbbc56a1534a87bef6280a5026c2dd`). The `/zoom` redirect and the design variants in `design-previews/` (built only for the preview project) do not carry it.
- Plausible is also installed in the same layout. It shares that bootstrap.
- The bootstrap loads neither script in browsers with `navigator.webdriver` or `localStorage.plausible_ignore === "true"`, so Cloudflare, which has no opt-out of its own, skips the same visits as Plausible. The Playwright fixtures, the font-size audit and the design-preview axe run all set that flag.
- GitHub Pages cannot send custom headers, so production builds carry a meta CSP, filled in after the build by `scripts/csp-integration.mjs`. Plausible and Cloudflare are on its `script-src` and `connect-src` lists; a new analytics host has to be added there.

## Logs
- GitHub Pages has no server logs; analytics only.
- Deployment logs: `gh run list -R adinotices/adityaaswani.com` then `gh run view <id> -R adinotices/adityaaswani.com --log`.

## Retention
- Web Analytics per Cloudflare plan; GitHub Actions logs per GitHub retention (90 days default).

## Health / uptime
- Targets are in ~/repos/monitoring/urls.yaml. The ops-dashboard uptime cron reads it every 15 minutes, and each sutam deploy builds it into the uptime cron of sutam's Worker.
- Deploy proof: every page of a deploy build carries `<meta name="build" content="<sha> <built at>">`. The nightly's `deploy-marker` step compares it with main (`scripts/check-deploy-marker.mjs`).

## Errors
- Sentry: deferred until the owner supplies an org token.
