// Shared fixtures for the e2e suite.
// - Every test fails on a console error, an uncaught page error, a CSP violation or a
//   failed same-origin request, unless the test calls guard.allow(/pattern/) first.
//   Firefox's navigation-aborted font loads are ignored everywhere (console-filter.mjs).
// - Analytics never record a test visit: Plausible events and the Cloudflare beacon are
//   answered locally. In live runs (E2E_LIVE=1) Plausible still loads from its CDN, so the CSP
//   is exercised against the real file. The real Cloudflare beacon runs only in tests that
//   opt in with test.use({ realBeacon: true }) (ANA-01); everywhere else it gets an empty
//   script, because WebKit reports its preflighted /cdn-cgi/rum POST as a page error
//   ("... due to access control checks") when a navigation cuts it off (ANA-04).
// - Stripe pages are never opened: checkout.stripe.com, buy.stripe.com and
//   billing.stripe.com navigations get a stub page that names the URL.
import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { isIgnoredConsoleError } from './console-filter.mjs';

export const supportLinks = JSON.parse(readFileSync(new URL('../src/data/support-links.json', import.meta.url), 'utf8'));
export const CHECKOUT_URL = 'https://sutam.org/api/donate/checkout';
export const PROD = 'https://adityaaswani.com';

export const PAGES = [
  { path: '/', h1: /Hi, I’m Aditya/ },
  { path: '/links/', h1: /Aditya Aswani/ },
  { path: '/contact/', h1: /Let's Connect/ },
  { path: '/learn-meditation/', h1: /Learn Meditation/ },
  { path: '/support/', h1: /Support my work/ },
  { path: '/support/thanks/', h1: /Thank you/ },
];

export const isProd = (baseURL) => new URL(baseURL).host === 'adityaaswani.com';

const STRIPE_STUB = (url) =>
  `<!doctype html><meta charset="utf-8"><title>Stripe stub</title><p id="stub-url">${url.replace(/</g, '&lt;')}</p>`;

export const test = base.extend({
  realBeacon: [false, { option: true }],
  guard: [
    async ({ page, realBeacon }, use) => {
      const problems = [];
      const allowed = [];
      const ok = (text) => allowed.some((re) => re.test(text));
      await page.addInitScript(() => {
        window.__csp = [];
        document.addEventListener('securitypolicyviolation', (e) => {
          window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
        });
      });
      page.on('console', (m) => {
        if (m.type() === 'error' && !ok(m.text()) && !isIgnoredConsoleError(m.text())) problems.push(`console: ${m.text()}`);
      });
      page.on('pageerror', (e) => {
        if (!ok(e.message)) problems.push(`pageerror: ${e.message}`);
      });
      page.on('requestfailed', (r) => {
        const sameOrigin = new URL(r.url()).origin === new URL(page.url() || 'about:blank').origin;
        const why = r.failure()?.errorText ?? '';
        // Navigations away and our own aborts are not failures of the site.
        if (sameOrigin && !/ABORTED|cancelled|NS_BINDING_ABORTED/i.test(why) && !ok(r.url())) {
          problems.push(`requestfailed: ${r.url()} ${why}`);
        }
      });
      await page.route(/plausible\.io\/api\/event/, (r) => r.fulfill({ status: 202, body: 'ok' }));
      // Outside live runs the analytics scripts are answered locally too, so a CDN hiccup can't fail CI.
      const emptyScript = (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
      if (process.env.E2E_LIVE !== '1') await page.route(/^https:\/\/plausible\.io\/js\//, emptyScript);
      if (process.env.E2E_LIVE !== '1' || !realBeacon) await page.route(/^https:\/\/static\.cloudflareinsights\.com\//, emptyScript);
      await page.route(/cloudflareinsights\.com\/cdn-cgi\/rum/, (r) => r.fulfill({ status: 204 }));
      await page.route(/^https:\/\/(checkout|buy|billing)\.stripe\.com\//, (r) =>
        r.fulfill({ status: 200, contentType: 'text/html', body: STRIPE_STUB(r.request().url()) }),
      );
      const guard = {
        allow: (re) => allowed.push(re),
        async cspViolations() {
          try { return await page.evaluate(() => window.__csp ?? []); } catch { return []; }
        },
      };
      await use(guard);
      const csp = (await guard.cspViolations()).filter((v) => !ok(v));
      expect.soft(csp, 'CSP violations').toEqual([]);
      expect.soft(problems, 'console errors / page errors / failed requests').toEqual([]);
    },
    { auto: true },
  ],

  // Records POSTs to the donate Worker and answers them as `respond(body)` says.
  // respond returns { status, json } or 'abort' or 'hang'.
  checkout: async ({ page }, use) => {
    const calls = [];
    let respond = () => ({ status: 200, json: { ok: true, url: 'https://checkout.stripe.com/c/pay/cs_test_e2e', id: 'cs_test_e2e' } });
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    await page.route(CHECKOUT_URL, async (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const body = req.postDataJSON();
      calls.push(body);
      const r = respond(body);
      if (r === 'abort') return route.abort('failed');
      if (r === 'hang') return; // never answered: the client's own timeout must fire
      return route.fulfill({ status: r.status, headers: cors, contentType: 'application/json', body: JSON.stringify(r.json) });
    });
    await use({ calls, respondWith: (fn) => { respond = fn; } });
  },
});

export { expect };

// Fails if the document is wider than the viewport (sideways scrolling on a phone).
export async function expectNoHorizontalOverflow(page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, 'page scrolls sideways').toBeLessThanOrEqual(cw);
}
