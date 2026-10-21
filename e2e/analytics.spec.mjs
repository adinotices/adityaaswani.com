// Analytics (FEATURES.md ANA-*). Live only: the real scripts load from their CDNs. No page-view
// event is asserted: Plausible ignores localhost and automated browsers (navigator.webdriver)
// by design, and the guard fixture answers any event locally, so test visits are never counted.
// Only this file runs the real Cloudflare beacon (ANA-04); it stays on one page so the beacon's
// /cdn-cgi/rum POST is never cut off by a navigation.
import { test, expect } from './fixtures.mjs';

test.use({ realBeacon: true });

test('ANA-01 @live Plausible and Cloudflare Web Analytics load under the CSP', async ({ page }) => {
  const scripts = [];
  page.on('response', (r) => { if (/plausible\.io\/js\/|static\.cloudflareinsights\.com\/beacon/.test(r.url())) scripts.push(`${r.status()} ${new URL(r.url()).host}`); });
  const rum = page.waitForResponse(/cloudflareinsights\.com\/cdn-cgi\/rum/, { timeout: 15_000 }).catch(() => null);
  await page.goto('/support/');
  // Preview builds (PUBLIC_PREVIEW=1, Cloudflare Pages) carry noindex everywhere and no analytics.
  test.skip((await page.locator('meta[name="robots"]').count()) > 0, 'preview build: no analytics by design');
  await page.waitForLoadState('networkidle');
  expect(scripts.sort()).toEqual(['200 plausible.io', '200 static.cloudflareinsights.com']);
  expect(await page.evaluate(() => typeof window.plausible)).toBe('function');
  // The beacon ran: its rum POST left the page (past connect-src) and the guard answered it.
  expect((await rum)?.status(), 'beacon rum POST answered locally').toBe(204);
});
