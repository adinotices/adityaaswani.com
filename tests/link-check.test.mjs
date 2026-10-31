// EXT-02 retry rule (docs/testing/FEATURES.md): a 5xx or network error is retried once, a 4xx fails at once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probeLink, findBadLinks } from '../e2e/link-check.mjs';

// A stubbed request that answers from a script, one entry per call; an Error entry rejects.
function stub(...answers) {
  const calls = [];
  const get = async (url) => {
    calls.push(url);
    const a = answers.shift();
    if (a instanceof Error) throw a;
    return a;
  };
  return { get, calls };
}
const sleeps = [];
const sleep = async (ms) => { sleeps.push(ms); };
const U = 'https://podcasts.apple.com/us/podcast/x/id1';

test('500 then 301 passes after one retry 2 s later', async () => {
  sleeps.length = 0;
  const { get, calls } = stub(500, 301);
  assert.deepEqual(await probeLink(get, U, { sleep }), { url: U, status: 301, ok: true });
  assert.equal(calls.length, 2);
  assert.deepEqual(sleeps, [2000]);
});

test('404 fails at once, without a retry', async () => {
  sleeps.length = 0;
  const { get, calls } = stub(404, 200);
  assert.deepEqual(await probeLink(get, U, { sleep }), { url: U, status: 404, ok: false });
  assert.equal(calls.length, 1);
  assert.deepEqual(sleeps, []);
});

test('410 fails at once too', async () => {
  const { get, calls } = stub(410, 200);
  assert.equal((await probeLink(get, U, { sleep })).ok, false);
  assert.equal(calls.length, 1);
});

test('a network error then 200 passes; two network errors fail with the message', async () => {
  let s = stub(new Error('getaddrinfo EAI_AGAIN'), 200);
  assert.equal((await probeLink(s.get, U, { sleep })).ok, true);
  s = stub(new Error('timeout'), new Error('Timeout 20000ms exceeded'));
  assert.deepEqual(await probeLink(s.get, U, { sleep }), { url: U, status: 'Timeout 20000ms exceeded', ok: false });
  assert.equal(s.calls.length, 2);
});

test('500 twice fails, and only one retry is made', async () => {
  const { get, calls } = stub(500, 503, 200);
  assert.deepEqual(await probeLink(get, U, { sleep }), { url: U, status: 503, ok: false });
  assert.equal(calls.length, 2);
});

test('findBadLinks lists every bad link, in order', async () => {
  const answers = { 'https://a/': [200], 'https://b/': [404], 'https://c/': [500, 302], 'https://d/': [502, 500] };
  const get = async (u) => answers[u].shift();
  assert.deepEqual(await findBadLinks(new Set(Object.keys(answers)), get, { sleep }), ['404 https://b/', '500 https://d/']);
});
