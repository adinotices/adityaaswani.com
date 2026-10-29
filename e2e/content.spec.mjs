// Page content and outbound links (FEATURES.md HOME-*, LINKS-*, CONTACT-*, MED-*, COPY-*; A11Y-07).
import AxeBuilder from '@axe-core/playwright';
import { test, expect, expectNoHorizontalOverflow } from './fixtures.mjs';

const external = (page) => page.locator('main a[href^="http"]:not([href^="https://adityaaswani.com"])');

test.describe('COPY: copy-email buttons', () => {
  test('COPY-01 Copy puts the address on the clipboard, announces it, and resets', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'reading the clipboard back needs Chromium permissions');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/contact/');
    const btn = page.locator('button[data-copy="support@adityaaswani.com"]');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(btn.locator('.copy-label')).toHaveText('Copied');
    await expect(page.locator('#copy-support-status')).toHaveText('Copied');
    // The other button's status is untouched.
    await expect(page.locator('#copy-hello-status')).toHaveText('');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('support@adityaaswani.com');
    await expect(btn.locator('.copy-label')).toHaveText('Copy', { timeout: 4000 });
    await expect(page.locator('#copy-support-status')).toHaveText('');
  });

  test('COPY-02 in every browser the Copy button either copies or says so; it never fails silently', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('button[data-copy="hello@adityaaswani.com"]');
    if (!(await btn.isVisible())) return; // no clipboard API: hidden, the address is still shown (COPY-03)
    await btn.click();
    await expect(page.locator('#copy-hello-status')).toHaveText(/^(Copied|Copy failed\. Select the address instead\.)$/);
  });

  test('COPY-03 without a clipboard API the buttons stay hidden and the address is still a mailto link', async ({ page }) => {
    await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined }); });
    await page.goto('/contact/');
    await expect(page.locator('button[data-copy]')).toHaveCount(2);
    await expect(page.locator('button[data-copy]').first()).toBeHidden();
    await expect(page.locator('a[href="mailto:hello@adityaaswani.com"]').first()).toBeVisible();
  });

  test('COPY-04 a clipboard that refuses shows the failure message', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => ({ writeText: () => Promise.reject(new Error('denied')) }) });
    });
    await page.goto('/contact/');
    await page.locator('button[data-copy="hello@adityaaswani.com"]').click();
    await expect(page.locator('#copy-hello-status')).toHaveText('Copy failed. Select the address instead.');
    await expect(page.locator('button[data-copy="hello@adityaaswani.com"] .copy-label')).toHaveText('Copy');
  });
});

test.describe('HOME', () => {
  test('HOME-01 the product cards link out for live products and to the newsletter for coming-soon ones', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('#building .card');
    expect(await cards.count()).toBe(5);
    for (const c of await cards.all()) {
      const badge = (await c.locator('.badge').textContent()).trim();
      const href = await c.locator('a.more').getAttribute('href');
      if (href === '#newsletter') expect(badge).toBe('Coming soon');
      else expect(href).toMatch(/^https:\/\//);
    }
  });

  test('HOME-02 the Writing section lists up to six essays, newest first, each linking to the essay site', async ({ page }) => {
    await page.goto('/');
    const items = page.locator('#writing .essay');
    const n = await items.count();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(6);
    const hrefs = await items.locator('h3 a').evaluateAll((as) => as.map((a) => a.href));
    for (const h of hrefs) expect(h).toMatch(/^https:\/\/essays\.adityaaswani\.com\/p\//);
    const dates = await items.locator('.date').allTextContents();
    const parsed = dates.map((d) => Date.parse(`1 ${d}`));
    expect([...parsed].sort((a, b) => b - a)).toEqual(parsed);
  });

  test('HOME-12 each product card has a known status and, where set, the month it last changed', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('#building .card');
    const badges = (await cards.locator('.badge').allTextContents()).map((t) => t.trim());
    for (const b of badges) expect(['Live', 'Private beta', 'Coming soon']).toContain(b);
    const updated = await cards.locator('.updated').allTextContents();
    expect(updated.length).toBeGreaterThanOrEqual(1);
    for (const u of updated) expect(u.trim()).toMatch(/^Updated (January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d$/);
  });

  test('HOME-03 the hero buttons scroll to their sections', async ({ page }) => {
    await page.goto('/');
    await page.locator('.hero a', { hasText: 'See what I’m building' }).click();
    await expect(page.locator('#building')).toBeInViewport();
    await page.locator('.hero a', { hasText: 'Read my writing' }).click();
    await expect(page.locator('#writing')).toBeInViewport();
  });

  test('HOME-04 Book a session opens cal.com in a new tab; Support goes to /support/', async ({ page }) => {
    await page.goto('/');
    const book = page.locator('#meditation a', { hasText: 'Book a session' });
    await expect(book).toHaveAttribute('href', 'https://cal.com/adityaa');
    await expect(book).toHaveAttribute('target', '_blank');
    await page.locator('#support a', { hasText: 'Support my work' }).click();
    await expect(page).toHaveURL(/\/support\/$/);
  });

  test('HOME-05 the Person JSON-LD parses and names the same socials as the footer', async ({ page }) => {
    await page.goto('/');
    const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    expect(ld['@type']).toBe('Person');
    const footer = await page.locator('.site-footer .socials a').evaluateAll((as) => as.map((a) => a.href.replace(/\/$/, '')));
    expect(ld.sameAs.map((s) => s.replace(/\/$/, ''))).toEqual(footer);
  });
});

// AA-27: below the two-column hero (860 px) the intro and CTAs come before the portrait,
// so the first screen of a phone or a portrait tablet ends on "See what I'm building".
test.describe('HOME hero by device (web-phone, web-tablet)', () => {
  const box = (page, sel) => page.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right };
  });
  const open = async (page, width, height) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
  };

  test('HOME-08 phone 390x844: intro and both CTAs come before the portrait', async ({ page }) => {
    await open(page, 390, 844);
    const [intro, cta, photo] = await Promise.all([box(page, '.hero .intro'), box(page, '.hero .cta'), box(page, '.hero .portrait')]);
    expect(intro.bottom).toBeLessThanOrEqual(cta.top);
    expect(cta.bottom).toBeLessThanOrEqual(photo.top);
    expect(cta.top).toBeLessThan(844);
  });

  for (const [name, w, h] of [['iPad portrait', 820, 1180], ['iPad mini portrait', 768, 1024], ['Android tablet portrait', 800, 1280]]) {
    test(`HOME-09 ${name} ${w}x${h}: the intro and both CTAs sit above y=600, the portrait follows`, async ({ page }) => {
      await open(page, w, h);
      const [intro, photo] = await Promise.all([box(page, '.hero .intro'), box(page, '.hero .portrait')]);
      expect(intro.bottom).toBeLessThan(600);
      for (const label of ['See what I’m building', 'Read my writing']) {
        const b = await box(page, `.hero .cta a:has-text("${label}")`);
        expect(b.bottom, label).toBeLessThan(600);
        expect(b.bottom, label).toBeLessThanOrEqual(photo.top);
      }
    });
  }

  test('HOME-10 iPad landscape 1180x820: two columns, the portrait beside the text, both CTAs on the first screen', async ({ page }) => {
    await open(page, 1180, 820);
    const [body, cta, photo] = await Promise.all([box(page, '.hero .hero-body'), box(page, '.hero .cta'), box(page, '.hero .portrait')]);
    expect(body.right).toBeLessThanOrEqual(photo.left);
    expect(cta.bottom).toBeLessThan(820);
  });

  test('HOME-11 no sideways scroll across the single-column tablet band (600, 768, 820, 859 px)', async ({ page }) => {
    for (const w of [600, 768, 820, 859]) {
      await open(page, w, 1024);
      await expectNoHorizontalOverflow(page);
    }
  });

  for (const scheme of ['light', 'dark']) {
    test(`A11Y-07 / at iPad portrait 820x1180 has no axe violations in ${scheme} mode`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'axe results do not depend on the engine');
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, 820, 1180);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target})`)).toEqual([]);
    });
  }
});

test.describe('LINKS: /links', () => {
  test('LINKS-01 the main cards: essays and the external causes open in new tabs; Support stays on site', async ({ page }) => {
    await page.goto('/links/');
    const cards = page.locator('.link-card');
    expect(await cards.count()).toBe(4);
    for (const c of await cards.all()) {
      const href = await c.getAttribute('href');
      if (href.startsWith('/')) expect(await c.getAttribute('target')).toBeNull();
      else { await expect(c).toHaveAttribute('target', '_blank'); await expect(c).toHaveAttribute('rel', /noopener/); }
    }
    await page.locator('.link-card', { hasText: 'Support my work' }).click();
    await expect(page).toHaveURL(/\/support\/$/);
  });

  test('LINKS-02 the build list links each product, and coming-soon ones with no site go to the home newsletter', async ({ page }) => {
    await page.goto('/links/');
    const items = page.locator('.build-item');
    expect(await items.count()).toBe(5);
    const noSite = page.locator('.build-item[href="/#newsletter"]');
    if (await noSite.count()) {
      await noSite.first().click();
      await expect(page).toHaveURL(/\/#newsletter$/);
      await expect(page.locator('#newsletter')).toBeInViewport();
    }
  });

  test('LINKS-03 /links has its own top bar (no site header) with Support and the theme switch', async ({ page }) => {
    await page.goto('/links/');
    await expect(page.locator('.site-header')).toHaveCount(0);
    await expect(page.locator('.topactions a.support')).toHaveAttribute('href', '/support/');
    await expect(page.locator('.topactions .theme-toggle')).toBeVisible();
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://adityaaswani.com/og-links.jpg');
  });

  test('LINKS-04 every social tile opens in a new tab with noopener', async ({ page }) => {
    await page.goto('/links/');
    const tiles = page.locator('.social-link');
    expect(await tiles.count()).toBe(12);
    for (const t of await tiles.all()) {
      await expect(t).toHaveAttribute('target', '_blank');
      await expect(t).toHaveAttribute('rel', /noopener/);
    }
  });
});

test.describe('CONTACT and MED', () => {
  test('CONTACT-01 both addresses are mailto links and the anonymous form opens Tally in a new tab', async ({ page }) => {
    await page.goto('/contact/');
    await expect(page.locator('a[href="mailto:hello@adityaaswani.com"]')).toHaveCount(2);
    await expect(page.locator('a[href="mailto:support@adityaaswani.com"]')).toHaveCount(1);
    const tally = page.locator('a[href="https://tally.so/r/dWQZlV"]');
    await expect(tally).toHaveAttribute('target', '_blank');
  });

  test('CONTACT-02 the footer feedback anchor #share-feedback exists for deep links', async ({ page }) => {
    await page.goto('/contact/#share-feedback');
    await expect(page.locator('#share-feedback')).toBeInViewport();
  });

  test('CONTACT-04 "Through someone else" lists each intermediary with an outbound link and an email', async ({ page }) => {
    await page.goto('/contact/');
    const cards = page.locator('.intermediary-card');
    expect(await cards.count()).toBe(2);
    for (const card of await cards.all()) {
      await expect(card.locator('h4')).not.toBeEmpty();
      const out = card.locator('.intermediary-links a[href^="https://"]');
      await expect(out).toHaveCount(1);
      await expect(out).toHaveAttribute('target', '_blank');
      await expect(out).toHaveAttribute('rel', /noopener/);
      await expect(card.locator('.intermediary-links a[href^="mailto:"]')).toHaveCount(1);
    }
  });

  test('MED-01 /learn-meditation schedules on cal.com and asks questions via /contact/', async ({ page }) => {
    await page.goto('/learn-meditation/');
    await expect(page.locator('main a[href="https://cal.com/adityaa"]')).toHaveCount(2);
    await page.locator('.cta-section a', { hasText: 'Ask Questions' }).click();
    await expect(page).toHaveURL(/\/contact\/$/);
  });

  test('EXT-01 every external link in a page body opens safely (new tab + noopener) or is a mailto', async ({ page }) => {
    for (const path of ['/', '/links/', '/contact/', '/learn-meditation/', '/support/']) {
      await page.goto(path);
      for (const a of await external(page).all()) {
        const target = await a.getAttribute('target');
        if (target === '_blank') await expect(a, `${path} ${await a.getAttribute('href')}`).toHaveAttribute('rel', /noopener/);
      }
    }
  });
});

test('EXT-02 @live every outbound link on the site still answers (link rot)', async ({ page, request, browserName }) => {
  test.skip(browserName !== 'chromium', 'one HTTP sweep');
  test.setTimeout(180_000);
  // Social networks refuse scripted requests (403/429/999); they are checked by hand in the
  // monthly fresh-user pass (AGENTS.md), not here.
  const SKIP = /instagram\.com|tiktok\.com|x\.com|facebook\.com|threads\.net|linkedin\.com|youtube\.com|zeffy\.com|substack\.com\/@|cmu\.zoom\.us/;
  const urls = new Set();
  for (const path of ['/', '/links/', '/contact/', '/learn-meditation/', '/support/']) {
    await page.goto(path);
    for (const h of await page.locator('a[href^="http"]').evaluateAll((as) => as.map((a) => a.href))) {
      if (!h.startsWith('https://adityaaswani.com') && !SKIP.test(h)) urls.add(h);
    }
  }
  const bad = [];
  for (const u of urls) {
    const r = await request.get(u, { timeout: 20_000, headers: { 'User-Agent': 'Mozilla/5.0 (adityaaswani.com link check)' } }).catch((e) => ({ status: () => e.message }));
    const s = r.status();
    if (!(typeof s === 'number' && s < 400)) bad.push(`${s} ${u}`);
  }
  expect(bad).toEqual([]);
});
