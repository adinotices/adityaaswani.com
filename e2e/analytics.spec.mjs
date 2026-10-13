// Analytics (FEATURES.md ANA-*). Live only: the real scripts load from their CDNs. No page-view
// event is asserted: Plausible ignores localhost and automated browsers (navigator.webdriver)
// by design, and the guard fixture answers any event locally, so test visits are never counted.
import { test, expect } from './fixtures.mjs';

test('ANA-01 @live Plausible and Cloudflare Web Analytics load under the CSP', async ({ page }) => {
  const scripts = [];
  page.on('response', (r) => { if (/plausible\.io\/js\/|static\.cloudflareinsights\.com\/beacon/.test(r.url())) scripts.push(`${r.status()} ${new URL(r.url()).host}`); });
  await page.goto('/support/');
  await page.waitForLoadState('networkidle');
  expect(scripts.sort()).toEqual(['200 plausible.io', '200 static.cloudflareinsights.com']);
  expect(await page.evaluate(() => typeof window.plausible)).toBe('function');
});
