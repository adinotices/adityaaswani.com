# adityaaswani.com

Personal website for Aditya Aswani — Buddhist, writer, and animal rights activist.

## Tech Stack
- [Astro](https://astro.build/) (static site generator)
- TypeScript
- Custom CSS (no framework)
- Deployed via GitHub Pages with a custom domain

## Pages
- `/` — Homepage with bio, work, writing, and newsletter subscribe
- `/links` — Link-in-bio page (used as social bio link)
- `/contact` — Contact and feedback page
- `/learn-meditation` — One-on-one meditation guidance info
- `/support` — Support page (give flow through Stripe)
- `/support/thanks` — Thank-you page after a gift
- `/zoom` — Redirect to the meditation Zoom room
- `404` — Not-found page

## Development
Needs Node 22.

```bash
npm install
npm run dev
```

## Testing
```bash
npm test                               # unit tests
npm run build && npm run test:dist     # checks on dist/
npm run build && npm run test:e2e      # Playwright: Chromium, Firefox, WebKit
npm run check:matrix -- origin/main    # feature matrix check
```

Every feature, its edge cases and its tests are in `docs/testing/FEATURES.md`.

## Deployment
`.github/workflows/deploy.yml` deploys to GitHub Pages on every push to `main`, on the Monday 09:00 UTC rebuild (new essays from the Substack feed), and on a manual run. Pull requests only build and test. The jobs run on a self-hosted runner, so nothing deploys while it is offline.
