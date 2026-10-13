// axe-core pass over the design variants on the adityaaswani-preview Pages project, in a Steel
// cloud browser at 390 px and 1280 px. Usage (docs/DESIGN-PREVIEWS.md):
//   STEEL_API_KEY=... node scripts/design-previews-axe.mjs [origin] > results.json
// puppeteer-core is borrowed from ~/repos/audits/font-size-tools (AUDIT_DEPS overrides), so this
// repo's package.json stays free of audit tooling.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

const origin = (process.argv[2] ?? 'https://design-previews.adityaaswani-preview.pages.dev').replace(/\/$/, '');
const deps = process.env.AUDIT_DEPS ?? join(homedir(), 'repos/audits/font-size-tools/');
const puppeteer = createRequire(deps.endsWith('/') ? deps : deps + '/')('puppeteer-core');
const key = process.env.STEEL_API_KEY;
if (!key) throw new Error('STEEL_API_KEY is not set');

const PATHS = ['/previews/', '/preview/', '/preview-dark/', '/preview-brutalist/', '/preview-japanese/', '/preview-pixel/', '/preview-anime/'];
const VIEWPORTS = [{ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, { width: 1280, height: 900 }];
const AXE = await (await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js')).text();

const steel = (path, body) => fetch(`https://api.steel.dev/v1/sessions${path}`, {
  method: 'POST', headers: { 'steel-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}),
});
const session = await (await steel('', { timeout: 600000 })).json();
if (!session.id) throw new Error('Steel session failed');
const results = [];
try {
  const browser = await puppeteer.connect({ browserWSEndpoint: `wss://connect.steel.dev?apiKey=${key}&sessionId=${session.id}`, defaultViewport: null });
  const page = await browser.newPage();
  for (const vp of VIEWPORTS) {
    await page.setViewport(vp);
    for (const path of PATHS) {
      const res = await page.goto(origin + path, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.evaluate(AXE); // CDP evaluate: the page CSP would block an injected <script>
      const violations = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
        .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) })));
      results.push({ path, width: vp.width, status: res.status(), violations });
      console.error(`${vp.width} ${path} ${res.status()} ${violations.map((v) => `${v.id}:${v.nodes}`).join(' ') || 'clean'}`);
    }
  }
  await browser.disconnect();
} finally {
  await steel(`/${session.id}/release`);
}
console.log(JSON.stringify({ origin, axe: '4.10.2', at: new Date().toISOString(), steelSession: session.id, results }, null, 2));
