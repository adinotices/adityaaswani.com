// Proves what is really deployed (FEATURES.md DEPLOY-06, DEPLOY-07, ESSAY-08; BOX-RULES "Deploys must
// prove the artefact changed"). Every page built by the deploy workflow carries
//   <meta name="build" content="<commit sha> <ISO build time>">
// and the nightly compares the live page with main:
//   node scripts/check-deploy-marker.mjs https://adityaaswani.com   (run in a checkout of main)
// A 200 from prod proves nothing: the marker shows which commit is served and how old the build is, so
// a deploy that failed or a Monday rebuild that never ran (GitHub turns schedules off on quiet repos) fails.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEPLOY_GRACE_MIN = 60; // a merge may still be deploying
export const MAX_BUILD_AGE_DAYS = 8; // the Monday rebuild, plus a day for GitHub's late schedules

export function parseMarker(html) {
  const m = html.match(/<meta name="build" content="([0-9a-f]{40}) ([^"]+)"/);
  if (!m || Number.isNaN(Date.parse(m[2]))) return null;
  return { sha: m[1], builtAt: m[2] };
}

// Pure: { ok, detail }.
export function verdict({ marker, headSha, headTime, now }) {
  const headAgeMin = (now - headTime) / 60_000;
  const grace = headAgeMin < DEPLOY_GRACE_MIN;
  if (!marker) {
    return grace
      ? { ok: true, detail: `no build marker yet; ${headSha.slice(0, 7)} merged ${Math.round(headAgeMin)} min ago, deploy in progress` }
      : { ok: false, detail: 'the live site has no build marker' };
  }
  if (marker.sha !== headSha) {
    const detail = `the live site is ${marker.sha.slice(0, 7)}, main is ${headSha.slice(0, 7)} (merged ${Math.round(headAgeMin)} min ago)`;
    return { ok: grace, detail: grace ? `${detail}: deploy in progress` : `${detail}: the deploy did not land` };
  }
  const ageDays = (now - Date.parse(marker.builtAt)) / 864e5;
  if (ageDays > MAX_BUILD_AGE_DAYS) {
    return { ok: false, detail: `the live build is ${ageDays.toFixed(1)} days old: the Monday rebuild did not run` };
  }
  return { ok: true, detail: `live ${marker.sha.slice(0, 7)} equals main, built ${marker.builtAt} (${ageDays.toFixed(1)} days ago)` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.argv[2];
  if (!url) {
    console.error('usage: check-deploy-marker.mjs <live url>');
    process.exit(2);
  }
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  const r = verdict({
    marker: parseMarker(await res.text()),
    headSha: git('rev-parse', 'HEAD'),
    headTime: Number(git('log', '-1', '--format=%ct')) * 1000,
    now: Date.now(),
  });
  console.log(`deploy marker: ${r.detail}`);
  process.exit(r.ok ? 0 : 1);
}
