// Web-tablet sweep (FEATURES.md PAGE-10; BOX-RULES 2026-10-20). Runs only in the tablet profiles
// (E2E_PROFILE=tablet): a full-page screenshot of every page per profile, no sideways scroll, and the
// touch targets. A control under 24 px fails (WCAG 2.2 2.5.8, inline text links excepted); one under
// 44 px (Apple's touch guideline) is listed "for review" in the test's annotations, not failed.
import { mkdirSync } from 'node:fs';
import { test, expect, PAGES, expectNoHorizontalOverflow } from './fixtures.mjs';

const SHOTS = process.env.E2E_SHOTS_DIR || 'test-results/tablet-shots';

test.describe('PAGE: web-tablet sweep', () => {
  test.beforeEach(({}, testInfo) => { test.skip(!testInfo.project.name.startsWith('tablet-'), 'tablet profiles only (E2E_PROFILE=tablet)'); });

  for (const p of PAGES) {
    test(`PAGE-10 ${p.path} on a tablet: screenshot, no sideways scroll, touch targets`, async ({ page }, testInfo) => {
      await page.goto(p.path);
      await expect(page.locator('h1')).toHaveText(p.h1);
      await page.evaluate(() => document.fonts.ready);
      await expectNoHorizontalOverflow(page);
      const targets = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')) {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || el.closest('[hidden], .sr-only') || el.matches('.skip-link')) continue;
          // Inline links inside running text are exempt from target size (WCAG 2.5.8).
          const inline = el.tagName === 'A' && cs.display === 'inline' && !!el.closest('p, li, figcaption, small, span.copy');
          const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
          out.push({ label, w: Math.round(r.width), h: Math.round(r.height), inline });
        }
        return out;
      });
      const tooSmall = targets.filter((t) => !t.inline && (t.w < 24 || t.h < 24));
      const review = targets.filter((t) => !t.inline && (t.w < 44 || t.h < 44) && !tooSmall.includes(t));
      const profile = testInfo.project.name.replace(/^tablet-/, '');
      if (review.length) {
        const description = review.map((t) => `${t.label} ${t.w}x${t.h}`).join('; ');
        testInfo.annotations.push({ type: 'for review (under 44 px)', description });
        console.log(`[tablet ${profile}] ${p.path} for review (under 44 px): ${description}`);
      }
      const name = p.path === '/' ? 'home' : p.path.replace(/^\/|\/$/g, '').replace(/\//g, '-');
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/tablet-${profile}-${name}.png`, fullPage: true });
      expect(tooSmall, 'controls under 24 px').toEqual([]);
    });
  }
});
