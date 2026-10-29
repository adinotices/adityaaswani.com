// Header, mobile menu and footer navigation (FEATURES.md NAV-*, MENU-*, FOOT-*).
import { test, expect, PAGES } from './fixtures.mjs';

const NAV = [
  { label: 'Building', path: '/', hash: '#building' },
  { label: 'Writing', path: '/', hash: '#writing' },
  { label: 'Meditation', path: '/learn-meditation/' },
  { label: 'Links', path: '/links/' },
  { label: 'Contact', path: '/contact/' },
];
const HEADER_PAGES = PAGES.filter((p) => p.path !== '/links/');
// The menu exists below 820 px (Header.astro): phones and the 800 px Android tablet. The iPad
// profiles (820 and 1180 px) get the desktop nav.
const hasMenu = (page) => page.viewportSize().width < 820;

async function openMenuIfPhone(page) {
  if (hasMenu(page)) await page.locator('.menu-toggle').click();
}

test.describe('NAV: header links', () => {
  for (const item of NAV) {
    test(`NAV-01 "${item.label}" from /contact/ lands on ${item.path}${item.hash ?? ''}`, async ({ page }) => {
      await page.goto('/contact/');
      await openMenuIfPhone(page);
      await page.locator('#site-nav a', { hasText: item.label }).click();
      await expect(page).toHaveURL(new RegExp(`${item.path.replace(/\//g, '\\/')}${item.hash ?? ''}$`));
      if (item.hash) await expect(page.locator(item.hash)).toBeInViewport();
    });
  }

  test('NAV-02 on the home page the section links are in-page anchors and scroll', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#site-nav a', { hasText: 'Writing' })).toHaveAttribute('href', '#writing');
    await openMenuIfPhone(page);
    await page.locator('#site-nav a', { hasText: 'Writing' }).click();
    await expect(page.locator('#writing')).toBeInViewport();
    if (hasMenu(page)) await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  // /links/ has its own top bar instead of the site header (LINKS-03).
  for (const item of NAV.filter((n) => !n.hash && n.path !== '/links/')) {
    test(`NAV-03 ${item.path} marks "${item.label}" as the current page`, async ({ page }) => {
      await page.goto(item.path);
      await expect(page.locator('#site-nav a[aria-current="page"]')).toHaveText(item.label);
    });
  }

  test('NAV-04 the Support button is marked current on /support/ and /support/thanks/ only', async ({ page }) => {
    for (const p of HEADER_PAGES) {
      await page.goto(p.path);
      const current = await page.locator('.actions a.support').getAttribute('aria-current');
      expect(current, p.path).toBe(p.path.startsWith('/support') ? 'page' : null);
    }
  });

  test('NAV-05 the wordmark goes home from every page', async ({ page }) => {
    for (const p of PAGES.filter((x) => x.path !== '/')) {
      await page.goto(p.path);
      await page.locator('a.brand').first().click();
      await expect(page).toHaveURL(/\/$/);
    }
  });

  test('NAV-06 the skip link is first in tab order and moves focus to main', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari does not Tab to links by default (Option+Tab); covered in Chromium and Firefox');
    await page.goto('/contact/');
    await page.keyboard.press('Tab');
    const skip = page.locator('.skip-link');
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });
});

test.describe('MENU: phone menu', () => {
  test.beforeEach(({ page }) => { test.skip(!hasMenu(page), 'menu layout only (viewport under 820 px)'); });

  test('MENU-01 the menu starts closed, opens on tap with focus on the first link', async ({ page }) => {
    await page.goto('/contact/');
    await expect(page.locator('#site-nav')).toBeHidden();
    await page.locator('.menu-toggle').click();
    await expect(page.locator('#site-nav')).toBeVisible();
    await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#site-nav a').first()).toBeFocused();
  });

  test('MENU-02 Escape closes it and returns focus to the button', async ({ page }) => {
    await page.goto('/contact/');
    await page.locator('.menu-toggle').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#site-nav')).toBeHidden();
    await expect(page.locator('.menu-toggle')).toBeFocused();
  });

  test('MENU-03 tapping outside closes it', async ({ page }) => {
    await page.goto('/contact/');
    await page.locator('.menu-toggle').click();
    // The open panel covers the top of the page; tap near the bottom of the screen.
    const vp = page.viewportSize();
    await page.mouse.click(vp.width / 2, vp.height - 20);
    await expect(page.locator('#site-nav')).toBeHidden();
  });

  test('MENU-04 the theme switch inside the menu works and keeps the menu open', async ({ page }) => {
    await page.goto('/contact/');
    await page.locator('.menu-toggle').click();
    await page.locator('#site-nav .theme-toggle').click();
    await expect(page.locator('#site-nav')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
  });

  test('MENU-05 rotating or widening past 820 px closes the menu and shows the desktop nav', async ({ page }) => {
    await page.goto('/contact/');
    await page.locator('.menu-toggle').click();
    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(page.locator('.menu-toggle')).toBeHidden();
    await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#site-nav a', { hasText: 'Contact' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(page.locator('#site-nav')).toBeHidden();
  });

  test('MENU-06 the open menu sits over the page and does not push content sideways', async ({ page }) => {
    await page.goto('/support/');
    await page.locator('.menu-toggle').click();
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw).toBeLessThanOrEqual(cw);
  });

  test('MENU-07 every menu target is at least 44 px tall', async ({ page }) => {
    await page.goto('/');
    await page.locator('.menu-toggle').click();
    for (const el of await page.locator('#site-nav a, #site-nav .theme-toggle, .menu-toggle, .actions a.support').all()) {
      const box = await el.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  for (const [width, visible] of [[320, 'none'], [390, 'short'], [440, 'full']]) {
    test(`MENU-08 at ${width} px the Support pill shows the ${visible} label and fits`, async ({ page }, testInfo) => {
      test.skip(!testInfo.project.name.startsWith('phone'), 'phone widths; phone projects only');
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      const pill = page.locator('.actions a.support');
      await expect(pill).toBeVisible();
      await expect(pill.locator('.full')).toBeVisible({ visible: visible === 'full' });
      await expect(pill.locator('.short')).toBeVisible({ visible: visible === 'short' });
      await expect(pill.locator('.sr-only')).toHaveText('Support my work');
      const box = await pill.boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(sw).toBeLessThanOrEqual(cw);
    });
  }
});

test.describe('MENU: without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('MENU-09 with no JS the nav links are shown inline and the menu button is hidden', async ({ page }) => {
    test.skip(!hasMenu(page), 'menu layout only (viewport under 820 px)');
    await page.goto('/contact/');
    await expect(page.locator('.menu-toggle')).toBeHidden();
    await expect(page.locator('#site-nav a', { hasText: 'Contact' })).toBeVisible();
  });
});

test.describe('FOOT: footer', () => {
  test('FOOT-01 the footer links reach every page, Support included', async ({ page }) => {
    await page.goto('/contact/');
    const hrefs = await page.locator('.site-footer nav[aria-label="Footer"] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual(['/#building', '/#writing', '/learn-meditation/', '/links/', '/contact/', '/support/']);
    await page.locator('.site-footer a', { hasText: 'Support my work' }).click();
    await expect(page).toHaveURL(/\/support\/$/);
  });

  test('FOOT-02 every social link opens in a new tab with noopener and says so to screen readers', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('.site-footer .socials a');
    expect(await links.count()).toBe(12);
    for (const a of await links.all()) {
      await expect(a).toHaveAttribute('target', '_blank');
      await expect(a).toHaveAttribute('rel', /noopener/);
      await expect(a.locator('.sr-only')).toHaveText(' (opens in a new tab)');
    }
  });

  test('FOOT-03 the copyright year is the current year', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.site-footer .copy')).toContainText(String(new Date().getUTCFullYear()));
  });
});
