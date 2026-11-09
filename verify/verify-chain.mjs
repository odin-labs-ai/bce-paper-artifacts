#!/usr/bin/env node
/**
 * verify-chain.mjs — zero-dependency verifier for bce evidence records.
 *
 * Requires ONLY node (>= 18). No npm install, no engine, no network.
 *
 * Usage (from the repository root):
 *   node verify/verify-chain.mjs evidence/born-public
 *   node verify/verify-chain.mjs --expect-records 35 --expect-chains 4 evidence/born-public
 *   node verify/verify-chain.mjs evidence/production-samples
 *   node verify/verify-chain.mjs [--expect-records N] [--expect-chains M] <file.chain.jsonl | record.json | directory> [...more]
 *
 * What it checks (mirrors the engine's canonicalization exactly):
 *   1. RECORD INTEGRITY — for every record: strip `id` + `hash`, canonicalize the body
 *      (recursive key-sort, JSON.stringify(v, null, 2) + "\n"), SHA-256 it, and require the
 *      digest to equal the record's `hash`. Any edited field breaks this — which is why the
 *      artifact's redaction rule is whole-record exclusion, never field editing.
 *   2. CHAIN LINKAGE — for a *.chain.jsonl file: record[0].previousHash must be the genesis
 *      sentinel (64 zeros) and every record[i].previousHash must equal record[i-1].hash.
 *   3. STANDALONE RECORDS — a single *.json record is verified for RECORD INTEGRITY; if its
 *      previousHash is non-genesis and the predecessor is not in scope, the link is reported
 *      as LINK-UNVERIFIED (predecessor-not-shipped) — stated, never silently passed.
 *   4. CHAIN MANIFEST — when <name>.chain.jsonl sits beside <name>.chain-manifest.json, the
 *      chain length must equal the manifest length and record[i].id must equal
 *      manifest[i].recordId. Hashes and links alone cannot see records cut off the END of a
 *      chain (every surviving record still re-hashes and links). A manifest whose chain is
 *      missing is a failure too.
 *   5. NON-EMPTY — an empty chain file fails, and a run that verified nothing (0 checks, e.g.
 *      a wrong directory) fails. "0 checks, 0 failures" is not a pass.
 *   6. EXPECTED COUNTS — --expect-records N / --expect-chains M fail the run unless exactly N
 *      chained records in M chains were verified. The manifests are not authenticated, so a
 *      pinned count is the stronger check against a chain truncated together with its manifest.
 *
 * Scope: tamper-evidence is relative to the committed bytes (CHECKSUMS.txt / the git commit
 * SHA). The hashes are self-derived, so someone who edits a record AND recomputes every hash
 * after it (and the manifest) is not caught by this script alone; pin the commit and check
 * CHECKSUMS.txt for that.
 *
 * Exit code: 0 = every check passed; 1 = any failure (including "nothing verified");
 * 2 = usage error, or a path that does not exist (run from the repository root).
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const GENESIS = '0'.repeat(64);
const CHAIN_SUFFIX = '.chain.jsonl';
const MANIFEST_SUFFIX = '.chain-manifest.json';

function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

/** Exact replica of the engine's stableStringify (recursive key-sort, 2-space, trailing \n). */
function stableStringify(value) {
  const seen = new WeakSet();
  const sort = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) throw new Error('cannot serialize a cycle');
    seen.add(v);
    if (Array.isArray(v)) return v.map(sort);
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sort(v[k]);
    return out;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

/** Verify one record's content hash. Returns null on success, an error string on failure. */
function verifyRecordIntegrity(rec) {
  const { id, hash, ...body } = rec;
  void id;
  const derived = sha256(stableStringify(body));
  if (derived !== hash) return `content-hash mismatch: stored ${hash} != derived ${derived}`;
  return null;
}

let failures = 0;
let checked = 0;
let chainCount = 0;
let chainRecords = 0;
let standaloneCount = 0;

function report(ok, label, detail) {
  checked += 1;
  if (ok) {
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label} — ${detail}`);
  }
}

/** Compare a chain's record ids, in order, with its sibling <name>.chain-manifest.json. */
function checkChainManifest(file, ids) {
  const manifestFile = file.slice(0, -CHAIN_SUFFIX.length) + MANIFEST_SUFFIX;
  if (!fs.existsSync(manifestFile)) return;
  const name = path.basename(manifestFile);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  } catch (e) {
    report(false, `manifest ${name}`, `not valid JSON: ${e.message}`);
    return;
  }
  if (!Array.isArray(manifest)) {
    report(false, `manifest ${name}`, 'expected a JSON array of {index, recordId, ...}');
    return;
  }
  const lenOk = manifest.length === ids.length;
  report(
    lenOk,
    'manifest length',
    lenOk ? `${ids.length} records, as listed in ${name}` : `chain has ${ids.length} records, ${name} lists ${manifest.length}`
  );
  const mismatches = [];
  for (let i = 0; i < Math.max(manifest.length, ids.length); i++) {
    const want = manifest[i]?.recordId;
    if (want !== ids[i]) mismatches.push(`[${i}] chain ${ids[i] ?? '(missing)'} != manifest ${want ?? '(missing)'}`);
  }
  report(
    mismatches.length === 0,
    'manifest record ids, in order',
    mismatches.length
      ? `${mismatches.length} mismatch(es): ${mismatches.slice(0, 3).join('; ')}${mismatches.length > 3 ? '; …' : ''}`
      : undefined
  );
}

function verifyChainFile(file) {
  console.log(`chain: ${file}`);
  chainCount += 1;
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    report(false, 'chain non-empty', 'chain file has 0 records');
    checkChainManifest(file, []);
    return;
  }
  const ids = [];
  let prev = GENESIS;
  let anchored = false;
  lines.forEach((line, i) => {
    let rec;
    try {
      rec = JSON.parse(line);
    } catch (e) {
      report(false, `[${i}] parse`, `not valid JSON: ${e.message}`);
      ids.push(undefined);
      prev = undefined;
      return;
    }
    chainRecords += 1;
    ids.push(rec.id);
    const integrity = verifyRecordIntegrity(rec);
    report(integrity === null, `[${i}] ${rec.id ?? '(no id)'} integrity`, integrity ?? undefined);
    const linked = rec.previousHash === prev;
    report(linked, `[${i}] link`, linked ? undefined : `previousHash ${rec.previousHash} != prior hash ${prev}`);
    if (i === 0) anchored = linked;
    prev = rec.hash;
  });
  console.log(`  chain length ${lines.length}, ${anchored ? 'anchored at genesis sentinel' : 'NOT anchored at the genesis sentinel'}`);
  checkChainManifest(file, ids);
}

function verifyStandaloneRecord(file, rec) {
  console.log(`record: ${file}`);
  standaloneCount += 1;
  const integrity = verifyRecordIntegrity(rec);
  report(integrity === null, `${rec.id ?? path.basename(file)} integrity`, integrity ?? undefined);
  if (rec.previousHash === GENESIS) {
    console.log('  genesis record (no predecessor expected)');
  } else {
    console.log(`  LINK-UNVERIFIED: previousHash ${rec.previousHash.slice(0, 16)}… — predecessor record not shipped in this artifact (stated in EXCLUSIONS.md); content integrity above is the verified property`);
  }
}

function looksLikeEvidenceRecord(obj) {
  return obj && typeof obj === 'object' && obj.schemaVersion === '1' && typeof obj.hash === 'string' && typeof obj.previousHash === 'string';
}

function walk(target) {
  const st = fs.statSync(target);
  if (st.isDirectory()) {
    for (const entry of fs.readdirSync(target).sort()) walk(path.join(target, entry));
    return;
  }
  if (target.endsWith(CHAIN_SUFFIX)) return verifyChainFile(target);
  if (target.endsWith(MANIFEST_SUFFIX)) {
    // A manifest is checked from its chain. A manifest whose chain is gone is a failure.
    const chainFile = target.slice(0, -MANIFEST_SUFFIX.length) + CHAIN_SUFFIX;
    if (!fs.existsSync(chainFile)) {
      console.log(`manifest: ${target}`);
      report(false, 'chain present', `${path.basename(target)} lists a chain, but ${path.basename(chainFile)} is missing`);
    }
    return;
  }
  if (target.endsWith('.json') && !target.endsWith('-manifest.json')) {
    let obj;
    try {
      obj = JSON.parse(fs.readFileSync(target, 'utf8'));
    } catch {
      return; /* not JSON — not a record, skip */
    }
    if (looksLikeEvidenceRecord(obj)) verifyStandaloneRecord(target, obj);
  }
}

const USAGE =
  'usage: node verify/verify-chain.mjs [--expect-records N] [--expect-chains M] <chain.jsonl | record.json | directory> [...more]';
const targets = [];
const expect = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const m = /^--expect-(records|chains)(?:=(.*))?$/.exec(a);
  if (m) {
    const raw = m[2] ?? argv[++i];
    if (raw === undefined || !/^\d+$/.test(raw)) {
      console.error(`${m[0].split('=')[0]} needs a non-negative integer\n${USAGE}`);
      process.exit(2);
    }
    expect[m[1]] = Number(raw);
  } else if (a.startsWith('--')) {
    console.error(`unknown option ${a}\n${USAGE}`);
    process.exit(2);
  } else {
    targets.push(a);
  }
}
if (targets.length === 0) {
  console.error(USAGE);
  process.exit(2);
}
for (const t of targets) {
  if (!fs.existsSync(t)) {
    console.error(`not found: ${t} (run from the repository root, e.g. node verify/verify-chain.mjs evidence/born-public)`);
    process.exit(2);
  }
}
for (const t of targets) walk(t);

console.log('');
if (checked === 0) {
  failures += 1;
  console.error(`  FAIL  nothing verified — no *.chain.jsonl or evidence record found under: ${targets.join(', ')}`);
}
if (expect.records !== undefined) {
  report(chainRecords === expect.records, 'expected record count', `${chainRecords} chained record(s) verified, expected ${expect.records}`);
}
if (expect.chains !== undefined) {
  report(chainCount === expect.chains, 'expected chain count', `${chainCount} chain(s) verified, expected ${expect.chains}`);
}

console.log(`${chainRecords} records in ${chainCount} chains, ${standaloneCount} standalone records`);
console.log(`${checked} checks, ${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
