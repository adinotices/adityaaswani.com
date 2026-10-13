# Observability runbook

## Where it runs
- adityaaswani.com: Astro static site on GitHub Pages (custom domain via `public/CNAME`), deployed by `.github/workflows/deploy.yml` on push to `main`. No server runtime.

## Web analytics
- Cloudflare Web Analytics (cookieless): Cloudflare dash > Analytics & Logs > Web Analytics > site `adityaaswani.com`.
- Beacon is an external script in `src/layouts/Layout.astro` (token `cfcbbc56a1534a87bef6280a5026c2dd`). The `/zoom` redirect and the design variants in `design-previews/` (built only for the preview project) do not carry it.
- Plausible is also installed in the same layout.
- No CSP is set (GitHub Pages cannot send custom headers; no meta CSP), so no allowlist changes are needed.

## Logs
- GitHub Pages has no server logs; analytics only.
- Deployment logs: `gh run list -R adinotices/adityaaswani.com` then `gh run view <id> -R adinotices/adityaaswani.com --log`.

## Retention
- Web Analytics per Cloudflare plan; GitHub Actions logs per GitHub retention (90 days default).

## Health / uptime
- Monitored by sutam/.github/workflows/uptime.yml from ~/repos/monitoring/urls.yaml.

## Errors
- Sentry: deferred until the owner supplies an org token.
