// Every page, every browser (FEATURES.md PAGE-*, A11Y-*, SEO-*, ERR404-*).
import AxeBuilder from '@axe-core/playwright';
import { gzipSync } from 'node:zlib';
import { test, expect, PAGES, PROD, expectNoHorizontalOverflow } from './fixtures.mjs';

// The browser's text setting, not just a root style, is what a person with 200% text has. Root 32 px gives the same layout.
const at200 = async (page, path) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.evaluate(() => document.fonts.ready);
};

const brokenWords = async (page, path) => {
  await at200(page, path);
  return page.evaluate(() => {
    const out = [];
    const root = document.querySelector('main') ?? document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const lines = (node, start, end) => {
      const r = document.createRange();
      r.setStart(node, start);
      r.setEnd(node, end);
      return new Set([...r.getClientRects()].filter((c) => c.width > 0).map((c) => Math.round(c.top))).size;
    };
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      // Headings are excluded: at 50 px and up, one long word can be wider than a phone.
      if (!el.offsetParent || el.closest('.sr-only, h1, h2, h3, script, style')) continue;
      for (const m of node.data.matchAll(/[^\s]{8,}/g)) {
        if (/[-/@]/.test(m[0])) continue; // a hyphen, slash or inline address is a fair place to break
        if (lines(node, m.index, m.index + m[0].length) > 1) out.push(m[0]);
      }
    }
    return out;
  });
};
const noFirefox = 'layout at a larger root size is covered in Chromium and WebKit';

test('PAGE-12 /support/ with text at 200% on a 390 px phone: words stay whole', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', noFirefox);
  expect(await brokenWords(page, '/support/')).toEqual([]);
});

test('PAGE-12 /links/ with text at 200% on a 390 px phone: words stay whole', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', noFirefox);
  expect(await brokenWords(page, '/links/')).toEqual([]);
});

test('PAGE-12 /learn-meditation/ with text at 200% on a 390 px phone: words stay whole', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', noFirefox);
  expect(await brokenWords(page, '/learn-meditation/')).toEqual([]);
});

test('HOME-18 home with text at 200% on a 390 px phone: words stay whole', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', noFirefox);
  expect(await brokenWords(page, '/')).toEqual([]);
});

test('CONTACT-05 /contact/ with text at 200% on a 390 px phone: words stay whole', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', noFirefox);
  expect(await brokenWords(page, '/contact/')).toEqual([]);
});

test('THX-13 /support/thanks/ with text at 200% on a 390 px phone: words stay whole', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', noFirefox);
  expect(await brokenWords(page, '/support/thanks/?type=once')).toEqual([]);
});

test('FOOT-07 the social links stay inside the page with text at 200% on a 390 px phone', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', noFirefox);
  await at200(page, '/contact/');
  const right = await page.evaluate(() => document.querySelector('.socials').getBoundingClientRect().right);
  expect(right).toBeLessThanOrEqual(390);
});

test('THEME-13 the menu theme button stays round with text at 200%', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'layout at a larger root size is covered in Chromium and WebKit');
  await at200(page, '/');
  await page.locator('.menu-toggle').click();
  const box = await page.locator('header .theme-toggle:visible').first().boundingBox();
  expect(Math.abs(box.width - box.height)).toBeLessThan(1);
});

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

// WCAG 1.4.4: text at 200% keeps working. The site sizes text in rem, so a 32 px root is what a
// visitor's "very large" browser font gives. Nothing may scroll sideways or get clipped.
for (const p of PAGES) {
  test(`PAGE-09 ${p.path} with text at 200%: no sideways scroll, nothing cut off`, async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'layout at a larger root size is covered in Chromium and WebKit');
    await page.goto(p.path);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))).toBe(32);
    await expectNoHorizontalOverflow(page);
    const clipped = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3, p, a.btn, button, label')]
      .filter((el) => el.offsetParent && !el.closest('.sr-only, .skip-link') && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && getComputedStyle(el).overflowX !== 'visible')
      .map((el) => `${el.tagName} ${el.textContent.trim().slice(0, 30)}`));
    expect(clipped).toEqual([]);
  });
}

// A budget that does not depend on the box's load, unlike a timed LCP: the bytes a phone must fetch
// before the first screen can paint, gzipped as GitHub Pages serves them. At PSI's Slow 4G (1.6 Mbps,
// 150 ms RTT, 4 round trips) 2.5 s of LCP leaves room for about 380 KB. Today's pages need 139 and
// 105 KB, so 200 KB fails on a real regression long before the ceiling.
const BUDGET_KB = { '/': 200, '/support/': 200 };
for (const [path, budget] of Object.entries(BUDGET_KB)) {
  test(`PAGE-11 ${path} stays inside the critical-bytes budget and blocks on no third party`, async ({ page, browserName, baseURL }) => {
    test.skip(browserName !== 'chromium', 'bytes do not depend on the engine');
    const bodies = new Map();
    page.on('response', async (r) => {
      const type = r.request().resourceType();
      if (!['document', 'stylesheet', 'font', 'image'].includes(type)) return;
      if (r.status() !== 200 || new URL(r.url()).origin !== new URL(baseURL).origin) return;
      bodies.set(r.url(), { type, body: r.body().catch(() => Buffer.alloc(0)) });
    });
    await page.goto(path, { waitUntil: 'load' });
    const hero = await page.evaluate(() => {
      const lcp = document.querySelector('.hero .portrait img');
      return lcp ? { src: lcp.currentSrc, lazy: lcp.loading === 'lazy', top: lcp.getBoundingClientRect().top } : null;
    });
    if (path === '/') {
      expect(hero?.lazy, 'the portrait is the LCP image and must not be lazy').toBe(false);
      await page.waitForFunction(() => document.querySelector('.hero .portrait img').complete);
    }
    let bytes = 0;
    const list = [];
    for (const [url, { type, body }] of bodies) {
      // Images count only if they are the LCP image: lazy cards below the fold don't block the first paint.
      if (type === 'image' && url !== hero?.src) continue;
      const raw = await body;
      const size = type === 'font' || type === 'image' ? raw.length : gzipSync(raw).length;
      bytes += size;
      list.push(`${(size / 1024).toFixed(1)} KB ${new URL(url).pathname}`);
    }
    console.log(`[PAGE-11] ${path}: ${(bytes / 1024).toFixed(0)} KB of ${budget} KB (${list.join(', ')})`);
    expect(bytes / 1024, list.join('\n')).toBeLessThanOrEqual(budget);
    // Scripts from other origins must not hold up the first paint.
    const blocking = await page.locator('head script[src^="http"]:not([async]):not([defer])').count();
    expect(blocking).toBe(0);
  });
}

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

test('SEO-05 every public page is indexable: its own canonical, no robots noindex', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine');
  for (const p of PAGES.filter((x) => x.path !== '/support/thanks/')) {
    await page.goto(p.path);
    await expect(page.locator('link[rel="canonical"]'), p.path).toHaveAttribute('href', `${PROD}${p.path}`);
    await expect(page.locator('meta[name="robots"]'), p.path).toHaveCount(0);
  }
});

test('SEO-10 every icon a page or the web manifest names answers 200 as an image', async ({ page, request, browserName }) => {
  test.skip(browserName !== 'chromium', 'one HTTP sweep');
  await page.goto('/');
  const manifest = await (await request.get('/site.webmanifest')).json();
  expect(manifest.name).toBe('Aditya Aswani');
  const links = await page.locator('link[rel~="icon"], link[rel="apple-touch-icon"]').evaluateAll((ls) => ls.map((l) => new URL(l.href).pathname));
  expect(links.length).toBeGreaterThanOrEqual(4);
  for (const path of [...links, ...manifest.icons.map((i) => i.src)]) {
    const r = await request.get(path);
    expect(r.status(), path).toBe(200);
    expect(r.headers()['content-type'], path).toMatch(/^image\//);
  }
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

test.describe('ZOOM: without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('ZOOM-02 with JavaScript off the meta refresh still sends visitors to the Zoom room', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'one engine');
    await page.route(/zoom\.us/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>zoom stub</title>' }));
    await page.goto('/zoom');
    await page.waitForURL(/cmu\.zoom\.us\/j\/4722169152/);
  });
});
