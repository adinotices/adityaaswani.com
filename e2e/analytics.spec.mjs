// Analytics (FEATURES.md ANA-*). ANA-01 is live only: the real scripts load from their CDNs.
// Test visits are never counted: Layout.astro skips Plausible under navigator.webdriver or
// localStorage.plausible_ignore, the fixtures set that flag in every context, and the guard fixture
// answers any event locally, even under realVisitor. Only ANA-01 runs the real Cloudflare beacon
// (ANA-04); it stays on one page so the beacon's /cdn-cgi/rum POST is never cut off by a navigation.
import { test, expect, isProd } from './fixtures.mjs';

const PLAUSIBLE_SRC = 'https://plausible.io/js/pa-bwqzj0WiW7cQd51RChC7F.js';
const plausibleTag = (page) => page.locator('script[src*="plausible.io/js/"]');
const setWebdriver = () => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => true, configurable: true });

test.describe('real scripts', () => {
  test.use({ realBeacon: true, realVisitor: true });

  test('ANA-01 @live Plausible and Cloudflare Web Analytics load under the CSP', async ({ page, baseURL, guard }) => {
    const scripts = [];
    page.on('response', (r) => { if (/plausible\.io\/js\/|static\.cloudflareinsights\.com\/beacon/.test(r.url())) scripts.push(`${r.status()} ${new URL(r.url()).host}`); });
    const rum = page.waitForResponse(/cloudflareinsights\.com\/cdn-cgi\/rum/, { timeout: 15_000 }).catch(() => null);
    await page.goto('/support/');
    // Preview builds (PUBLIC_PREVIEW=1, Cloudflare Pages) carry noindex everywhere and no analytics.
    // Never skipped against prod: a production page with noindex is a failure (SEO-05), not a preview.
    test.skip(!isProd(baseURL) && (await page.locator('meta[name="robots"]').count()) > 0, 'preview build: no analytics by design');
    await page.waitForLoadState('networkidle');
    expect(scripts.sort()).toEqual(['200 plausible.io', '200 static.cloudflareinsights.com']);
    expect(await page.evaluate(() => typeof window.plausible)).toBe('function');
    // The beacon ran: its rum POST left the page (past connect-src) and the guard answered it.
    expect((await rum)?.status(), 'beacon rum POST answered locally').toBe(204);
    // On prod the real tracker sends the page view (it ignores localhost). The guard must stop it,
    // or this test would itself be a visit in the dashboard.
    if (isProd(baseURL)) await expect.poll(() => guard.plausibleEvents.length, 'page view stopped at the guard').toBe(1);
  });
});

test.describe('a person', () => {
  test.use({ realVisitor: true });

  test('ANA-05 a real visitor gets the Plausible script, async, under the CSP', async ({ page }) => {
    const loaded = page.waitForResponse(PLAUSIBLE_SRC);
    await page.goto('/support/thanks/');
    expect((await loaded).status()).toBe(200);
    await expect(plausibleTag(page)).toHaveCount(1);
    expect(await plausibleTag(page).evaluate((s) => [s.src, s.async])).toEqual([PLAUSIBLE_SRC, true]);
    expect(await page.evaluate(() => typeof window.plausible)).toBe('function');
  });

  test('ANA-06 navigator.webdriver keeps the script out', async ({ page }) => {
    await page.addInitScript(setWebdriver);
    await page.goto('/support/thanks/');
    await expect(plausibleTag(page)).toHaveCount(0);
    expect(await page.evaluate(() => typeof window.plausible), 'calls to plausible() must not throw').toBe('function');
  });

  test('ANA-07 localStorage.plausible_ignore keeps the script out with webdriver hidden', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('plausible_ignore', 'true'));
    await page.goto('/support/thanks/');
    expect(await page.evaluate(() => navigator.webdriver)).toBe(false);
    await expect(plausibleTag(page)).toHaveCount(0);
  });

  test('ANA-08 a visitor whose browser blocks localStorage is still counted', async ({ page, guard }) => {
    guard.allow(/storage blocked/);
    await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } }));
    await page.goto('/support/');
    await expect(plausibleTag(page)).toHaveCount(1);
  });
});

test('ANA-02 every test context is opted out, on every page it opens', async ({ page, context }) => {
  await page.goto('/support/thanks/');
  await expect(plausibleTag(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('plausible_ignore'))).toBe('true');
  const second = await context.newPage();
  await second.goto('/support/');
  await expect(plausibleTag(second)).toHaveCount(0);
});
