// Offline checks for scripts/engine-version-freshness.mjs: a README that lags the
// activated engine fails naming the file, the version found and the version
// expected; a matching one passes; mid-release accepts either answer and nothing
// older; a network answer is retried once; the historical mentions are never
// judged. No network: the pin and npm answers below are recorded shapes.
//   node --test scripts/engine-version-freshness.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshnessProblems, getJson, NPM_LATEST_URL, PIN_URL, PLACES, readPlaces, run } from './engine-version-freshness.mjs';

// The README's three reader-facing places, plus the lineage paragraph's old
// versions, which must never be judged.
const readme = (v) => [
  '# fixture',
  '',
  'published as `@odinlabs-ai/engineering-blueprint` 0.2.0–0.17.1 on a private registry; the public',
  '`bce-engine` restarted the version line at 0.1.0. An old run used bce-engine@0.3.1.',
  '',
  '```bash',
  `npx --yes --package=bce-engine@${v} -- bce demo --recipe module-layering   # GREEN, then RED`,
  '```',
  '',
  '```bash',
  `git clone --depth 1 --branch v${v} https://github.com/blueprint-conformance/bce.git`,
  'cd bce',
  '```',
  '',
  `The engine's [\`corpus/CORPUS-MAP.md\`](https://github.com/blueprint-conformance/bce/blob/v${v}/corpus/CORPUS-MAP.md)`,
  '',
].join('\n');

function fakeFetch({ pin, latest }) {
  return async (url) => {
    if (url === PIN_URL) return { ok: true, status: 200, json: async () => ({ package: 'bce-engine', pin }) };
    if (url === NPM_LATEST_URL) return { ok: true, status: 200, json: async () => ({ name: 'bce-engine', version: latest }) };
    throw new Error(`unexpected fetch ${url}`);
  };
}

async function check(text, versions) {
  const root = mkdtempSync(join(tmpdir(), 'engine-version-freshness-'));
  try {
    writeFileSync(join(root, 'README.md'), text);
    const out = [];
    const err = [];
    const code = await run({ root, fetchImpl: fakeFetch(versions), out: (s) => out.push(s), err: (s) => err.push(s) });
    return { code, out: out.join('\n'), err: err.join('\n') };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('a README that lags the activated engine fails at all three places, naming file, found and expected', async () => {
  const r = await check(readme('0.6.2'), { pin: '0.6.3', latest: '0.6.3' });
  assert.equal(r.code, 1);
  assert.match(r.err, /::error file=README\.md,.*demo command .*: found 0\.6\.2, expected 0\.6\.3/);
  assert.match(r.err, /engine clone line .*: found 0\.6\.2, expected 0\.6\.3/);
  assert.match(r.err, /CORPUS-MAP link .*: found 0\.6\.2, expected 0\.6\.3/);
});

test('a README that matches the activated engine passes, and the historical versions are not judged', async () => {
  const r = await check(readme('0.6.3'), { pin: '0.6.3', latest: '0.6.3' });
  assert.equal(r.code, 0, r.err);
  assert.equal(r.err, '');
  assert.match(r.out, /every place states 0\.6\.3/);
});

test('one lagging place out of three is enough to fail', async () => {
  const r = await check(readme('0.6.3').replace('--branch v0.6.3', '--branch v0.6.2'), { pin: '0.6.3', latest: '0.6.3' });
  assert.equal(r.code, 1);
  assert.match(r.err, /engine clone line .*: found 0\.6\.2/);
  assert.doesNotMatch(r.err, /demo command|CORPUS-MAP/);
});

test('mid-release (npm latest differs from the pin) passes with a notice when the README states either answer', async () => {
  for (const v of ['0.6.3', '0.6.4']) {
    const r = await check(readme(v), { pin: '0.6.4', latest: '0.6.3' });
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /::notice .*mid-release: main pins 0\.6\.4, npm latest is 0\.6\.3/);
  }
});

test('mid-release never hides a README that lags both the pin and npm latest', async () => {
  const r = await check(readme('0.6.2'), { pin: '0.6.4', latest: '0.6.3' });
  assert.equal(r.code, 1);
  assert.match(r.err, /demo command .*: found 0\.6\.2, expected 0\.6\.4 or 0\.6\.3/);
  assert.match(r.err, /engine clone line .*: found 0\.6\.2, expected 0\.6\.4 or 0\.6\.3/);
  assert.match(r.err, /CORPUS-MAP link .*: found 0\.6\.2, expected 0\.6\.4 or 0\.6\.3/);
});

test('mid-release never hides a place the check can no longer find', async () => {
  const r = await check(readme('0.6.4').replace(/^npx .*$/m, 'npx bce demo'), { pin: '0.6.4', latest: '0.6.3' });
  assert.equal(r.code, 1);
  assert.match(r.err, /demo command .*: no bce-engine version found/);
});

test('a place the check can no longer find fails instead of passing on nothing', async () => {
  const r = await check(readme('0.6.3').replace(/^npx .*$/m, 'npx bce demo'), { pin: '0.6.3', latest: '0.6.3' });
  assert.equal(r.code, 1);
  assert.match(r.err, /demo command .*: no bce-engine version found/);
  assert.equal(freshnessProblems([{ file: 'f', where: 'w', versions: [] }], '1.0.0').length, 1);
});

test('an answer that is not a version fails', async () => {
  const r = await check(readme('0.6.3'), { pin: '0.6.3', latest: null });
  assert.equal(r.code, 1);
  assert.match(r.err, /npm latest for bce-engine is null, not a version/);
});

test('the real README states exactly one engine version at each place, and it is the same at all three', () => {
  const found = readPlaces((file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  assert.equal(found.length, PLACES.length);
  for (const { where, versions } of found) assert.equal(versions.length, 1, `${where}: ${versions}`);
  assert.equal(new Set(found.flatMap((f) => f.versions)).size, 1, JSON.stringify(found));
});

test('a network answer that fails once is retried once; failing twice still fails loudly, naming both tries', async () => {
  let calls = 0;
  const flaky = async () => (++calls === 1 ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ pin: '0.6.4' }) });
  assert.deepEqual(await getJson(flaky, PIN_URL, 0), { pin: '0.6.4' });
  assert.equal(calls, 2);
  calls = 0;
  const down = async () => { calls++; throw new Error('ECONNRESET'); };
  await assert.rejects(getJson(down, PIN_URL, 0), /ECONNRESET \(and on the first try: ECONNRESET\)/);
  assert.equal(calls, 2);
  await assert.rejects(run({ root: '.', fetchImpl: down, retryMs: 0, out: () => {}, err: () => {} }), /ECONNRESET/);
});
