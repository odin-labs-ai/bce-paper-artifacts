#!/usr/bin/env node
/**
 * verify-chain.mjs — zero-dependency verifier for bce evidence records.
 *
 * Requires ONLY node (>= 18). No npm install, no engine, no network.
 *
 * Usage:
 *   node verify/verify-chain.mjs evidence/born-public
 *   node verify/verify-chain.mjs evidence/production-samples
 *   node verify/verify-chain.mjs <file.chain.jsonl | record.json | directory> [...more]
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
 *
 * Exit code: 0 = every content hash verified and every chain linked; 1 = any failure.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const GENESIS = '0'.repeat(64);

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

function report(ok, label, detail) {
  checked += 1;
  if (ok) {
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label} — ${detail}`);
  }
}

function verifyChainFile(file) {
  console.log(`chain: ${file}`);
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim().length > 0);
  let prev = GENESIS;
  lines.forEach((line, i) => {
    const rec = JSON.parse(line);
    const integrity = verifyRecordIntegrity(rec);
    report(integrity === null, `[${i}] ${rec.id ?? '(no id)'} integrity`, integrity ?? undefined);
    const linked = rec.previousHash === prev;
    report(linked, `[${i}] link`, linked ? undefined : `previousHash ${rec.previousHash} != prior hash ${prev}`);
    prev = rec.hash;
  });
  console.log(`  chain length ${lines.length}, anchored at genesis sentinel`);
}

function verifyStandaloneRecord(file) {
  console.log(`record: ${file}`);
  const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
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
  if (target.endsWith('.chain.jsonl')) return verifyChainFile(target);
  if (target.endsWith('.json') && !target.endsWith('-manifest.json')) {
    try {
      const obj = JSON.parse(fs.readFileSync(target, 'utf8'));
      if (looksLikeEvidenceRecord(obj)) return verifyStandaloneRecord(target);
    } catch {
      /* not a record — skip */
    }
  }
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('usage: node verify/verify-chain.mjs <chain.jsonl | record.json | directory> [...more]');
  process.exit(1);
}
for (const t of targets) walk(t);

console.log(`\n${checked} checks, ${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
