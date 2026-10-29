// End-to-end suite: real Chromium, Firefox and WebKit against a built site.
// Default target is dist/ served over HTTPS like GitHub Pages (e2e/serve.mjs; CI and
// local runs; build first). Set E2E_BASE_URL to run against
// a Cloudflare preview deploy or https://adityaaswani.com (the nightly box run).
// Tests tagged @live call third-party services (sutam.org donate Worker, Stripe,
// Substack); they run only with E2E_LIVE=1. See docs/testing/FEATURES.md.
import { defineConfig, devices } from '@playwright/test';

// E2E_PORT avoids a clash with other sessions' servers on the shared box.
const port = Number(process.env.E2E_PORT || 4322);
const baseURL = process.env.E2E_BASE_URL || `https://localhost:${port}`;
const local = !process.env.E2E_BASE_URL;

const DEFAULT_PROJECTS = [
  { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 } } },
  { name: 'desktop-webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } } },
  { name: 'phone-chromium', use: { ...devices['Pixel 7'] } },
  { name: 'phone-webkit', use: { ...devices['iPhone 14'] } },
];
// Web-tablet lane (BOX-RULES 2026-10-20; FEATURES.md "Coverage by platform"). E2E_PROFILE=tablet runs
// the whole suite as these three profiles instead of the five above; E2E_PROFILE=<profile> runs one.
// Touch and a tablet user agent come from the device; the viewport is the brief's.
const TABLET_PROFILES = {
  'ipad-portrait': { name: 'tablet-ipad-portrait', use: { ...devices['iPad Pro 11'], viewport: { width: 820, height: 1180 } } },
  'ipad-landscape': { name: 'tablet-ipad-landscape', use: { ...devices['iPad Pro 11 landscape'], viewport: { width: 1180, height: 820 } } },
  'android-tablet': { name: 'tablet-android', use: { ...devices['Galaxy Tab S4'], viewport: { width: 800, height: 1280 } } },
};
const profile = process.env.E2E_PROFILE;
if (profile && profile !== 'tablet' && !TABLET_PROFILES[profile]) {
  throw new Error(`E2E_PROFILE=${profile}: use tablet or one of ${Object.keys(TABLET_PROFILES).join(', ')}`);
}
const projects = !profile ? DEFAULT_PROJECTS : profile === 'tablet' ? Object.values(TABLET_PROFILES) : [TABLET_PROFILES[profile]];
const PROFILE_SUFFIX = profile ? `-${profile}` : '';

export default defineConfig({
  testDir: 'e2e',
  // Flaky = broken: no retries, fix the cause.
  retries: 0,
  fullyParallel: true,
  workers: process.env.CI ? 3 : 6,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  forbidOnly: !!process.env.CI,
  grepInvert: process.env.E2E_LIVE === '1' ? undefined : /@live/,
  reporter: process.env.CI ? [['list'], ['github']] : [['list'], ['json', { outputFile: `e2e-report/e2e${PROFILE_SUFFIX}.json` }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // The local server's certificate is self-signed.
    ignoreHTTPSErrors: local,
    screenshot: 'only-on-failure',
  },
  projects,
  webServer: local
    ? { command: `node e2e/serve.mjs ${port} dist`, url: baseURL, ignoreHTTPSErrors: true, reuseExistingServer: !process.env.CI, timeout: 30_000 }
    : undefined,
});
