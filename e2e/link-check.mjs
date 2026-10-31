// Link-rot probe for EXT-02 (docs/testing/FEATURES.md). Kept apart from the spec so the retry rule has a
// unit test (tests/link-check.test.mjs) with a stubbed request instead of real third-party hosts.
//
// A link is good when it answers below 400 (redirects are followed by the caller's request).
// A 5xx or a network error is retried once after `retryDelayMs`: upstreams answer 500 for a moment
// (Apple Podcasts in the 2026-10-31 nightly, 301 again a minute later), which is not link rot.
// A 4xx (404, 410, ...) fails at once: that is the rot this test exists to catch.

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// `get(url)` resolves to the HTTP status (a number) or rejects on a network error / timeout.
// Resolves to the status, or the error message when the request never got an answer.
async function statusOf(get, url) {
  try {
    return await get(url);
  } catch (e) {
    return e?.message ?? String(e);
  }
}

const ok = (s) => typeof s === 'number' && s < 400;
const retryable = (s) => typeof s !== 'number' || s >= 500;

export async function probeLink(get, url, { retryDelayMs = 2_000, sleep = defaultSleep } = {}) {
  let s = await statusOf(get, url);
  if (!ok(s) && retryable(s)) {
    await sleep(retryDelayMs);
    s = await statusOf(get, url);
  }
  return { url, status: s, ok: ok(s) };
}

// Returns one "<status> <url>" line per bad link, in input order, so the assertion lists them all.
export async function findBadLinks(urls, get, opts) {
  const bad = [];
  for (const u of urls) {
    const r = await probeLink(get, u, opts);
    if (!r.ok) bad.push(`${r.status} ${u}`);
  }
  return bad;
}
