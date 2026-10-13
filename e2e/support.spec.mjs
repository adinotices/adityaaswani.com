// /support Give flow (FEATURES.md SUP-*, GIVE-*, ERR-*). The donate Worker is answered by the
// checkout fixture unless the test is @live; Stripe pages are stubbed by the guard fixture.
import { test, expect, supportLinks, CHECKOUT_URL, isProd } from './fixtures.mjs';

const { monthly, oneTime } = supportLinks;
const fmt = (c) => '$' + (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2));
const fee = (c) => Math.floor(((c + 30) * 1000 + 970) / 971) - c;

const giveBtn = (page) => page.locator('#give-btn');
const pick = (page, label) => page.locator('.opt', { hasText: label }).filter({ visible: true }).click();
const freq = (page, which) => page.locator('label.tab', { hasText: which }).click();

test.beforeEach(async ({ page }) => {
  await page.goto('/support/');
});

test.describe('SUP: ladder and labels', () => {
  test('SUP-01 default is monthly, $5 suggested, and the button reads Give $5 a month', async ({ page }) => {
    await expect(page.locator('input[name="freq"][value="monthly"]')).toBeChecked();
    await expect(page.locator('input[name="m-amt"]:checked')).toHaveValue(String(monthly.defaultCents));
    await expect(page.locator('#ladder-monthly .tag')).toHaveText('Suggested');
    await expect(giveBtn(page)).toHaveText(`Give ${fmt(monthly.defaultCents)} a month`);
    await expect(page.locator('#callout')).toBeVisible();
    await expect(page.locator('#cancel-note')).toBeVisible();
    await expect(page.locator('#ladder-once')).toBeHidden();
    await expect(page.locator('#fee-cb')).not.toBeChecked();
    await expect(page.locator('#fee-text')).toHaveText(`Add ${fmt(fee(monthly.defaultCents))} to cover card fees, so the full ${fmt(monthly.defaultCents)} reaches me`);
    await expect(page.locator('#impact')).not.toBeEmpty();
    // With JS the button is not a link, so it cannot bypass the Worker.
    await expect(giveBtn(page)).not.toHaveAttribute('href');
    await expect(giveBtn(page)).toHaveAttribute('role', 'button');
    await expect(page.locator('.test-badge')).toHaveCount(supportLinks.mode === 'test' ? 1 : 0);
  });

  test('SUP-02 every monthly tier shows its price, and with fees the Payment Link fee total', async ({ page }) => {
    for (const t of monthly.tiers) {
      await pick(page, `${fmt(t.cents)}/month`);
      await expect(giveBtn(page)).toHaveText(`Give ${fmt(t.cents)} a month`);
      await page.locator('#fee-cb').check();
      // The Worker charges the same total the fee Payment Link does.
      await expect(giveBtn(page)).toHaveText(`Give ${fmt(t.feeCents)} a month`);
      await page.locator('#fee-cb').uncheck();
    }
  });

  test('SUP-03 one-time shows its own ladder with $10 suggested and hides the monthly-only copy', async ({ page }) => {
    await freq(page, 'One-time');
    await expect(page.locator('#ladder-once')).toBeVisible();
    await expect(page.locator('#ladder-monthly')).toBeHidden();
    await expect(page.locator('input[name="o-amt"]:checked')).toHaveValue(String(oneTime.defaultCents));
    await expect(giveBtn(page)).toHaveText(`Give ${fmt(oneTime.defaultCents)} once`);
    await expect(page.locator('#callout')).toBeHidden();
    await expect(page.locator('#cancel-note')).toBeHidden();
    for (const c of oneTime.amounts) {
      await pick(page, new RegExp(`^\\s*\\${fmt(c)}\\s*(Suggested)?\\s*$`));
      await expect(giveBtn(page)).toHaveText(`Give ${fmt(c)} once`);
    }
    await freq(page, 'Monthly');
    await expect(giveBtn(page)).toHaveText(`Give ${fmt(monthly.defaultCents)} a month`);
  });

  test('SUP-04 every amount has an impact line and it changes with the amount', async ({ page }) => {
    const seen = new Set();
    for (const t of monthly.tiers) {
      await pick(page, `${fmt(t.cents)}/month`);
      const line = await page.locator('#impact').textContent();
      expect(line?.trim()).toBeTruthy();
      seen.add(line);
    }
    expect(seen.size).toBe(monthly.tiers.length);
  });

  test('SUP-05 the fee checkbox label tracks the chosen amount', async ({ page }) => {
    await pick(page, `${fmt(2500)}/month`);
    await expect(page.locator('#fee-text')).toHaveText(`Add ${fmt(fee(2500))} to cover card fees, so the full $25 reaches me`);
    await freq(page, 'One-time');
    await expect(page.locator('#fee-text')).toContainText(`Add ${fmt(fee(oneTime.defaultCents))}`);
  });
});

test.describe('SUP: Other amount', () => {
  test('SUP-10 Other with nothing typed disables Give and sends nothing', async ({ page, checkout }) => {
    await pick(page, 'Other');
    await expect(page.locator('#other-amount')).toBeVisible();
    await expect(giveBtn(page)).toHaveText('Enter an amount');
    await expect(giveBtn(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#other-error')).toBeEmpty();
    // A real click on an aria-disabled element still fires; force skips Playwright's actionability wait.
    await giveBtn(page).click({ force: true });
    await giveBtn(page).press('Enter');
    await page.waitForTimeout(300);
    expect(checkout.calls).toHaveLength(0);
    await expect(page.locator('#fee-text')).toHaveText('Add card fees to my gift, so the full amount reaches me');
  });

  for (const bad of ['0.5', '0.99', '1000.01', '5000', '12.345', '-5', '1e3']) {
    test(`SUP-11 Other "${bad}" shows the range error and blocks Give`, async ({ page, checkout }) => {
      await pick(page, 'Other');
      await page.locator('#other-amount').fill(bad);
      await expect(page.locator('#other-error')).toHaveText('Please choose an amount between $1 and $1,000.');
      await expect(page.locator('#other-amount')).toHaveAttribute('aria-invalid', 'true');
      await expect(giveBtn(page)).toHaveAttribute('aria-disabled', 'true');
      await giveBtn(page).click({ force: true });
      await page.waitForTimeout(200);
      expect(checkout.calls).toHaveLength(0);
    });
  }

  for (const [good, label] of [['1', '$1'], ['1000', '$1000'], ['7.5', '$7.50'], ['12.34', '$12.34']]) {
    test(`SUP-12 Other "${good}" is accepted and the button reads Give ${label} a month`, async ({ page }) => {
      await pick(page, 'Other');
      await page.locator('#other-amount').fill(good);
      await expect(page.locator('#other-error')).toBeEmpty();
      await expect(page.locator('#other-amount')).toHaveAttribute('aria-invalid', 'false');
      await expect(giveBtn(page)).toHaveText(`Give ${label} a month`);
      await expect(giveBtn(page)).not.toHaveAttribute('aria-disabled');
    });
  }

  test('SUP-13 fixing an invalid Other amount clears the error', async ({ page }) => {
    await pick(page, 'Other');
    await page.locator('#other-amount').fill('0.5');
    await expect(page.locator('#other-error')).not.toBeEmpty();
    await page.locator('#other-amount').fill('15');
    await expect(page.locator('#other-error')).toBeEmpty();
    await expect(giveBtn(page)).toHaveText('Give $15 a month');
  });

  test('SUP-14 the Other amount survives a switch of frequency and back', async ({ page }) => {
    await pick(page, 'Other');
    await page.locator('#other-amount').fill('42');
    await freq(page, 'One-time');
    // One-time keeps its own preset selection, so the Other box hides.
    await expect(page.locator('#other-wrap')).toBeHidden();
    await expect(giveBtn(page)).toHaveText(`Give ${fmt(oneTime.defaultCents)} once`);
    await freq(page, 'Monthly');
    await expect(page.locator('#other-amount')).toHaveValue('42');
    await expect(giveBtn(page)).toHaveText('Give $42 a month');
  });

  test('SUP-15 Other with fees adds the fee to the total', async ({ page }) => {
    await freq(page, 'One-time');
    await pick(page, 'Other');
    await page.locator('#other-amount').fill('20');
    await page.locator('#fee-cb').check();
    await expect(giveBtn(page)).toHaveText(`Give ${fmt(2000 + fee(2000))} once`);
    await expect(page.locator('#impact')).not.toBeEmpty();
  });
});

test.describe('GIVE: checkout request', () => {
  const cases = [
    { name: 'monthly preset', steps: async () => {}, body: { site: 'aditya', amount_cents: 500, interval: 'month', cover_fees: false } },
    { name: 'monthly preset with fees', steps: async (page) => { await pick(page, '$10/month'); await page.locator('#fee-cb').check(); }, body: { site: 'aditya', amount_cents: 1000, interval: 'month', cover_fees: true } },
    { name: 'one-time preset', steps: async (page) => { await freq(page, 'One-time'); await pick(page, /^\s*\$50\s*$/); }, body: { site: 'aditya', amount_cents: 5000, interval: 'once', cover_fees: false } },
    { name: 'custom monthly', steps: async (page) => { await pick(page, 'Other'); await page.locator('#other-amount').fill('7.25'); }, body: { site: 'aditya', amount_cents: 725, interval: 'month', cover_fees: false } },
    { name: 'custom one-time with fees', steps: async (page) => { await freq(page, 'One-time'); await pick(page, 'Other'); await page.locator('#other-amount').fill('1000'); await page.locator('#fee-cb').check(); }, body: { site: 'aditya', amount_cents: 100000, interval: 'once', cover_fees: true } },
  ];
  for (const c of cases) {
    test(`GIVE-01 ${c.name}: Give sends the base amount and opens Stripe Checkout`, async ({ page, checkout }) => {
      await c.steps(page);
      await giveBtn(page).click();
      await page.waitForURL(/checkout\.stripe\.com\/c\/pay\/cs_test_e2e/);
      expect(checkout.calls).toEqual([c.body]);
    });
  }

  for (const which of ['Monthly', 'One-time']) {
    test(`GIVE-06 ${which}: typing an Other amount and pressing Give once is enough (Safari dropped the first click)`, async ({ page, checkout }) => {
      await freq(page, which);
      await pick(page, 'Other');
      await page.locator('#other-amount').fill('8');
      // One click, straight from the focused input: blur fires `change` between mousedown and mouseup.
      await giveBtn(page).click();
      await page.waitForURL(/checkout\.stripe\.com/);
      expect(checkout.calls).toEqual([{ site: 'aditya', amount_cents: 800, interval: which === 'Monthly' ? 'month' : 'once', cover_fees: false }]);
    });
  }

  test('GIVE-02 a double click opens one checkout, not two', async ({ page, checkout }) => {
    checkout.respondWith(() => 'hang');
    await giveBtn(page).dblclick();
    await expect(giveBtn(page)).toHaveText('Opening secure checkout…');
    await expect(giveBtn(page)).toHaveAttribute('aria-busy', 'true');
    await giveBtn(page).click({ force: true });
    await page.waitForTimeout(300);
    expect(checkout.calls).toHaveLength(1);
  });

  test('GIVE-03 Enter and Space on the focused button both start checkout', async ({ page, checkout }) => {
    await giveBtn(page).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/checkout\.stripe\.com/);
    expect(checkout.calls).toHaveLength(1);
    await page.goto('/support/');
    await giveBtn(page).focus();
    await page.keyboard.press(' ');
    await page.waitForURL(/checkout\.stripe\.com/);
    expect(checkout.calls).toHaveLength(2);
  });

  test('GIVE-04 coming back from Stripe with Back leaves a working button, not a stuck spinner', async ({ page, checkout }) => {
    await giveBtn(page).click();
    await page.waitForURL(/checkout\.stripe\.com/);
    await page.goBack();
    await expect(page).toHaveURL(/\/support\/$/);
    await expect(giveBtn(page)).toHaveText(`Give ${fmt(monthly.defaultCents)} a month`);
    await expect(giveBtn(page)).not.toHaveAttribute('aria-busy');
    await giveBtn(page).click();
    await page.waitForURL(/checkout\.stripe\.com/);
    expect(checkout.calls).toHaveLength(2);
  });

  test('GIVE-05 a Worker answer that is not a Stripe Checkout URL is never followed', async ({ page, checkout, guard }) => {
    guard.allow(/status of 200/);
    checkout.respondWith(() => ({ status: 200, json: { ok: true, url: 'https://evil.example/pay' } }));
    await giveBtn(page).click();
    await expect(page.locator('#give-status')).toContainText("Checkout couldn't open just now.");
    await expect(page).toHaveURL(/\/support\/$/);
  });
});

test.describe('ERR: checkout failures', () => {
  test.beforeEach(({ guard }) => {
    guard.allow(/Failed to load resource|status of (4|5)\d\d|NetworkError|net::ERR|Load failed|CORS|access control|sutam\.org/i);
  });

  test('ERR-01 rate limited (429) says wait a minute, with no direct link', async ({ page, checkout }) => {
    checkout.respondWith(() => ({ status: 429, json: { ok: false, error: 'rate_limited' } }));
    await giveBtn(page).click();
    await expect(page.locator('#give-status')).toHaveText('Too many attempts; please wait a minute.');
    await expect(page.locator('#give-status a')).toHaveCount(0);
    await expect(giveBtn(page)).toHaveText('Give $5 a month');
  });

  test('ERR-02 invalid_amount from the Worker shows the range message', async ({ page, checkout }) => {
    checkout.respondWith(() => ({ status: 400, json: { ok: false, error: 'invalid_amount' } }));
    await giveBtn(page).click();
    await expect(page.locator('#give-status')).toHaveText('Please choose an amount between $1 and $1,000.');
    await expect(page.locator('#give-status a')).toHaveCount(0);
  });

  for (const fees of [false, true]) {
    test(`ERR-03 Worker down on a monthly preset (fees ${fees ? 'on' : 'off'}): the direct Payment Link is offered and opens`, async ({ page, checkout }) => {
      checkout.respondWith(() => ({ status: 503, json: { ok: false, error: 'unavailable' } }));
      await pick(page, '$10/month');
      if (fees) await page.locator('#fee-cb').check();
      await giveBtn(page).click();
      const tier = monthly.tiers.find((t) => t.cents === 1000);
      const link = page.locator('#give-status a');
      await expect(page.locator('#give-status')).toContainText("Checkout couldn't open just now.");
      await expect(link).toHaveAttribute('href', fees ? tier.feeUrl : tier.url);
      await link.click();
      await page.waitForURL((u) => u.href === (fees ? tier.feeUrl : tier.url));
    });
  }

  test('ERR-04 Worker down on one-time: the direct link pre-fills the total', async ({ page, checkout }) => {
    checkout.respondWith(() => ({ status: 502, json: { ok: false, error: 'stripe_error' } }));
    await freq(page, 'One-time');
    await page.locator('#fee-cb').check();
    await giveBtn(page).click();
    await expect(page.locator('#give-status a')).toHaveAttribute('href', `${oneTime.url}?prefilled_amount=${1000 + fee(1000)}`);
  });

  test('ERR-05 Worker down on a custom monthly amount: no link, a pick-a-preset hint', async ({ page, checkout }) => {
    checkout.respondWith(() => ({ status: 503, json: { ok: false, error: 'unavailable' } }));
    await pick(page, 'Other');
    await page.locator('#other-amount').fill('8');
    await giveBtn(page).click();
    await expect(page.locator('#give-status')).toContainText('Custom monthly amounts need secure checkout');
    await expect(page.locator('#give-status a')).toHaveCount(0);
  });

  test('ERR-06 network failure offers the direct link and the button recovers', async ({ page, checkout }) => {
    checkout.respondWith(() => 'abort');
    await giveBtn(page).click();
    await expect(page.locator('#give-status')).toContainText("Checkout couldn't open just now.");
    await expect(page.locator('#give-status a')).toHaveAttribute('href', monthly.tiers.find((t) => t.cents === 500).url);
    await expect(giveBtn(page)).toHaveText('Give $5 a month');
    await expect(giveBtn(page)).not.toHaveAttribute('aria-disabled');
  });

  test('ERR-07 a Worker that never answers times out after 10 s with the direct link', async ({ page, checkout, browserName }) => {
    test.skip(browserName !== 'chromium', 'timer behaviour is browser-independent; one engine is enough for a 10 s test');
    test.setTimeout(30_000);
    checkout.respondWith(() => 'hang');
    await giveBtn(page).click();
    await expect(giveBtn(page)).toHaveText('Opening secure checkout…');
    await expect(page.locator('#give-status')).toContainText("Checkout couldn't open just now.", { timeout: 15_000 });
    await expect(page.locator('#give-status a')).toHaveCount(1);
  });

  test('ERR-08 changing the amount after an error clears the message', async ({ page, checkout }) => {
    checkout.respondWith(() => ({ status: 429, json: { ok: false, error: 'rate_limited' } }));
    await giveBtn(page).click();
    await expect(page.locator('#give-status')).not.toBeEmpty();
    await pick(page, '$25/month');
    await expect(page.locator('#give-status')).toBeEmpty();
  });
});

test.describe('SUP: without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('SUP-20 no-JS visitors get every Payment Link and a working default button', async ({ page }) => {
    await expect(page.locator('.controls')).toBeHidden();
    await expect(giveBtn(page)).toHaveAttribute('href', monthly.tiers.find((t) => t.cents === monthly.defaultCents).url);
    const hrefs = await page.locator('.noscript-links a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    const expected = [oneTime.url, ...monthly.tiers.flatMap((t) => [t.url, t.feeUrl])];
    expect(hrefs).toEqual(expected);
    await page.locator('.noscript-links a').first().click();
    await page.waitForURL(oneTime.url);
  });
});

test.describe('SUP: page content', () => {
  test('SUP-30 the manage-or-cancel link points at the Stripe customer portal', async ({ page }) => {
    await expect(page.locator('#cancel-note a')).toHaveAttribute('href', supportLinks.checkout.portalUrl);
  });

  test('SUP-31 every project link opens in a new tab safely', async ({ page }) => {
    const links = page.locator('.project-list a');
    expect(await links.count()).toBeGreaterThan(0);
    for (const a of await links.all()) {
      await expect(a).toHaveAttribute('target', '_blank');
      await expect(a).toHaveAttribute('rel', /noopener/);
    }
  });
});

test.describe('LIVE: donate Worker and Stripe', () => {
  test('LIVE-01 @live the real Worker refuses this origin and the page falls back to the direct link', async ({ page, baseURL, guard }) => {
    test.skip(isProd(baseURL), 'from adityaaswani.com the Worker would open a real live-mode Checkout Session');
    // The Worker refuses the preflight (403 origin_not_allowed), so the POST is never sent.
    guard.allow(/Failed to load resource|status of 403|Status code: 403|CORS|access control|NetworkError|Load failed|sutam\.org/i);
    const preflight = page.waitForResponse((r) => r.url() === CHECKOUT_URL && r.request().method() === 'OPTIONS', { timeout: 10_000 }).catch(() => null);
    await giveBtn(page).click();
    await expect(page.locator('#give-status')).toContainText("Checkout couldn't open just now.", { timeout: 15_000 });
    await expect(page.locator('#give-status a')).toHaveAttribute('href', monthly.tiers.find((t) => t.cents === 500).url);
    const r = await preflight;
    if (r) expect(r.status()).toBe(403);
  });

  test('LIVE-02 @live the Worker validates amounts for adityaaswani.com without touching Stripe', async ({ request, browserName }) => {
    test.skip(browserName !== 'chromium', 'one HTTP probe is enough');
    for (const amount of [50, 100001]) {
      const r = await request.post(CHECKOUT_URL, {
        headers: { Origin: 'https://adityaaswani.com', 'Content-Type': 'application/json' },
        data: { site: 'aditya', amount_cents: amount, interval: 'month', cover_fees: false },
      });
      expect(r.status()).toBe(400);
      expect(await r.json()).toEqual({ ok: false, error: 'invalid_amount' });
    }
    const evil = await request.post(CHECKOUT_URL, {
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      data: { site: 'aditya', amount_cents: 500, interval: 'month', cover_fees: false },
    });
    expect(evil.status()).toBe(403);
  });

  test('LIVE-03 @live every Payment Link and portal link in support-links.json is live at Stripe', async ({ request, browserName }) => {
    test.skip(browserName !== 'chromium', 'one HTTP sweep is enough');
    const urls = [
      oneTime.url,
      supportLinks.portalUrl,
      supportLinks.checkout.portalUrl,
      ...monthly.tiers.flatMap((t) => [t.url, t.feeUrl]),
    ];
    for (const u of urls) {
      const r = await request.get(u, { maxRedirects: 0 });
      expect(r.status(), u).toBe(200);
    }
  });
});
