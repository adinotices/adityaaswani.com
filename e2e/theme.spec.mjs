// Light/dark theme (FEATURES.md THEME-*). The only client-side state the site keeps is
// localStorage.theme; the invariant rows check that nothing else is stored.
import { test, expect, PAGES } from './fixtures.mjs';

const theme = (page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const stored = (page) => page.evaluate(() => localStorage.getItem('theme'));
// The visible toggle: in the bar on desktop, in the menu on phones (the menu is opened first).
async function toggle(page) {
  const menu = page.locator('.menu-toggle');
  if (await menu.isVisible()) {
    if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click();
    return page.locator('#site-nav .theme-toggle');
  }
  return page.locator('.actions .theme-toggle');
}

test.describe('first visit follows the OS', () => {
  test.use({ colorScheme: 'dark' });
  test('THEME-01 an OS dark preference gives dark on first paint, with nothing stored', async ({ page }) => {
    await page.goto('/');
    expect(await theme(page)).toBe('dark');
    expect(await stored(page)).toBeNull();
    await expect(page.locator('.theme-toggle').first()).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('light OS', () => {
  test.use({ colorScheme: 'light' });

  test('THEME-02 an OS light preference gives light', async ({ page }) => {
    await page.goto('/');
    expect(await theme(page)).toBe('light');
    await expect(page.locator('.theme-toggle').first()).toHaveAttribute('aria-pressed', 'false');
  });

  test('THEME-03 toggling stores the choice, and it survives reload and every other page', async ({ page }) => {
    await page.goto('/');
    await (await toggle(page)).click();
    expect(await theme(page)).toBe('dark');
    expect(await stored(page)).toBe('dark');
    await page.reload();
    expect(await theme(page)).toBe('dark');
    for (const p of PAGES) {
      await page.goto(p.path);
      expect(await theme(page), p.path).toBe('dark');
    }
  });

  test('THEME-04 the stored choice beats the OS preference', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    expect(await theme(page)).toBe('dark');
  });

  test('THEME-05 the theme is set before first paint (no light flash on a dark page)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    // Read the attribute from the very first script that runs after <head>.
    await page.addInitScript(() => {
      document.addEventListener('readystatechange', () => {
        if (document.readyState === 'interactive') window.__themeAtInteractive = document.documentElement.getAttribute('data-theme');
      });
    });
    await page.goto('/support/');
    expect(await page.evaluate(() => window.__themeAtInteractive)).toBe('dark');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe('rgb(248, 241, 227)');
  });

  test('THEME-06 a second tab opened after the change gets the new theme', async ({ page, context }) => {
    await page.goto('/');
    await (await toggle(page)).click();
    const tab2 = await context.newPage();
    await tab2.goto('/contact/');
    expect(await theme(tab2)).toBe('dark');
  });

  test('THEME-07 toggling twice returns to light and stores light', async ({ page }) => {
    await page.goto('/links/');
    const t = page.locator('.topactions .theme-toggle');
    await t.click();
    await t.click();
    expect(await theme(page)).toBe('light');
    expect(await stored(page)).toBe('light');
    await expect(t).toHaveAttribute('aria-pressed', 'false');
  });

  test('THEME-08 storage that throws (private mode) still switches the theme for this page', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => { throw new DOMException('QuotaExceededError'); };
    });
    await page.goto('/');
    await (await toggle(page)).click();
    expect(await theme(page)).toBe('dark');
  });

  test('THEME-09 the site stores nothing but the theme and sets no cookies', async ({ page, context }) => {
    for (const p of PAGES) await page.goto(p.path);
    await (await toggle(page)).click();
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).toEqual(['theme']);
    const own = (await context.cookies()).filter((c) => /localhost|adityaaswani\.com/.test(c.domain));
    expect(own).toEqual([]);
  });

  test('THEME-10 every toggle on the page reports the same state', async ({ page }) => {
    await page.goto('/contact/');
    await (await toggle(page)).click();
    const pressed = await page.locator('.theme-toggle').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-pressed')));
    expect(pressed.length).toBeGreaterThan(1);
    expect(new Set(pressed)).toEqual(new Set(['true']));
  });
});
