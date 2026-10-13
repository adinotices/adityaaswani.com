// /support/thanks (FEATURES.md THX-*): what Stripe's return URL shows for each gift type.
import { test, expect, supportLinks } from './fixtures.mjs';

const monthly5 = supportLinks.monthly.tiers.find((t) => t.cents === 500);

test('THX-01 no type: just the thanks, no upsell and no portal note', async ({ page }) => {
  await page.goto('/support/thanks/');
  await expect(page.locator('h1')).toContainText('Thank you');
  await expect(page.locator('#upsell')).toBeHidden();
  await expect(page.locator('#monthly-note')).toBeHidden();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});

test('THX-02 one-time gift: the $5-a-month upsell shows; No thanks hides it', async ({ page }) => {
  await page.goto('/support/thanks/?type=once');
  await expect(page.locator('#upsell')).toBeVisible();
  await expect(page.locator('#monthly-note')).toBeHidden();
  await page.locator('#upsell-no').click();
  await expect(page.locator('#upsell')).toBeHidden();
});

test('THX-03 upsell Yes opens a $5 monthly Worker checkout', async ({ page, checkout }) => {
  await page.goto('/support/thanks/?type=once');
  await page.locator('#upsell-yes').click();
  await page.waitForURL(/checkout\.stripe\.com/);
  expect(checkout.calls).toEqual([{ site: 'aditya', amount_cents: 500, interval: 'month', cover_fees: false }]);
});

test('THX-04 upsell Yes with the Worker down falls through to the $5 Payment Link', async ({ page, checkout, guard }) => {
  guard.allow(/Failed to load resource|status of 503/);
  checkout.respondWith(() => ({ status: 503, json: { ok: false, error: 'unavailable' } }));
  await page.goto('/support/thanks/?type=once');
  await page.locator('#upsell-yes').click();
  await page.waitForURL(monthly5.url);
});

test('THX-05 upsell Yes clicked twice sends one request', async ({ page, checkout }) => {
  checkout.respondWith(() => 'hang');
  await page.goto('/support/thanks/?type=once');
  await page.locator('#upsell-yes').click();
  await expect(page.locator('#upsell-yes')).toHaveText('Opening secure checkout…');
  await page.locator('#upsell-yes').click();
  await page.waitForTimeout(300);
  expect(checkout.calls).toHaveLength(1);
});

test('THX-06 monthly via a Payment Link (no session_id): the portal link is the Payment Link portal', async ({ page }) => {
  await page.goto('/support/thanks/?type=monthly');
  await expect(page.locator('#monthly-note')).toBeVisible();
  await expect(page.locator('#upsell')).toBeHidden();
  await expect(page.locator('#portal-link')).toHaveAttribute('href', supportLinks.portalUrl);
});

test('THX-07 monthly via the Worker (session_id): the portal link is the Worker account portal', async ({ page }) => {
  await page.goto('/support/thanks/?type=monthly&session_id=cs_test_e2e');
  await expect(page.locator('#portal-link')).toHaveAttribute('href', supportLinks.checkout.portalUrl);
});

test('THX-08 Stripe returns without the trailing slash; the redirect keeps type and session_id', async ({ page }) => {
  await page.goto('/support/thanks?type=monthly&session_id=cs_test_e2e');
  await expect(page).toHaveURL(/\/support\/thanks\/\?type=monthly&session_id=cs_test_e2e$/);
  await expect(page.locator('#portal-link')).toHaveAttribute('href', supportLinks.checkout.portalUrl);
});

test('THX-09 an unknown type shows neither block', async ({ page }) => {
  await page.goto('/support/thanks/?type=<script>');
  await expect(page.locator('#upsell')).toBeHidden();
  await expect(page.locator('#monthly-note')).toBeHidden();
});

test('THX-10 Back from the upsell checkout leaves the Yes button usable', async ({ page, checkout }) => {
  await page.goto('/support/thanks/?type=once');
  await page.locator('#upsell-yes').click();
  await page.waitForURL(/checkout\.stripe\.com/);
  await page.goBack();
  await expect(page.locator('#upsell-yes')).toHaveText('Yes, give $5 a month');
  await expect(page.locator('#upsell-yes')).not.toHaveAttribute('aria-busy');
});
