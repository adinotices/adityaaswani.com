// .github/workflows (FEATURES.md DEPLOY-09): every action is pinned to a commit SHA with its release
// tag in a comment, and one action is pinned to the same release everywhere (AA-S15).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const dir = new URL('../.github/workflows/', import.meta.url);
const uses = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).flatMap((f) =>
  readFileSync(new URL(f, dir), 'utf8').split('\n')
    .map((line, i) => ({ where: `${f}:${i + 1}`, m: line.match(/^\s*(?:-\s+)?uses:\s*(\S+?)@(\S+)(.*)$/) }))
    .filter((u) => u.m)
    .map(({ where, m }) => ({ where, action: m[1], ref: m[2], comment: m[3].trim() })));

test('every action in the workflows is pinned to a full commit SHA with a # vX.Y.Z comment', () => {
  assert.ok(uses.length >= 10, `only ${uses.length} uses: lines found`);
  const bad = uses.filter((u) => !/^[0-9a-f]{40}$/.test(u.ref) || !/^# v\d+\.\d+\.\d+$/.test(u.comment));
  assert.deepEqual(bad.map((u) => `${u.where}: ${u.action}@${u.ref} ${u.comment}`), []);
});

test('each action is pinned to one SHA and one release across the workflows', () => {
  const pins = new Map();
  for (const u of uses) pins.set(u.action, (pins.get(u.action) ?? new Set()).add(`${u.ref} ${u.comment}`));
  const split = [...pins].filter(([, s]) => s.size > 1).map(([a, s]) => `${a}: ${[...s].join(' | ')}`);
  assert.deepEqual(split, []);
});

// DEPLOY-13 (#49): the self-hosted runner is shared by five repos, so a hung job must end by itself.
test('every job in every workflow has its own timeout-minutes', () => {
  const missing = [];
  for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
    const jobs = readFileSync(new URL(f, dir), 'utf8').split(/^jobs:$/m)[1];
    const blocks = jobs.split(/^(?=  [a-z][a-z0-9_-]*:$)/m).filter((b) => b.trim());
    assert.ok(blocks.length >= 2, `${f}: only ${blocks.length} jobs parsed`);
    for (const b of blocks) if (!/^    timeout-minutes: \d+$/m.test(b)) missing.push(`${f}: ${b.split('\n')[0].trim()}`);
  }
  assert.deepEqual(missing, []);
});

// DEPLOY-08: the self-hosted runner keeps old Node builds in its tool cache, so a bare "22" resolved
// to 22.23.3 and astro 7.4.2 (engines >= 22.23.4) failed on dependabot #37 (2026-10-26).
test('every setup-node takes the newest release of its line (check-latest: true)', () => {
  const steps = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).flatMap((f) =>
    readFileSync(new URL(f, dir), 'utf8').split(/\n(?=\s*- (?:name|uses|run):)/)
      .filter((s) => /uses:\s*actions\/setup-node@/.test(s))
      .map((s) => ({ f, s })));
  assert.ok(steps.length >= 3, `only ${steps.length} setup-node steps found`);
  assert.deepEqual(steps.filter(({ s }) => !/^\s*check-latest:\s*true\s*$/m.test(s)).map(({ f }) => f), []);
});

// DEPLOY-11 (AA-S18): #49's `cancel-in-progress: true` in e2e.yml also applied to pushes to main, so
// 5dccd63's merge cancelled phone-webkit on 128f961 (run 40897311377). Only stale PR runs may be cancelled.
test('pushes to main are never cancelled in progress (cancel-in-progress only for pull_request)', () => {
  const lines = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).flatMap((f) =>
    readFileSync(new URL(f, dir), 'utf8').split('\n')
      .map((line, i) => ({ where: `${f}:${i + 1}`, m: line.match(/^\s*cancel-in-progress:\s*(.+?)\s*$/) }))
      .filter((l) => l.m));
  assert.ok(lines.length >= 2, `only ${lines.length} cancel-in-progress: lines found`);
  const ok = new Set(['false', "${{ github.event_name == 'pull_request' }}"]);
  assert.deepEqual(lines.filter((l) => !ok.has(l.m[1])).map((l) => `${l.where}: ${l.m[1]}`), []);
});

// DEPLOY-12 (AA-S20): the four E2E contexts are required checks (AA-S6), so they must report on a
// docs-only PR. A trigger-level paths-ignore never starts them; a matrix job skipped by `if` reports one
// check named `E2E (${{ matrix.name }})` (probe run 41129264256), so the contexts stay "Expected".
const e2eYml = readFileSync(new URL('e2e.yml', dir), 'utf8');
const e2eJobs = Object.fromEntries(e2eYml.slice(e2eYml.indexOf('\njobs:\n')).split(/\n(?=  [a-z0-9-]+:\n)/).slice(1)
  .map((block) => [block.match(/^  ([a-z0-9-]+):/)[1], block]));
const required = ['chromium', 'firefox', 'desktop-webkit', 'phone-webkit'];

test('e2e.yml has no trigger-level paths filter', () => {
  assert.doesNotMatch(e2eYml.slice(0, e2eYml.indexOf('\njobs:\n')), /paths(-ignore)?:/);
});

test('each required E2E context is its own job (no matrix), gated on changes', () => {
  assert.doesNotMatch(e2eYml, /^\s*strategy:/m);
  for (const lane of required) {
    const job = e2eJobs[`e2e-${lane}`];
    assert.ok(job, `no e2e-${lane} job`);
    assert.match(job, new RegExp(`^    name: E2E \\(${lane}\\)$`, 'm'));
    assert.match(job, /^    needs: changes$/m);
    // !cancelled and != 'false': if `changes` itself fails, E2E runs. With a plain == 'true' the jobs
    // would be skipped, and skipped passes a required check.
    assert.ok(job.includes(`if: \${{ !cancelled() && needs.changes.outputs.code != 'false' && github.actor != 'dependabot[bot]' }}`), lane);
  }
});

test('the changes job fetches full history and the feature matrix job does not depend on it', () => {
  assert.match(e2eJobs.changes, /fetch-depth: 0/);
  assert.doesNotMatch(e2eJobs.matrix, /needs:/);
});

// Runs the job's real shell block (bash -e, as Actions does) on a throwaway repo.
function changesOutput(event, files, extra = () => {}) {
  const script = e2eJobs.changes.match(/run: \|\n((?: {10}.*\n?)+)/)[1].replace(/^ {10}/gm, '');
  const cwd = mkdtempSync(join(tmpdir(), 'aa-s20-'));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd, stdio: 'pipe' });
  try {
    git('init', '-q', '-b', 'main');
    writeFileSync(join(cwd, 'a.txt'), 'a');
    mkdirSync(join(cwd, 'src'));
    writeFileSync(join(cwd, 'src/page.astro'), 'page');
    git('add', '-A');
    git('commit', '-qm', 'base');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    for (const f of files) {
      mkdirSync(dirname(join(cwd, f)), { recursive: true });
      writeFileSync(join(cwd, f), 'x');
    }
    extra(git);
    git('add', '-A');
    git('commit', '-qm', 'change', '--allow-empty');
    const out = join(cwd, '.output');
    execFileSync('bash', ['-e', '-c', script], { cwd, stdio: 'pipe', env: { ...process.env, EVENT: event, BASE: 'main', GITHUB_OUTPUT: out } });
    return readFileSync(out, 'utf8').trim();
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('changes: code=false only when every changed file is **.md or docs/**', () => {
  for (const event of ['pull_request', 'push']) {
    assert.equal(changesOutput(event, ['README.md']), 'code=false', event);
    assert.equal(changesOutput(event, ['docs/testing/FEATURES.md', 'docs/shot.png', 'scripts/x/README.md']), 'code=false', event);
    assert.equal(changesOutput(event, ['docs/a.md', 'src/b.astro']), 'code=true', event);
    assert.equal(changesOutput(event, ['.github/workflows/e2e.yml']), 'code=true', event);
    assert.equal(changesOutput(event, ['docsite/a.txt']), 'code=true', event);
    assert.equal(changesOutput(event, ['notes.md.bak']), 'code=true', event);
  }
});

test('changes: a rename out of code, an empty diff and a manual run all still run E2E', () => {
  assert.equal(changesOutput('pull_request', [], (git) => { git('mv', 'src/page.astro', 'page.md'); }), 'code=true');
  assert.equal(changesOutput('pull_request', []), 'code=true');
  assert.equal(changesOutput('workflow_dispatch', ['README.md']), 'code=true');
});

// DEPLOY-10 (AA-S21): a busy runner gives each repo a fixed CPU share, so 2 WebKit workers each ran on half
// of it and tests hit the 30 s timeout. The config keys off PW_ENGINE, so the jobs must keep setting it.
const workersFor = (env) => {
  const { CI, PW_ENGINE, ...rest } = process.env;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e',
    "console.log((await import('./playwright.config.mjs')).default.workers)"],
  { cwd: new URL('..', import.meta.url), env: { ...rest, ...env }, encoding: 'utf8' });
  return Number(out.trim());
};

test('WebKit runs one worker on CI; other engines two; the box six', () => {
  assert.equal(workersFor({ CI: 'true', PW_ENGINE: 'webkit' }), 1);
  assert.equal(workersFor({ CI: 'true', PW_ENGINE: 'chromium' }), 2);
  assert.equal(workersFor({ CI: 'true', PW_ENGINE: 'firefox' }), 2);
  assert.equal(workersFor({}), 6);
});

test('both WebKit E2E jobs set PW_ENGINE: webkit, which the one-worker rule keys off', () => {
  const yml = readFileSync(new URL('e2e.yml', dir), 'utf8');
  for (const job of ['e2e-desktop-webkit', 'e2e-phone-webkit']) {
    const block = yml.slice(yml.indexOf(`  ${job}:`)).split(/\n\n/)[0];
    assert.match(block, /env: \{ PW_ENGINE: webkit,/, job);
  }
});

// DEPLOY-15 (audit 2026-11-10 A1/A2, HIGH): ci-runner-1 is persistent, shared with five private repos and
// the `ci` user has passwordless sudo, so a fork PR or a Dependabot bump (whose npm ci runs install scripts)
// must never run there. Pull requests from forks or bots go to GitHub's throwaway ubuntu-latest VMs (free on
// a public repo); pushes, the schedule, manual runs and same-repo PRs by people keep the self-hosted runner.
const workflowJobs = (f) => {
  const yml = readFileSync(new URL(f, dir), 'utf8');
  return Object.fromEntries(yml.slice(yml.indexOf('\njobs:\n')).split(/\n(?=  [a-z0-9-]+:\n)/).slice(1)
    .map((block) => [block.match(/^  ([a-z0-9-]+):/)[1], block]));
};
const SELF_HOSTED = ['self-hosted', 'linux', 'gcp'];
// The one runs-on expression every job a pull_request can start must use (e2e.yml: first job defines &runner).
const runnerExpr = (f) => {
  const m = readFileSync(new URL(f, dir), 'utf8').match(/^    runs-on: (?:&runner )?\$\{\{ (.+) \}\}$/m);
  assert.ok(m, `${f}: no "runs-on: \${{ ... }}" line`);
  return m[1];
};
// Evaluates a GitHub expression for one event: enough of the language for runs-on (==, !=, &&, ||, !,
// endsWith, fromJSON, string literals, property access that yields null on a missing object).
function evalExpr(expr, github) {
  const js = expr
    .replace(/\bgithub((?:\.[a-z_]+)+)/g, (_, path) => `github${path.replace(/\./g, '?.')}`)
    .replace(/==/g, '===').replace(/!===/g, '!==');
  const endsWith = (s, t) => String(s ?? '').toLowerCase().endsWith(String(t).toLowerCase());
  return new Function('github', 'endsWith', 'fromJSON', `return (${js});`)(github, endsWith, JSON.parse);
}
const pr = ({ head = 'adinotices/adityaaswani.com', author = 'adinotices', actor = author } = {}) => ({
  event_name: 'pull_request', repository: 'adinotices/adityaaswani.com', actor,
  event: { pull_request: { head: { repo: head === null ? null : { full_name: head } }, user: { login: author } } },
});
const runnerCases = [
  ['push to main', { event_name: 'push', repository: 'adinotices/adityaaswani.com', actor: 'adinotices', event: {} }, SELF_HOSTED],
  ['weekly schedule', { event_name: 'schedule', repository: 'adinotices/adityaaswani.com', actor: 'adinotices', event: {} }, SELF_HOSTED],
  ['manual run', { event_name: 'workflow_dispatch', repository: 'adinotices/adityaaswani.com', actor: 'adinotices', event: {} }, SELF_HOSTED],
  ['same-repo PR by a person', pr(), SELF_HOSTED],
  ['fork PR', pr({ head: 'stranger/adityaaswani.com', author: 'stranger' }), 'ubuntu-latest'],
  ['fork PR whose fork was deleted', pr({ head: null, author: 'stranger' }), 'ubuntu-latest'],
  ['Dependabot PR', pr({ author: 'dependabot[bot]' }), 'ubuntu-latest'],
  ['Dependabot PR with a person\'s commit pushed on top (actor is the person)', pr({ author: 'dependabot[bot]', actor: 'adinotices' }), 'ubuntu-latest'],
  ['same-repo PR pushed to by a bot', pr({ actor: 'github-actions[bot]' }), 'ubuntu-latest'],
];

// Literal test names: feature-matrix.test looks up the names FEATURES.md cites as plain text.
function assertRunnerCases(f) {
  const expr = runnerExpr(f);
  for (const [name, github, want] of runnerCases) assert.deepEqual(evalExpr(expr, github), want, name);
}
function assertEveryPrJobUsesRunner(f) {
  for (const [name, job] of Object.entries(workflowJobs(f))) {
    const runsOn = job.match(/^    runs-on: (.+)$/m)[1];
    if (/^    if: github\.event_name != 'pull_request'$/m.test(job)) assert.equal(runsOn, '[self-hosted, linux, gcp]', `${f} ${name}`);
    else assert.ok(runsOn === '*runner' || runsOn.replace(/^&runner /, '') === `\${{ ${runnerExpr(f)} }}`, `${f} ${name}: ${runsOn}`);
  }
}
test('deploy.yml: fork and bot PRs run on ubuntu-latest, everything else on the self-hosted runner', () => assertRunnerCases('deploy.yml'));
test('e2e.yml: fork and bot PRs run on ubuntu-latest, everything else on the self-hosted runner', () => assertRunnerCases('e2e.yml'));
test('deploy.yml: every job a pull_request can start uses that runner (no bare self-hosted label)', () => assertEveryPrJobUsesRunner('deploy.yml'));
test('e2e.yml: every job a pull_request can start uses that runner (no bare self-hosted label)', () => assertEveryPrJobUsesRunner('e2e.yml'));

test('the runs-on expression is the same in deploy.yml and e2e.yml', () => {
  assert.equal(runnerExpr('deploy.yml'), runnerExpr('e2e.yml'));
});

// A3: the PR build job holds no Pages or OIDC token; only the deploy job (never run for a PR) may.
test('deploy.yml: pages/id-token write only on the deploy job, read-only everywhere else', () => {
  const yml = readFileSync(new URL('deploy.yml', dir), 'utf8');
  const top = yml.slice(0, yml.indexOf('\njobs:\n'));
  assert.match(top, /^permissions:\n  contents: read\n(?![ ])/m);
  const jobs = workflowJobs('deploy.yml');
  assert.match(jobs.build, /^    permissions:\n      contents: read\n      pages: read\n(?!      )/m);
  assert.match(jobs.deploy, /^    permissions:\n      contents: read\n      pages: write\n      id-token: write\n(?!      )/m);
  assert.match(jobs.deploy, /^    if: github\.event_name != 'pull_request'$/m);
  assert.equal((yml.match(/: write$/gm) ?? []).length, 2);
});

// The Playwright browser cache must not cross from ci-runner-1 into GitHub-hosted jobs (different distro).
test('e2e.yml: the Playwright cache key separates self-hosted from GitHub-hosted runners', () => {
  assert.match(readFileSync(new URL('e2e.yml', dir), 'utf8'), /^          key: playwright-\$\{\{ runner\.os \}\}-\$\{\{ runner\.environment \}\}-/m);
});

// Audit A7: expressions are expanded before the shell runs, so a run: line never carries ${{ }}; values go via env.
test('no run: line in any workflow interpolates ${{ }} directly', () => {
  const bad = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).flatMap((f) =>
    readFileSync(new URL(f, dir), 'utf8').split('\n').map((l, i) => ({ where: `${f}:${i + 1}`, l }))
      .filter(({ l }) => /^\s*(?:-\s+)?run:.*\$\{\{/.test(l)));
  assert.deepEqual(bad.map((b) => b.where), []);
});

// DEPLOY-14: ci-runner-1's disk filled with orphaned Docker volumes on 2026-11-01/02 and all six runners
// went offline for ~16 h. runner-housekeeping.yml prunes weekly and gauges the disk daily.
const hk = readFileSync(new URL('runner-housekeeping.yml', dir), 'utf8');
const hkJob = (name) => {
  const rest = hk.slice(hk.indexOf(`\n  ${name}:\n`) + 1);
  const next = rest.slice(1).search(/\n  [a-z][a-z0-9-]*:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
};
const hkSteps = (name) => hkJob(name).split(/\n(?=      - name:)/).slice(1);

test('housekeeping: weekly prune Sunday 05:30 UTC, daily gauge 05:00 UTC, manual run, never twice, self-hosted', () => {
  assert.match(hk, /^    - cron: '30 5 \* \* 0'/m);
  assert.match(hk, /^    - cron: '0 5 \* \* \*'/m);
  assert.match(hk, /^  workflow_dispatch:$/m);
  assert.match(hk, /^concurrency:\n  group: runner-housekeeping\n  cancel-in-progress: false$/m);
  assert.match(hkJob('prune'), /if: github\.event_name == 'workflow_dispatch' \|\| github\.event\.schedule == '30 5 \* \* 0'/);
  assert.match(hkJob('disk-gauge'), /if: github\.event_name == 'workflow_dispatch' \|\| github\.event\.schedule == '0 5 \* \* \*'/);
  for (const job of ['prune', 'disk-gauge']) assert.match(hkJob(job), /^    runs-on: \[self-hosted, linux, gcp\]$/m, job);
  assert.match(hkJob('disk-gauge'), /^    timeout-minutes: 2$/m);
  assert.doesNotMatch(hk, /ubuntu-latest|docker (?:system|network) prune/);
});

test('housekeeping: prunes only stopped/orphaned/dangling resources, sudo never prompts, every step has a timeout', () => {
  const runs = hk.split('\n').filter((l) => /docker \w+ prune/.test(l)).map((l) => l.trim());
  assert.deepEqual(runs, [
    'run: sudo -n docker container prune -f --filter until=1h',
    'run: sudo -n docker volume prune -f',
    'run: sudo -n docker image prune -f --filter until=1h',
    'run: sudo -n docker builder prune -f --keep-storage 10GB',
  ]);
  assert.doesNotMatch(hk.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n'), /\bsudo (?!-n )/);
  assert.doesNotMatch(hkJob('disk-gauge'), /prune/);
  for (const job of ['prune']) for (const s of hkSteps(job)) assert.match(s, /^        timeout-minutes: \d+$/m, s.split('\n')[0]);
  const after = hkSteps('prune').slice(-2);
  for (const s of after) assert.match(s, /^        if: always\(\)$/m, s.split('\n')[0]);
});

test('housekeeping: the gauge fails above 80 % and names the number', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gauge-'));
  try {
    for (const job of ['prune', 'disk-gauge']) {
      const step = hkSteps(job).find((s) => /Root disk at or below 80 %/.test(s));
      const script = step.slice(step.indexOf('run: |\n') + 7).split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n');
      for (const [pct, code] of [[12, 0], [80, 0], [81, 1], [100, 1]]) {
        writeFileSync(join(tmp, 'df'), `#!/bin/sh\nprintf 'Use%%\\n ${pct}%%\\n'\n`, { mode: 0o755 });
        let out = '', status = 0;
        try {
          out = execFileSync('bash', ['-e', '-c', script], { env: { ...process.env, PATH: `${tmp}:${process.env.PATH}`, GITHUB_STEP_SUMMARY: join(tmp, 'sum') }, encoding: 'utf8' });
        } catch (e) { status = e.status; out = e.stdout; }
        assert.equal(status, code, `${job} at ${pct}%`);
        if (code) assert.match(out, new RegExp(`::error title=ci-runner-1 disk ${pct}%::`), `${job} at ${pct}%`);
      }
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
