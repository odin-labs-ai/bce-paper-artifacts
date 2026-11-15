#!/usr/bin/env node
// =============================================================================
// engine version freshness: the README's engine version must be the one bce
// activated.
//
// README.md tells a reader which bce-engine to run in three places: the
// `npx --package=bce-engine@X` demo command, the `git clone --branch vX` line of
// the pinned recall re-run, and the link to the engine's corpus/CORPUS-MAP.md at
// tag vX. When bce activated 0.6.3 all three still said 0.6.2 for a day (fixed in
// #8), because nothing compared them with the engine. This does.
//
// The expected version is bce main's `.engine-pin.json` "pin" (the activated
// release), read over HTTPS from the public repository; npm `latest` for
// bce-engine must agree with it. When the two differ, bce is mid-release: the
// README may state either answer (a notice says so), but a README that lags BOTH,
// or a place the check cannot find, still fails. The grace is bounded by the two
// live answers, not by time, so a long disagreement never hides an older README.
//
// Only those reader-facing places are read. Dated, historical mentions are left
// alone on purpose: evidence/*.SANITIZED.md and the rest of evidence/ record what
// a past run used, and the README's lineage paragraph names old version ranges.
//
//   node scripts/engine-version-freshness.mjs
//     (network: raw.githubusercontent.com, registry.npmjs.org; no token; each
//      read is retried once after a short backoff, then fails loudly)
// Exit codes: 0 every place states the activated version (or, mid-release, the
//               pin or npm latest);
//             1 a place lags (or moved), or the pin / npm answer is unusable.
// =============================================================================
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PIN_URL = 'https://raw.githubusercontent.com/blueprint-conformance/bce/main/.engine-pin.json';
export const NPM_LATEST_URL = 'https://registry.npmjs.org/bce-engine/latest';
const SEMVER = '[0-9]+[.][0-9]+[.][0-9]+(?:-[0-9A-Za-z.-]+)?';
const IS_SEMVER = new RegExp(`^${SEMVER}$`);

// The places a reader reads the version to use. Each must yield at least one
// version, and every version found must be an accepted one.
export const PLACES = [
  { file: 'README.md', where: 'demo command (npx --package=bce-engine@X)', pattern: new RegExp(`npx --yes --package=bce-engine@(${SEMVER}) -- bce demo`, 'g') },
  { file: 'README.md', where: 'engine clone line (git clone --branch vX)', pattern: new RegExp(`git clone [^\n]*--branch v(${SEMVER}) https://github[.]com/blueprint-conformance/bce[.]git`, 'g') },
  { file: 'README.md', where: 'CORPUS-MAP link (bce/blob/vX)', pattern: new RegExp(`https://github[.]com/blueprint-conformance/bce/blob/v(${SEMVER})/corpus/CORPUS-MAP[.]md`, 'g') },
];

/** Every version each place states: [{ file, where, versions }]. `read(file)` returns the file's text. */
export function readPlaces(read, places = PLACES) {
  return places.map(({ file, where, pattern }) => ({ file, where, versions: [...read(file).matchAll(pattern)].map((m) => m[1]) }));
}

/** Every way the places disagree with `expected`, a version or a list of acceptable versions (empty when they all state one). */
export function freshnessProblems(found, expected) {
  const accepted = [expected].flat();
  const want = accepted.join(' or ');
  const why = accepted.length > 1 ? 'bce is mid-release: main .engine-pin.json pin or npm latest' : 'bce main .engine-pin.json pin, which npm latest matches';
  const problems = [];
  for (const { file, where, versions } of found) {
    if (!versions.length) problems.push({ file, message: `${file}, ${where}: no bce-engine version found. The place moved or its wording changed; update PLACES in scripts/engine-version-freshness.mjs so the check reads what readers read.` });
    for (const v of new Set(versions)) if (!accepted.includes(v)) problems.push({ file, message: `${file}, ${where}: found ${v}, expected ${want} (${why}).` });
  }
  return problems;
}

async function getJsonOnce(fetchImpl, url) {
  const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET ${url} answered ${res.status}`);
  return res.json();
}

/** One GET with one retry after `retryMs` (a registry or CDN hiccup); a second failure throws, naming both attempts. */
export async function getJson(fetchImpl, url, retryMs = 5000) {
  try {
    return await getJsonOnce(fetchImpl, url);
  } catch (first) {
    await new Promise((r) => setTimeout(r, retryMs));
    try {
      return await getJsonOnce(fetchImpl, url);
    } catch (second) {
      throw new Error(`${second.message} (and on the first try: ${first.message})`);
    }
  }
}

/** The whole check. Returns the exit code; writes GitHub Actions annotations through `out` and `err`. */
export async function run({ root = '.', fetchImpl = fetch, out = console.log, err = console.error, retryMs = 5000 } = {}) {
  const pin = (await getJson(fetchImpl, PIN_URL, retryMs))?.pin;
  const latest = (await getJson(fetchImpl, NPM_LATEST_URL, retryMs))?.version;
  for (const [name, v] of [['bce main .engine-pin.json pin', pin], ['npm latest for bce-engine', latest]]) {
    if (typeof v !== 'string' || !IS_SEMVER.test(v)) { err(`::error title=engine version freshness::${name} is ${JSON.stringify(v)}, not a version`); return 1; }
  }
  const found = readPlaces((file) => readFileSync(join(root, file), 'utf8'));
  const midRelease = pin !== latest;
  if (midRelease) out(`::notice title=engine version freshness::bce is mid-release: main pins ${pin}, npm latest is ${latest}. The README may state either until the two agree; a README older than both still fails.`);
  const problems = freshnessProblems(found, midRelease ? [pin, latest] : pin);
  for (const { file, message } of problems) err(`::error file=${file},title=engine version freshness::${message}`);
  if (problems.length) return 1;
  for (const { file, where, versions } of found) out(`${file}, ${where}: ${[...new Set(versions)].join(', ')}`);
  out(midRelease
    ? `engine version freshness: every place states ${pin} or ${latest} (bce is mid-release: main pin or npm latest)`
    : `engine version freshness: every place states ${pin}, the activated bce-engine (pin and npm latest agree)`);
  return 0;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  process.exitCode = await run().catch((e) => { console.error(`::error title=engine version freshness::${e.message}`); return 1; });
}
