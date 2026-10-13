// Newsletter subscribe forms (FEATURES.md NEWS-*): home, /links and /support/thanks.
// The CI rows answer the Substack POST locally so nobody is subscribed. The @live row posts an
// address Substack rejects ("e2e@invalid") to prove the real request reaches Substack's handler.
import { test, expect } from './fixtures.mjs';

const FORMS = [
  { path: '/', input: '#email' },
  { path: '/links/', input: '#lp-email' },
  { path: '/support/thanks/', input: '#news-email' },
];
const ENDPOINT = /^https:\/\/essays\.adityaaswani\.com\/api\/v1\/free\?nojs=true$/;

for (const f of FORMS) {
  test.describe(`${f.path}`, () => {
    test.beforeEach(async ({ page }) => { await page.goto(f.path); });

    test(`NEWS-01 ${f.path} a valid email posts to Substack in a new tab`, async ({ page, context }) => {
      const posts = [];
      await context.route(ENDPOINT, (r) => {
        posts.push({ method: r.request().method(), body: r.request().postData() });
        return r.fulfill({ status: 200, contentType: 'text/html', body: '<title>subscribed stub</title>' });
      });
      const popup = context.waitForEvent('page');
      await page.locator(f.input).fill('reader@example.com');
      await page.locator(f.input).press('Enter');
      const tab = await popup;
      await tab.waitForLoadState();
      expect(posts).toEqual([{ method: 'POST', body: 'email=reader%40example.com' }]);
      // The site itself stays where it was.
      await expect(page).toHaveURL(new RegExp(`${f.path.replace(/\//g, '\\/')}$`));
    });

    for (const bad of ['', 'not-an-email', 'a@']) {
      test(`NEWS-02 ${f.path} "${bad}" is stopped by the browser and nothing is sent`, async ({ page, context }) => {
        let posted = false;
        await context.route(ENDPOINT, (r) => { posted = true; return r.abort(); });
        await page.locator(f.input).fill(bad);
        await page.locator(f.input).press('Enter');
        await page.waitForTimeout(400);
        expect(posted).toBe(false);
        expect(context.pages()).toHaveLength(1);
        expect(await page.locator(f.input).evaluate((el) => el.validity.valid)).toBe(false);
      });
    }

    test(`NEWS-03 ${f.path} the form has a visible or screen-reader label and email autocomplete`, async ({ page }) => {
      const input = page.locator(f.input);
      await expect(input).toHaveAttribute('type', 'email');
      await expect(input).toHaveAttribute('autocomplete', 'email');
      await expect(input).toHaveAttribute('required', '');
      const id = await input.getAttribute('id');
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    });
  });
}

test('NEWS-04 the "Get notified" link on a coming-soon product lands on the newsletter form', async ({ page }) => {
  await page.goto('/');
  await page.locator('#building a.more[href="#newsletter"]').first().click();
  await expect(page).toHaveURL(/#newsletter$/);
  await expect(page.locator('#newsletter')).toBeInViewport();
});

test('NEWS-12 @live the real subscribe POST reaches Substack in every browser (no redirect, no CSP block)', async ({ page, context, guard }) => {
  // Substack answers a 400 JSON for an address it rejects; that proves the POST got through.
  guard.allow(/form-action/); // reported by the assertion below with a clearer message
  await page.goto('/');
  const popup = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
  await page.locator('#email').fill('e2e@invalid');
  await page.locator('#email').press('Enter');
  const tab = await popup;
  const csp = await guard.cspViolations();
  expect(csp, 'the form post was blocked by the CSP').toEqual([]);
  expect(tab, 'no tab opened: the form post was blocked').not.toBeNull();
  await tab.waitForLoadState();
  expect(tab.url()).toMatch(ENDPOINT);
  await expect(tab.locator('body')).toContainText('Please enter a valid email', { timeout: 15_000 });
});
