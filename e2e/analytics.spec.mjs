// Analytics (FEATURES.md ANA-*). ANA-01 is live only: the real scripts load from their CDNs.
// Test visits are never counted: Layout.astro skips Plausible and the Cloudflare beacon under
// navigator.webdriver or localStorage.plausible_ignore, the fixtures set that flag in every context,
// and the guard fixture answers any event locally, even under realVisitor. Only ANA-01 runs the real Cloudflare beacon
// (ANA-04); it stays on one page so the beacon's /cdn-cgi/rum POST is never cut off by a navigation.
import { test, expect, isProd } from './fixtures.mjs';

const PLAUSIBLE_SRC = 'https://plausible.io/js/pa-bwqzj0WiW7cQd51RChC7F.js';
const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
const BEACON_TOKEN = 'cfcbbc56a1534a87bef6280a5026c2dd';
const plausibleTag = (page) => page.locator('script[src*="plausible.io/js/"]');
const beaconTag = (page) => page.locator('script[src*="cloudflareinsights.com"]');
// Every request to Cloudflare Web Analytics, script or event: a skipped visitor must make none.
const watchBeacon = (page) => { const urls = []; page.on('request', (r) => { if (/cloudflareinsights\.com/.test(r.url())) urls.push(r.url()); }); return urls; };
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
    const answered = await rum;
    expect(answered?.status(), 'beacon rum POST answered locally').toBe(204);
    // The bootstrap adds the tag at runtime, so prove the beacon still found its token on it.
    expect(answered.request().postDataJSON().siteToken).toBe(BEACON_TOKEN);
    // On prod the real tracker sends the page view (it ignores localhost). The guard must stop it,
    // or this test would itself be a visit in the dashboard.
    if (isProd(baseURL)) await expect.poll(() => guard.plausibleEvents.length, 'page view stopped at the guard').toBe(1);
  });
});

test.describe('a person', () => {
  test.use({ realVisitor: true });

  test('ANA-05 a real visitor gets both scripts, async, same src and token, under the CSP', async ({ page }) => {
    const loaded = page.waitForResponse(PLAUSIBLE_SRC);
    const beacon = page.waitForResponse(BEACON_SRC);
    await page.goto('/support/thanks/');
    expect((await loaded).status()).toBe(200);
    expect((await beacon).status()).toBe(200);
    await expect(beaconTag(page)).toHaveCount(1);
    expect(await beaconTag(page).evaluate((s) => [s.src, s.async, s.getAttribute('data-cf-beacon')])).toEqual([BEACON_SRC, true, `{"token":"${BEACON_TOKEN}"}`]);
    await expect(plausibleTag(page)).toHaveCount(1);
    expect(await plausibleTag(page).evaluate((s) => [s.src, s.async])).toEqual([PLAUSIBLE_SRC, true]);
    expect(await page.evaluate(() => typeof window.plausible)).toBe('function');
  });

  test('ANA-06 navigator.webdriver keeps both scripts out', async ({ page }) => {
    const beacon = watchBeacon(page);
    await page.addInitScript(setWebdriver);
    await page.goto('/support/thanks/', { waitUntil: 'load' });
    await expect(plausibleTag(page)).toHaveCount(0);
    await expect(beaconTag(page)).toHaveCount(0);
    expect(beacon, 'no request to Cloudflare').toEqual([]);
    expect(await page.evaluate(() => typeof window.plausible), 'calls to plausible() must not throw').toBe('function');
  });

  test('ANA-07 localStorage.plausible_ignore keeps both scripts out with webdriver hidden', async ({ page }) => {
    const beacon = watchBeacon(page);
    await page.addInitScript(() => localStorage.setItem('plausible_ignore', 'true'));
    await page.goto('/support/thanks/', { waitUntil: 'load' });
    expect(await page.evaluate(() => navigator.webdriver)).toBe(false);
    await expect(plausibleTag(page)).toHaveCount(0);
    await expect(beaconTag(page)).toHaveCount(0);
    expect(beacon, 'no request to Cloudflare').toEqual([]);
  });

  test('ANA-08 a visitor whose browser blocks localStorage is still counted', async ({ page, guard }) => {
    guard.allow(/storage blocked/);
    await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } }));
    await page.goto('/support/');
    await expect(plausibleTag(page)).toHaveCount(1);
    await expect(beaconTag(page)).toHaveCount(1);
  });
});

test('ANA-02 every test context is opted out, on every page it opens', async ({ page, context }) => {
  const beacon = watchBeacon(page);
  await page.goto('/support/thanks/', { waitUntil: 'load' });
  await expect(plausibleTag(page)).toHaveCount(0);
  await expect(beaconTag(page)).toHaveCount(0);
  expect(beacon, 'no request to Cloudflare').toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('plausible_ignore'))).toBe('true');
  const second = await context.newPage();
  await second.goto('/support/');
  await expect(plausibleTag(second)).toHaveCount(0);
  await expect(beaconTag(second)).toHaveCount(0);
});
