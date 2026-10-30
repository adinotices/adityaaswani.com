// Every page, every browser (FEATURES.md PAGE-*, A11Y-*, SEO-*, ERR404-*).
import AxeBuilder from '@axe-core/playwright';
import { test, expect, PAGES, expectNoHorizontalOverflow } from './fixtures.mjs';

for (const p of PAGES) {
  test.describe(p.path, () => {
    test(`PAGE-01 ${p.path} loads with its heading, one main landmark and no broken images`, async ({ page }) => {
      const res = await page.goto(p.path);
      expect(res.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toContainText(p.h1);
      await expect(page.locator('main#main')).toHaveCount(1);
      await expect(page).toHaveTitle(/Aditya Aswani|Thank you/);
      // Bring each lazy image into view and wait for it to decode; a 404 or corrupt file rejects.
      // Not scrollIntoViewIfNeeded: its "stable" check counts animation frames, and a starved
      // WebKit paints one every few seconds, which ran `/` (12 images) out of the 30 s (AA-S19).
      // Instant, or the site's smooth scroll is still moving; then wait for the lazy load itself,
      // because WebKit rejects decode() on an image whose load has not started.
      const broken = [];
      for (const img of await page.locator('img').all()) {
        if (!(await img.isVisible())) continue;
        await img.evaluate((i) => {
          i.scrollIntoView({ block: 'center', behavior: 'instant' });
          return i.complete || new Promise((done) => { i.addEventListener('load', done); i.addEventListener('error', done); });
        });
        const ok = await img.evaluate((i) => (i.complete && i.naturalWidth > 0 ? true : i.decode().then(() => i.naturalWidth > 0, () => false)));
        if (!ok) broken.push(await img.evaluate((i) => i.currentSrc || i.src));
      }
      expect(broken).toEqual([]);
    });

    test(`PAGE-02 ${p.path} never scrolls sideways, at this device's width and at 320 px`, async ({ page }) => {
      await page.goto(p.path);
      await expectNoHorizontalOverflow(page);
      await page.setViewportSize({ width: 320, height: 700 });
      await expectNoHorizontalOverflow(page);
    });

    test(`PAGE-03 ${p.path} uses the site fonts`, async ({ page }) => {
      await page.goto(p.path);
      await page.evaluate(() => document.fonts.ready);
      const fams = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
      expect(fams.some((f) => /Nunito/i.test(f)), fams.join()).toBe(true);
    });

    for (const scheme of ['light', 'dark']) {
      test(`A11Y-01 ${p.path} has no axe violations in ${scheme} mode`, async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'axe results do not depend on the engine; Chromium desktop and phone cover both layouts');
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(p.path);
        // Upsell and portal note are hidden by default; show both so they are checked too.
        if (p.path === '/support/thanks/') await page.goto('/support/thanks/?type=once');
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target})`)).toEqual([]);
      });
    }
  });
}

// Longest transition or animation on the page, in ms (the menu panel included when it is open).
const longestMotion = (page) => page.evaluate(() => {
  const ms = (v) => Math.max(...v.split(',').map((t) => parseFloat(t) * (t.trim().endsWith('ms') ? 1 : 1000)));
  let max = 0;
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.transitionProperty !== 'none') max = Math.max(max, ms(cs.transitionDuration));
    if (cs.animationName !== 'none') max = Math.max(max, ms(cs.animationDuration));
  }
  return max;
});

test('PAGE-08 with reduced motion no transition or animation runs, the open menu included', async ({ page }) => {
  const menu = page.viewportSize().width < 820;
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  expect(await longestMotion(page), 'the cards animate without the preference').toBeGreaterThan(100);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const p of PAGES) {
    await page.goto(p.path);
    expect(await longestMotion(page), p.path).toBeLessThanOrEqual(0.01);
  }
  if (menu) {
    await page.goto('/contact/');
    await page.locator('.menu-toggle').click();
    await expect(page.locator('#site-nav')).toBeVisible();
    expect(await longestMotion(page), 'open menu').toBeLessThanOrEqual(0.01);
  }
});

test('A11Y-02 the /support Other field and its error are announced', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine');
  await page.goto('/support/');
  await page.locator('.opt', { hasText: 'Other' }).filter({ visible: true }).click();
  await page.locator('#other-amount').fill('0.5');
  const r = await new AxeBuilder({ page }).include('#give').analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
  await expect(page.locator('#other-amount')).toHaveAttribute('aria-describedby', 'other-error');
  await expect(page.locator('#other-error')).toHaveAttribute('aria-live', 'polite');
});

test('ERR404-01 an unknown URL answers 404 with the site 404 page and a way home', async ({ page, guard }) => {
  guard.allow(/status of 404/);
  const res = await page.goto('/no-such-page/');
  expect(res.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('404');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await page.locator('main a', { hasText: 'Go home' }).click();
  await expect(page).toHaveURL(/\/$/);
});

for (const old of ['/preview/', '/previews/', '/preview-pixel/', '/aditya-photo-new.jpg']) {
  test(`ERR404-02 the retired ${old} answers 404`, async ({ page, browserName, guard }) => {
    test.skip(browserName !== 'chromium', 'status codes do not depend on the engine');
    guard.allow(/status of 404/);
    const res = await page.goto(old);
    expect(res.status()).toBe(404);
  });
}

test('SEO-01 every sitemap URL answers 200 and the thank-you page is not listed', async ({ page, request, baseURL, browserName }) => {
  test.skip(browserName !== 'chromium', 'one HTTP sweep');
  const idx = await (await request.get('/sitemap-index.xml')).text();
  const maps = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const urls = [];
  for (const m of maps) urls.push(...[...(await (await request.get(m)).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]));
  expect(urls.length).toBeGreaterThanOrEqual(5);
  expect(urls.some((u) => u.includes('/support/thanks'))).toBe(false);
  for (const u of urls) {
    expect(u.startsWith('https://adityaaswani.com/'), u).toBe(true);
    const r = await request.get(new URL(new URL(u).pathname, baseURL).href, { maxRedirects: 0 });
    expect(r.status(), u).toBe(200);
  }
});

test('SEO-02 robots.txt, security.txt and the web manifest are served', async ({ request, browserName }) => {
  test.skip(browserName !== 'chromium', 'one HTTP sweep');
  expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap: https://adityaaswani.com/sitemap-index.xml');
  const sec = await request.get('/.well-known/security.txt');
  expect(sec.status()).toBe(200);
  const expires = (await sec.text()).match(/^Expires: (.+)$/m)?.[1];
  expect(new Date(expires).getTime(), 'security.txt has expired').toBeGreaterThan(Date.now() + 30 * 864e5);
  expect((await request.get('/site.webmanifest')).status()).toBe(200);
});

test('SEO-03 each page shares a title, description and an image that loads', async ({ page, request }) => {
  for (const p of PAGES) {
    await page.goto(p.path);
    for (const prop of ['og:title', 'og:description', 'og:image', 'og:url']) {
      await expect(page.locator(`meta[property="${prop}"]`), `${p.path} ${prop}`).toHaveCount(1);
    }
    const img = new URL(await page.locator('meta[property="og:image"]').getAttribute('content'));
    const r = await request.get(img.pathname);
    expect(r.status(), `${p.path} og:image ${img.pathname}`).toBe(200);
  }
});

test('ZOOM-01 /zoom sends visitors on to the Zoom room', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine');
  await page.route(/zoom\.us/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>zoom stub</title>' }));
  await page.goto('/zoom');
  await page.waitForURL(/cmu\.zoom\.us\/j\/4722169152/);
});
